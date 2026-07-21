import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  companyDomainFromEmail,
  companyDomainFromUrl,
  sanitizeKnownCompanyIdentity
} from "../lib/companyAnalytics.ts";
import {
  parseTrackingConsent,
  trackingConsentCookieAssignment
} from "../lib/trackingConsent.ts";
import { verifiedPurchaseFromStripeEvent } from "../lib/payments/analytics.ts";

assert.equal(parseTrackingConsent("analytics"), "analytics");
assert.equal(parseTrackingConsent("necessary"), "necessary");
assert.equal(parseTrackingConsent("anything-else"), null);
assert.match(trackingConsentCookieAssignment("analytics", true), /SameSite=Lax; Secure$/);

assert.equal(companyDomainFromUrl("https://www.schoolgig.us/path"), "schoolgig.us");
assert.equal(companyDomainFromEmail("Joelle@Reparel.com"), "reparel.com");
assert.deepEqual(sanitizeKnownCompanyIdentity({
  userId: "account-123",
  email: "JOELLE@REPAREL.COM",
  companyDomain: "https://www.reparel.com/path",
  companyName: "Reparel"
}), {
  userId: "account-123",
  email: "joelle@reparel.com",
  companyDomain: "reparel.com",
  companyName: "Reparel"
});

const purchaseEvent = {
  type: "checkout.session.completed",
  data: {
    object: {
      payment_status: "paid",
      customer_details: { email: "private@example.com" },
      metadata: { product: "report", billing_interval: "one_time" }
    }
  }
};
assert.deepEqual(verifiedPurchaseFromStripeEvent(purchaseEvent), {
  plan: "full_report",
  billingPeriod: "one_time"
});
assert.equal(verifiedPurchaseFromStripeEvent({
  ...purchaseEvent,
  data: { object: { ...purchaseEvent.data.object, payment_status: "unpaid" } }
}), null);

const [layout, consent, analytics, attribution, dashboard, checkout, privacy, handlers] = await Promise.all([
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/tracking-consent.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/product-analytics.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/first-touch-attribution.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/dashboard/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/checkout-button.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/payments/handlers.ts", import.meta.url), "utf8")
]);

assert.match(layout, /<TrackingConsentBanner \/>/);
assert.match(consent, /globalPrivacyControl/);
assert.match(consent, /Necessary only/);
assert.match(consent, /Allow analytics/);
assert.match(attribution, /currentTrackingConsent\(\) !== "analytics"/);
assert.match(analytics, /js\.hs-scripts\.com/);
assert.match(analytics, /DEFAULT_HUBSPOT_PORTAL_ID = "44475527"/);
assert.match(analytics, /\["identify", \{ email: identity\.email \}\]/);
assert.match(analytics, /\["revokeCookieConsent"\]/);
assert.match(dashboard, /companyDomainFromEmail\(session\.user\.email\)/);
assert.doesNotMatch(dashboard, /companyDomain=\{[^}]*report/i);
assert.doesNotMatch(checkout, /window\.localStorage/);
assert.match(checkout, /window\.sessionStorage/);
assert.match(privacy, /Known customers and company activity/);
assert.match(handlers, /if \(processed\)[\s\S]*trackVerifiedStripePurchase/);

console.log("Company analytics, consent, identity separation, and verified purchase checks passed.");
