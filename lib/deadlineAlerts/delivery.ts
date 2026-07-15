import { deadlineReminderLabel } from "./core.ts";
import type { ClaimedDeadlineAlert } from "./storage.ts";
import { createAlertUnsubscribeToken, getAlertUnsubscribeSecret } from "./token.ts";
import {
  getMonitoringEmailConfig,
  sendResendEmailRequest,
  type MonitoringEmailConfig,
  type ResendRequestOptions
} from "../monitoring/delivery.ts";

export type DeadlineEmailConfig = MonitoringEmailConfig & { unsubscribeSecret: string };

export function getDeadlineEmailConfig(env: NodeJS.ProcessEnv = process.env): DeadlineEmailConfig | null {
  const base = getMonitoringEmailConfig(env);
  const unsubscribeSecret = getAlertUnsubscribeSecret(env);
  return base && unsubscribeSecret ? { ...base, unsubscribeSecret } : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function deadlineAlertUnsubscribeUrl(config: DeadlineEmailConfig, accountId: string): string {
  const token = createAlertUnsubscribeToken(accountId, config.unsubscribeSecret);
  return `${config.appUrl}/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function deadlineAlertOneClickUnsubscribeUrl(config: DeadlineEmailConfig, accountId: string): string {
  const token = createAlertUnsubscribeToken(accountId, config.unsubscribeSecret);
  return `${config.appUrl}/api/deadline-alerts/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function sendDeadlineAlertEmail(
  config: DeadlineEmailConfig,
  alert: ClaimedDeadlineAlert,
  fetchImpl: typeof fetch = fetch,
  options: ResendRequestOptions = {}
): Promise<string> {
  const reportUrl = `${config.appUrl}/reports/${encodeURIComponent(alert.scan_id)}`;
  const preferencesUrl = `${config.appUrl}/dashboard?tab=alerts`;
  const unsubscribeUrl = deadlineAlertUnsubscribeUrl(config, alert.customer_account_id);
  const oneClickUrl = deadlineAlertOneClickUnsubscribeUrl(config, alert.customer_account_id);
  const timeLeft = deadlineReminderLabel(alert.reminder_days);
  const timeLeftVerb = alert.reminder_days === 1 ? "remains" : "remain";
  const agency = alert.agency_or_funder?.trim();
  const details = [agency ? `Agency or funder: ${agency}` : null, `Deadline: ${alert.deadline_date}`]
    .filter(Boolean)
    .join("\n");
  const subject = `${timeLeft} left: ${alert.opportunity_title}`.slice(0, 160);

  return sendResendEmailRequest({
    apiKey: config.apiKey,
    idempotencyKey: `deadline-alert/${alert.alert_id}`,
    failureLabel: "Resend deadline delivery",
    body: {
      from: `Opportunity Scanner <${config.fromEmail}>`,
      to: [alert.recipient_email],
      subject,
      text: [
        `${timeLeft} ${timeLeftVerb} before this opportunity closes.`,
        "",
        alert.opportunity_title,
        details,
        "",
        `Review the opportunity: ${reportUrl}`,
        `Manage alert preferences: ${preferencesUrl}`,
        `Unsubscribe from Opportunity Scanner alerts: ${unsubscribeUrl}`
      ].join("\n"),
      html: `<p><strong>${escapeHtml(timeLeft)}</strong> ${timeLeftVerb} before this opportunity closes.</p><p><strong>${escapeHtml(alert.opportunity_title)}</strong><br>${escapeHtml(details).replaceAll("\n", "<br>")}</p><p><a href="${escapeHtml(reportUrl)}">Review the opportunity</a></p><p style="border-top:1px solid #d8dee8;padding-top:18px;font-size:12px;color:#667085"><a href="${escapeHtml(preferencesUrl)}">Manage alert preferences</a> or <a href="${escapeHtml(unsubscribeUrl)}">unsubscribe from alerts</a>.</p>`,
      headers: {
        "List-Unsubscribe": `<${oneClickUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    }
  }, fetchImpl, options);
}
