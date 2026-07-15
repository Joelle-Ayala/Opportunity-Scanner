import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getNurtureEmailConfig, sendNurtureEmail } from "../lib/nurture/delivery.ts";
import { getNurtureTouch, nurtureScheduledAt, SCAN_NURTURE_TOUCHES } from "../lib/nurture/sequence.ts";
import { createUnsubscribeToken, readUnsubscribeToken } from "../lib/nurture/token.ts";

const secret = "test-secret-that-is-at-least-thirty-two-characters";
const subscriberId = "4f09e8fa-9f78-4c7a-92b0-52f3529afeca";

test("five touches span days 0 through 10 and preserve the approved annual offer", () => {
  assert.deepEqual(SCAN_NURTURE_TOUCHES.map((touch) => touch.dayOffset), [0, 2, 4, 7, 10]);
  assert.equal(nurtureScheduledAt(5, new Date("2026-07-12T12:00:00Z")).toISOString(), "2026-07-22T12:00:00.000Z");
  assert.match(getNurtureTouch(5).body.join(" "), /12 months of access for the price of 10/);
  assert.match(getNurtureTouch(5).body.join(" "), /2 months free annually/);
});

test("unsubscribe tokens are signed, opaque to email, and reject tampering", () => {
  const token = createUnsubscribeToken(subscriberId, secret);
  assert.equal(readUnsubscribeToken(token, secret), subscriberId);
  assert.equal(readUnsubscribeToken(`${token.slice(0, -1)}x`, secret), null);
  assert.doesNotMatch(token, /@/);
});

test("email configuration fails closed without every delivery and unsubscribe setting", () => {
  assert.equal(getNurtureEmailConfig({ APP_URL: "https://scanner.example.test" }), null);
  assert.deepEqual(getNurtureEmailConfig({
    APP_URL: "https://scanner.example.test/",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "hello@example.test",
    NURTURE_UNSUBSCRIBE_SECRET: secret
  }), {
    apiKey: "re_test",
    fromEmail: "hello@example.test",
    appUrl: "https://scanner.example.test",
    unsubscribeSecret: secret
  });
});

test("Resend delivery is idempotent and includes visible and one-click unsubscribe paths", async () => {
  const config = {
    apiKey: "re_test",
    fromEmail: "hello@example.test",
    appUrl: "https://scanner.example.test",
    unsubscribeSecret: secret
  };
  const job = {
    job_id: "job-123",
    enrollment_id: "enrollment-123",
    subscriber_id: subscriberId,
    scan_id: "scan-123",
    recipient_email: "customer@example.test",
    recipient_name: "Jo",
    company_name: "Example Co",
    touch_number: 5,
    attempt_count: 1
  };
  let request;
  const providerId = await sendNurtureEmail(config, job, async (url, init) => {
    request = { url, init, body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({ id: "email-123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  assert.equal(providerId, "email-123");
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.ok(request.init.signal instanceof AbortSignal);
  assert.equal(request.init.headers["Idempotency-Key"], "scan-nurture/job-123");
  assert.match(request.body.text, /12 months of access for the price of 10/);
  assert.match(request.body.text, /\/unsubscribe\?token=/);
  assert.match(request.body.headers["List-Unsubscribe"], /\/api\/nurture\/unsubscribe\?token=/);
  assert.equal(request.body.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("hung nurture delivery aborts within the monitoring delivery budget", async () => {
  const config = {
    apiKey: "re_test",
    fromEmail: "hello@example.test",
    appUrl: "https://scanner.example.test",
    unsubscribeSecret: secret
  };
  const job = {
    job_id: "job-timeout",
    enrollment_id: "enrollment-timeout",
    subscriber_id: subscriberId,
    scan_id: "scan-timeout",
    recipient_email: "customer@example.test",
    touch_number: 1,
    attempt_count: 1
  };
  let observedAbort = false;
  const hungFetch = async (_url, init) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    assert.ok(signal instanceof AbortSignal);
    const abort = () => {
      observedAbort = true;
      reject(signal.reason);
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });

  await assert.rejects(
    sendNurtureEmail(config, job, hungFetch, { timeoutMs: 20 }),
    /Resend nurture delivery timed out after 20ms/
  );
  assert.equal(observedAbort, true);
});

test("nurture delivery removes caller abort listeners after completion", async () => {
  const controller = new AbortController();
  const config = {
    apiKey: "re_test",
    fromEmail: "hello@example.test",
    appUrl: "https://scanner.example.test",
    unsubscribeSecret: secret
  };
  const job = {
    job_id: "job-cleanup",
    enrollment_id: "enrollment-cleanup",
    subscriber_id: subscriberId,
    scan_id: "scan-cleanup",
    recipient_email: "customer@example.test",
    touch_number: 2,
    attempt_count: 1
  };

  await sendNurtureEmail(
    config,
    job,
    async () => Response.json({ id: "email-cleanup" }),
    { signal: controller.signal, timeoutMs: 100 }
  );

  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
});

test("migration provides transactional dedupe, leasing, retries, and durable suppression", async () => {
  const [sql, route, storage, homepage, submitButton] = await Promise.all([
    readFile(new URL("../db/scan-nurture.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/nurture/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/scan-submit-button.tsx", import.meta.url), "utf8")
  ]);
  assert.match(sql, /unique \(scan_id, subscriber_id\)/);
  assert.match(sql, /unique \(enrollment_id, touch_number\)/);
  assert.match(sql, /interval '10 days'/);
  assert.match(sql, /for update of job skip locked/);
  assert.match(sql, /lease_expires_at = now\(\) \+ interval '10 minutes'/);
  assert.match(sql, /attempt_count < 5/);
  assert.match(sql, /interval '15 minutes'/);
  assert.match(sql, /interval '2 hours'/);
  assert.match(sql, /'dead_letter'/);
  assert.match(sql, /status = 'suppressed'/);
  assert.match(
    sql,
    /on conflict on constraint scan_nurture_enrollments_scan_id_subscriber_id_key do update/
  );
  assert.doesNotMatch(sql, /on conflict \(scan_id, subscriber_id\) do update/);
  assert.match(sql, /grant execute on function enqueue_scan_nurture/);
  assert.match(sql, /marketing_consent boolean not null default false/);
  assert.match(sql, /enrollment\.marketing_consent = true/);
  assert.match(sql, /p_consent_source <> 'homepage_scan'/);
  assert.match(sql, /drop function if exists enqueue_scan_nurture\(uuid, text, text, text\)/);
  assert.match(sql, /enqueue_scan_nurture\(uuid, text, text, text, timestamptz, text\)/);
  assert.match(route, /input\.email && marketingConsent/);
  assert.match(storage, /p_consented_at: consentedAt\.toISOString\(\)/);
  assert.match(storage, /p_consent_source: input\.consentSource/);
  assert.match(homepage, /name="marketingConsent"/);
  assert.match(submitButton, /marketing_consent: marketingConsent/);
});

test("cron and environment configuration expose the isolated nurture runner", async () => {
  const [vercel, env, route] = await Promise.all([
    readFile(new URL("../vercel.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/nurture/route.ts", import.meta.url), "utf8")
  ]);
  assert.deepEqual(vercel.crons.find((job) => job.path === "/api/cron/nurture"), {
    path: "/api/cron/nurture",
    schedule: "47 12 * * *"
  });
  assert.match(env, /^NURTURE_UNSUBSCRIBE_SECRET=$/m);
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /claimDueNurtureJobs\(10\)/);
  assert.match(route, /event: "cron\.nurture\.summary"/);
  assert.match(route, /const status = ok \? 200 : storageFailed \? 503 : 502/);
  assert.match(route, /status === "dead_letter"/);
  assert.match(route, /status === "pending"/);
  assert.match(route, /outcome: "configuration_error"/);
});
