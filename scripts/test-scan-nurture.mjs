import assert from "node:assert/strict";
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
  assert.equal(request.init.headers["Idempotency-Key"], "scan-nurture/job-123");
  assert.match(request.body.text, /12 months of access for the price of 10/);
  assert.match(request.body.text, /\/unsubscribe\?token=/);
  assert.match(request.body.headers["List-Unsubscribe"], /\/api\/nurture\/unsubscribe\?token=/);
  assert.equal(request.body.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("migration provides transactional dedupe, leasing, retries, and durable suppression", async () => {
  const sql = await readFile(new URL("../db/scan-nurture.sql", import.meta.url), "utf8");
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
});
