# Opportunity Scanner Launch Control

Last audited: 2026-07-09  
Integration owner: Chief of Staff Agent  
Status owner: Project Management Agent

This is the source of truth for launch status. It reconciles the current repository with `docs/live-mvp-domain-test-plan.md` and `docs/beta-readiness-sprint.md`; those documents still define scope, but their older status labels should not override this audit.

## Executive status

**Not ready for external beta yet.** The core beta-access and launch-safety foundation is committed, but the current launch-hardening bundle is uncommitted and has not completed automated or live verification. Production hosting, schema setup, credentials, webhook policy, and tester scope still require founder/Chief of Staff action.

Repository snapshot at audit time:

- Commit: `8d95280` on a detached `HEAD`; local `main` points at the same commit.
- Inherited launch-hardening bundle: 6 modified tracked files plus 1 untracked file; none staged.
- Modified: `app/api/workflow/send/route.ts`, `app/page.tsx`, `app/pricing/page.tsx`, `app/reports/[id]/page.tsx`, `components/workflow.tsx`, `docs/live-mvp-domain-test-plan.md`.
- Untracked: `lib/workflowPayload.ts`.
- The bundle moves workflow payload construction to the server and replaces implied live `$99` checkout language with request-based beta access.
- This status file is separate PM-owned work and must not be mixed into an inherited-code checkpoint without integration-owner review.

## Launch board

| Workstream | Owner | Status | Acceptance criteria | Blocker / current evidence | Verification and next action |
|---|---|---|---|---|---|
| Beta access and production fail-closed foundation | Back-End + Front-End | **Done** | Normal users cannot reach admin/refinement surfaces; export, enrichment, and workflow require full access; production cannot silently fall back to local storage. | Implemented in committed checkpoints `b7c347f` and `a5ba6ee`. | Preserve in regression testing; do not reopen unless a test fails. |
| Normalized opportunity action persistence | Back-End | **Done** | Newly saved opportunities contain the normalized action contract used by the report, export, and workflow layers. | `saveOpportunitySignals` persists `normalized_action`; committed implementation exists. Runtime proof must still come from fresh scans. | Treat implementation as done; verify one stored row per regression company during the domain pass. |
| Launch-hardening bundle and server-owned workflow payload | Back-End + Front-End; Chief of Staff integrates | **In Review** | Browser sends only scan/opportunity IDs, access, and webhook URL; server reloads the stored row, rebuilds and validates the allowlisted payload; free users cannot send; UI shows clear errors; beta access copy does not imply live checkout. | Seven inherited files are uncommitted. No workflow-route tests are present in the audited tree. | Back-End finishes verification tests; Front-End reviews free/full and error states; run typecheck; integration owner reviews the full diff and creates a clean checkpoint. |
| Stable scan/report flow on the live environment | Back-End | **Blocked by founder/credentials** | A URL submission reaches a report without manual intervention; failures are plain-English and reveal no debug data; all three regression companies complete. | Needs selected domain/host, production Supabase schema, required environment variables, and an approved deployment. | After environment setup, capture scan IDs and report URLs for Reparel, Jammcard, and SchoolGig. |
| Three-company report quality and fresh normalized-contract proof | Back-End + Product Strategy; PM verifies | **In Review** | Reparel, Jammcard, and SchoolGig each have 0 high-priority evaluator issues; visible rows contain revenue motion, actionability, next best action, and contact path; weak-fit filtering remains credible. | Docs report a prior 0-issue local run, but this worktree has no `.data/local-db.json`, no quality artifact, and no installed dependencies, so that claim could not be independently rerun here. | Generate fresh scans in the test environment, rerun the evaluator, inspect at least one stored row and compare it with report/export/workflow values. |
| Report UI and free/full states | Front-End + Product Strategy | **In Review** | Desktop and mobile are usable; free shows 2-3 real signals plus total found; full unlocks the action layer; no raw/debug data is visible; payment language is beta-safe. | Copy changes are in the uncommitted bundle. Full three-company free/full visual review is not recorded. | Review free and full URLs for all three companies at desktop and phone widths; record defects before checkpoint approval. |
| Workflow verification tests | Back-End | **In Review** | Tests cover invalid/non-HTTPS URLs, embedded credentials, missing IDs, scan/opportunity mismatch, full-access denial, non-ready payloads, allowlisted output, delivery failure, and success. | Parallel Back-End workstream owns this. No matching automated test exists in the current audited tree. | Add and run the focused tests, then report files, results, and any gaps to the Chief of Staff. |
| Safe-webhook smoke test | Back-End + PM; founder approves policy/destination | **Blocked by founder/credentials** | One full-access opportunity reaches an approved safe endpoint; received payload matches the stored row and excludes secrets, raw connector data, debug fields, and hidden free details; UI success and failure states are visible. | Needs founder/Chief of Staff decision on beta webhook policy and an approved safe endpoint. Must wait for tests, checkpoint, environment setup, and a known-good scan. | Use one test opportunity only, inspect the received payload, test one controlled failure, and record date, scan ID, opportunity ID, endpoint class, and result without recording credentials. |
| Production environment and controlled-test scope | Founder + Chief of Staff | **Blocked by founder/credentials** | Domain/preview selected; Supabase schema installed; required variables configured; tester audience and webhook policy approved; deployment explicitly authorized. | Founder decisions and private account access are outside agent authority. | Decide domain, internal/founder-invited scope, payment placeholder policy, and webhook policy; then authorize environment setup and deployment. |
| Clean launch checkpoint | Chief of Staff + PM | **Not Started** | Accepted P0 bundle is committed with no secrets or generated artifacts; staged scope is reviewed; checkpoint ID is recorded; work is on an intentional branch/commit rather than an unexplained detached state. | Inherited bundle is unstaged and uncommitted; automated review is incomplete. | After specialist sign-off, inspect staging, checkpoint only accepted files, and record the commit. Do not invite testers before this is complete. |
| Live-domain regression evidence package | PM + Back-End + Front-End | **Not Started** | Domain, environment, timestamp, company URLs, scan IDs, report URLs, counts, evaluator result, free/full screenshots or notes, mobile result, webhook result, and checkpoint ID are recorded. | Depends on environment, checkpoint, and deployment. | Run the controlled test pass and attach evidence to the Chief of Staff go/no-go review. |
| External beta invitation | Founder + Chief of Staff | **Not Started** | All go criteria pass, known limitations are documented, tester list is approved, and rollback/support owner is named. | All P0 verification above must complete first. | Make a founder go/no-go decision only after the evidence package is reviewed. |

## Parallel non-gating work

These streams can continue, but they must not delay or overwrite P0 launch verification:

| Workstream | Owner | Status | Acceptance criteria | Blocker / verification | Next action |
|---|---|---|---|---|---|
| Blog editorial queue and first package | Product Strategy / Content | **In Review** | Prioritized queue and first publishable package support ICP acquisition without changing pricing or major positioning. | Parallel output not yet handed to this PM audit. | Report deliverables and review needs to the Chief of Staff. |
| Resource article template | Front-End | **In Review** | Reusable, responsive article template is ready for content insertion and does not disrupt scan/report P0 surfaces. | Parallel output not yet handed to this PM audit. | Complete visual/route verification and report changed files. |
| Connector readiness audit | Connector | **In Review** | Sources are labeled active, missing credentials, failing, or planned; source-native contacts and graceful failures are assessed; no new APIs are added. | Credential-backed health checks require founder-controlled access; audit can still separate code-ready from credential-blocked connectors. | Deliver a read-only readiness matrix and precise credential blockers to the Chief of Staff. |

## Precise P0 sequence

1. **Finish the hardening bundle.** Back-End completes workflow verification tests; Front-End and Product Strategy review beta access, free/full, and error states. No domain work should start from an unreviewed bundle.
2. **Restore local verification capability and run checks.** Install/restore project dependencies in an approved environment, run typecheck and focused workflow tests, then generate or restore regression scan data and run the report evaluator. Fix failures before moving on.
3. **Create the checkpoint.** Chief of Staff reviews the inherited diff, confirms no secrets/generated files are staged, commits the accepted P0 bundle, and records the checkpoint. Resolve the detached-`HEAD` state intentionally.
4. **Obtain founder decisions and environment access.** Select domain/preview, tester scope, payment placeholder behavior, and webhook policy. Configure Supabase schema and required production variables only with authorization.
5. **Deploy the approved checkpoint.** Run build and launch-environment checks in CI/hosting, point the selected domain, and record the deployed commit. Production deployment requires explicit founder approval.
6. **Run the three-company domain pass.** Fresh-scan Reparel, Jammcard, and SchoolGig; inspect desktop/mobile, free/full gating, Opportunity Action Table, source credibility, hidden debug data, failure behavior, and stored normalized fields. Run the evaluator against these scans.
7. **Run one safe-webhook smoke test.** Use an approved endpoint and one full-access row; inspect allowlisted payload content plus visible success and controlled-failure states.
8. **Founder go/no-go.** PM assembles the evidence package; Chief of Staff summarizes tradeoffs; founder decides whether to invite a small controlled tester group.

Dependency chain: workflow tests and UI review → passing local checks → clean checkpoint → founder decisions/credentials → deployment → three-company domain pass → safe-webhook smoke test → external beta go/no-go.

## Regression matrix required for launch

| Company | Required opportunity lanes | Required pass |
|---|---|---|
| Reparel | Healthcare, rehab, DME/medical supply, VA/prosthetics/orthotics, buyer/channel motions | Fresh scan completes; credible rows; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |
| Jammcard | Music, arts, creative economy/workforce, live performance, city/county events, grants, tourism, parks and recreation | Fresh scan completes; public-event and arts lanes remain strong; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |
| SchoolGig | Education, workforce/training, school staffing, arts education, public education funding, district/vendor motions | Fresh scan completes; broad weak fits stay screened/research-only; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |

## Verification record for this audit

- `git status --short --branch`: inspected; found detached `HEAD`, seven inherited unstaged/untracked launch-hardening files, and no staged files.
- Recent commits: inspected; current history is dominated by July 9 content/resource work, while launch foundations are in `b7c347f` and `a5ba6ee`.
- `git diff --check`: passed with no whitespace errors.
- TypeScript check: **attempted, not completed**. The supplied Node binary works, but `node_modules/typescript/bin/tsc` is absent because this worktree has no installed dependencies. This is an environment gap, not a passing code check.
- Report evaluator: **not run**. This worktree has neither installed dependencies nor `.data/local-db.json`; no current `output/quality/report-quality-latest.json` evidence is present. The prior 0-issue result remains a documentation claim pending rerun.
- `test:apis` and `test:sam`: **not run** because this assignment prohibits credentials and connector checks may load local credentials. Connector Agent owns readiness verification.
- Workflow automated tests: **not found** in the audited repository; parallel Back-End work owns them.
- Safe-webhook smoke test: **not run**; it is intentionally blocked until policy, endpoint, environment, tests, and checkpoint are ready.

## Checkpoint rule

Do not stage the inherited bundle piecemeal from this PM workstream. The Chief of Staff integration owner should checkpoint it only after specialist reports include changed files, decisions, blockers, tests run, and follow-ups. Before committing, inspect the staged list and confirm `.env`, `.env.local`, `.data`, `.next`, `node_modules`, `output`, credentials, and generated artifacts are absent.

