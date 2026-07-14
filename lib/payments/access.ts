import { hasFullReportAccess } from "../access";
import type { ScanRecord } from "../types";
import { isMatchingPaidReportSession, resolveStoredReportAccess } from "./accessContract";
import { getStripeServerConfig } from "./config";
import { fulfillVerifiedReportCheckout } from "./persistence";
import { retrieveCheckoutSession, type StripeCheckoutSession } from "./stripeApi";
import { hasActiveCustomerMonitoringEntitlement, hasActiveCustomerReportGrant } from "./customerEntitlement";

type ReportAccessScan = Pick<ScanRecord, "id" | "report_access">;

export type ReportPaymentAccessDependencies = {
  hasActiveGrant: (authUserId: string, scanId: string) => Promise<boolean>;
  retrieveSession: (secretKey: string, sessionId: string) => Promise<StripeCheckoutSession>;
  fulfillCheckout: (scanId: string, session: StripeCheckoutSession) => Promise<boolean>;
};

const defaultDependencies: ReportPaymentAccessDependencies = {
  hasActiveGrant: hasActiveCustomerReportGrant,
  retrieveSession: retrieveCheckoutSession,
  fulfillCheckout: fulfillVerifiedReportCheckout
};

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
  dependencies: Pick<ReportPaymentAccessDependencies, "retrieveSession" | "fulfillCheckout"> = defaultDependencies
): Promise<boolean> {
  if (!sessionId || !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(sessionId) || sessionId.length > 255) return false;
  try {
    const config = getStripeServerConfig();
    const session = await dependencies.retrieveSession(config.secretKey, sessionId);
    if (!isMatchingPaidReportSession(session, scanId, config.prices.report)) return false;
    return await dependencies.fulfillCheckout(scanId, session);
  } catch {
    return false;
  }
}
