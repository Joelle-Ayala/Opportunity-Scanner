import {
  sendResendEmailRequest,
  type ResendRequestOptions
} from "../monitoring/delivery.ts";
import { configuredSupportEmail } from "../support.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ScanLifecycleEmailState = "completed" | "failed";

export type ScanLifecycleEmailConfig = {
  apiKey: string;
  fromEmail: string;
  appUrl: string;
  supportEmail: string;
};

export type ScanLifecycleEmailResult =
  | { status: "delivered"; providerMessageId: string }
  | { status: "skipped"; reason: "no_recipient" | "invalid_scan_id" | "not_configured" }
  | { status: "failed"; reason: "provider_failure" };

type ScanLifecycleEmailInput = {
  scanId: string;
  recipientEmail?: string | null;
  state: ScanLifecycleEmailState;
};

type SendScanLifecycleEmailInput = {
  scanId: string;
  recipientEmail: string;
  state: ScanLifecycleEmailState;
};

type DeliveryLogger = Pick<Console, "error">;

function normalizedEmail(value?: string | null): string | null {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function getScanLifecycleEmailConfig(
  env: NodeJS.ProcessEnv = process.env
): ScanLifecycleEmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const fromEmail = normalizedEmail(env.RESEND_FROM_EMAIL);
  const appUrl = env.APP_URL?.trim();
  if (!apiKey || !fromEmail || !appUrl) return null;

  try {
    const url = new URL(appUrl);
    const localDevelopment =
      env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
    const hasNonOriginParts =
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "");
    if ((url.protocol !== "https:" && !localDevelopment) || hasNonOriginParts) return null;

    return {
      apiKey,
      fromEmail,
      appUrl: url.origin,
      supportEmail: configuredSupportEmail(env)
    };
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function scanLifecycleReportUrl(config: ScanLifecycleEmailConfig, scanId: string): string {
  return `${config.appUrl}/reports/${encodeURIComponent(scanId)}`;
}

export async function sendScanLifecycleEmail(
  config: ScanLifecycleEmailConfig,
  input: SendScanLifecycleEmailInput,
  fetchImpl: typeof fetch = fetch,
  options: ResendRequestOptions = {}
): Promise<string> {
  const reportUrl = scanLifecycleReportUrl(config, input.scanId);
  const completed = input.state === "completed";
  const subject = completed
    ? "Your Opportunity Scanner report is ready"
    : "We couldn't complete your Opportunity Scanner report";
  const text = completed
    ? [
        "Your Opportunity Scanner report is ready.",
        "",
        `View your report: ${reportUrl}`,
        "",
        "This is a transactional message about the report you requested."
      ].join("\n")
    : [
        "We couldn't complete the Opportunity Scanner report you requested.",
        "",
        `Review the scan and retry: ${reportUrl}`,
        `Need help? Contact ${config.supportEmail}.`,
        "",
        "This is a transactional message about the report you requested."
      ].join("\n");
  const html = completed
    ? [
        '<p style="font-size:16px;line-height:1.6;color:#172033">Your Opportunity Scanner report is ready.</p>',
        `<p style="margin:24px 0"><a href="${escapeHtml(reportUrl)}" style="background:#0e7c86;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:600">View report</a></p>`,
        '<p style="border-top:1px solid #d8dee8;padding-top:16px;font-size:12px;line-height:1.5;color:#667085">This is a transactional message about the report you requested.</p>'
      ].join("")
    : [
        '<p style="font-size:16px;line-height:1.6;color:#172033">We couldn&#39;t complete the Opportunity Scanner report you requested.</p>',
        `<p style="margin:24px 0"><a href="${escapeHtml(reportUrl)}" style="background:#0e7c86;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:600">Review scan and retry</a></p>`,
        `<p style="font-size:14px;line-height:1.6;color:#42526b">Need help? Email <a href="mailto:${escapeHtml(config.supportEmail)}">${escapeHtml(config.supportEmail)}</a>.</p>`,
        '<p style="border-top:1px solid #d8dee8;padding-top:16px;font-size:12px;line-height:1.5;color:#667085">This is a transactional message about the report you requested.</p>'
      ].join("");

  return sendResendEmailRequest(
    {
      apiKey: config.apiKey,
      idempotencyKey: `scan-lifecycle/${input.scanId}/${input.state}`,
      failureLabel: "Resend scan lifecycle delivery",
      body: {
        from: `Opportunity Scanner <${config.fromEmail}>`,
        to: [input.recipientEmail],
        subject,
        text,
        html
      }
    },
    fetchImpl,
    options
  );
}

export async function deliverScanLifecycleEmailSafely(
  input: ScanLifecycleEmailInput,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    request?: ResendRequestOptions;
    logger?: DeliveryLogger;
  } = {}
): Promise<ScanLifecycleEmailResult> {
  const recipientEmail = normalizedEmail(input.recipientEmail);
  if (!recipientEmail) return { status: "skipped", reason: "no_recipient" };
  if (!UUID_PATTERN.test(input.scanId)) {
    return { status: "skipped", reason: "invalid_scan_id" };
  }

  const config = getScanLifecycleEmailConfig(options.env);
  if (!config) return { status: "skipped", reason: "not_configured" };

  try {
    const providerMessageId = await sendScanLifecycleEmail(
      config,
      { ...input, recipientEmail },
      options.fetchImpl,
      options.request
    );
    return { status: "delivered", providerMessageId };
  } catch (error) {
    try {
      (options.logger ?? console).error("Transactional scan email delivery failed", {
        scanId: input.scanId,
        state: input.state,
        errorType: error instanceof Error ? error.name : "UnknownDeliveryError"
      });
    } catch {
      // Logging must not turn a provider failure into a scan lifecycle failure.
    }
    return { status: "failed", reason: "provider_failure" };
  }
}
