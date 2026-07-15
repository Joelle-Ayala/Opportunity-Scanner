import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { sendNurtureEmail } from "../lib/nurture/delivery.ts";
import { sanitizeProductAnalyticsEvent } from "../lib/productAnalytics.ts";

const config = {
  apiKey: "re_test",
  fromEmail: "hello@example.test",
  appUrl: "https://scanner.example.test",
  unsubscribeSecret: "test-secret-that-is-at-least-thirty-two-characters"
};

function nurtureJob(touchNumber) {
  return {
    job_id: `job-${touchNumber}`,
    enrollment_id: "enrollment-123",
    subscriber_id: "4f09e8fa-9f78-4c7a-92b0-52f3529afeca",
    scan_id: "91a3e66c-2c07-46cf-ab0c-3768375e050a",
    recipient_email: "customer@example.test",
    touch_number: touchNumber,
    attempt_count: 1
  };
}

async function deliveredEmail(touchNumber) {
  let body;
  await sendNurtureEmail(config, nurtureJob(touchNumber), async (_url, init) => {
    body = JSON.parse(String(init?.body));
    return Response.json({ id: `email-${touchNumber}` });
  });
  return body;
}

function ctaUrl(text) {
  const match = text.match(/https:\/\/scanner\.example\.test\/pricing\?[^\s]+/);
  assert.ok(match, "pricing CTA URL is present");
  return new URL(match[0]);
}

test("touch five carries allowlisted nurture attribution and annual intent", async () => {
  const email = await deliveredEmail(5);
  const url = ctaUrl(email.text);

  assert.equal(url.searchParams.get("source"), "nurture");
  assert.equal(url.searchParams.get("billing_interval"), "annual");
  assert.equal(url.searchParams.get("scanId"), nurtureJob(5).scan_id);
  assert.deepEqual([...url.searchParams.keys()].sort(), ["billing_interval", "scanId", "source"]);
});

test("earlier pricing touches do not claim annual billing intent", async () => {
  const email = await deliveredEmail(4);
  const url = ctaUrl(email.text);

  assert.equal(url.searchParams.get("source"), "nurture");
  assert.equal(url.searchParams.has("billing_interval"), false);
});

test("pricing allowlists nurture and only accepts its exact annual intent", async () => {
  const pricingPage = await readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8");

  assert.match(pricingPage, /searchParams\?\.source === "nurture"\) return "nurture"/);
  assert.match(
    pricingPage,
    /searchParams\?\.source === "nurture" && searchParams\.billing_interval === "annual"/
  );
  assert.match(pricingPage, /if \(searchParams\?\.checkout\) return "checkout_return"/);
  assert.match(
    pricingPage,
    /initialBillingInterval=\{resumeCheckout[\s\S]*\? resumeCheckout\.billingInterval[\s\S]*: nurtureBillingIntent\(searchParams\)\}/
  );
  assert.doesNotMatch(pricingPage, /initialBillingInterval=\{searchParams\?\.billing_interval\}/);
  assert.doesNotMatch(pricingPage, /source=\{searchParams\?\.source\}/);
  assert.deepEqual(sanitizeProductAnalyticsEvent("pricing_viewed", { source: "nurture" }), {
    name: "pricing_viewed",
    properties: { source: "nurture" }
  });
});
