import type { StripeServerConfig } from "../payments/config.ts";
import {
  preparePaidReportDelivery,
  recordPaidReportDelivery,
  type PreparedPaidReportDelivery
} from "../payments/persistence.ts";
import { sendResendEmailRequest, type ResendRequestOptions } from "../monitoring/delivery.ts";
import {
  getScanLifecycleEmailConfig,
  type ScanLifecycleEmailConfig
} from "./scanLifecycle.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_PATTERN = /^cs_(test_|live_)?[A-Za-z0-9]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PaidReportFulfillment = {
  scanId: string;
  checkoutSessionId: string;
  recipientEmail: string;
};

export type PaidReportFulfillmentResult =
  | { status: "skipped" }
  | { status: "delivered"; deliveryId: string }
  | {
      status: "failed";
      failureCode: "persistence_failure" | "not_configured" | "identity_mismatch" | "provider_failure";
    };

type PaidReportDependencies = {
  prepare: (scanId: string, checkoutSessionId: string) => Promise<PreparedPaidReportDelivery | null>;
  record: typeof recordPaidReportDelivery;
  send: typeof sendPaidReportEmail;
  emailConfig: () => ScanLifecycleEmailConfig | null;
};

const defaultDependencies: PaidReportDependencies = {
  prepare: preparePaidReportDelivery,
  record: recordPaidReportDelivery,
  send: sendPaidReportEmail,
  emailConfig: getScanLifecycleEmailConfig
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

export function paidReportFulfillmentFromStripeEvent(
  event: Record<string, unknown>,
  config: StripeServerConfig
): PaidReportFulfillment | null {
  if (![
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded"
  ].includes(String(event.type ?? ""))) {
    return null;
  }
  if (config.prices.requireLivemode && event.livemode !== true) return null;

  const object = record(record(event.data)?.object);
  const metadata = record(object?.metadata);
  const customerDetails = record(object?.customer_details);
  const scanId = typeof metadata?.scan_id === "string" ? metadata.scan_id : "";
  const checkoutSessionId = typeof object?.id === "string" ? object.id : "";
  const recipientEmail = normalizedEmail(customerDetails?.email);
  if (
    object?.mode !== "payment"
    || object?.payment_status !== "paid"
    || metadata?.product !== "report"
    || metadata?.price_id !== config.prices.report
    || !UUID_PATTERN.test(scanId)
    || !CHECKOUT_SESSION_PATTERN.test(checkoutSessionId)
    || !recipientEmail
  ) {
    return null;
  }

  return { scanId, checkoutSessionId, recipientEmail };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function paidReportClaimUrl(config: ScanLifecycleEmailConfig, scanId: string): string {
  const nextPath = `/reports/${encodeURIComponent(scanId)}?claim=paid`;
  return `${config.appUrl}/auth/sign-in?next=${encodeURIComponent(nextPath)}`;
}

export function sendPaidReportEmail(
  config: ScanLifecycleEmailConfig,
  input: { scanId: string; recipientEmail: string; deliveryId: string },
  fetchImpl: typeof fetch = fetch,
  options: ResendRequestOptions = {}
): Promise<string> {
  if (!UUID_PATTERN.test(input.deliveryId)) {
    return Promise.reject(new Error("Paid Report delivery ID is invalid."));
  }
  const claimUrl = paidReportClaimUrl(config, input.scanId);
  const text = [
    "Your full Opportunity Scanner report is ready.",
    "",
    "Sign in with the email used for your purchase to securely claim access:",
    claimUrl,
    "",
    `Need help? Contact ${config.supportEmail}.`,
    "",
    "This is a transactional message about your Report purchase."
  ].join("\n");
  const html = [
    '<p style="font-size:16px;line-height:1.6;color:#172033">Your full Opportunity Scanner report is ready.</p>',
    '<p style="font-size:14px;line-height:1.6;color:#42526b">Sign in with the email used for your purchase to securely claim access.</p>',
    `<p style="margin:24px 0"><a href="${escapeHtml(claimUrl)}" style="background:#0e7c86;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:600">Claim full report</a></p>`,
    `<p style="font-size:14px;line-height:1.6;color:#42526b">Need help? Email <a href="mailto:${escapeHtml(config.supportEmail)}">${escapeHtml(config.supportEmail)}</a>.</p>`,
    '<p style="border-top:1px solid #d8dee8;padding-top:16px;font-size:12px;line-height:1.5;color:#667085">This is a transactional message about your Report purchase.</p>'
  ].join("");

  return sendResendEmailRequest({
    apiKey: config.apiKey,
    idempotencyKey: `paid-report/${input.deliveryId}/claim`,
    failureLabel: "Resend paid Report delivery",
    body: {
      from: `Opportunity Scanner <${config.fromEmail}>`,
      to: [input.recipientEmail],
      subject: "Claim your full Opportunity Scanner report",
      text,
      html
    }
  }, fetchImpl, options);
}

async function recordFailureSafely(
  prepared: PreparedPaidReportDelivery,
  failureCode: Exclude<PaidReportFulfillmentResult, { status: "skipped" } | { status: "delivered" }>["failureCode"],
  dependencies: PaidReportDependencies
): Promise<void> {
  await dependencies.record({
    deliveryId: prepared.delivery_id,
    status: "failed",
    failureCode
  }).catch(() => false);
}

export async function deliverPaidReportFulfillment(
  event: Record<string, unknown>,
  config: StripeServerConfig,
  dependencies: PaidReportDependencies = defaultDependencies
): Promise<PaidReportFulfillmentResult> {
  const fulfillment = paidReportFulfillmentFromStripeEvent(event, config);
  if (!fulfillment) return { status: "skipped" };

  let prepared: PreparedPaidReportDelivery | null;
  try {
    prepared = await dependencies.prepare(fulfillment.scanId, fulfillment.checkoutSessionId);
  } catch {
    return { status: "failed", failureCode: "persistence_failure" };
  }
  if (!prepared) return { status: "skipped" };

  const emailConfig = dependencies.emailConfig();
  if (!emailConfig) {
    await recordFailureSafely(prepared, "not_configured", dependencies);
    return { status: "failed", failureCode: "not_configured" };
  }
  if (prepared.recipient_email.trim().toLowerCase() !== fulfillment.recipientEmail) {
    await recordFailureSafely(prepared, "identity_mismatch", dependencies);
    return { status: "failed", failureCode: "identity_mismatch" };
  }

  let providerMessageId: string;
  try {
    providerMessageId = await dependencies.send(emailConfig, {
      scanId: fulfillment.scanId,
      recipientEmail: prepared.recipient_email,
      deliveryId: prepared.delivery_id
    });
  } catch {
    await recordFailureSafely(prepared, "provider_failure", dependencies);
    return { status: "failed", failureCode: "provider_failure" };
  }

  try {
    const recorded = await dependencies.record({
      deliveryId: prepared.delivery_id,
      status: "delivered",
      providerMessageId: providerMessageId.slice(0, 255)
    });
    return recorded
      ? { status: "delivered", deliveryId: prepared.delivery_id }
      : { status: "failed", failureCode: "persistence_failure" };
  } catch {
    return { status: "failed", failureCode: "persistence_failure" };
  }
}
