import { hasFullReportAccess } from "../access";
import type { ScanRecord } from "../types";
import { isMatchingPaidReportSession, resolveStoredReportAccess } from "./accessContract";
import { getStripeServerConfig } from "./config";
import { fulfillVerifiedReportCheckout } from "./persistence";
import { retrieveCheckoutSession, type StripeCheckoutSession } from "./stripeApi";
import { hasActiveCustomerMonitoringEntitlement, hasActiveCustomerReportGrant } from "./customerEntitlement";

type ReportAccessScan = Pick<ScanRecord, "id" | "report_access">;
type ReportCheckoutOwner = { authUserId: string; accountId: string };
type ReportCheckoutReturn = { scanId: string; sessionId: string };

export type VerifiedReportCheckoutSignIn = {
  checkoutEmail: string;
  scanId: string;
};

export type ReportPaymentAccessDependencies = {
  hasActiveGrant: (authUserId: string, scanId: string) => Promise<boolean>;
  retrieveSession: (secretKey: string, sessionId: string) => Promise<StripeCheckoutSession>;
  fulfillCheckout: (
    scanId: string,
    session: StripeCheckoutSession,
    owner?: ReportCheckoutOwner
  ) => Promise<boolean>;
};

const defaultDependencies: ReportPaymentAccessDependencies = {
  hasActiveGrant: hasActiveCustomerReportGrant,
  retrieveSession: retrieveCheckoutSession,
  fulfillCheckout: fulfillVerifiedReportCheckout
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_PATTERN = /^cs_(test_|live_)?[A-Za-z0-9]+$/;

function reportCheckoutReturn(nextPath: string | undefined): ReportCheckoutReturn | null {
  if (
    !nextPath ||
    nextPath.length > 1_024 ||
    !nextPath.startsWith("/") ||
    nextPath.startsWith("//") ||
    nextPath.includes("\\")
  ) {
    return null;
  }

  try {
    const url = new URL(nextPath, "https://checkout-return.invalid");
    const reportPath = /^\/reports\/([^/]+)$/.exec(url.pathname);
    const scanId = reportPath?.[1] ?? "";
    const sessionIds = url.searchParams.getAll("session_id");
    const checkoutStates = url.searchParams.getAll("checkout");
    const hasOnlyExpectedParams = [...url.searchParams.keys()].every(
      (key) => key === "checkout" || key === "session_id"
    );
    if (
      url.hash ||
      !hasOnlyExpectedParams ||
      !UUID_PATTERN.test(scanId) ||
      checkoutStates.length !== 1 ||
      checkoutStates[0] !== "success" ||
      sessionIds.length !== 1 ||
      sessionIds[0].length > 255 ||
      !CHECKOUT_SESSION_PATTERN.test(sessionIds[0])
    ) {
      return null;
    }
    return { scanId, sessionId: sessionIds[0] };
  } catch {
    return null;
  }
}

export async function resolveVerifiedReportCheckoutSignIn(
  nextPath: string | undefined,
  dependencies: Pick<ReportPaymentAccessDependencies, "retrieveSession"> = defaultDependencies
): Promise<VerifiedReportCheckoutSignIn | null> {
  const checkoutReturn = reportCheckoutReturn(nextPath);
  if (!checkoutReturn) return null;

  try {
    const config = getStripeServerConfig();
    const session = await dependencies.retrieveSession(config.secretKey, checkoutReturn.sessionId);
    if (!isMatchingPaidReportSession(session, checkoutReturn.scanId, config.prices.report)) return null;
    return {
      checkoutEmail: session.customer_details!.email!.trim().toLowerCase(),
      scanId: checkoutReturn.scanId
    };
  } catch {
    return null;
  }
}

export async function hasServerReportAccess(
  access: string | undefined,
  scan: ReportAccessScan
): Promise<boolean> {
  return hasFullReportAccess(access, scan);
}

export async function hasCustomerServerReportAccess(
  access: string | undefined,
  scan: ReportAccessScan,
  authUserId?: string | null
): Promise<boolean> {
  const legacyAccess = await hasServerReportAccess(access, scan);
  try {
    if (await resolveStoredReportAccess(legacyAccess, authUserId, scan.id, defaultDependencies.hasActiveGrant)) {
      return true;
    }
    if (!authUserId) return false;
    return await hasActiveCustomerMonitoringEntitlement(authUserId, scan.id);
  } catch {
    return false;
  }
}

export async function verifyReportCheckoutHandoff(
  scanId: string,
  sessionId: string | undefined,
  owner?: ReportCheckoutOwner,
  dependencies: Pick<ReportPaymentAccessDependencies, "retrieveSession" | "fulfillCheckout"> = defaultDependencies
): Promise<boolean> {
  if (!sessionId || !CHECKOUT_SESSION_PATTERN.test(sessionId) || sessionId.length > 255) return false;
  try {
    const config = getStripeServerConfig();
    const session = await dependencies.retrieveSession(config.secretKey, sessionId);
    if (!isMatchingPaidReportSession(session, scanId, config.prices.report)) return false;
    return await dependencies.fulfillCheckout(scanId, session, owner);
  } catch {
    return false;
  }
}
