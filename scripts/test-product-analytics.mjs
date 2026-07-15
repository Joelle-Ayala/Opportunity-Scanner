import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PRODUCT_ANALYTICS_BROWSER_EVENT,
  scanDurationBucket,
  sanitizeProductAnalyticsEvent,
  signalCountBucket,
  stripUrlQuery,
  trackProductEvent
} from "../lib/productAnalytics.ts";

assert.equal(signalCountBucket(0), "0");
assert.equal(signalCountBucket(3), "1-3");
assert.equal(signalCountBucket(10), "4-10");
assert.equal(signalCountBucket(11), "11+");
assert.equal(scanDurationBucket("2026-07-11T12:00:00Z", "2026-07-11T12:00:29Z"), "under_30_seconds");
assert.equal(scanDurationBucket("2026-07-11T12:00:00Z", "2026-07-11T12:01:00Z"), "30-89_seconds");
assert.equal(scanDurationBucket("2026-07-11T12:00:00Z", "2026-07-11T12:02:00Z"), "90_seconds_or_more");

const validEvents = [
  ["scan_started", { entry_point: "homepage" }],
  ["scan_completed", { outcome: "success", signal_count_bucket: "4-10", duration_bucket: "30-89_seconds" }],
  ["scan_viewed", { report_tier: "free", signal_count_bucket: "1-3" }],
  ["email_captured", { surface: "scan", marketing_consent: false }],
  ["pricing_viewed", { source: "report_gate" }],
  ["checkout_started", { plan: "full_report", billing_period: "one_time" }],
  ["purchase_completed", { plan: "growth", billing_period: "annual" }],
  ["dashboard_action_selected", { action: "open_report" }],
  ["report_value_action_selected", { action: "open_source", report_tier: "full" }]
];

for (const [name, properties] of validEvents) {
  assert.deepEqual(sanitizeProductAnalyticsEvent(name, properties), { name, properties });
}

assert.equal(sanitizeProductAnalyticsEvent("unknown_event", {}), null);
assert.equal(sanitizeProductAnalyticsEvent("scan_viewed", { report_tier: "admin", signal_count_bucket: "1-3" }), null);
assert.equal(sanitizeProductAnalyticsEvent("email_captured", { surface: "scan", marketing_consent: "yes" }), null);
assert.equal(sanitizeProductAnalyticsEvent("dashboard_action_selected", { action: "email_customer", email: "private@example.com" }), null);
assert.deepEqual(
  sanitizeProductAnalyticsEvent("report_value_action_selected", {
    action: "open_source",
    report_tier: "full",
    source_url: "https://secret.example"
  }),
  { name: "report_value_action_selected", properties: { action: "open_source", report_tier: "full" } }
);

const hostilePayload = sanitizeProductAnalyticsEvent("scan_started", {
  entry_point: "homepage",
  email: "private@example.com",
  company: "Private Company",
  query: "?secret=value",
  api_key: "secret"
});
assert.deepEqual(hostilePayload, {
  name: "scan_started",
  properties: { entry_point: "homepage" }
});

assert.equal(stripUrlQuery("https://example.com/report?email=private%40example.com#details"), "https://example.com/report");
assert.equal(stripUrlQuery("/report?company=private#details"), "/report");

assert.equal(trackProductEvent("scan_started", { entry_point: "homepage" }), false);

const originalWindow = globalThis.window;
const originalCustomEvent = globalThis.CustomEvent;
const dispatched = [];
class TestCustomEvent {
  constructor(type, options) {
    this.type = type;
    this.detail = options.detail;
  }
}
globalThis.CustomEvent = TestCustomEvent;
globalThis.window = {
  dispatchEvent(event) {
    dispatched.push(event);
    return true;
  }
};

try {
  assert.equal(trackProductEvent("pricing_viewed", { source: "navigation" }), true);
  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, PRODUCT_ANALYTICS_BROWSER_EVENT);
  assert.deepEqual(dispatched[0].detail, {
    name: "pricing_viewed",
    properties: { source: "navigation" }
  });
} finally {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalCustomEvent === undefined) delete globalThis.CustomEvent;
  else globalThis.CustomEvent = originalCustomEvent;
}

const componentSource = await readFile(new URL("../components/product-analytics.tsx", import.meta.url), "utf8");
const pageAnalyticsSource = await readFile(new URL("../components/page-analytics.tsx", import.meta.url), "utf8");
assert.match(pageAnalyticsSource, /trackProductEvent\("purchase_completed"/);
assert.match(pageAnalyticsSource, /opportunity-scanner:purchase-completed:/);
for (const privacySetting of [
  "autocapture: false",
  "capture_pageview: false",
  "capture_pageleave: false",
  "disable_session_recording: true",
  'persistence: "memory"',
  "sanitize_properties: sanitizePostHogProperties"
]) {
  assert.ok(componentSource.includes(privacySetting), `Missing PostHog privacy setting: ${privacySetting}`);
}
assert.ok(componentSource.includes("<Analytics"), "Vercel Web Analytics component must be rendered");

console.log("Product analytics contract tests passed.");
