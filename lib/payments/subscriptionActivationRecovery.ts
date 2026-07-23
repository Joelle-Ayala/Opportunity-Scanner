import { getScanLifecycleEmailConfig, type ScanLifecycleEmailConfig } from "../transactionalEmail/scanLifecycle.ts";
import { sendResendEmailRequest, type ResendRequestOptions } from "../monitoring/delivery.ts";
import { supportMailboxIsReady } from "../support.ts";
import { supabaseRpc } from "../supabaseRest.ts";
import type { StripeServerConfig } from "./config.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type StripeRecord = Record<string, unknown>;

export type SubscriptionActivationCapture = {
  customerId: string;
  customerEmail: string | null;
  subscriptionId: string;
  sourceScanId: string;
};

export type ClaimedSubscriptionActivationRecovery = {
  recovery_id: string;
  lease_token: string;
  attempt_count: number;
};

export type SubscriptionActivationAttemptResult = {
  status: "activated" | "retrying" | "dead_letter" | "canceled" | "stale_claim";
};

export type ClaimedSubscriptionActivationReminder = {
  reminder_id: string;
  lease_token: string;
  source_scan_id: string;
  recipient_email: string;
  attempt_count: number;
};

export type SubscriptionActivationHealth = {
  active_without_profile_count: number;
  untracked_count: number;
  pending_recovery_count: number;
  stale_recovery_count: number;
  dead_letter_recovery_count: number;
  pending_reminder_count: number;
  dead_letter_reminder_count: number;
  oldest_unactivated_age_seconds: number;
};

export type SubscriptionActivationRecoverySummary = {
  recovery: {
    claimed: number;
    activated: number;
    retrying: number;
    deadLettered: number;
    canceled: number;
    staleClaims: number;
    claimFailed: boolean;
    attemptFailed: number;
    releaseFailed: number;
  };
  reminders: {
    configured: boolean;
    claimed: number;
    delivered: number;
    retried: number;
    deadLettered: number;
    claimFailed: boolean;
    releaseFailed: number;
  };
};

type SubscriptionActivationDependencies = {
  claimRecoveries: (limit?: number) => Promise<ClaimedSubscriptionActivationRecovery[]>;
  attemptRecovery: (
    recoveryId: string,
    leaseToken: string
  ) => Promise<SubscriptionActivationAttemptResult>;
  releaseRecovery: (
    recoveryId: string,
    leaseToken: string,
    cause: unknown
  ) => Promise<"pending" | "dead_letter" | null>;
  claimReminders: (limit?: number) => Promise<ClaimedSubscriptionActivationReminder[]>;
  completeReminder: (
    reminderId: string,
    leaseToken: string,
    providerMessageId: string
  ) => Promise<boolean>;
  releaseReminder: (
    reminderId: string,
    leaseToken: string,
    cause: unknown
  ) => Promise<"pending" | "dead_letter" | null>;
  supportMailboxReady: () => boolean;
  emailConfig: () => ScanLifecycleEmailConfig | null;
  sendReminder: typeof sendSubscriptionActivationReminder;
};

function record(value: unknown): StripeRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as StripeRecord
    : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stripeId(value: unknown, prefix: string): string | null {
  const id = stringValue(value) ?? stringValue(record(value)?.id);
  return id && new RegExp(`^${prefix}_[A-Za-z0-9_]+$`).test(id) ? id : null;
}

function normalizedEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function sourceScanId(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value.toLowerCase()
    : null;
}

function catalogPlan(
  priceId: string,
  prices: StripeServerConfig["prices"]
): "monitor" | "growth" | null {
  if (priceId === prices.monitorMonthly || priceId === prices.monitorAnnual) return "monitor";
  if (priceId === prices.growthMonthly || priceId === prices.growthAnnual) return "growth";
  return null;
}

export function subscriptionActivationFromStripeEvent(
  event: StripeRecord,
  prices: StripeServerConfig["prices"]
): SubscriptionActivationCapture | null {
  if (prices.requireLivemode && event.livemode !== true) return null;
  const eventType = stringValue(event.type);
  const object = record(record(event.data)?.object);
  if (!eventType || !object) return null;

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(eventType)) {
    const metadata = record(object.metadata);
    const priceId = stringValue(metadata?.price_id);
    const plan = priceId ? catalogPlan(priceId, prices) : null;
    const sourceId = sourceScanId(metadata?.scan_id);
    const customerId = stripeId(object.customer, "cus");
    const subscriptionId = stripeId(object.subscription, "sub");
    const customerEmail = normalizedEmail(record(object.customer_details)?.email);
    if (
      object.mode !== "subscription"
      || object.payment_status !== "paid"
      || !plan
      || metadata?.product !== plan
      || !sourceId
      || !customerId
      || !subscriptionId
      || !customerEmail
    ) {
      return null;
    }
    return { customerId, customerEmail, subscriptionId, sourceScanId: sourceId };
  }

  if (["customer.subscription.created", "customer.subscription.updated"].includes(eventType)) {
    const status = stringValue(object.status);
    const metadata = record(object.metadata);
    const firstItem = record((record(object.items)?.data as unknown[] | undefined)?.[0]);
    const priceId = stripeId(firstItem?.price, "price");
    const plan = priceId ? catalogPlan(priceId, prices) : null;
    const sourceId = sourceScanId(metadata?.scan_id);
    const customerId = stripeId(object.customer, "cus");
    const subscriptionId = stripeId(object.id, "sub");
    if (
      !["active", "trialing"].includes(status ?? "")
      || !plan
      || metadata?.product !== plan
      || !sourceId
      || !customerId
      || !subscriptionId
    ) {
      return null;
    }
    return { customerId, customerEmail: null, subscriptionId, sourceScanId: sourceId };
  }

  return null;
}

export function registerSubscriptionActivationRecovery(
  capture: SubscriptionActivationCapture
): Promise<boolean> {
  return supabaseRpc<boolean>("register_subscription_activation_recovery", {
    p_customer_id: capture.customerId,
    p_customer_email: capture.customerEmail,
    p_subscription_id: capture.subscriptionId,
    p_scan_id: capture.sourceScanId
  });
}

export function claimDueSubscriptionActivationRecoveries(
  limit = 5
): Promise<ClaimedSubscriptionActivationRecovery[]> {
  return supabaseRpc<ClaimedSubscriptionActivationRecovery[]>(
    "claim_due_subscription_activation_recoveries",
    { p_limit: limit }
  );
}

export function attemptSubscriptionActivationRecovery(
  recoveryId: string,
  leaseToken: string
): Promise<SubscriptionActivationAttemptResult> {
  return supabaseRpc<SubscriptionActivationAttemptResult>(
    "attempt_subscription_activation_recovery",
    { p_recovery_id: recoveryId, p_lease_token: leaseToken }
  );
}

export function releaseSubscriptionActivationRecovery(
  recoveryId: string,
  leaseToken: string,
  cause: unknown
): Promise<"pending" | "dead_letter" | null> {
  const message = cause instanceof Error ? cause.message : "Subscription activation recovery failed.";
  return supabaseRpc<"pending" | "dead_letter" | null>(
    "release_subscription_activation_recovery",
    {
      p_recovery_id: recoveryId,
      p_lease_token: leaseToken,
      p_error: message.trim().slice(0, 500) || "Subscription activation recovery failed."
    }
  );
}

export function claimPendingSubscriptionActivationReminders(
  limit = 5
): Promise<ClaimedSubscriptionActivationReminder[]> {
  return supabaseRpc<ClaimedSubscriptionActivationReminder[]>(
    "claim_pending_subscription_activation_reminders",
    { p_limit: limit }
  );
}

export function completeSubscriptionActivationReminder(
  reminderId: string,
  leaseToken: string,
  providerMessageId: string
): Promise<boolean> {
  return supabaseRpc<boolean>("complete_subscription_activation_reminder", {
    p_reminder_id: reminderId,
    p_lease_token: leaseToken,
    p_provider_message_id: providerMessageId.slice(0, 255)
  });
}

export function releaseSubscriptionActivationReminder(
  reminderId: string,
  leaseToken: string,
  cause: unknown
): Promise<"pending" | "dead_letter" | null> {
  const message = cause instanceof Error ? cause.message : "Subscription activation reminder failed.";
  return supabaseRpc<"pending" | "dead_letter" | null>(
    "release_subscription_activation_reminder",
    {
      p_reminder_id: reminderId,
      p_lease_token: leaseToken,
      p_error: message.trim().slice(0, 500) || "Subscription activation reminder failed."
    }
  );
}

function validHealth(value: unknown): value is SubscriptionActivationHealth {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every(
    (count) => Number.isSafeInteger(count) && Number(count) >= 0
  );
}

export async function getSubscriptionActivationRecoveryHealth(): Promise<SubscriptionActivationHealth> {
  const rows = await supabaseRpc<SubscriptionActivationHealth[]>(
    "get_subscription_activation_recovery_health",
    {}
  );
  const health = rows[0];
  if (!validHealth(health)) throw new Error("Subscription activation recovery health is unavailable.");
  return health;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function subscriptionActivationUrl(
  config: ScanLifecycleEmailConfig,
  sourceScanId: string
): string {
  const next = `/dashboard/onboarding?source_scan_id=${encodeURIComponent(sourceScanId)}`;
  return `${config.appUrl}/auth/sign-in?next=${encodeURIComponent(next)}`;
}

export function sendSubscriptionActivationReminder(
  config: ScanLifecycleEmailConfig,
  reminder: ClaimedSubscriptionActivationReminder,
  fetchImpl: typeof fetch = fetch,
  options: ResendRequestOptions = {}
): Promise<string> {
  if (
    !UUID_PATTERN.test(reminder.reminder_id)
    || !UUID_PATTERN.test(reminder.source_scan_id)
    || !EMAIL_PATTERN.test(reminder.recipient_email)
    || reminder.recipient_email.length > 254
  ) {
    return Promise.reject(new Error("Subscription activation reminder is invalid."));
  }
  const activationUrl = subscriptionActivationUrl(config, reminder.source_scan_id);
  const text = [
    "Your Opportunity Scanner subscription is active, but monitoring still needs to be connected.",
    "",
    "Finish monitoring setup from the report you selected:",
    activationUrl,
    "",
    `Need help? Contact ${config.supportEmail}.`,
    "",
    "This is a transactional message about your Opportunity Scanner subscription."
  ].join("\n");
  const html = [
    '<p style="font-size:16px;line-height:1.6;color:#172033">Your Opportunity Scanner subscription is active, but monitoring still needs to be connected.</p>',
    '<p style="font-size:14px;line-height:1.6;color:#42526b">Finish monitoring setup from the report you selected.</p>',
    `<p style="margin:24px 0"><a href="${escapeHtml(activationUrl)}" style="background:#0e7c86;color:#ffffff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:600">Finish monitoring setup</a></p>`,
    `<p style="font-size:14px;line-height:1.6;color:#42526b">Need help? Email <a href="mailto:${escapeHtml(config.supportEmail)}">${escapeHtml(config.supportEmail)}</a>.</p>`,
    '<p style="border-top:1px solid #d8dee8;padding-top:16px;font-size:12px;line-height:1.5;color:#667085">This is a transactional message about your Opportunity Scanner subscription.</p>'
  ].join("");

  return sendResendEmailRequest({
    apiKey: config.apiKey,
    idempotencyKey: `subscription-activation/${reminder.reminder_id}`,
    failureLabel: "Resend subscription activation reminder",
    body: {
      from: `Opportunity Scanner <${config.fromEmail}>`,
      to: [reminder.recipient_email],
      subject: "Finish setting up Opportunity Scanner monitoring",
      text,
      html
    }
  }, fetchImpl, options);
}

const defaultDependencies: SubscriptionActivationDependencies = {
  claimRecoveries: claimDueSubscriptionActivationRecoveries,
  attemptRecovery: attemptSubscriptionActivationRecovery,
  releaseRecovery: releaseSubscriptionActivationRecovery,
  claimReminders: claimPendingSubscriptionActivationReminders,
  completeReminder: completeSubscriptionActivationReminder,
  releaseReminder: releaseSubscriptionActivationReminder,
  supportMailboxReady: supportMailboxIsReady,
  emailConfig: getScanLifecycleEmailConfig,
  sendReminder: sendSubscriptionActivationReminder
};

export async function processSubscriptionActivationRecoveries(
  dependencies: SubscriptionActivationDependencies = defaultDependencies
): Promise<SubscriptionActivationRecoverySummary> {
  const summary: SubscriptionActivationRecoverySummary = {
    recovery: {
      claimed: 0,
      activated: 0,
      retrying: 0,
      deadLettered: 0,
      canceled: 0,
      staleClaims: 0,
      claimFailed: false,
      attemptFailed: 0,
      releaseFailed: 0
    },
    reminders: {
      configured: false,
      claimed: 0,
      delivered: 0,
      retried: 0,
      deadLettered: 0,
      claimFailed: false,
      releaseFailed: 0
    }
  };

  let recoveries: ClaimedSubscriptionActivationRecovery[] = [];
  try {
    recoveries = await dependencies.claimRecoveries(5);
    summary.recovery.claimed = recoveries.length;
  } catch {
    summary.recovery.claimFailed = true;
  }

  for (const recovery of recoveries) {
    try {
      const result = await dependencies.attemptRecovery(
        recovery.recovery_id,
        recovery.lease_token
      );
      if (result.status === "activated") summary.recovery.activated += 1;
      else if (result.status === "retrying") summary.recovery.retrying += 1;
      else if (result.status === "dead_letter") summary.recovery.deadLettered += 1;
      else if (result.status === "canceled") summary.recovery.canceled += 1;
      else summary.recovery.staleClaims += 1;
    } catch (cause) {
      summary.recovery.attemptFailed += 1;
      try {
        const status = await dependencies.releaseRecovery(
          recovery.recovery_id,
          recovery.lease_token,
          cause
        );
        if (status === "dead_letter") summary.recovery.deadLettered += 1;
        else if (status === "pending") summary.recovery.retrying += 1;
        else summary.recovery.releaseFailed += 1;
      } catch {
        summary.recovery.releaseFailed += 1;
      }
    }
  }

  if (!dependencies.supportMailboxReady()) return summary;

  const emailConfig = dependencies.emailConfig();
  summary.reminders.configured = Boolean(emailConfig);
  if (!emailConfig) return summary;

  let reminders: ClaimedSubscriptionActivationReminder[] = [];
  try {
    reminders = await dependencies.claimReminders(5);
    summary.reminders.claimed = reminders.length;
  } catch {
    summary.reminders.claimFailed = true;
    return summary;
  }

  for (const reminder of reminders) {
    try {
      const providerMessageId = await dependencies.sendReminder(emailConfig, reminder);
      const completed = await dependencies.completeReminder(
        reminder.reminder_id,
        reminder.lease_token,
        providerMessageId
      );
      if (!completed) throw new Error("Subscription activation reminder claim expired.");
      summary.reminders.delivered += 1;
    } catch (cause) {
      try {
        const status = await dependencies.releaseReminder(
          reminder.reminder_id,
          reminder.lease_token,
          cause
        );
        if (status === "dead_letter") summary.reminders.deadLettered += 1;
        else if (status === "pending") summary.reminders.retried += 1;
        else summary.reminders.releaseFailed += 1;
      } catch {
        summary.reminders.releaseFailed += 1;
      }
    }
  }

  return summary;
}
