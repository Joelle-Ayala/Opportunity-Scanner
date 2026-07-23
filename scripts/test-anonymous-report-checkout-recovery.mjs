import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { handleCheckout } from "../lib/payments/handlers.ts";

const SCAN_ID = "91a3e66c-2c07-46cf-ab0c-3768375e050a";
const APP_URL = "https://scanner.example.test";

const captured = [];
const response = await handleCheckout(
  new Request(`${APP_URL}/api/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan: "report",
      billingInterval: null,
      customerEmail: "buyer@example.com",
      scanId: SCAN_ID,
      requestId: "5d4ec747-3c53-4ed7-bfbb-d431ddda01d9"
    })
  }),
  null,
  {
    getConfig: () => ({
      secretKey: "sk_test_recovery",
      webhookSecret: "whsec_recovery",
      appUrl: APP_URL,
      subscriptionCheckoutEnabled: false,
      prices: {
        report: "price_report",
        monitorMonthly: "",
        monitorAnnual: "",
        growthMonthly: "",
        growthAnnual: "",
        requireLivemode: false
      }
    }),
    inspectReport: async (scanId) => scanId === SCAN_ID
      ? { ok: true }
      : { ok: false, status: 404, code: "SCAN_NOT_FOUND", message: "The report scan was not found." },
    verifyReportCatalog: async () => ({
      ok: true,
      code: "VERIFIED",
      reason: "Configured Report price verified.",
      checkedAt: "2026-07-14T12:00:00.000Z"
    }),
    createSession: async (input) => {
      captured.push(input);
      return { id: "cs_test_recovery", url: "https://checkout.stripe.com/c/pay/recovery" };
    }
  }
);

assert.equal(response.status, 201);
assert.equal(captured.length, 1);
assert.equal(
  captured[0].successUrl,
  `${APP_URL}/auth/sign-in?next=%2Freports%2F${SCAN_ID}%3Fcheckout%3Dsuccess%26session_id%3D{CHECKOUT_SESSION_ID}`
);
assert.equal(
  captured[0].cancelUrl,
  `${APP_URL}/reports/${SCAN_ID}?checkout=cancelled#checkout-return`
);
assert.doesNotMatch(captured[0].successUrl, /buyer%40example\.com|buyer@example\.com/);

const [access, signIn, report, pricing, checkoutButton] = await Promise.all([
  readFile(new URL("../lib/payments/access.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/auth/sign-in/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/reports/[id]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/checkout-button.tsx", import.meta.url), "utf8")
]);

assert.match(access, /resolveVerifiedReportCheckoutSignIn/);
assert.match(report, /searchParams\?\.checkout === "cancelled"/);
assert.match(report, /Checkout was canceled/);
assert.doesNotMatch(report, /No charge was made/);
assert.match(report, /source=checkout_return&scanId=/);
assert.match(report, /Checkout return needs verification/);
assert.match(report, /checkoutHandoffFailed/);
assert.match(report, /Retry verification/);
assert.match(report, /paidReportClaimSupportHref\(scan\.id\)/);
assert.match(report, /reportCheckoutIsEnabled/);
assert.match(report, /return reportCheckoutIsEnabled\(\) \? "available" : "paused"/);
assert.match(report, /checkoutAvailability === "paused"/);
assert.match(report, /Checkout paused/);
assert.match(report, /!isPaid && !checkoutHandoffFailed/);
assert.match(pricing, /searchParams\?\.source === "report_gate" \|\| searchParams\?\.source === "checkout_return"/);
assert.match(pricing, /scanId=\{reportScanId\}/);
assert.match(checkoutButton, /if \(!checkoutEnabled\)/);
assert.match(checkoutButton, /plan === "report" \? "Checkout Paused"/);
assert.ok(
  checkoutButton.indexOf("if (!checkoutEnabled)") < checkoutButton.indexOf("if (!canCheckout)"),
  "Disabled Report checkout must render its paused state before the free-scan fallback"
);
assert.match(checkoutButton, /This is a one-time purchase/);
assert.match(checkoutButton, /Full report access is delivered after payment confirmation/);
assert.match(checkoutButton, /Fees are non-refundable except where required by law/);
assert.match(checkoutButton, /href="\/terms"/);
assert.match(checkoutButton, /href="\/privacy"/);
assert.match(access, /isMatchingPaidReportSession\(session, checkoutReturn\.scanId, config\.prices\.report\)/);
assert.match(access, /hasOnlyExpectedParams/);
assert.match(access, /checkoutStates\[0\] !== "success"/);
assert.match(
  access,
  /return \{\s*checkoutEmail: session\.customer_details!\.email![^,]+,\s*scanId: checkoutReturn\.scanId\s*\}/
);

assert.match(signIn, /await resolveVerifiedReportCheckoutSignIn\(nextPath\)/);
assert.match(signIn, /defaultValue=\{checkoutRecovery\?\.checkoutEmail\}/);
assert.match(signIn, /readOnly=\{Boolean\(checkoutRecovery\)\}/);
assert.match(signIn, /Contact support/);
assert.match(signIn, /`Report ID: \$\{scanId\}`/);
assert.doesNotMatch(signIn, /purchaseSupportHref\([^)]*session/i);

console.log("Anonymous Report checkout recovery tests passed.");
