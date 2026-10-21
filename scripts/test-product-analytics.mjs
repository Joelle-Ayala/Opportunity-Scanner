import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  GOOGLE_CONSENT_SIGNALS,
  analyticsGrantedGoogleConsent,
  deniedGoogleConsent,
  googleAnalyticsConfig,
  googleAnalyticsMeasurementId,
  googleAnalyticsPageView,
  planGoogleAnalytics
} from "../lib/googleAnalytics.ts";
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
  ["checkout_return_viewed", { plan: "growth", billing_period: "annual" }],
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
assert.match(pageAnalyticsSource, /trackProductEvent\("checkout_return_viewed"/);
assert.doesNotMatch(pageAnalyticsSource, /trackProductEvent\("purchase_completed"/);
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
assert.match(componentSource, /function trackingEnabled/);
assert.match(componentSource, /trackingEnabled\(consent\)/);
assert.doesNotMatch(componentSource, /consent !== "analytics"/);
assert.match(componentSource, /NEXT_PUBLIC_HUBSPOT_PORTAL_ID/);
assert.match(componentSource, /postHog\.group\("company"/);

const googleAnalyticsSource = await readFile(new URL("../lib/googleAnalytics.ts", import.meta.url), "utf8");
const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const launchCheck = await readFile(new URL("./check-launch-env.mjs", import.meta.url), "utf8");
const productionMeasurementId = "G-0MLMTPZ84W";

assert.equal(googleAnalyticsMeasurementId(productionMeasurementId), productionMeasurementId);
assert.equal(googleAnalyticsMeasurementId(`  ${productionMeasurementId}  `), productionMeasurementId);
assert.equal(googleAnalyticsMeasurementId(""), null);
assert.equal(googleAnalyticsMeasurementId("   "), null);
assert.equal(googleAnalyticsMeasurementId(undefined), null);
assert.equal(googleAnalyticsMeasurementId("g-0mlmtpz84w"), null);
assert.equal(googleAnalyticsMeasurementId("UA-123456"), null);
assert.equal(googleAnalyticsMeasurementId(`${productionMeasurementId}";alert(1)`), null);
assert.equal(googleAnalyticsMeasurementId(`https://example.com/?id=${productionMeasurementId}`), null);

for (const signal of GOOGLE_CONSENT_SIGNALS) {
  assert.equal(deniedGoogleConsent()[signal], "denied", `${signal} must default to denied`);
}
const granted = analyticsGrantedGoogleConsent();
assert.equal(granted.analytics_storage, "granted");
for (const signal of GOOGLE_CONSENT_SIGNALS) {
  if (signal === "analytics_storage") continue;
  assert.equal(granted[signal], "denied", `${signal} stays denied when analytics storage is granted`);
}
assert.equal(googleAnalyticsConfig().send_page_view, false);

assert.deepEqual(
  googleAnalyticsPageView(
    "https://www.opportunityscanner.ai",
    "/pricing?utm_source=secret&email=private%40example.com#details",
    "https://partner.example/landing?utm_campaign=spring#top"
  ),
  {
    page_path: "/pricing",
    page_location: "https://www.opportunityscanner.ai/pricing",
    page_referrer: "https://partner.example/landing"
  }
);
assert.deepEqual(
  googleAnalyticsPageView("https://www.opportunityscanner.ai", "/reports/abc", ""),
  {
    page_path: "/reports/abc",
    page_location: "https://www.opportunityscanner.ai/reports/abc"
  }
);

const measurementId = "G-TEST1234";
const beforeConsent = planGoogleAnalytics({
  measurementId,
  consent: null,
  defaultSet: false,
  configured: false
});
assert.equal(beforeConsent.loadScript, true);
assert.equal(beforeConsent.trackPageViews, true);
assert.deepEqual(beforeConsent.commands[0], ["consent", "default", analyticsGrantedGoogleConsent()]);
assert.equal(beforeConsent.commands[0][2].analytics_storage, "granted");
assert.equal(beforeConsent.commands[0][2].ad_storage, "denied");
assert.deepEqual(beforeConsent.commands.at(-2), ["js"]);
assert.deepEqual(beforeConsent.commands.at(-1), ["config", measurementId, googleAnalyticsConfig()]);
assert.ok(beforeConsent.commands.findIndex((command) => command[1] === "default") < beforeConsent.commands.findIndex((command) => command[0] === "config"));

const optedOutBeforeLoad = planGoogleAnalytics({
  measurementId,
  consent: "necessary",
  defaultSet: false,
  configured: false
});
assert.equal(optedOutBeforeLoad.loadScript, false);
assert.equal(optedOutBeforeLoad.trackPageViews, false);
assert.deepEqual(optedOutBeforeLoad.commands, []);

const necessaryOnly = planGoogleAnalytics({
  measurementId,
  consent: "necessary",
  defaultSet: true,
  configured: true
});
assert.equal(necessaryOnly.loadScript, false);
assert.equal(necessaryOnly.trackPageViews, false);
assert.deepEqual(necessaryOnly.commands, [["consent", "update", deniedGoogleConsent()]]);

const allowAnalytics = planGoogleAnalytics({
  measurementId,
  consent: "analytics",
  defaultSet: false,
  configured: false
});
assert.equal(allowAnalytics.loadScript, true);
assert.equal(allowAnalytics.trackPageViews, true);
assert.deepEqual(allowAnalytics.commands[0], ["consent", "default", analyticsGrantedGoogleConsent()]);
assert.deepEqual(allowAnalytics.commands.at(-2), ["js"]);
assert.deepEqual(allowAnalytics.commands.at(-1), ["config", measurementId, googleAnalyticsConfig()]);

const alreadyConfigured = planGoogleAnalytics({
  measurementId,
  consent: "analytics",
  defaultSet: true,
  configured: true
});
assert.equal(alreadyConfigured.loadScript, false);
assert.equal(alreadyConfigured.trackPageViews, true);
assert.deepEqual(alreadyConfigured.commands, [["consent", "update", analyticsGrantedGoogleConsent()]]);

const unset = planGoogleAnalytics({
  measurementId: null,
  consent: "analytics",
  defaultSet: false,
  configured: false
});
assert.deepEqual(unset, { loadScript: false, trackPageViews: false, commands: [] });

assert.match(componentSource, /googleAnalyticsMeasurementId\(process\.env\.NEXT_PUBLIC_GA_MEASUREMENT_ID\)/);
assert.match(componentSource, /if \(!measurementId\) return;/);
assert.match(componentSource, /if \(plan\.loadScript && !document\.getElementById\(GOOGLE_ANALYTICS_SCRIPT_ID\)\)/);
assert.match(componentSource, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=\$\{measurementId\}/);
assert.match(componentSource, /gtag\("event", "page_view"/);
assert.match(componentSource, /googleAnalyticsPageView\(window\.location\.origin, pathname \|\| "\/", document\.referrer\)/);
assert.doesNotMatch(componentSource, /G-0MLMTPZ84W/);
assert.doesNotMatch(googleAnalyticsSource, /G-0MLMTPZ84W/);
assert.match(envExample, /NEXT_PUBLIC_GA_MEASUREMENT_ID=G-0MLMTPZ84W/);
assert.match(launchCheck, /googleAnalyticsMeasurementId/);
assert.doesNotMatch(launchCheck, /G-0MLMTPZ84W/);

const emptyDirectory = mkdtempSync(join(tmpdir(), "opportunity-scanner-ga-env-"));
const launchCheckPath = fileURLToPath(new URL("./check-launch-env.mjs", import.meta.url));
function runLaunchCheck(gaMeasurementId) {
  const env = { ...process.env };
  if (gaMeasurementId === undefined) delete env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  else env.NEXT_PUBLIC_GA_MEASUREMENT_ID = gaMeasurementId;
  return spawnSync(process.execPath, [launchCheckPath], {
    cwd: emptyDirectory,
    env,
    encoding: "utf8"
  });
}

try {
  const invalid = runLaunchCheck("UA-SECRET123");
  const invalidOutput = `${invalid.stdout}${invalid.stderr}`;
  assert.match(invalidOutput, /NEXT_PUBLIC_GA_MEASUREMENT_ID must be a GA4 measurement ID/);
  assert.doesNotMatch(invalidOutput, /UA-SECRET123/);

  const valid = runLaunchCheck(productionMeasurementId);
  const validOutput = `${valid.stdout}${valid.stderr}`;
  assert.match(validOutput, /Google Analytics 4 is configured/);
  assert.doesNotMatch(validOutput, /must be a GA4 measurement ID/);
  assert.doesNotMatch(validOutput, new RegExp(productionMeasurementId));

  const missing = runLaunchCheck(undefined);
  const missingOutput = `${missing.stdout}${missing.stderr}`;
  assert.doesNotMatch(missingOutput, /Google Analytics 4 is configured/);
  assert.doesNotMatch(missingOutput, /must be a GA4 measurement ID/);
} finally {
  rmSync(emptyDirectory, { recursive: true, force: true });
}

console.log("Product analytics contract tests passed.");
