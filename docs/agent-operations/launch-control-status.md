# Opportunity Scanner Launch Control

Last audited: 2026-07-15
Integration owner: Chief of Staff Agent
Status owner: Project Management Agent

This is the current source of truth for launch status. It keeps deployed production evidence separate from the verified release candidate.

## Executive status

**Demo-ready: GO. Paid signup: NO-GO. Subscriptions: NO-GO.**

- The latest independently verified launch feature release is `9e2f55b`; read `/api/health` after every deployment for the exact live release.
- Production health reports `ready.demo: true`, analytics via Vercel, `ready.paidSignup: false`, and Stripe in test mode.
- The Reparel demo account for `joelle@reparel.com` has account-scoped full access to scan `74de7c26-0978-48f4-af7a-be58c1623dd9`, refreshed July 14, 2026 with six sourced signals.
- Launch verification passed 46/46 distinct checks, including the production build and 99 generated pages.
- The homepage, fictional public examples, industries, lead magnets, and planned content surfaces are complete. Public example QA found no Jammcard name or logo in the presentation layer.
- The `v0019` scan-nurture ambiguity repair was applied and rollback-tested.
- The `v0020` refund-safe Report entitlement migration was applied and verified without changing Reparel demo access.
- Production migrations through `v0028` are applied, rollback-tested, and ledger-recorded, including aggregate scheduler heartbeat and capacity evidence.
- The live release adds a Report-to-Monitor/Growth plan and billing selector, product-level MRR mix, scheduler evidence, branded-support launch checks, and a payment gate that stays closed until monitoring readiness is proven.

## Launch board

| Workstream | Status | Current evidence / decision | Next action |
|---|---|---|---|
| Production demo release | **Live / GO** | Feature release `9e2f55b` is live; production is demo-ready and the core routes return 200 with no recent Vercel runtime errors. | Preserve the live demo while completing the controlled paid launch gate. |
| Reparel demo | **Live / GO** | `joelle@reparel.com` owns full access to the July 14 Reparel report at `/reports/74de7c26-0978-48f4-af7a-be58c1623dd9`. The signed-out route returns a safe gated report. | Open the magic link sent to `joelle@reparel.com`, then use the dashboard and full report as the primary private demo path. |
| Public acquisition surfaces | **Complete** | Homepage, examples, industry pages, lead magnets, and content are complete. | Shift effort from new surface creation to distribution, measurement, and conversion proof. |
| Launch verification | **Passed** | Automated launch verification passed 46/46 distinct checks, including the production build, 99 generated pages, and 28 production migrations in order. | Preserve the gate during deployment and live verification. |
| Scan nurture repair | **Applied / rollback-tested** | Production database repair `v0019` resolves the nurture-enrollment ambiguity and has a tested rollback path. | Keep the migration ledger and repository record aligned before the next release. |
| Report-only payments | **Live code / NO-GO** | Production still reports `paidSignup: false` because Vercel uses a test Stripe secret. Live price IDs are present and checkout remains explicitly fail-closed. | Complete Stripe identity verification, install the dedicated live key, then run the controlled $49 Report purchase. |
| Monitor and Growth subscriptions | **NO-GO** | Batch processing, retries, queue health, and aggregate heartbeat evidence are ready, but the production schedule is still once daily. | Approve Vercel Pro, run every 15 minutes for 48 hours, and review the capacity evidence before enabling subscriptions. |
| Paid-launch operations | **Founder action required** | Vercel Web Analytics and Resend are ready. Live Stripe identity verification, a branded support mailbox, and the controlled purchase remain. | Complete the founder checklist below before any paid traffic. |

## Founder actions

1. Complete Stripe identity verification so Codex can replace the test key with a dedicated live key, verify the $49 Report catalog, and run one controlled purchase/refund proof.
2. Approve one Google Workspace Business Starter mailbox for `support@opportunityscanner.ai` (about $7/month on annual billing), complete its identity/MFA prompt, and let Codex configure and verify the provider-issued DNS records.
3. Approve Vercel Pro for the Opportunity Scanner project (about $20/month), then let Codex activate the 15-minute monitoring schedule and collect the required 48-hour capacity evidence.

## Next launch sequence

1. Complete Stripe identity verification and the Google Workspace support mailbox in parallel.
2. Install the dedicated live Stripe key, verify the $49 Report catalog, rerun the launch gate, and complete one controlled Report purchase, entitlement, receipt, refund/revocation, and rollback pass.
3. Require production health to show `ready.demo: true`, `ready.paidSignup: true`, and live Stripe before accepting paid Report traffic.
4. Upgrade Vercel and collect 48 hours of scheduler evidence in parallel with the Report launch.
5. Make a separate capacity-backed go/no-go decision for subscriptions; Report readiness does not make subscriptions ready.

## Current evidence record

- Latest verified launch feature release: `9e2f55b`; Vercel deployment `dpl_E13dPopg6fnLzVti3Zv8BLmsTh4Y` is Ready on the production domains.
- Production readiness: demo `true`; paid signup `false`; Stripe test mode.
- Live demo proof: Reparel Auth user `cfda4281-4662-4eba-b304-88ea42125cec`, customer account `1c65ed91-a079-46b3-9446-d607e91875ad`, and full-access scan `74de7c26-0978-48f4-af7a-be58c1623dd9`; signed-out report returned 200 with scan date July 14 and six sourced signals.
- Automated verification: 46/46 distinct checks passed, including the production build and 99 generated pages.
- Acquisition buildout: homepage, examples, industries, lead magnets, and content complete.
- Database migrations through `v0028` are applied, rollback-tested, and ledger-recorded; `v0028` checksum is `c492c45bd551d6dfbdf472b4eb2078f3aa26751544fc1f8eb5e51ad8ea320e4b`.
- Deployment proof: Vercel reported the feature release ready on the production domains and `/api/health` returned release `9e2f55b40f51` with demo, email, monitoring, and Vercel analytics ready. Homepage, pricing, sign-in, Reparel report, and favicon returned 200, with no runtime error clusters in the release window.

## Checkpoint rule

Future status updates must identify the exact production release and keep deployed evidence separate from local or uncommitted work. Before any commit or release, review scope and confirm secrets, local data, build output, and unrelated changes are excluded.
