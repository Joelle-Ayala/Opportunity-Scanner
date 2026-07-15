import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deliverScanLifecycleEmailSafely,
  getScanLifecycleEmailConfig
} from "../lib/transactionalEmail/scanLifecycle.ts";

const scanId = "4f09e8fa-9f78-4c7a-92b0-52f3529afeca";
const env = {
  NODE_ENV: "production",
  APP_URL: "https://scanner.example.test",
  RESEND_API_KEY: "re_test",
  RESEND_FROM_EMAIL: "reports@example.test",
  OPPORTUNITY_SCANNER_CONTACT_EMAIL: "support@example.test"
};

test("completed scans send a private, idempotent report-ready message", async () => {
  let request;
  const result = await deliverScanLifecycleEmailSafely(
    {
      scanId,
      recipientEmail: " Customer@Example.Test ",
      state: "completed"
    },
    {
      env,
      fetchImpl: async (url, init) => {
        request = { url, init, body: JSON.parse(String(init?.body)) };
        return Response.json({ id: "email-completed" });
      }
    }
  );

  assert.deepEqual(result, { status: "delivered", providerMessageId: "email-completed" });
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(
    request.init.headers["Idempotency-Key"],
    `scan-lifecycle/${scanId}/completed`
  );
  assert.deepEqual(request.body.to, ["customer@example.test"]);
  assert.equal(request.body.subject, "Your Opportunity Scanner report is ready");
  assert.match(request.body.text, new RegExp(`https://scanner\\.example\\.test/reports/${scanId}`));
  assert.doesNotMatch(request.body.text, /unsubscribe|pricing|marketing/i);
  assert.deepEqual(Object.keys(request.body).sort(), ["from", "html", "subject", "text", "to"]);
});

test("definitively failed scans send only retry and support guidance", async () => {
  let body;
  const result = await deliverScanLifecycleEmailSafely(
    { scanId, recipientEmail: "customer@example.test", state: "failed" },
    {
      env,
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return Response.json({ id: "email-failed" });
      }
    }
  );

  assert.equal(result.status, "delivered");
  assert.match(body.text, /couldn't complete/i);
  assert.match(body.text, /Review the scan and retry:/);
  assert.match(body.text, /support@example\.test/);
  assert.doesNotMatch(body.text, /company_url|query_used|raw_json|error_message/i);
});

test("missing or invalid recipient email safely skips delivery", async () => {
  let providerCalled = false;
  const fetchImpl = async () => {
    providerCalled = true;
    return Response.json({ id: "unexpected" });
  };

  assert.deepEqual(
    await deliverScanLifecycleEmailSafely(
      { scanId, recipientEmail: null, state: "completed" },
      { env, fetchImpl }
    ),
    { status: "skipped", reason: "no_recipient" }
  );
  assert.deepEqual(
    await deliverScanLifecycleEmailSafely(
      { scanId, recipientEmail: "not-an-email", state: "completed" },
      { env, fetchImpl }
    ),
    { status: "skipped", reason: "no_recipient" }
  );
  assert.equal(providerCalled, false);
});

test("provider failure is contained and cannot change scan completion", async () => {
  const logs = [];
  const result = await deliverScanLifecycleEmailSafely(
    { scanId, recipientEmail: "customer@example.test", state: "completed" },
    {
      env,
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: "provider unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" }
        }),
      logger: { error: (...values) => logs.push(values) }
    }
  );

  assert.deepEqual(result, { status: "failed", reason: "provider_failure" });
  assert.equal(logs.length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /customer@example\.test|provider unavailable/);
});

test("configuration requires a secure application origin and no unsubscribe secret", () => {
  assert.equal(getScanLifecycleEmailConfig({ ...env, APP_URL: "http://scanner.example.test" }), null);
  assert.equal(getScanLifecycleEmailConfig({ ...env, APP_URL: "https://scanner.example.test/path" }), null);
  assert.equal(getScanLifecycleEmailConfig({ ...env, APP_URL: "https://user:pass@scanner.example.test" }), null);
  assert.deepEqual(getScanLifecycleEmailConfig(env), {
    apiKey: "re_test",
    fromEmail: "reports@example.test",
    appUrl: "https://scanner.example.test",
    supportEmail: "support@example.test"
  });
});

test("scan lifecycle delivery stays separate from consent-gated nurture", async () => {
  const route = await readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8");
  const completedDelivery = route.indexOf('state: "completed"');
  const nurtureConsent = route.indexOf("if (input.email && marketingConsent)");
  const failurePersistence = route.indexOf("if (failurePersisted)");
  const failedDelivery = route.indexOf('state: "failed"');

  assert.ok(completedDelivery > 0 && completedDelivery < nurtureConsent);
  assert.ok(failurePersistence > 0 && failurePersistence < failedDelivery);
  assert.match(route, /async function attemptScanLifecycleEmail/);
  assert.match(route, /try \{[\s\S]*?await deliverScanLifecycleEmailSafely[\s\S]*?\} catch \{/);
  assert.match(route, /await attemptScanLifecycleEmail/);
});
