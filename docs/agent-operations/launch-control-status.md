# Opportunity Scanner Launch Control

Last audited: 2026-07-21
Integration owner: Chief of Staff Agent
Status owner: Project Management Agent

This is the source of truth for launch status. Deployed production evidence is kept separate from local or release-candidate work.

## Executive status

**Demo-ready: GO. Paid Report checkout: NO-GO. Subscriptions: NO-GO.**

- Production release `d0eb48b6b07f` reports demo readiness and a verified live Stripe catalog.
- Paid Report checkout remains fail-closed because branded support readiness is false and the controlled purchase/refund/access proof is incomplete.
- Monitor and Growth remain fail-closed because the production monitoring scheduler readiness flag is false.
- Vercel Web Analytics is live. A consent-controlled HubSpot/PostHog and company-account analytics release is in verification and is not counted as deployed until the live release changes.
- Reparel, SchoolGig, and Jammcard report regression tests pass, but the paid quality bar still needs a stronger guarantee of current pursuits or an explicit market-intelligence classification.

## Production health

Checked July 21, 2026 at `https://www.opportunityscanner.ai/api/health`:

| Capability | Production state |
|---|---|
| Demo | Ready |
| Database, auth, and scans | Ready |
| Stripe | Live |
| Report catalog | Verified |
| Paid Report checkout | Closed |
| Monitor/Growth checkout | Closed |
| Email delivery | Ready |
| Branded support identity | Not ready |
| Monitoring runtime | Available |
| Monitoring scheduler launch proof | Not ready |
| Analytics | Vercel active |

## Prioritized launch board

| Priority | Workstream | Status | Definition of done |
|---|---|---|---|
| P0 | Report usefulness and current-opportunity guarantee | In progress | Fresh Reparel, SchoolGig, and Jammcard production scans either contain at least one credible current pursuit from appropriate sources or clearly state that the result is market intelligence rather than an open opportunity list. |
| P0 | Consent, funnel, and company analytics | Release candidate | Cookieless Vercel analytics remains active; optional attribution, PostHog, and HubSpot load only after permission; known accounts use account IDs/work-email domains; scanned companies remain separate; Stripe webhooks are the purchase source of truth. |
| P0 | $49 Report checkout | Closed by design | Branded support identity passes, pricing copy is current, and one controlled live purchase proves receipt, account ownership, full access, refund, and revocation before the checkout flag opens. |
| P0 | Quality-review operations | Needs operating rule | Assign an owner, response-time target, alert, and customer-facing delay state for reports held by the publication fence. |
| P1 | Opportunity pursuit/application workflow | Planned next | Store source-native application method/URL, eligibility, registration, required documents, owner, pursuit status, and deadline; provide a readiness screen before sending the user to the official submission route. |
| P1 | Monitor and Growth launch | Closed by design | Run the intended authenticated schedule, collect 48 hours of capacity and failure evidence, then make a separate subscription go/no-go decision. |
| P1 | Native CRM lifecycle sync | Foundation ready | HubSpot tracking and known-contact association work first; server-side contact/company/deal sync requires a private app or OAuth credential and a reviewed field map. |
| P2 | Demo video and remaining content repurposing | Queued | Product proof uses current screen recordings and credible example data; remaining social packs proceed after product quality and measurement are stable. |

## What is already done

- Company website enrichment and company-profile evidence extraction.
- Normalized opportunity rows with revenue motion, contact path, next action, CRM note, outreach angle, source link, export, and generic workflow send.
- Account dashboard for reports, new searches, saved-search edits, monitoring controls, comparisons, alerts, usage, and billing.
- Live Stripe integration, verified Report price catalog, webhook idempotency, account-owned access, fulfillment recovery, and refund-safe entitlement logic.
- Publication fence and admin quality-review controls.
- Industry, solution, article, lead-magnet, example-report, social-profile, and flagship-carousel surfaces.
- First-touch campaign attribution and an authoritative database-backed launch funnel.

## Founder actions

Only these items require founder ownership or spend approval:

1. Confirm or create the working `support@opportunityscanner.ai` mailbox so the production support readiness check can pass.
2. Approve and complete one real $49 live purchase/refund proof after the release candidate passes.
3. Approve the Vercel plan/scheduling capacity needed before Monitor and Growth move from daily proof to the intended production cadence.
4. In HubSpot, confirm `opportunityscanner.ai` as the tracked domain and configure Buyer Intent target markets/high-intent paths if anonymous company-visit identification is desired.

## Next sequence

1. Deploy and verify the consented analytics/company-tracking release.
2. Strengthen the report publication contract around current pursuits and source diversity; run fresh production regressions.
3. Complete branded support and the controlled $49 purchase/refund/access proof.
4. Open one-time Report checkout only when production health reports paid signup ready.
5. Build the application-readiness workspace while monitoring collects capacity evidence.
6. Make a separate subscription launch decision; live Report checkout does not imply Monitor/Growth readiness.

## Checkpoint rule

Every release update must name the exact production release and keep deployed evidence separate from local work. Before a commit or deployment, confirm that secrets, `.env.local`, local data, build output, and unrelated changes are excluded.
