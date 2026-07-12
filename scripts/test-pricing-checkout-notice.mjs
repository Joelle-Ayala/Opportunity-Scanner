import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pricingCheckoutNoticeFor } from "../components/pricing-checkout-notice-state.ts";

const success = pricingCheckoutNoticeFor("success");
assert.deepEqual(success, {
  title: "Checkout complete",
  message: "Thanks, your plan is set. Stripe will email your receipt and billing details to the address used at checkout.",
  tone: "success"
});

const cancelled = pricingCheckoutNoticeFor("cancelled");
assert.deepEqual(cancelled, {
  title: "Checkout canceled",
  message: "No payment was taken. You can review the options below or continue with a free scan.",
  tone: "neutral"
});

for (const checkout of [undefined, null, "", "cancel", "failed", ["success"]]) {
  assert.equal(pricingCheckoutNoticeFor(checkout), null);
}

const [component, pricingPage] = await Promise.all([
  readFile(new URL("../components/pricing-checkout-notice.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8")
]);

assert.match(component, /role="status"/);
assert.match(component, /aria-live="polite"/);
assert.match(component, /aria-atomic="true"/);
assert.doesNotMatch(component, /session_id/i);
assert.match(pricingPage, /<PricingCheckoutNotice checkout=\{searchParams\?\.checkout\} \/>/);

console.log("Pricing checkout notice tests passed.");
