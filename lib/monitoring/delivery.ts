import type { ClaimedMonitoringAlert } from "./storage";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type MonitoringEmailConfig = {
  apiKey: string;
  fromEmail: string;
  appUrl: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
};

export function getMonitoringEmailConfig(
  env: NodeJS.ProcessEnv = process.env
): MonitoringEmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const fromEmail = env.RESEND_FROM_EMAIL?.trim();
  const appUrl = env.APP_URL?.trim();
  if (!apiKey || !fromEmail || !appUrl || !EMAIL_PATTERN.test(fromEmail)) return null;

  try {
    const url = new URL(appUrl);
    const localDevelopment = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localDevelopment) || url.username || url.password || url.search || url.hash) {
      return null;
    }
    url.pathname = url.pathname.replace(/\/$/, "");
    return { apiKey, fromEmail, appUrl: url.toString().replace(/\/$/, "") };
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

export function monitoringReportUrl(config: MonitoringEmailConfig, scanId: string): string {
  return `${config.appUrl}/reports/${encodeURIComponent(scanId)}`;
}

export async function sendMonitoringAlertEmail(
  config: MonitoringEmailConfig,
  alert: ClaimedMonitoringAlert,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const reportUrl = monitoringReportUrl(config, alert.scan_id);
  const agency = alert.agency_or_funder?.trim();
  const deadline = alert.deadline?.trim();
  const details = [agency ? `Agency or funder: ${agency}` : null, deadline ? `Deadline: ${deadline}` : null]
    .filter(Boolean)
    .join("\n");
  const safeTitle = escapeHtml(alert.opportunity_title);
  const safeDetails = escapeHtml(details).replaceAll("\n", "<br>");

  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `monitoring-alert/${alert.alert_id}`
    },
    body: JSON.stringify({
      from: `Opportunity Scanner <${config.fromEmail}>`,
      to: [alert.recipient_email],
      subject: `New opportunity: ${alert.opportunity_title.slice(0, 120)}`,
      text: [
        "Opportunity Scanner found a new public-sector opportunity.",
        "",
        alert.opportunity_title,
        details,
        "",
        `View the updated report: ${reportUrl}`
      ].filter(Boolean).join("\n"),
      html: `<p>Opportunity Scanner found a new public-sector opportunity.</p><p><strong>${safeTitle}</strong>${safeDetails ? `<br>${safeDetails}` : ""}</p><p><a href="${escapeHtml(reportUrl)}">View the updated report</a></p>`
    })
  });

  const payload = (await response.json().catch(() => ({}))) as ResendResponse;
  if (!response.ok || !payload.id) {
    throw new Error(payload.message?.slice(0, 450) || `Resend delivery failed with status ${response.status}.`);
  }
  return payload.id;
}
