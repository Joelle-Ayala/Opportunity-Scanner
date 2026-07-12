import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deadlineReminderLabel,
  normalizeDeadlineReminderDays
} from "../lib/deadlineAlerts/core.ts";
import {
  deadlineAlertUnsubscribeUrl,
  getDeadlineEmailConfig,
  sendDeadlineAlertEmail
} from "../lib/deadlineAlerts/delivery.ts";
import {
  createAlertUnsubscribeToken,
  readAlertUnsubscribeToken
} from "../lib/deadlineAlerts/token.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, ROOT), "utf8");
const ACCOUNT_ID = "c4f7f32e-b7aa-4bf5-8e41-5402092f10f8";
const SECRET = "deadline-alert-test-secret-is-at-least-32-characters";

test("normalizes supported reminder timing in product order", () => {
  assert.deepEqual(normalizeDeadlineReminderDays([1, 14, 14, 99]), [14, 1]);
  assert.equal(deadlineReminderLabel(1), "1 day");
  assert.equal(deadlineReminderLabel(7), "7 days");
});

test("alert unsubscribe tokens are scoped, signed, and tamper resistant", () => {
  const token = createAlertUnsubscribeToken(ACCOUNT_ID, SECRET);
  assert.equal(readAlertUnsubscribeToken(token, SECRET), ACCOUNT_ID);
  assert.equal(readAlertUnsubscribeToken(`${token}x`, SECRET), null);
  assert.equal(readAlertUnsubscribeToken(token, `${SECRET}x`), null);
});

test("deadline delivery requires Resend, sender, app URL, and unsubscribe secret", () => {
  assert.equal(getDeadlineEmailConfig({
    APP_URL: "https://scanner.example.test",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "alerts@example.test"
  }), null);
  assert.deepEqual(getDeadlineEmailConfig({
    APP_URL: "https://scanner.example.test/",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "alerts@example.test",
    ALERT_UNSUBSCRIBE_SECRET: SECRET
  }), {
    apiKey: "re_test",
    fromEmail: "alerts@example.test",
    appUrl: "https://scanner.example.test",
    unsubscribeSecret: SECRET
  });
});

test("deadline email is idempotent and carries preference and one-click unsubscribe links", async () => {
  const config = {
    apiKey: "re_test",
    fromEmail: "alerts@example.test",
    appUrl: "https://scanner.example.test",
    unsubscribeSecret: SECRET
  };
  const alert = {
    alert_id: "alert-123",
    customer_account_id: ACCOUNT_ID,
    scan_id: "scan-123",
    recipient_email: "customer@example.test",
    opportunity_title: "City arts grant",
    agency_or_funder: "Example City",
    deadline_date: "2026-08-01",
    reminder_days: 7,
    attempt_count: 1
  };
  let request;
  const providerId = await sendDeadlineAlertEmail(config, alert, async (url, init) => {
    request = { url, init, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ id: "email-123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  assert.equal(providerId, "email-123");
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.init.headers["Idempotency-Key"], "deadline-alert/alert-123");
  assert.match(request.body.subject, /7 days left/);
  assert.match(request.body.text, /dashboard\?tab=alerts/);
  assert.match(request.body.headers["List-Unsubscribe"], /api\/deadline-alerts\/unsubscribe/);
  assert.match(deadlineAlertUnsubscribeUrl(config, ACCOUNT_ID), /alerts\/unsubscribe\?token=/);
});

test("migration gates, deduplicates, leases, and suppresses reminders", async () => {
  const sql = await source("db/deadline-alerts.sql");
  assert.match(sql, /create table if not exists customer_alert_preferences/);
  assert.match(sql, /unique \(customer_account_id, opportunity_key, deadline_date, reminder_days\)/);
  assert.match(sql, /auth_user\.email_confirmed_at is not null/);
  assert.match(sql, /preferences\.unsubscribed_at is null/);
  assert.match(sql, /subscription\.status in \('active', 'trialing'\)/);
  assert.match(sql, /for update of alert skip locked/);
  assert.match(sql, /delivery_status = 'suppressed'/);
  assert.match(sql, /grant execute on function enqueue_due_deadline_alerts\(integer\) to service_role/);
  assert.match(sql, /drop function if exists claim_pending_monitoring_alerts\(integer\)/);
});

test("cron and dashboard expose the bounded deadline alert workflow", async () => {
  const [cron, page, route, env] = await Promise.all([
    source("app/api/cron/monitoring/route.ts"),
    source("app/dashboard/page.tsx"),
    source("app/api/dashboard/alert-preferences/route.ts"),
    source(".env.example")
  ]);
  assert.match(cron, /enqueueDueDeadlineAlerts\(100\)/);
  assert.match(cron, /claimPendingDeadlineAlerts\(5\)/);
  assert.match(cron, /sendDeadlineAlertEmail/);
  assert.match(page, /loadCustomerAlertPreferences/);
  assert.match(route, /resolveCustomerSession/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(env, /^ALERT_UNSUBSCRIBE_SECRET=$/m);
});
