# Opportunity Scanner Launch Control

Last audited: 2026-07-09
Integration owner: Chief of Staff Agent
Status owner: Project Management Agent

This is the source of truth for launch status. It reconciles the current repository with `docs/live-mvp-domain-test-plan.md` and `docs/beta-readiness-sprint.md`; those documents still define scope, but their older status labels should not override this audit.

## Executive status

**Ready for production setup and controlled live-domain verification, but not for external beta invitations yet.** The launch-hardening bundle, workflow contract tests, connector reliability work, resource-page upgrade, and content operating system are committed and locally verified. Production hosting, Supabase schema/setup, required environment variables, a safe webhook endpoint, deployment approval, and fresh live-domain evidence still require founder/Chief of Staff action.

Repository snapshot at audit time:

- Branch: `main`; working tree clean after integration.
- The integrated launch checkpoints are local to `main`; nothing has been pushed or deployed.
- Integrated checkpoints cover launch control, resource article UX, content packages, the refreshed government-spending flagship, workflow contract tests, beta workflow hardening, connector runtime visibility, and public connector regression stability.
- Beta workflow payloads are rebuilt from stored server data, and public pricing copy no longer implies a live `$99` checkout.
- No secrets, `.env` files, `.data`, `.next`, `node_modules`, or generated output were committed.

## Launch board

| Workstream | Owner | Status | Acceptance criteria | Blocker / current evidence | Verification and next action |
|---|---|---|---|---|---|
| Beta access and production fail-closed foundation | Back-End + Front-End | **Done** | Normal users cannot reach admin/refinement surfaces; export, enrichment, and workflow require full access; production cannot silently fall back to local storage. | Implemented in committed checkpoints `b7c347f` and `a5ba6ee`. | Preserve in regression testing; do not reopen unless a test fails. |
| Normalized opportunity action persistence | Back-End | **Done** | Newly saved opportunities contain the normalized action contract used by the report, export, and workflow layers. | `saveOpportunitySignals` persists `normalized_action`; committed implementation exists. Runtime proof must still come from fresh scans. | Treat implementation as done; verify one stored row per regression company during the domain pass. |
| Launch-hardening bundle and server-owned workflow payload | Back-End + Front-End; Chief of Staff integrates | **Done locally** | Browser sends only scan/opportunity IDs, access, and webhook URL; server reloads the stored row, rebuilds and validates the payload; free users cannot send; UI shows clear errors; beta access copy does not imply live checkout. | Committed in `557edad`; workflow contract harness is committed in `b32ca64`. | Preserve in the live-domain pass and complete one approved safe-webhook delivery. |
| Stable scan/report flow on the live environment | Back-End | **Blocked by founder/credentials** | A URL submission reaches a report without manual intervention; failures are plain-English and reveal no debug data; all three regression companies complete. | Needs selected domain/host, production Supabase schema, required environment variables, and an approved deployment. | After environment setup, capture scan IDs and report URLs for Reparel, Jammcard, and SchoolGig. |
| Three-company report quality and fresh normalized-contract proof | Back-End + Product Strategy; PM verifies | **Done locally / live proof pending** | Reparel, Jammcard, and SchoolGig each have 0 high-priority evaluator issues; visible rows contain revenue motion, actionability, next best action, and contact path; weak-fit filtering remains credible. | Local evaluator passes with 0 issues across all three companies. Public source regressions also pass for all three lanes. | Generate fresh live-domain scans, rerun the evaluator, and inspect stored/report/export/workflow agreement. |
| Report UI and free/full states | Front-End + Product Strategy | **In Review** | Desktop and mobile are usable; free shows 2-3 real signals plus total found; full unlocks the action layer; no raw/debug data is visible; payment language is beta-safe. | Copy changes are in the uncommitted bundle. Full three-company free/full visual review is not recorded. | Review free and full URLs for all three companies at desktop and phone widths; record defects before checkpoint approval. |
| Workflow verification tests | Back-End | **Done locally** | Tests cover invalid/non-HTTPS URLs, embedded credentials, missing IDs, scan/opportunity mismatch, full-access denial, non-ready payloads, server reconstruction, payload size, and delivery failures. | `scripts/test-workflow-contract.mjs` passes 11/11. | Add a real safe-endpoint smoke test after production setup; private-network destination policy remains a beta security decision. |
| Safe-webhook smoke test | Back-End + PM; founder approves policy/destination | **Blocked by founder/credentials** | One full-access opportunity reaches an approved safe endpoint; received payload matches the stored row and excludes secrets, raw connector data, debug fields, and hidden free details; UI success and failure states are visible. | Needs founder/Chief of Staff decision on beta webhook policy and an approved safe endpoint. Must wait for tests, checkpoint, environment setup, and a known-good scan. | Use one test opportunity only, inspect the received payload, test one controlled failure, and record date, scan ID, opportunity ID, endpoint class, and result without recording credentials. |
| Production environment and controlled-test scope | Founder + Chief of Staff | **Blocked by founder/credentials** | Domain/preview selected; Supabase schema installed; required variables configured; tester audience and webhook policy approved; deployment explicitly authorized. | Founder decisions and private account access are outside agent authority. | Decide domain, internal/founder-invited scope, payment placeholder policy, and webhook policy; then authorize environment setup and deployment. |
| Clean launch checkpoint | Chief of Staff + PM | **Done locally** | Accepted P0 bundle is committed with no secrets or generated artifacts; staged scope is reviewed; checkpoint IDs are recorded on `main`. | Main working tree is clean with local launch checkpoints. No push or deployment was performed. | Keep commits local until founder authorizes the production/deployment path. |
| Live-domain regression evidence package | PM + Back-End + Front-End | **Not Started** | Domain, environment, timestamp, company URLs, scan IDs, report URLs, counts, evaluator result, free/full screenshots or notes, mobile result, webhook result, and checkpoint ID are recorded. | Depends on environment, checkpoint, and deployment. | Run the controlled test pass and attach evidence to the Chief of Staff go/no-go review. |
| External beta invitation | Founder + Chief of Staff | **Not Started** | All go criteria pass, known limitations are documented, tester list is approved, and rollback/support owner is named. | All P0 verification above must complete first. | Make a founder go/no-go decision only after the evidence package is reviewed. |

## Parallel non-gating work

These streams can continue, but they must not delay or overwrite P0 launch verification:

| Workstream | Owner | Status | Acceptance criteria | Blocker / verification | Next action |
|---|---|---|---|---|---|
| Blog editorial queue and first packages | Product Strategy / Content | **Done for first wave** | Deduplicated queue and research-backed packages support ICP acquisition without changing pricing or major positioning. | Forty-three canonical resources are organized; government-spending and Building Local Credibility packages are committed; the government-spending flagship is integrated into the canonical article. | Use the same evidence-to-action standard for the next approved article refresh. |
| Resource article template | Front-End | **Done locally** | Reusable, responsive article template supports breadcrumbs, answer box, table of contents, related reads, optional metadata, structured data, and chart assets without exposing internal fields. | Typecheck and production build pass after flagship integration; all 20 resource URLs generate, and internal editorial fields remain absent from the built page. | Preserve the template during the next content refresh and include it in live-domain visual review. |
| Connector reliability and readiness | Connector | **Done locally / live monitoring pending** | Connector requests are bounded; no matches are distinct from failures; status is stored internally; no new APIs are added. | Runtime tests pass; public regressions pass for Reparel, Jammcard, and SchoolGig. SAM.gov is valid-looking but quota-throttled until 2026-07-10 00:00 UTC. | Re-test SAM after the throttle clears and inspect connector-run records during live scans. |

## Precise P0 sequence

1. **Obtain founder decisions and production access.** Confirm domain/preview, controlled tester scope, webhook policy/destination, and deployment approval.
2. **Configure production persistence and environment.** Install the Supabase schema and configure required environment variables without exposing secret values.
3. **Deploy the approved checkpoint.** Run build and launch-environment checks in hosting, point the selected domain, and record the deployed commit.
4. **Run the three-company domain pass.** Fresh-scan Reparel, Jammcard, and SchoolGig; inspect desktop/mobile, free/full gating, Opportunity Action Table, source credibility, connector-run status, hidden debug data, failure behavior, and stored normalized fields. Rerun the evaluator.
5. **Re-test SAM.gov after quota reset.** Confirm active procurement coverage or narrow live product claims if the source remains unavailable.
6. **Run one safe-webhook smoke test.** Use an approved endpoint and one full-access row; inspect payload content plus visible success and controlled-failure states.
7. **Founder go/no-go.** PM assembles the evidence package; Chief of Staff summarizes tradeoffs; founder decides whether to invite a small controlled tester group.

Dependency chain: founder decisions/credentials → production setup → deployment → three-company domain pass and SAM re-test → safe-webhook smoke test → external beta go/no-go.

## Regression matrix required for launch

| Company | Required opportunity lanes | Required pass |
|---|---|---|
| Reparel | Healthcare, rehab, DME/medical supply, VA/prosthetics/orthotics, buyer/channel motions | Fresh scan completes; credible rows; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |
| Jammcard | Music, arts, creative economy/workforce, live performance, city/county events, grants, tourism, parks and recreation | Fresh scan completes; public-event and arts lanes remain strong; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |
| SchoolGig | Education, workforce/training, school staffing, arts education, public education funding, district/vendor motions | Fresh scan completes; broad weak fits stay screened/research-only; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |

## Verification record for this audit

- `git status --short --branch`: clean on `main` with local launch checkpoints not pushed to `origin/main`.
- `git diff --check`: passed with no whitespace errors.
- TypeScript check: passed.
- Production build: passed; all 20 resource URLs generated.
- Flagship article source review: official SBA, SAM.gov, USAspending, Grants.gov, and Acquisition.gov claims checked; the built public page contains no internal research, republishing, or visual-production fields.
- Workflow contract: passed 11/11 without real delivery or credentials.
- Connector runtime: passed no-match/failure separation, partial-failure preservation, timeout bounds, credential skips, and error sanitization.
- Report evaluator: passed with 0 issues for Jammcard, SchoolGig, and Reparel.
- Public connector regressions: passed for all three company lanes across USAspending, Grants.gov, and Federal Register.
- Broad API health: passed for available configured sources; SAM.gov reported quota throttling and should be retried after 2026-07-10 00:00 UTC.
- Safe-webhook smoke test: not run; it remains intentionally blocked until an approved destination, production environment, and deployment are available.

## Checkpoint rule

Future checkpoints must continue to include specialist reports with changed files, decisions, blockers, tests, and follow-ups. Before every commit, inspect the staged list and confirm `.env`, `.env.local`, `.data`, `.next`, `node_modules`, `output`, credentials, and generated artifacts are absent.
