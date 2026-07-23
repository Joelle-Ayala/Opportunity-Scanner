import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  processSubscriptionActivationRecoveries,
  sendSubscriptionActivationReminder,
  subscriptionActivationFromStripeEvent
} from "../lib/payments/subscriptionActivationRecovery.ts";

const sourceScanId = "91a3e66c-2c07-46cf-ab0c-3768375e050a";
const recoveryId = "72b4270c-6ca3-4427-a75f-ec5ca0a01cb2";
const reminderId = "3e992063-afc9-48d1-a2ce-55389e6cf84a";
const leaseToken = "bc0f53b8-0dc6-46eb-9ed5-27d008278e21";
const prices = {
  report: "price_report",
  monitorMonthly: "price_monitor_monthly",
  monitorAnnual: "price_monitor_annual",
  growthMonthly: "price_growth_monthly",
  growthAnnual: "price_growth_annual",
  requireLivemode: true
};

const checkoutCapture = subscriptionActivationFromStripeEvent({
  id: "evt_checkout",
  type: "checkout.session.completed",
  livemode: true,
  data: {
    object: {
      mode: "subscription",
      payment_status: "paid",
      customer: "cus_customer123",
      subscription: "sub_subscription123",
      customer_details: { email: "BUYER@EXAMPLE.COM" },
      metadata: {
        product: "monitor",
        price_id: prices.monitorMonthly,
        scan_id: sourceScanId
      }
    }
  }
}, prices);
assert.deepEqual(checkoutCapture, {
  customerId: "cus_customer123",
  customerEmail: "buyer@example.com",
  subscriptionId: "sub_subscription123",
  sourceScanId
});

const subscriptionCapture = subscriptionActivationFromStripeEvent({
  id: "evt_subscription",
  type: "customer.subscription.created",
  livemode: true,
  data: {
    object: {
      id: "sub_subscription123",
      customer: "cus_customer123",
      status: "active",
      metadata: { product: "growth", scan_id: sourceScanId },
      items: { data: [{ price: { id: prices.growthAnnual } }] }
    }
  }
}, prices);
assert.deepEqual(subscriptionCapture, {
  customerId: "cus_customer123",
  customerEmail: null,
  subscriptionId: "sub_subscription123",
  sourceScanId
});

for (const event of [
  {
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { mode: "subscription" } }
  },
  {
    type: "checkout.session.completed",
    livemode: true,
    data: {
      object: {
        mode: "subscription",
        payment_status: "paid",
        customer: "cus_customer123",
        subscription: "sub_subscription123",
        customer_details: { email: "buyer@example.com" },
        metadata: {
          product: "growth",
          price_id: prices.monitorMonthly,
          scan_id: sourceScanId
        }
      }
    }
  },
  {
    type: "customer.subscription.created",
    livemode: true,
    data: {
      object: {
        id: "sub_subscription123",
        customer: "cus_customer123",
        status: "past_due",
        metadata: { product: "monitor", scan_id: sourceScanId },
        items: { data: [{ price: { id: prices.monitorMonthly } }] }
      }
    }
  }
]) {
  assert.equal(subscriptionActivationFromStripeEvent(event, prices), null);
}

const sent = [];
const completed = [];
const released = [];
const healthySummary = await processSubscriptionActivationRecoveries({
  claimRecoveries: async () => [{
    recovery_id: recoveryId,
    lease_token: leaseToken,
    attempt_count: 1
  }],
  attemptRecovery: async () => ({ status: "activated" }),
  releaseRecovery: async () => null,
  claimReminders: async () => [{
    reminder_id: reminderId,
    lease_token: leaseToken,
    source_scan_id: sourceScanId,
    recipient_email: "buyer@example.com",
    attempt_count: 1
  }],
  completeReminder: async (...input) => {
    completed.push(input);
    return true;
  },
  releaseReminder: async (...input) => {
    released.push(input);
    return "pending";
  },
  supportMailboxReady: () => true,
  emailConfig: () => ({
    apiKey: "resend-test",
    fromEmail: "reports@example.test",
    appUrl: "https://scanner.example.test",
    supportEmail: "support@example.test"
  }),
  sendReminder: async (_config, reminder) => {
    sent.push(reminder.reminder_id);
    return "message_fixture";
  }
});
assert.deepEqual(healthySummary, {
  recovery: {
    claimed: 1,
    activated: 1,
    retrying: 0,
    deadLettered: 0,
    canceled: 0,
    staleClaims: 0,
    claimFailed: false,
    attemptFailed: 0,
    releaseFailed: 0
  },
  reminders: {
    configured: true,
    claimed: 1,
    delivered: 1,
    retried: 0,
    deadLettered: 0,
    claimFailed: false,
    releaseFailed: 0
  }
});
assert.deepEqual(sent, [reminderId]);
assert.deepEqual(completed, [[reminderId, leaseToken, "message_fixture"]]);
assert.deepEqual(released, []);

const retrySummary = await processSubscriptionActivationRecoveries({
  claimRecoveries: async () => [{
    recovery_id: recoveryId,
    lease_token: leaseToken,
    attempt_count: 2
  }],
  attemptRecovery: async () => ({ status: "retrying" }),
  releaseRecovery: async () => null,
  claimReminders: async () => [{
    reminder_id: reminderId,
    lease_token: leaseToken,
    source_scan_id: sourceScanId,
    recipient_email: "buyer@example.com",
    attempt_count: 2
  }],
  completeReminder: async () => false,
  releaseReminder: async () => "pending",
  supportMailboxReady: () => true,
  emailConfig: () => ({
    apiKey: "resend-test",
    fromEmail: "reports@example.test",
    appUrl: "https://scanner.example.test",
    supportEmail: "support@example.test"
  }),
  sendReminder: async () => {
    throw new Error("provider unavailable");
  }
});
assert.equal(retrySummary.recovery.retrying, 1);
assert.equal(retrySummary.reminders.retried, 1);

const failedAttemptSummary = await processSubscriptionActivationRecoveries({
  claimRecoveries: async () => [{
    recovery_id: recoveryId,
    lease_token: leaseToken,
    attempt_count: 5
  }],
  attemptRecovery: async () => {
    throw new Error("database exception");
  },
  releaseRecovery: async () => "dead_letter",
  claimReminders: async () => [],
  completeReminder: async () => true,
  releaseReminder: async () => null,
  supportMailboxReady: () => false,
  emailConfig: () => null,
  sendReminder: async () => "unused"
});
assert.equal(failedAttemptSummary.recovery.attemptFailed, 1);
assert.equal(failedAttemptSummary.recovery.deadLettered, 1);
assert.equal(failedAttemptSummary.recovery.releaseFailed, 0);

let mailboxBlockedReminderClaims = 0;
let mailboxBlockedEmailConfigReads = 0;
let mailboxBlockedReminderSends = 0;
const mailboxBlockedSummary = await processSubscriptionActivationRecoveries({
  claimRecoveries: async () => [{
    recovery_id: recoveryId,
    lease_token: leaseToken,
    attempt_count: 1
  }],
  attemptRecovery: async () => ({ status: "activated" }),
  releaseRecovery: async () => null,
  claimReminders: async () => {
    mailboxBlockedReminderClaims += 1;
    return [];
  },
  completeReminder: async () => true,
  releaseReminder: async () => null,
  supportMailboxReady: () => false,
  emailConfig: () => {
    mailboxBlockedEmailConfigReads += 1;
    return {
      apiKey: "resend-test",
      fromEmail: "reports@example.test",
      appUrl: "https://scanner.example.test",
      supportEmail: "support@example.test"
    };
  },
  sendReminder: async () => {
    mailboxBlockedReminderSends += 1;
    return "unused";
  }
});
assert.equal(mailboxBlockedSummary.recovery.activated, 1);
assert.deepEqual(mailboxBlockedSummary.reminders, {
  configured: false,
  claimed: 0,
  delivered: 0,
  retried: 0,
  deadLettered: 0,
  claimFailed: false,
  releaseFailed: 0
});
assert.equal(mailboxBlockedReminderClaims, 0);
assert.equal(mailboxBlockedEmailConfigReads, 0);
assert.equal(mailboxBlockedReminderSends, 0);

let outboundRequest;
await sendSubscriptionActivationReminder({
  apiKey: "resend-test",
  fromEmail: "reports@example.test",
  appUrl: "https://scanner.example.test",
  supportEmail: "support@example.test"
}, {
  reminder_id: reminderId,
  lease_token: leaseToken,
  source_scan_id: sourceScanId,
  recipient_email: "buyer@example.com",
  attempt_count: 1
}, async (_url, init) => {
  outboundRequest = init;
  return Response.json({ id: "message_fixture" });
});
assert.equal(outboundRequest.headers["Idempotency-Key"], `subscription-activation/${reminderId}`);
const outboundBody = JSON.parse(outboundRequest.body);
assert.deepEqual(outboundBody.to, ["buyer@example.com"]);
assert.match(outboundBody.subject, /Finish setting up/);
assert.match(outboundBody.text, /dashboard%2Fonboarding/);

const [migration, hardeningMigration, route, publicHealth, cron, handlers, handoff] = await Promise.all([
  readFile(new URL("../db/subscription-activation-recovery.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/subscription-activation-recovery-hardening.sql", import.meta.url), "utf8"),
  readFile(new URL("../app/api/health/subscriptions/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/cron/monitoring/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/handlers.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/subscriptionHandoff.ts", import.meta.url), "utf8")
]);

assert.match(migration, /interval '15 minutes'/);
assert.match(migration, /for update of recovery skip locked/i);
assert.match(migration, /unique \(recovery_id, reminder_sequence\)/i);
assert.match(migration, /profile\.status <> 'canceled'/);
assert.match(migration, /having count\(\*\) = 1/i);
assert.match(migration, /subscription\.status in \('active', 'trialing'\)/);
assert.match(migration, /get_subscription_activation_recovery_health/);
assert.match(migration, /grant execute on function public\.get_subscription_activation_recovery_health\(\)[\s\S]*to service_role/i);
assert.match(migration, /revoke all on function public\.get_subscription_activation_recovery_health\(\)[\s\S]*from public, anon, authenticated/i);
assert.match(route, /process\.env\.CRON_SECRET/);
assert.match(route, /timingSafeEqual/);
assert.match(route, /status: 401/);
assert.match(route, /PRIVATE_HEADERS/);
assert.doesNotMatch(publicHealth, /subscriptionActivationRecoveryHealth|active_without_profile_count/);
assert.match(cron, /processSubscriptionActivationRecoveries/);
assert.match(handlers, /subscriptionActivationFromStripeEvent/);
assert.match(hardeningMigration, /subscription\.livemode = true/);
assert.match(hardeningMigration, /schema_migration_corrections/);
assert.match(hardeningMigration, /schema_migration_effective_checksums/);
assert.match(hardeningMigration, /migration\.migration_file/);
assert.doesNotMatch(hardeningMigration, /migration\.file/);
assert.match(hardeningMigration, /1025299c3b390e4d36e7af59d0f982f9b3573cee418d757f70939771d1bb6f0b/);
assert.match(hardeningMigration, /if recorded_checksum = '1025299c3b390e4d36e7af59d0f982f9b3573cee418d757f70939771d1bb6f0b' then[\s\S]*?return/);
assert.match(hardeningMigration, /enforce_live_subscription_activation_recovery/);
assert.match(hardeningMigration, /register_subscription_activation_recovery[\s\S]*?subscription\.livemode = true/);
assert.match(hardeningMigration, /register_subscription_activation_recovery[\s\S]*?lower\(customer\.email\) <> p_customer_email/);
assert.match(hardeningMigration, /Recover older live subscriptions only/);
assert.match(hardeningMigration, /create_customer_monitored_search[\s\S]*?subscription\.livemode = true[\s\S]*?subscription\.status in \('active', 'trialing'\)/);
assert.match(hardeningMigration, /attempt_subscription_activation_recovery[\s\S]*?subscription\.livemode = true[\s\S]*?subscription\.product in \('monitor', 'growth'\)[\s\S]*?for share/);
assert.match(hardeningMigration, /release_subscription_activation_recovery/);
assert.match(hardeningMigration, /recovery\.attempt_count >= 5/);
assert.match(hardeningMigration, /recovery\.status in \('pending', 'dead_letter'\)/);
assert.match(hardeningMigration, /reminder\.attempt_count >= 5/);
assert.match(hardeningMigration, /reminder\.status in \('pending', 'dead_letter'\)/);
assert.match(handlers, /SUBSCRIPTION_ACTIVATION_RETRY_REQUIRED/);
assert.match(handoff, /registerActivation/);

const serializedSummary = JSON.stringify(healthySummary);
assert.doesNotMatch(serializedSummary, /buyer@example|cus_|sub_|[0-9a-f]{8}-[0-9a-f-]{27,}/i);

console.log("Subscription activation recovery, reminder idempotency, privacy, and service-only health checks passed.");
