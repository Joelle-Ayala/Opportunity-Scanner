import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [checkoutButton, pricingPage] = await Promise.all([
  readFile(new URL("../components/checkout-button.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8")
]);

assert.match(checkoutButton, /body\?\.error\?\.code === "AUTHENTICATION_REQUIRED" && plan !== "report"/);
assert.match(checkoutButton, /window\.sessionStorage\.setItem\(PENDING_CHECKOUT_KEY, JSON\.stringify\(pendingCheckout\)\)/);
assert.match(checkoutButton, /plan,\s*billingInterval,\s*createdAt: Date\.now\(\)/);
assert.doesNotMatch(checkoutButton, /type PendingSubscriptionCheckout = \{[\s\S]*customerEmail:/);
assert.match(checkoutButton, /const nextPath = `\/pricing\?\$\{returnParams\.toString\(\)\}#\$\{plan\}-checkout`/);
assert.match(checkoutButton, /window\.location\.assign\(`\/auth\/sign-in\?next=\$\{encodeURIComponent\(nextPath\)\}`\)/);
assert.doesNotMatch(checkoutButton, /returnParams\.set\(["'](?:email|customerEmail)["']/);
assert.match(checkoutButton, /pending\.plan === plan/);
assert.match(checkoutButton, /pending\.billingInterval === initialBillingInterval/);
assert.match(checkoutButton, /window\.sessionStorage\.removeItem\(PENDING_CHECKOUT_KEY\)/);
assert.match(checkoutButton, /PENDING_CHECKOUT_MAX_AGE_MS/);
assert.match(checkoutButton, /Resume Secure Checkout/);

assert.match(pricingPage, /searchParams\?\.checkout !== "resume"/);
assert.match(pricingPage, /searchParams\.plan !== "monitor" && searchParams\.plan !== "growth"/);
assert.match(pricingPage, /searchParams\.billing_interval !== "monthly" && searchParams\.billing_interval !== "annual"/);
assert.match(
  pricingPage,
  /initialBillingInterval=\{resumeCheckout[\s\S]*resumeCheckout\.plan === checkoutPlan[\s\S]*\? resumeCheckout\.billingInterval[\s\S]*: undefined[\s\S]*: nurtureBillingIntent\(searchParams\)\}/
);
assert.match(pricingPage, /resumeCheckout=\{resumeCheckout\?\.plan === checkoutPlan\}/);
assert.match(pricingPage, /id=\{`\$\{checkoutPlan\}-checkout`\}/);

const appOrigin = "https://scanner.example.test";
for (const plan of ["monitor", "growth"]) {
  for (const billingInterval of ["monthly", "annual"]) {
    const returnParams = new URLSearchParams({
      checkout: "resume",
      plan,
      billing_interval: billingInterval
    });
    const nextPath = `/pricing?${returnParams.toString()}#${plan}-checkout`;
    const signInUrl = new URL(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`, appOrigin);
    const resumeUrl = new URL(signInUrl.searchParams.get("next"), appOrigin);

    assert.equal(signInUrl.origin, appOrigin);
    assert.equal(signInUrl.pathname, "/auth/sign-in");
    assert.equal(resumeUrl.origin, appOrigin);
    assert.equal(resumeUrl.pathname, "/pricing");
    assert.equal(resumeUrl.searchParams.get("plan"), plan);
    assert.equal(resumeUrl.searchParams.get("billing_interval"), billingInterval);
    assert.equal(resumeUrl.hash, `#${plan}-checkout`);
    assert.equal(resumeUrl.searchParams.has("email"), false);
  }
}

console.log("Anonymous subscription checkout recovery checks passed.");
