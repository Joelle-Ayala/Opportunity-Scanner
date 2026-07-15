# Opportunity Scanner Launch Control

Last audited: 2026-07-14
Integration owner: Chief of Staff Agent
Status owner: Project Management Agent

This is the current source of truth for launch status. It keeps deployed production evidence separate from the verified release candidate.

## Executive status

**Demo-ready: GO. Paid signup: NO-GO. Subscriptions: NO-GO.**

- The independently verified production baseline is release `ab02a0d`; read `/api/health` after every deployment for the current live release.
- Production health reports `ready.demo: true`, `ready.paidSignup: false`, and Stripe in test mode.
- The Reparel demo account for `joelle@reparel.com` has account-scoped full access to scan `74de7c26-0978-48f4-af7a-be58c1623dd9`, refreshed July 14, 2026 with six sourced signals.
- Launch verification passed 46/46 distinct checks, including the production build and 99 generated pages.
- The homepage, fictional public examples, industries, lead magnets, and planned content surfaces are complete. Public example QA found no Jammcard name or logo in the presentation layer.
- The `v0019` scan-nurture ambiguity repair was applied and rollback-tested.
- The `v0020` refund-safe Report entitlement migration was applied and verified without changing Reparel demo access.
- Production migrations through `v0027` are applied, rollback-tested, and ledger-recorded, including repeat-purchase recovery and day-one nurture timing.
- The current candidate adds verified first-party analytics readiness, explicit fail-closed subscription capacity, customer dashboard improvements, and additional paid-launch protections. It is not the live baseline until Vercel reports the matching deployment ready.

## Launch board

| Workstream | Status | Current evidence / decision | Next action |
|---|---|---|---|
| Production demo release | **Live / GO** | Release `ab02a0d` is live; production is demo-ready and the core routes return 200 with no recent Vercel runtime errors. | Preserve the live demo while completing the controlled paid launch gate. |
| Reparel demo | **Live / GO** | `joelle@reparel.com` owns full access to the July 14 Reparel report at `/reports/74de7c26-0978-48f4-af7a-be58c1623dd9`. The signed-out route returns a safe gated report. | Open the magic link sent to `joelle@reparel.com`, then use the dashboard and full report as the primary private demo path. |
| Public acquisition surfaces | **Complete** | Homepage, examples, industry pages, lead magnets, and content are complete. | Shift effort from new surface creation to distribution, measurement, and conversion proof. |
| Launch verification | **Passed** | Automated launch verification passed 46/46 distinct checks, including the production build and 99 generated pages. | Preserve the gate during deployment and live verification. |
| Scan nurture repair | **Applied / rollback-tested** | Production database repair `v0019` resolves the nurture-enrollment ambiguity and has a tested rollback path. | Keep the migration ledger and repository record aligned before the next release. |
| Report-only payments | **Live code / NO-GO** | Production still reports `paidSignup: false` because Vercel uses a test Stripe secret. Live price IDs are present and checkout remains explicitly fail-closed. | Complete Stripe identity verification, install the dedicated live key, then run the controlled $49 Report purchase. |
| Monitor and Growth subscriptions | **NO-GO** | Subscription checkout must remain unavailable; monitoring capacity has not been approved for sale. | Measure and approve operating capacity before enabling or promoting subscriptions. |
| Paid-launch operations | **Founder action required** | Vercel Web Analytics is enabled and fail-closed checkout flags are explicit. Live Stripe identity verification, sender/support proof, and the controlled purchase remain. | Complete the founder checklist below before any paid traffic. |

## Founder actions

1. Configure GoDaddy MX records for `support@opportunityscanner.ai` and confirm the inbox can send and receive.
2. Publish the Resend domain records, configure the production sender and unsubscribe secrets, and prove delivery plus suppression behavior.
3. Review Vercel Web Analytics after production traffic begins; add PostHog later only if event-level analysis beyond first-touch attribution and Stripe/Supabase reconciliation is needed.
4. Complete Stripe identity verification so Codex can replace the test key with a dedicated live key, confirm the active one-time $49 Report Product/Price passes catalog health, and run one controlled $49 purchase/refund proof.
5. Keep Monitor and Growth disabled until measured monitoring and support capacity are sufficient for every subscription sold.

## Next launch sequence

1. Checkpoint and deploy the verified Report-only payment and acquisition candidate; do not include secrets or unrelated working-tree changes.
2. Verify live pricing, sign-in recovery, health, and subscription-disabled states on the deployed release.
3. Complete the support MX, Resend, and live Stripe founder actions.
4. Run the full launch gate and one controlled live Report purchase, entitlement, receipt, refund/revocation, and rollback pass.
5. Require production health to show `ready.demo: true`, `ready.paidSignup: true`, and live Stripe before accepting paid Report traffic.
6. Make a separate capacity-backed go/no-go decision for subscriptions; Report readiness does not make subscriptions ready.

## Current evidence record

- Current production release: `ab02a0d`.
- Production readiness: demo `true`; paid signup `false`; Stripe test mode.
- Live demo proof: Reparel Auth user `cfda4281-4662-4eba-b304-88ea42125cec`, customer account `1c65ed91-a079-46b3-9446-d607e91875ad`, and full-access scan `74de7c26-0978-48f4-af7a-be58c1623dd9`; signed-out report returned 200 with scan date July 14 and six sourced signals.
- Automated verification: 46/46 distinct checks passed, including the production build and 99 generated pages.
- Acquisition buildout: homepage, examples, industries, lead magnets, and content complete.
- Database migrations through `v0027` are applied, rollback-tested, and ledger-recorded; monitoring queue health currently reports zero backlog while Reparel retains full demo access.
- Deployment boundary: the current working candidate is not live until Vercel reports the new deployment ready and `/api/health` returns its release ID.

## Checkpoint rule

Future status updates must identify the exact production release and keep deployed evidence separate from local or uncommitted work. Before any commit or release, review scope and confirm secrets, local data, build output, and unrelated changes are excluded.
