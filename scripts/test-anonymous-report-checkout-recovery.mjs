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
    scanExists: async (scanId) => scanId === SCAN_ID,
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
assert.equal(captured[0].cancelUrl, `${APP_URL}/reports/${SCAN_ID}?checkout=cancelled`);
assert.doesNotMatch(captured[0].successUrl, /buyer%40example\.com|buyer@example\.com/);

const [access, signIn] = await Promise.all([
  readFile(new URL("../lib/payments/access.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/auth/sign-in/page.tsx", import.meta.url), "utf8")
]);

assert.match(access, /resolveVerifiedReportCheckoutSignIn/);
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
