# Opportunity Scanner Launch Control

Last audited: 2026-07-14
Integration owner: Chief of Staff Agent
Status owner: Project Management Agent

This is the current source of truth for launch status. It records the production state that existed before this audit and does not treat uncommitted local work as deployed.

## Executive status

**Demo-ready: GO. Paid signup: NO-GO. Subscriptions: NO-GO.**

- Production is live on release `f33aa50`, the release in production before this work began.
- Production health reports `ready.demo: true`, `ready.paidSignup: false`, and Stripe in test mode.
- The Reparel demo account and report are live and ready for founder-led demos.
- Launch verification passed 34/34 checks, including the production build.
- The homepage, examples, industries, lead magnets, and planned content surfaces are complete.
- The `v0019` scan-nurture ambiguity repair was applied and rollback-tested.
- The `v0020` refund-safe Report entitlement migration was applied and verified without changing Reparel demo access.
- Report-only payment hardening is a verified release candidate awaiting Vercel deployment confirmation. It is not part of release `f33aa50`.

## Launch board

| Workstream | Status | Current evidence / decision | Next action |
|---|---|---|---|
| Production demo release | **Live / GO** | Release `f33aa50` is live; production is demo-ready. | Preserve this release while paid work is completed and verified. |
| Reparel demo | **Live / GO** | Demo account and report are available for founder-led demonstrations. | Use Reparel as the primary live demo path and record any customer-facing defects. |
| Public acquisition surfaces | **Complete** | Homepage, examples, industry pages, lead magnets, and content are complete. | Shift effort from new surface creation to distribution, measurement, and conversion proof. |
| Launch verification | **Passed** | Automated launch verification passed 34/34 checks, including the production build. | Preserve the gate during deployment and live verification. |
| Scan nurture repair | **Applied / rollback-tested** | Production database repair `v0019` resolves the nurture-enrollment ambiguity and has a tested rollback path. | Keep the migration ledger and repository record aligned before the next release. |
| Report-only payments | **Verified candidate / NO-GO** | Production still reports `paidSignup: false` and uses test Stripe. The candidate defaults subscriptions closed, derives paid access from active grants, preserves canceled/wrong-email recovery, and requires support, email, analytics, and live Stripe readiness. | Deploy and verify the candidate, then complete the founder launch settings before a controlled live Report purchase. |
| Monitor and Growth subscriptions | **NO-GO** | Subscription checkout must remain unavailable; monitoring capacity has not been approved for sale. | Measure and approve operating capacity before enabling or promoting subscriptions. |
| Paid-launch operations | **Founder action required** | Support email, customer email, analytics, and live payment operations are not launch-cleared. | Complete the founder checklist below before any paid traffic. |

## Founder actions

1. Configure support-domain MX records and confirm the customer support inbox can send and receive.
2. Verify the sending domain in Resend, configure the production sender and unsubscribe secrets, and prove delivery plus suppression behavior.
3. Configure PostHog production analytics and verify the approved funnel events without personal data or sensitive URL values.
4. Complete live Stripe setup for the one-time Report offer: live Product/Price, webhook, receipt, approved test buyer and charge limit, and a controlled purchase/refund proof.
5. Keep Monitor and Growth disabled until measured monitoring and support capacity are sufficient for every subscription sold.

## Next launch sequence

1. Checkpoint and deploy the verified Report-only payment candidate; do not include secrets or unrelated working-tree changes.
2. Verify live pricing, sign-in recovery, health, and subscription-disabled states on the deployed release.
3. Complete the support MX, Resend, PostHog, and live Stripe founder actions.
4. Run the full launch gate and one controlled live Report purchase, entitlement, receipt, refund/revocation, and rollback pass.
5. Require production health to show `ready.demo: true`, `ready.paidSignup: true`, and live Stripe before accepting paid Report traffic.
6. Make a separate capacity-backed go/no-go decision for subscriptions; Report readiness does not make subscriptions ready.

## Current evidence record

- Live production release before this audit: `f33aa50`.
- Production readiness: demo `true`; paid signup `false`; Stripe test mode.
- Live demo proof: Reparel demo account and report.
- Automated verification: 34/34 passed, including the production build.
- Acquisition buildout: homepage, examples, industries, lead magnets, and content complete.
- Database repairs: `v0019` applied and rollback-tested; `v0020` applied and verified while Reparel retained full demo access.
- Deployment boundary: the Report-payment candidate is verified but is not part of the pre-audit production release `f33aa50` until Vercel reports the new deployment ready.

## Checkpoint rule

Future status updates must identify the exact production release and keep deployed evidence separate from local or uncommitted work. Before any commit or release, review scope and confirm secrets, local data, build output, and unrelated changes are excluded.
