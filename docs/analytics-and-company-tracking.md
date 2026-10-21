# Analytics and Company Tracking

Updated: 2026-07-21
Owner: Chief of Staff Agent with Connector, Back-End, and QA agents

## Measurement model

1. **Vercel Analytics** is the anonymous aggregate layer for traffic, pages, referrers, devices, and privacy-safe product events. It is cookieless and stays on.
2. **First-touch attribution** stores a random identifier, landing path, referrer hostname, and UTM fields on the first visit unless the visitor has turned analytics off. It never stores form answers, emails, full query strings, or scanned-company URLs.
3. **PostHog** receives allowlisted product events by default when both PostHog environment variables are set, and stops after the visitor turns analytics off. Authenticated users use the stable customer account ID. Company grouping uses the customer work-email domain, never the company currently being scanned.
4. **HubSpot** loads on the first page view and stops after the visitor turns analytics off. It tracks SPA page views and identifies a visitor only after a real email is provided or the customer signs in.
5. **Google Analytics 4** is optional. It loads on the first page view when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set, with no consent click. Consent Mode v2 defaults `analytics_storage` to granted and leaves advertising and personalization signals denied. Page views fire on that first view and on later client route changes, without query strings. Turning analytics off denies storage and stops later page views. The production measurement ID is `G-0MLMTPZ84W`, supplied by the environment rather than hardcoded. Unset the variable to keep the tag off.
6. **Supabase and Stripe** remain authoritative for scans, report state, purchases, refunds, subscriptions, and entitlements. Browser events explain behavior but cannot grant access or create revenue truth.

## Funnel events

- Scan started, completed, and viewed
- Email captured with marketing-consent state, without the email value
- Pricing viewed
- Checkout started and checkout return viewed
- Verified purchase completed from the idempotent Stripe webhook
- Dashboard viewed and dashboard action selected
- Report source/action selected, including solicitation review, eligibility check, target research, monitoring, and workflow send
- Monitoring onboarding, saved-search changes, comparisons, and billing portal use

## Company tracking rules

- A consultant can scan many client websites. A scanned company is not automatically the consultant's customer organization.
- Known-account company association uses a stable account ID and normalized work-email domain until a first-party customer-organization model is added.
- HubSpot Buyer Intent may infer an anonymous visiting company from network and activity data. It does not prove the identity of a specific person and can be inaccurate on home, mobile, shared, or VPN networks.
- Sign-out resets PostHog identity and revokes HubSpot tracking cookies for the prior known session.

## Production configuration

- HubSpot portal tracking uses the Minting House portal `20159837`. The script is `https://js.hs-scripts.com/20159837.js`. `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` overrides that default when set. The script loads on the first page view unless the visitor has turned analytics off.
- PostHog remains optional and requires `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`.
- Google Analytics 4 remains optional. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-0MLMTPZ84W` in the build environment. It does not replace the Vercel or PostHog launch requirement.
- HubSpot server-side CRM synchronization is not enabled. It requires a private app or OAuth credential, a reviewed contact/company/deal field map, deduplication, and failure logging.

## Verification

Run:

```bash
pnpm run test:product-analytics
pnpm run test:company-analytics
pnpm run test:scan-attribution
pnpm run test:payments-contract
pnpm run typecheck
```

Browser QA must verify fresh visit, necessary-only, allow analytics, Global Privacy Control, preference reset, known-account association, sign-out reset, and absence of email/report contents in analytics payloads.
