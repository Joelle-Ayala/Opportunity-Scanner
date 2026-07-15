# Paid Launch Runbook

Last updated: 2026-07-14
Decision owner: Founder
Integration owner: Chief of Staff Agent
Evidence owner: Project Management Agent

## Purpose

Use this runbook to move Opportunity Scanner from a working live demo to controlled collection of real customer payments. Do not treat a healthy homepage or successful scan as proof that paid signup is ready.

## Readiness Levels

| Level | Meaning | Required proof |
|---|---|---|
| Demo-ready | A visitor can submit a URL, receive a report, and review a clean free experience. | `/api/health` shows `ready.demo: true`; all three regression scans pass. |
| Paid-signup-ready | A real buyer can pay, sign in, receive account-owned access, and be supported after purchase. | `/api/health` shows `ready.paidSignup: true` and `stripeMode: "live"`; Stripe, Supabase Auth/migrations, Resend, analytics, capacity, purchase, and rollback checks below pass. |

The default first paid launch is controlled and Report-only. Offer Monitor or Growth only after the subscription and monitoring-capacity gates pass.

Keep `ENABLE_PAID_REPORT_CHECKOUT=false` until every Report-only gate below passes. Set it to `true` only for the approved controlled purchase window or the final paid launch. Turning it back to `false` stops new Report Checkout sessions without disabling the Stripe webhook needed for receipts, refunds, disputes, and existing access.

## 1. Freeze The Candidate

- Record the production commit, deployment ID, domain, test window, launch owner, support owner, and known-good rollback deployment.
- Stop unrelated production changes during the purchase test.
- Confirm no secrets, local data, generated output, or unrelated changes are included in the release.
- Run `pnpm run check:launch-env` against production configuration.
- Run `pnpm run verify:launch` on the exact release candidate.
- Open `GET /api/health`; save the response and confirm it contains service booleans and release ID only, never secret values.
- Query `GET /api/health/paid` with `Authorization: Bearer <CRON_SECRET>`; confirm it returns no customer identifiers and use its strict `200`/`503` result as the paid Report operations gate.

## 2. Prove Demo Readiness

- Run fresh live scans for Reparel, Jammcard, and SchoolGig.
- Review each report on desktop and phone width.
- Confirm visible opportunities include source evidence, revenue motion, actionability, contact path, and next best action.
- Confirm the free report is useful, the paid action layer remains locked, and normal users see no raw/debug data.
- Run the report evaluator and resolve every high-priority issue.

Demo-ready is necessary but does not authorize payment collection.

## 3. Configure Supabase

### Database

1. Back up the production project and confirm the project identity.
2. Run `db/schema-migrations.sql` to establish the append-only migration ledger.
3. Apply every required entry in `db/migration-manifest.json` in order, one transaction per entry, and record it in `public.schema_migrations` in the same transaction.
4. Compare the production ledger to the manifest. Stop on a missing prerequisite, checksum mismatch, changed historical migration, or unrecorded production SQL.
5. Verify row-level security and service-role-only functions for billing, customer ownership, monitoring, alerts, and migration recording.

Never roll back paid launch by deleting migration rows or reversing additive migrations. Fix forward or redeploy application code that remains compatible with the applied schema.

### Customer Auth

- Configure the Supabase Auth Site URL as the canonical production origin in `APP_URL`.
- Allow the production callback `https://www.opportunityscanner.ai/auth/callback` and any intentionally supported non-`www` canonical redirect.
- Confirm magic-link email delivery, PKCE callback completion, same-origin return paths, secure session cookies, sign-out, and expired/reused-link handling.
- Confirm a signed-in customer sees only account-owned scans, reports, saved searches, monitoring, and billing.

## 4. Configure Stripe Live Mode

### Products And Prices

Verify the five production Price IDs map exactly to:

| Environment variable | Product | Billing |
|---|---|---|
| `STRIPE_PRICE_REPORT` | Report, $49 | One-time |
| `STRIPE_PRICE_MONITOR_MONTHLY` | Monitor, $99 | Monthly |
| `STRIPE_PRICE_MONITOR_ANNUAL` | Monitor, $990 | Annual |
| `STRIPE_PRICE_GROWTH_MONTHLY` | Growth, $249 | Monthly |
| `STRIPE_PRICE_GROWTH_ANNUAL` | Growth, $2,490 | Annual |

Confirm currency, tax behavior, receipt settings, customer statement text, and billing portal configuration before the test. Production must use an `sk_live_*` secret. The application rejects test Checkout sessions and test webhook objects in production.

### Webhook

- Create the live endpoint `https://www.opportunityscanner.ai/api/stripe/webhook`.
- Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
- Subscribe to: `customer.created`, `customer.updated`, `customer.deleted`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, and `charge.dispute.funds_reinstated`.
- Confirm Stripe receives a `2xx` response, duplicate events are harmless, and failures can be retried.
- Confirm paid Report fulfillment sends one idempotent sign-in-and-claim email when the buyer closes the Checkout success tab, and that it never exposes Stripe or auth tokens.
- Keep webhook processing active during rollback so refunds, disputes, cancellations, and subscription status changes continue to update access.

## 5. Configure Customer Email

- Verify the sending domain in Resend and set `RESEND_FROM_EMAIL` to an approved address on that domain.
- Use Google Workspace Business Starter for the monitored `support@opportunityscanner.ai` mailbox. Configure the exact Google-issued MX, SPF, and DKIM records in GoDaddy, then prove the inbox can send and receive customer replies.
- Keep Resend on its provider-issued sending subdomain records for transactional product email. Do not place Resend inbound MX records at the root domain.
- Configure `RESEND_API_KEY`, `ALERT_UNSUBSCRIBE_SECRET`, and `NURTURE_UNSUBSCRIBE_SECRET` in production.
- Send one monitoring/deadline alert to the founder test inbox and verify subject, report link, sender identity, and delivery status.
- Send nurture email only for a consent-eligible test record. Verify one-click and visible unsubscribe links, then confirm suppression prevents future sends.
- Confirm Stripe receipts separately in Stripe. Resend does not replace Stripe's payment receipt.

No-go if required customer email is landing in spam, the sender is unverified, or unsubscribe behavior fails.

## 6. Configure Product Analytics

- Enable Vercel Web Analytics and set `VERCEL_WEB_ANALYTICS_ENABLED=true`, or configure both `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`.
- With Vercel Analytics, confirm production pageviews, referrers, and UTM parameters arrive. Reconcile scan first-touch attribution with Stripe and Supabase for conversion reporting.
- When PostHog is configured, also confirm `pricing_viewed`, `checkout_started`, `purchase_completed`, `dashboard_viewed`, `monitoring_onboarding_viewed`, and `monitoring_onboarding_completed` arrive when their steps occur.
- Review the aggregate 7-day and 90-day launch-funnel snapshot by first-touch source, medium, and campaign; confirm it excludes emails, company URLs, report IDs, and full referrers.
- Review normalized MRR by both product (Monitor/Growth) and billing schedule (monthly/annual), including subscription count, MRR contribution, and mix share against the $10,000 target.
- Confirm events contain only the allowlisted plan, billing period, source, state, and aggregate status fields.
- Confirm email addresses, scan IDs, Stripe IDs, auth tokens, and URL query strings are absent.
- If PostHog is used, keep autocapture, pageview capture, session replay, and persistent anonymous profiling disabled.

Use Stripe and Supabase as the financial/access source of truth. Analytics is evidence of funnel behavior, not entitlement.

## 7. Prove Monitoring Capacity

Customer plan limits:

- Monitor: one saved company profile, weekly cadence.
- Growth: up to three saved company profiles, daily cadence.

Current operating capacity:

- The worker supports a bounded batch of 1-10 due profiles per invocation, defaults to five, and processes up to three profiles concurrently by default.
- The production cron is scheduled once daily at `12:17 UTC`.
- One invocation attempts up to five monitoring alerts and five deadline alerts after the scan work.
- A failed monitoring scan is scheduled for retry after 15 minutes, but a retry still needs another invocation.
- Migration `v0028` records service-only, aggregate scheduler heartbeats for authorized invocations, including zero-work and failure outcomes. It records no customer, profile, report, company, or email identifiers and prunes evidence older than 90 days during scheduler writes.

Before selling subscriptions, upgrade the project to Vercel Pro and schedule the monitoring route every 15 minutes. Run it for at least 48 hours, then query `get_monitoring_scheduler_evidence` and prove the schedule interval, successful/zero-work outcomes, throughput, backlog age, retries, dead letters, and alert delivery stay within plan capacity and the 60-second route limit. A single daily invocation is not sufficient for a fully used Growth plan with three daily profiles.

Set `MONITORING_SCHEDULER_READY=true` only after that evidence is recorded. Subscription checkout remains fail-closed without it even when all plan Price IDs are configured.

If capacity is not proven, choose **Go - Report only**.

## 8. Run The Controlled Live Purchase

### Minimum Money Proof: $49 Report

1. Approve one buyer email, real cardholder, maximum $49 charge, fresh scan, and test window.
2. Set `ENABLE_PAID_REPORT_CHECKOUT=true` for Production only after the other readiness checks pass and record the change time.
3. Start from that scan's free report and confirm the checkout summary is a one-time $49 Report purchase.
4. Confirm authenticated `/api/health/paid` returns `200` with `ready.paidReport: true`, including a verified live Report catalog, recent persisted webhook, no stale/failed delivery, and no active grant missing a delivery attempt.
5. Complete live Stripe Checkout, then close the success tab before returning to the report.
6. Confirm the buyer receives one private claim email and can use the same verified email to complete magic-link sign-in.
7. Confirm return to the same report with the full action layer, export, opportunity workspace, and workflow access.
8. Refresh, sign out, and sign back in. Confirm the same report stays unlocked and a different report stays locked.
9. Reconcile the Stripe payment and receipt, successful webhook event, delivery attempt, Supabase customer/account ownership and active report grant, and the configured analytics/attribution evidence.
10. Refund the test charge if that was pre-approved. Confirm the refund webhook revokes the report grant; otherwise document why the paid access intentionally remains active.

### Subscription Proof

If Monitor or Growth will be sold, repeat with the approved subscription after capacity passes. Verify sign-in before checkout, live subscription status, dashboard onboarding, monitored-profile limit, first monitoring run, alert delivery, billing portal, and cancellation/status webhook. Do not infer subscription readiness from the one-time Report purchase.

## 9. Rollback

Trigger rollback for a wrong price, test-mode object, failed webhook, broken auth, incorrect entitlement, cross-customer exposure, failed receipt, unbounded monitoring backlog, or any charge the team cannot support.

1. Stop promotion and tell invited testers checkout is paused.
2. In Stripe, deactivate the affected live Prices and expire open Checkout sessions to stop new purchases. Keep the live API key and webhook endpoint active for existing payment lifecycle events.
3. Redeploy the recorded known-good release if the application release is at fault.
4. Refund unintended one-time charges and cancel or refund unintended subscriptions in Stripe.
5. Confirm refund, dispute, or cancellation webhooks update Supabase grants/subscriptions and customer access.
6. Pause monitoring profiles that cannot be serviced and tell affected customers what happened and what will happen next.
7. Preserve Stripe objects, webhook-event records, customer ownership, and the migration ledger for auditability.
8. Record the incident, customer impact, cleanup evidence, owner, fix, and next test window.

## 10. Founder Go/No-Go Evidence

The founder should receive one short evidence packet:

| Evidence | Pass condition |
|---|---|
| Release | Exact commit/deployment and rollback deployment recorded. |
| Automated checks | Launch env, full launch verification, and migration parity pass. |
| Health | Demo and paid signup are true; Stripe mode is live; required services are ready. |
| Product quality | Three live regression scans pass on desktop/mobile with no high-priority issue. |
| Auth | Magic link, callback, session return, sign-out, and customer isolation pass. |
| Money | Live amount/product/interval are correct; receipt and webhook succeed. |
| Access | Only the purchased report or entitled monitoring scans unlock for the correct account. |
| Email | Verified sender delivers; required unsubscribe/suppression behavior passes. |
| Analytics | Paid funnel events arrive without personal or sensitive data. |
| Capacity | Offered monitoring plans fit measured worker and alert throughput. |
| Recovery | Purchase cleanup and rollback rehearsal succeed; owners are named. |

Decision options:

- **Go - Report only:** collect controlled one-time Report payments.
- **Go - Paid plans:** collect Report, Monitor, and Growth payments within the proven support and monitoring capacity.
- **No-go:** pause new purchases, execute rollback, and repeat the failed evidence pass.

## Immediate Next Action

Freeze one production candidate, run the two launch commands, capture `/api/health`, and assemble migration parity plus three fresh regression scans. If those pass, schedule the founder-approved $49 live Report purchase as the first money proof.
