# Opportunity Scanner Launch Control

Last audited: 2026-07-12
Integration owner: Chief of Staff Agent
Status owner: Project Management Agent

This is the source of truth for launch status. It reconciles the current repository with `docs/live-mvp-domain-test-plan.md` and `docs/beta-readiness-sprint.md`; those documents still define scope, but their older status labels should not override this audit.

## Executive status

**Production foundation is live; controlled customer-readiness verification is in progress. External beta invitations and paid collection remain off.** The verified checkpoint is deployed at `049aa05`, the required production variables are configured, the Supabase lead-capture schema is installed with row-level security, and the gated guide flow passed a live capture/download test. Fresh three-company scan evidence, SAM re-testing, one safe webhook proof, and the paid-pilot commercial decision remain open.

Repository snapshot at audit time:

- Branch: `main`; verified product checkpoint `049aa05` is pushed and deployed to production.
- Custom domains `opportunityscanner.ai` and `www.opportunityscanner.ai` resolve to the ready production deployment.
- Integrated checkpoints cover launch control, resource article UX, a 57-resource editorial queue, industry/solution related content, one flagship and eight industry lead magnets, safe lead capture, the refreshed government-spending flagship, workflow contract tests, beta workflow hardening, connector runtime visibility, and public connector regression stability.
- Beta workflow payloads are rebuilt from stored server data, and public pricing copy no longer implies a live `$99` checkout.
- No secrets, `.env` files, `.data`, `.next`, `node_modules`, or generated output were committed.

## Launch board

| Workstream | Owner | Status | Acceptance criteria | Blocker / current evidence | Verification and next action |
|---|---|---|---|---|---|
| Beta access and production fail-closed foundation | Back-End + Front-End | **Done** | Normal users cannot reach admin/refinement surfaces; export, enrichment, and workflow require full access; production cannot silently fall back to local storage. | Implemented in committed checkpoints `b7c347f` and `a5ba6ee`. | Preserve in regression testing; do not reopen unless a test fails. |
| Normalized opportunity action persistence | Back-End | **Done** | Newly saved opportunities contain the normalized action contract used by the report, export, and workflow layers. | `saveOpportunitySignals` persists `normalized_action`; committed implementation exists. Runtime proof must still come from fresh scans. | Treat implementation as done; verify one stored row per regression company during the domain pass. |
| Launch-hardening bundle and server-owned workflow payload | Back-End + Front-End; Chief of Staff integrates | **Done locally** | Browser sends only scan/opportunity IDs, access, and webhook URL; server reloads the stored row, rebuilds and validates the payload; free users cannot send; UI shows clear errors; beta access copy does not imply live checkout. | Committed in `557edad`; workflow contract harness is committed in `b32ca64`. | Preserve in the live-domain pass and complete one approved safe-webhook delivery. |
| Stable scan/report flow on the live environment | Back-End | **Live proof pending** | A URL submission reaches a report without manual intervention; failures are plain-English and reveal no debug data; all three regression companies complete. | Production hosting, required variables, schema, and deployment are complete. | Capture fresh scan IDs and report URLs for Reparel, Jammcard, and SchoolGig. |
| Three-company report quality and fresh normalized-contract proof | Back-End + Product Strategy; PM verifies | **Done locally / live proof pending** | Reparel, Jammcard, and SchoolGig each have 0 high-priority evaluator issues; visible rows contain revenue motion, actionability, next best action, and contact path; weak-fit filtering remains credible. | Local evaluator passes with 0 issues across all three companies. Public source regressions also pass for all three lanes. | Generate fresh live-domain scans, rerun the evaluator, and inspect stored/report/export/workflow agreement. |
| Report UI and free/full states | Front-End + Product Strategy | **In Review** | Desktop and mobile are usable; free shows 2-3 real signals plus total found; full unlocks the action layer; no raw/debug data is visible; payment language is beta-safe. | Copy changes are in the uncommitted bundle. Full three-company free/full visual review is not recorded. | Review free and full URLs for all three companies at desktop and phone widths; record defects before checkpoint approval. |
| Workflow verification tests | Back-End | **Done locally** | Tests cover invalid/non-HTTPS URLs, embedded credentials, missing IDs, scan/opportunity mismatch, full-access denial, non-ready payloads, server reconstruction, payload size, and delivery failures. | `scripts/test-workflow-contract.mjs` passes 11/11. | Add a real safe-endpoint smoke test after production setup; private-network destination policy remains a beta security decision. |
| Saved-profile monitoring and alerts | Back-End + Front-End | **Foundation deployed to the database / activation pending** | Paid profiles use the same scan pipeline as manual scans; only active Monitor/Growth subscriptions can be claimed; jobs are leased against duplicate execution; each run records status and queues only genuinely new visible opportunities. | Additive production schema, shared scan pipeline, secret-protected cron route, schedule/diff logic, and 6/6 monitoring contract checks are complete. All three tables and RLS policies plus the service-role claim function were verified in production. `CRON_SECRET`, cron scheduling, profile onboarding, and alert delivery are not active yet. | Configure scheduler authentication, add subscription-to-profile onboarding, activate the cron only after setup succeeds, then run one controlled profile twice and verify the second-run diff. |
| Lead-magnet acquisition flow | Product Strategy + Front-End + Back-End | **Live verified / full library automated QA complete** | One flagship and nine industry guides have cataloged PDFs and public landing routes; capture validates and persists only allowlisted guide requests; marketing consent is optional and false by default; users receive immediate browser access; PII is not placed in analytics or public errors. | Contract and automated file/visual QA cover all ten PDFs and 94 rasterized pages. The new 11-page marketing and digital-services report was also inspected page by page. Desktop and 390px browser flows plus production capture were previously verified for the original two guides. | Complete a human visual and live-domain capture/download spot-check for the seven industry guides that still lack one; add abuse protection before broad promotion and define the approved marketing follow-up process. |
| Safe-webhook smoke test | Back-End + PM; founder approves policy/destination | **Blocked by founder/credentials** | One full-access opportunity reaches an approved safe endpoint; received payload matches the stored row and excludes secrets, raw connector data, debug fields, and hidden free details; UI success and failure states are visible. | Needs founder/Chief of Staff decision on beta webhook policy and an approved safe endpoint. Must wait for tests, checkpoint, environment setup, and a known-good scan. | Use one test opportunity only, inspect the received payload, test one controlled failure, and record date, scan ID, opportunity ID, endpoint class, and result without recording credentials. |
| Production environment and controlled-test scope | Founder + Chief of Staff | **Done for controlled verification** | Domain/preview selected; Supabase schema installed; required variables configured; tester audience and webhook policy approved; deployment explicitly authorized. | Founder approved production setup and founder-assisted beta. Environment, schema, domains, and deployment are complete. Automated payment remains off pending an explicit pilot price. | Keep tester invitations controlled; finalize safe webhook destination and pilot price before paid collection. |
| Clean launch checkpoint | Chief of Staff + PM | **Deployed** | Accepted P0 and customer-acquisition bundle is committed with no secrets or transient artifacts; staged scope is reviewed; checkpoint IDs are recorded on `main`. | Checkpoint `049aa05` is pushed and the production deployment is ready. | Preserve this as the rollback/reference checkpoint during live regression testing. |
| Live-domain regression evidence package | PM + Back-End + Front-End | **Not Started** | Domain, environment, timestamp, company URLs, scan IDs, report URLs, counts, evaluator result, free/full screenshots or notes, mobile result, webhook result, and checkpoint ID are recorded. | Depends on environment, checkpoint, and deployment. | Run the controlled test pass and attach evidence to the Chief of Staff go/no-go review. |
| External beta invitation | Founder + Chief of Staff | **Not Started** | All go criteria pass, known limitations are documented, tester list is approved, and rollback/support owner is named. | All P0 verification above must complete first. | Make a founder go/no-go decision only after the evidence package is reviewed. |

## Parallel non-gating work

These streams can continue, but they must not delay or overwrite P0 launch verification:

| Workstream | Owner | Status | Acceptance criteria | Blocker / verification | Next action |
|---|---|---|---|---|---|
| Blog editorial queue and first packages | Product Strategy / Content | **Done for first wave** | Deduplicated queue and research-backed packages support ICP acquisition without changing pricing or major positioning. | Sixty canonical resources are organized; every one of nine industries and three solutions has a minimum three-post cluster; government-spending and Building Local Credibility packages are committed; the marketing-services cluster adds three source-backed deep articles. | Publish and refresh deeper cluster articles incrementally, with time-sensitive source records rechecked after their stated dates. |
| Lead-magnet content and distribution | Product Strategy + Front-End | **Done / manual spot-check pending** | One flagship and one asset for each of nine industries combine practical guidance, current official research, trends, caveats, source ledgers, and next actions; catalog-driven guide, resource, industry, and sitemap routes cover the full library. | `pnpm run validate:lead-magnet-quality` passes 6/6: exact catalog/source/public-file parity, route coverage, safe paths, PDF structure, 94-page raster health, nonblank output, and one successful allowlisted capture contract per asset. The new marketing guide also passed an 11-page human visual review. Email delivery is intentionally disabled. | Human-review covers and dense table pages, then run one production capture/download at desktop and mobile for the seven industry guides that still lack a manual spot-check. Do not activate marketing follow-up until sender, unsubscribe, suppression, and privacy processes are approved. |
| Resource article template | Front-End | **Done locally** | Reusable, responsive article template supports breadcrumbs, answer box, table of contents, related reads, optional metadata, structured data, and chart assets without exposing internal fields. | Typecheck and production build pass after marketing-services integration; all 23 resource URLs generate, and internal editorial fields remain absent from the built page. | Preserve the template during the next content refresh and include it in live-domain visual review. |
| Connector reliability and readiness | Connector | **Done locally / live monitoring pending** | Connector requests are bounded; no matches are distinct from failures; status is stored internally; no new APIs are added. | Runtime tests pass; public regressions pass for Reparel, Jammcard, and SchoolGig. SAM.gov returned partial zero-result responses, then quota-throttled until 2026-07-11 00:00 UTC. | Re-test SAM after the throttle clears and inspect connector-run records during live scans. |

## Precise P0 sequence

1. **Run the three-company domain pass.** Fresh-scan Reparel, Jammcard, and SchoolGig; inspect desktop/mobile, free/full gating, Opportunity Action Table, source credibility, connector-run status, hidden debug data, failure behavior, and stored normalized fields. Rerun the evaluator.
2. **Re-test SAM.gov after quota reset.** Confirm active procurement coverage or narrow live product claims if the source remains unavailable.
3. **Run one safe-webhook smoke test.** Use an approved endpoint and one full-access row; inspect payload content plus visible success and controlled-failure states.
4. **Activate one controlled monitored profile.** Apply the additive schema, configure scheduler authentication, complete subscription-to-profile onboarding, and verify a baseline run plus one subsequent diff without sending customer alerts.
5. **Implement the approved connector wave.** Follow `docs/connector-expansion-priorities-2026-07-10.md`: SAM validation, buyer/recipient resolution, then one official state/local pilot.
6. **Founder go/no-go.** PM assembles the evidence package; Chief of Staff summarizes tradeoffs; founder decides whether to invite a small controlled tester group and sets the assisted-pilot price.

Dependency chain: three-company domain pass and SAM re-test → safe-webhook smoke test → external beta and paid-pilot go/no-go.

## Regression matrix required for launch

| Company | Required opportunity lanes | Required pass |
|---|---|---|
| Reparel | Healthcare, rehab, DME/medical supply, VA/prosthetics/orthotics, buyer/channel motions | Fresh scan completes; credible rows; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |
| Jammcard | Music, arts, creative economy/workforce, live performance, city/county events, grants, tourism, parks and recreation | Fresh scan completes; public-event and arts lanes remain strong; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |
| SchoolGig | Education, workforce/training, school staffing, arts education, public education funding, district/vendor motions | Fresh scan completes; broad weak fits stay screened/research-only; normalized fields present; free/full and mobile pass; 0 high-priority evaluator issues. |

## Verification record for this audit

- Production deployment: checkpoint `049aa05` is ready on both custom domains.
- Production configuration: required OpenAI, Supabase, report-access, and admin variables are present for Production and Preview; source and enrichment credentials are present without exposing values.
- Production database: `lead_magnet_captures` and its index are installed; row-level security is enabled.
- Live acquisition smoke: guide index, guide landing page, and PDF returned `200`; a synthetic capture returned `201` and the test record was removed.
- `git diff --check`: passed with no whitespace errors.
- TypeScript check: passed.
- Production build: passed; all 20 resource URLs generated.
- Related-content validation: passed for 12 industry/solution pages and 36 published links.
- Lead-magnet contract: passed 12/12, including allowlisted paths, validation, PII-safe errors, production persistence failure, and explicit consent behavior.
- Lead-magnet PDF automated QA (2026-07-13): passed 6/6 for all ten catalog entries and all 94 pages. Every PDF exists, matches a source document and allowlisted public path, is 9–11 US Letter pages and at least 20 KB, rasterizes page-for-page at 36 DPI, and has no page below the obvious-blank threshold. Temporary raster files and font caches are deleted after the run.
- Lead-magnet manual QA: the original flagship and healthcare assets were previously inspected in desktop/mobile browser flows, and the new marketing and digital-services guide passed a page-by-page visual review. Live capture/download behavior and dense tables for the other seven industry reports still need a human production spot-check.
- Lead-magnet browser flow: passed at 1440px and 390px with no horizontal overflow, console errors, or framework overlays; capture, confirmation, and both PDF content types were verified.
- Flagship article source review: official SBA, SAM.gov, USAspending, Grants.gov, and Acquisition.gov claims checked; the built public page contains no internal research, republishing, or visual-production fields.
- Workflow contract: passed 11/11 without real delivery or credentials.
- Monitoring foundation (2026-07-12): passed 6/6 checks for daily/weekly scheduling, stable source fingerprinting, visible-only new-opportunity detection, subscription-gated leasing, shared manual/scheduled scan execution, secret-protected cron handling, and durable run/alert state. The production migration succeeded; `monitored_profiles`, `monitoring_runs`, and `monitoring_alerts` exist with RLS enabled, and the claim function is executable only through the service role. Scheduling, onboarding, and delivery remain intentionally inactive pending the controlled activation pass.
- Connector runtime: passed no-match/failure separation, partial-failure preservation, timeout bounds, credential skips, and error sanitization.
- Report evaluator: passed with 0 issues for Jammcard, SchoolGig, and Reparel.
- Public connector regressions: passed for all three company lanes across USAspending, Grants.gov, and Federal Register.
- Broad API health: passed for available configured sources; SAM.gov reported quota throttling and should be retried after 2026-07-11 00:00 UTC.
- Local environment intentionally lacks production Supabase credentials; production contains all required values.
- Safe-webhook smoke test: not run; it remains intentionally blocked until an approved destination, production environment, and deployment are available.

## Checkpoint rule

Future checkpoints must continue to include specialist reports with changed files, decisions, blockers, tests, and follow-ups. Before every commit, inspect the staged list and confirm `.env`, `.env.local`, `.data`, `.next`, `node_modules`, `output`, credentials, and generated artifacts are absent.
