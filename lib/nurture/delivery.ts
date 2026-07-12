import type { ClaimedNurtureJob } from "./storage.ts";
import { getNurtureTouch } from "./sequence.ts";
import { createUnsubscribeToken, getNurtureUnsubscribeSecret } from "./token.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NurtureEmailConfig = {
  apiKey: string;
  fromEmail: string;
  appUrl: string;
  unsubscribeSecret: string;
};

type ResendResponse = { id?: string; message?: string };

export function getNurtureEmailConfig(env: NodeJS.ProcessEnv = process.env): NurtureEmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const fromEmail = env.RESEND_FROM_EMAIL?.trim();
  const appUrl = env.APP_URL?.trim();
  const unsubscribeSecret = getNurtureUnsubscribeSecret(env);
  if (!apiKey || !fromEmail || !appUrl || !unsubscribeSecret || !EMAIL_PATTERN.test(fromEmail)) return null;

  try {
    const url = new URL(appUrl);
    const local = env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if ((url.protocol !== "https:" && !local) || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/$/, "");
    return { apiKey, fromEmail, appUrl: url.toString().replace(/\/$/, ""), unsubscribeSecret };
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

export function nurtureUnsubscribeUrl(config: NurtureEmailConfig, subscriberId: string): string {
  const token = createUnsubscribeToken(subscriberId, config.unsubscribeSecret);
  return `${config.appUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function nurtureOneClickUnsubscribeUrl(config: NurtureEmailConfig, subscriberId: string): string {
  const token = createUnsubscribeToken(subscriberId, config.unsubscribeSecret);
  return `${config.appUrl}/api/nurture/unsubscribe?token=${encodeURIComponent(token)}`;
}

export async function sendNurtureEmail(
  config: NurtureEmailConfig,
  job: ClaimedNurtureJob,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (!EMAIL_PATTERN.test(job.recipient_email) || job.recipient_email.length > 254) {
    throw new Error("Nurture recipient email is invalid.");
  }

  const touch = getNurtureTouch(job.touch_number);
  const reportUrl = `${config.appUrl}/reports/${encodeURIComponent(job.scan_id)}`;
  const pricingUrl = `${config.appUrl}/pricing?source=nurture&scanId=${encodeURIComponent(job.scan_id)}`;
  const destinationUrl = touch.destination === "report" ? reportUrl : pricingUrl;
  const unsubscribeUrl = nurtureUnsubscribeUrl(config, job.subscriber_id);
  const oneClickUnsubscribeUrl = nurtureOneClickUnsubscribeUrl(config, job.subscriber_id);
  const greeting = job.recipient_name?.trim() ? `Hi ${job.recipient_name.trim()},` : "Hello,";
  const subject = touch.subject(job.company_name).slice(0, 160);
  const text = [
    greeting,
    "",
    touch.heading,
    "",
    ...touch.body.flatMap((paragraph) => [paragraph, ""]),
    `${touch.ctaLabel}: ${destinationUrl}`,
    "",
    `Unsubscribe from post-scan emails: ${unsubscribeUrl}`
  ].join("\n");
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<h1 style="font-size:24px;line-height:1.25;color:#14213d">${escapeHtml(touch.heading)}</h1>`,
    ...touch.body.map((paragraph) => `<p style="font-size:16px;line-height:1.6;color:#42526b">${escapeHtml(paragraph)}</p>`),
    `<p style="margin:28px 0"><a href="${escapeHtml(destinationUrl)}" style="background:#0e7c86;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:600">${escapeHtml(touch.ctaLabel)}</a></p>`,
    `<p style="border-top:1px solid #d8dee8;padding-top:18px;font-size:12px;line-height:1.5;color:#667085">You received this because you requested an Opportunity Scanner report. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#42526b">Unsubscribe</a>.</p>`
  ].join("");

  const response = await fetchImpl(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `scan-nurture/${job.job_id}`
    },
    body: JSON.stringify({
      from: `Opportunity Scanner <${config.fromEmail}>`,
      to: [job.recipient_email],
      subject,
      text,
      html,
      headers: {
        "List-Unsubscribe": `<${oneClickUnsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      }
    })
  });

  const payload = (await response.json().catch(() => ({}))) as ResendResponse;
  if (!response.ok || !payload.id) {
    throw new Error(payload.message?.slice(0, 450) || `Resend nurture delivery failed with status ${response.status}.`);
  }
  return payload.id;
}
