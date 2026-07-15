# Live MVP Domain Test Plan

Date: 2026-07-01
Last updated: 2026-07-14

Owner: Project Management Agent
Go/no-go owner: Founder with Chief of Staff Agent

## Objective

Prove that Opportunity Scanner can move a real customer from a company URL to a credible free report, secure payment, account-owned paid access, and an actionable next step on the live domain.

This is a controlled paid-launch test, not a broad public launch. Use founder-approved testers and the operating sequence in [`paid-launch-runbook.md`](paid-launch-runbook.md).

## Current Product Behavior

- A free scan produces a limited report with real opportunity signals.
- A $49 one-time Report is purchased from an existing free report so the paid grant stays tied to the correct scan.
- Monitor is $99 per month or $990 per year and includes one weekly monitored company profile when subscription checkout is explicitly enabled.
- Growth is $249 per month or $2,490 per year and includes up to three daily monitored company profiles when subscription checkout is explicitly enabled.
- One-time Report checkout may start before sign-in; the buyer must complete magic-link sign-in to claim durable account-owned access after payment.
- Monitor and Growth require a verified Supabase Auth session before Stripe Checkout.
- Production accepts only live Stripe credentials, live Checkout sessions, and live webhook objects.
- Paid access is resolved server-side from account ownership, report grants, or active monitoring entitlement. Legacy URL access codes are disabled in production unless the explicit emergency override is enabled.
- If Stripe is incomplete, the product keeps the free scan available and presents paid checkout as temporarily unavailable.
- Production defaults to Report-only checkout. Monitor and Growth must remain unavailable unless `ENABLE_SUBSCRIPTION_CHECKOUT=true` and all four subscription Price IDs are configured.

## Entry Gates

Do not begin a live purchase until all of these are true:

- The intended production release and rollback release are recorded.
- `pnpm run check:launch-env` passes against the production configuration.
- `pnpm run verify:launch` passes on the release candidate.
- `GET /api/health` returns `ready.demo: true`, `ready.paidSignup: true`, `services.stripeMode: "live"`, and the expected service readiness.
- Authenticated `GET /api/health/paid` returns `200` and `ready.paidReport: true`; unauthenticated requests return `401` without operational counts.
- The Supabase migration ledger matches every required entry in `db/migration-manifest.json`.
- Supabase Auth Site URL and redirect allowlist include the production origin and `/auth/callback`.
- The Stripe live webhook endpoint is healthy and subscribed to the required billing events.
- The Resend sender is verified, a production analytics provider is enabled, and cron authentication is configured.
- The founder has approved the buyer email, product, maximum charge, rollback owner, and test window.

## Test Passes

### 1. Demo Readiness

Run fresh scans for the three regression companies:

| Company | Required quality signal |
|---|---|
| Reparel | Healthcare, rehab, DME, VA/prosthetics/orthotics, and buyer/channel motions are credible. |
| Jammcard | Music, arts, live performance, creative workforce, tourism, and local event lanes remain strong. |
| SchoolGig | Education, staffing, workforce, district/vendor, and arts-education lanes remain strong; broad weak fits are screened. |

For each company:

1. Submit the company URL on the live domain.
2. Confirm the scan completes without manual database work.
3. Confirm desktop and phone-width report layouts are usable.
4. Confirm the free report shows useful signals and total value without exposing paid action details.
5. Confirm visible rows have a source, revenue motion, actionability, contact path, and next best action.
6. Confirm no raw JSON, stack traces, secrets, connector responses, or internal scoring data is exposed.
7. Record the scan ID, report URL, completion time, signal count, screenshot, and defects.

Pass when all three scans complete and the evaluator reports no high-priority issue.

### 2. Customer Authentication

1. Request a magic link at `/auth/sign-in` using the approved buyer email.
2. Confirm the message arrives and the link returns to the requested same-origin page through `/auth/callback`.
3. Confirm `/dashboard` loads only the signed-in customer's records.
4. Sign out, request a second link, and confirm expired or reused links fail cleanly.

Pass when the customer can sign in without operator intervention and cannot see another customer's data.

### 3. Controlled One-Time Report Purchase

Use the $49 Report as the minimum live-money proof.

1. Open a fresh free report and start Report checkout from that report's paid gate.
2. Confirm Stripe Checkout shows the intended live product, $49 USD price, buyer email, and no unexpected recurring terms.
3. Complete payment with a founder-approved real card.
4. Confirm Stripe records a live successful payment and the webhook endpoint returns a successful delivery.
5. Complete sign-in if requested and confirm the buyer returns to the same report with the full action layer unlocked.
6. Confirm refresh, sign-out/sign-in, export, opportunity workspace, and workflow access preserve the same report entitlement.
7. Confirm no other report is unlocked.
8. Confirm the receipt reaches the buyer and the configured analytics path records acquisition/conversion evidence without email, scan ID, or query-string leakage.

Pass when payment, webhook fulfillment, account ownership, report-scoped access, receipt, and analytics all agree.

### 4. Subscription Purchase And Monitoring

Run this pass only if Monitor or Growth will be available to customers at launch. Before the pass, confirm `ENABLE_SUBSCRIPTION_CHECKOUT=true`, all four subscription Price IDs are configured, and `GET /api/health` reports `ready.subscriptionCheckout: true`.

1. Sign in before checkout and purchase the approved monthly or annual plan.
2. Confirm the active subscription appears in Stripe and the customer's dashboard.
3. Confirm checkout returns to `/dashboard/onboarding` and requires an eligible completed report.
4. Add a report to monitoring and verify plan capacity: Monitor allows one weekly profile; Growth allows up to three daily profiles.
5. Trigger or wait for the approved monitoring run, then confirm a durable run result, report ownership, comparison state, and any new-opportunity alert.
6. Open the Stripe billing portal from the dashboard and confirm the customer can manage the plan.
7. Cancel the test subscription or schedule cancellation according to the approved cleanup plan, then verify the webhook updates access correctly.

Capacity warning: the current scheduled monitoring worker claims one due profile per invocation and the production schedule runs once daily. Subscription launch is no-go unless expected due profiles fit that throughput or an independently verified operating schedule supplies enough invocations.

### 5. Email, Analytics, And Operations

- Resend: confirm the verified sender can deliver one monitoring or deadline alert and one consent-eligible nurture message; verify unsubscribe links and suppression behavior.
- Analytics: confirm Vercel pageviews/referrers/UTMs and persisted first-touch scan attribution arrive. If PostHog is configured, confirm allowlisted pricing, checkout, purchase, dashboard, onboarding, and monitoring events; keep autocapture and session replay disabled.
- Monitoring: record due profile count, claimed/completed/failed runs, alert queue depth, and delivery failures for the test window.
- Stripe: inspect webhook delivery failures, duplicate handling, refunds/disputes, and subscription status changes.
- Supabase: inspect schema ledger parity and the expected customer, ownership, grant/subscription, monitoring, and webhook-event records without exporting secrets or unnecessary personal data.

## Evidence Package

The Project Management Agent records:

- Domain, environment, release commit, deployment ID, test date/time, and operators.
- Output of the launch preflight and launch verification.
- `/api/health` response with configuration values absent.
- Migration manifest/ledger parity result.
- Reparel, Jammcard, and SchoolGig scan IDs, report URLs, counts, evaluator result, and desktop/mobile evidence.
- Auth email delivery and callback result.
- Stripe live Product/Price IDs checked, webhook endpoint status, payment/subscription object IDs, amount, currency, and receipt result.
- Supabase entitlement and ownership result.
- Resend delivery result and analytics/attribution result.
- Monitoring capacity calculation and observed run/alert counts.
- Refund/cancellation outcome for any controlled test charge that should not remain active.
- Known defects, owners, severity, workarounds, and rollback status.

Do not place card data, secret values, magic links, auth tokens, webhook signatures, or service-role credentials in the evidence package.

`/api/health` does not query migration-manifest/ledger parity. Treat its database status as configuration readiness only and attach a separately verified parity result to the evidence package.

## Go Criteria

- All entry gates pass on the exact deployed release.
- All three regression scans pass on desktop and mobile with no high-priority quality issue.
- Magic-link authentication and customer isolation pass.
- The controlled $49 Report purchase creates only the intended report entitlement and survives a new session.
- Stripe live webhook delivery is healthy and idempotent.
- The private paid-operations health gate confirms recent webhook persistence, delivery recovery coverage, and no stale or failed paid Report delivery.
- Required Supabase migrations and production Auth settings are verified.
- Required customer emails deliver from a verified sender with working unsubscribe behavior where applicable.
- The configured analytics and attribution path records acquisition and paid-funnel evidence without personal data or sensitive URL parameters.
- Monitoring capacity is measured and sufficient for every subscription offered.
- A rollback owner and known-good release are named, and cleanup of the controlled purchase is complete or intentionally documented.

## No-Go Conditions

- `/api/health` is demo-ready but not paid-signup-ready.
- A launch check, migration parity check, or regression scan fails.
- Stripe uses test mode, a Price ID maps to the wrong product/amount/interval, or the live webhook is failing.
- Payment succeeds but access, ownership, dashboard state, receipt, or analytics does not reconcile.
- A customer can access another customer's report, monitoring profile, billing account, or internal data.
- Magic links do not reliably return to the production domain.
- Resend sender verification, required unsubscribe behavior, or alert delivery is incomplete.
- Subscription demand can exceed the verified monitoring worker throughput.
- Rollback cannot stop new purchases while preserving webhook handling for existing payments.

## Founder Decision

The Chief of Staff Agent summarizes the evidence and recommends one of three decisions:

- **Go - Report only:** accept one-time Report purchases while Monitor and Growth remain visibly unavailable and the checkout API rejects both subscription plans.
- **Go - Paid plans:** accept Report, Monitor, and Growth purchases only after subscription capacity, operations, and `ready.subscriptionCheckout` are verified.
- **No-go:** stop new paid traffic, execute the rollback section of the runbook, assign blockers, and repeat the failed pass.

## Definition Of Done

The live MVP is ready for paid launch when the founder can review one evidence package and see that the exact production release is demo-ready, money-ready, account-safe, email- and analytics-observable, supportable at the offered monitoring capacity, and recoverable through a rehearsed rollback.
