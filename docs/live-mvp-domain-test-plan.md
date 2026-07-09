# Live MVP Domain Test Plan

Date: 2026-07-01  
Last updated: 2026-07-08

Owner: Project Management Agent

## Live MVP Objective

Get Opportunity Scanner ready for controlled testing on the live domain with a stable company URL to report to opportunity action workflow.

The live MVP should let a founder, operator, consultant, or sales/growth user enter a company website, receive a credible public-sector opportunity report, understand the best next action for each signal, and see a clear free-to-paid path without being exposed to debug data or unfinished internal mechanics.

The first domain test is not a broad launch. It is a controlled proof that the product can run end to end on the domain for known test companies and a small number of founder-approved external testers.

## Current Blockers

1. Production hosting/domain access is still needed to publish the app.
2. Production environment variables must be configured, especially OpenAI, Supabase, report access code, and admin access code.
3. Supabase schema must be created from `db/schema.sql` in the production project before the scan flow can persist data.
4. Workflow webhook behavior still needs one live safe-webhook smoke test before external users send records to automations.
5. Fresh live-domain scans are still needed across Reparel, Jammcard, and SchoolGig.

## Current Launch Status

- Free/full access hardening is implemented with beta and admin access codes.
- Normal users are blocked from admin/profile refinement surfaces.
- Export, contact enrichment, and workflow send require full-report access.
- Production fails closed if Supabase is missing, preventing accidental local JSON storage on the live domain.
- Latest local report evaluator shows 0 issues across Jammcard, SchoolGig, and Reparel.
- The scan route remains synchronous and is suitable for controlled beta traffic, not broad public launch volume.

## Fastest Path To Domain

1. Create or select the production Supabase project.
2. Run `db/schema.sql` in the production Supabase SQL editor.
3. Deploy the Next app to the hosting provider connected to the target domain.
4. Set required production env vars: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE`, and `OPPORTUNITY_SCANNER_ADMIN_CODE`.
5. Set recommended connector env vars where available: `SAM_API_KEY`, `SNOV_CLIENT_ID`, and `SNOV_CLIENT_SECRET`.
6. Run `npm run build` and `npm run check:launch-env` in the deployment environment or equivalent CI.
7. Point the domain to the deployment.
8. Run fresh Reparel, Jammcard, and SchoolGig scans on the domain and record scan/report URLs.

## P0 Task List

### P0-1: Verify Stable Scan And Report Flow

Owner: Back-End Agent

Status: Pending Domain Verification

Problem: The live domain is not testable until a user can submit a company URL and reliably receive a report.

Required Work:

- Confirm the scan form creates a scan on the live-domain environment.
- Confirm report generation completes for Reparel, Jammcard, and SchoolGig.
- Confirm failed scans show a plain-language failure state and do not expose stack traces, raw JSON, secrets, or connector internals.
- Confirm local storage or Supabase behavior is understood for the environment being tested.

Dependencies:

- Environment variables configured for the selected domain test environment.
- No unresolved schema mismatch between scan storage and report rendering.

Acceptance Criteria:

- A tester can submit a company URL and reach a report page without manual database intervention.
- Reparel, Jammcard, and SchoolGig each produce a report.
- Report pages do not expose debug/internal data to normal users.
- Failures are visible, understandable, and recoverable.

Testing / Verification:

- Run `pnpm run typecheck`.
- Run `pnpm run evaluate:reports`.
- Perform one fresh scan each for Reparel, Jammcard, and SchoolGig on the environment under test.
- Capture scan IDs and report URLs in the checkpoint notes.

### P0-2: Confirm Normalized Opportunity Action Contract

Owner: Back-End Agent

Status: In Review

Problem: The report UI, export, and workflow payload must agree on action fields before the domain can be tested with users.

Required Work:

- Verify every visible opportunity has normalized action fields.
- Confirm the report UI, CSV/export path, and workflow payload use the same action contract.
- Confirm required action fields include revenue motion, next best action, contact strategy, actionability, source status, CRM note, outreach angle, and workflow readiness.

Dependencies:

- Fresh scans must be generated after the normalized action contract changes.
- Front-End Agent must know which fields are guaranteed and which are optional.

Acceptance Criteria:

- Every visible opportunity row has revenue motion, actionability, next best action, and contact path.
- UI labels match the payload/export values.
- Missing optional fields degrade gracefully and do not show raw placeholders.
- The action contract supports the Opportunity Action Table and workflow send.

Testing / Verification:

- Inspect stored opportunity data for at least one fresh scan.
- Compare one report row against its workflow payload.
- Run `pnpm run evaluate:reports` and confirm 0 high-priority issues.

### P0-3: Clean Report UI For Domain Testers

Owner: Front-End Agent

Status: In Review

Problem: Domain testers need a credible product experience, not a technical prototype.

Required Work:

- Confirm the report opens cleanly on desktop and mobile.
- Keep the Opportunity Action Table as the core report surface.
- Make the first screen clearly communicate what was found, why it matters, and what to do next.
- Hide raw/debug data from normal users.
- Ensure empty, loading, locked, and failed states are readable.

Dependencies:

- Back-End Agent must confirm guaranteed action fields.
- Product Strategy Agent must confirm paid unlock wording.

Acceptance Criteria:

- A non-technical tester can understand the top opportunities within 60 seconds.
- Every visible row has a clear target, source, revenue motion, contact path, and next best action.
- Locked rows preview value without exposing full paid details.
- The report does not show raw JSON, internal scoring artifacts, stack traces, or debug panels to normal users.
- Mobile layout is usable for scan completion and report review.

Testing / Verification:

- Manually inspect free and full report states for Reparel, Jammcard, and SchoolGig.
- Check desktop and mobile widths.
- Confirm user-facing copy uses public-sector opportunity language, not internal/debug language.

### P0-4: Make Free And Full Report States Beta-Credible

Owner: Front-End Agent with Product Strategy & Product Marketing Agent

Status: In Review

Problem: The free/full split must make paid value clear before domain testing creates user expectations.

Required Work:

- Show 2-3 real free signals and total signals found.
- Lock the deeper action layer without making the free report feel empty.
- Position the full report as a workflow-ready opportunity pipeline.
- Make the full report value clear: buyer/partner targets, source records, source links, contact strategy, CRM-ready notes, outreach angles, workflow send, and export placeholder.

Dependencies:

- Product Strategy Agent must approve unlock message and value framing.
- Back-End Agent must confirm free/full gating behavior.

Acceptance Criteria:

- Free users see enough credible value to trust the product.
- Paid/full state clearly unlocks the action layer, not just "more data."
- No paid-only operational details leak into the free state.
- Placeholder checkout/access language is clearly beta-safe and does not imply live payment if payment is not enabled.

Testing / Verification:

- Inspect free report URLs and full/admin report URLs for the three regression companies.
- Verify the free state shows useful signals but locks deeper action details.
- Verify the full state exposes the full action layer.

Current Result:

- Homepage and pricing copy no longer imply a live `$99` checkout during beta.
- Full report access is positioned as request-based while checkout is being finalized.

### P0-5: Tighten SchoolGig Weak-Fit Filtering

Owner: Back-End Agent with Product Strategy & Product Marketing Agent

Status: In Review

Problem: SchoolGig previously surfaced medium weak-fit signals, which could reduce trust during live testing.

Required Work:

- Review current SchoolGig weak-fit issues.
- Decide which records should be hidden, downgraded to research-only, or reframed with a clearer staffing/recruiting path.
- Tune playbook/actionability rules without breaking Jammcard arts/live-performance fit.

Dependencies:

- Product Strategy Agent must confirm fit rules for education/workforce vs arts/culture.
- Back-End Agent must avoid front-end-only filtering that creates payload/UI mismatches.

Acceptance Criteria:

- SchoolGig keeps education workforce, teacher staffing, school arts staffing, district/vendor, and educator hiring lanes.
- Broad cultural, behavioral health, healthcare, justice, or generic workforce records do not appear as move-forward SchoolGig opportunities unless the staffing/recruiting path is explicit.
- Reparel and Jammcard regression quality does not degrade.
- Local evaluator returns 0 issues for Jammcard, Reparel, and SchoolGig.

Testing / Verification:

- Run `pnpm run evaluate:reports`.
- Manually inspect the latest SchoolGig report.
- Confirm no high-priority issues and no avoidable SchoolGig medium issues.

Current Result:

- Latest local evaluator run shows 0 total issues across Jammcard, Reparel, and SchoolGig.
- Fresh live-domain scans are still needed before marking this complete for beta.

### P0-6: Add Workflow Webhook Beta Guardrails

Owner: Back-End Agent

Status: In Review

Problem: Workflow send can create confusion or risk if testers can send incomplete, unsafe, or raw payloads.

Required Work:

- Decide beta behavior: disabled placeholder, configured test endpoint, HTTPS-only arbitrary webhook, or allowlisted destinations.
- Ensure success and failure states are clear.
- Ensure the payload is CRM/workflow-ready and excludes raw/debug source data.
- Confirm whether workflow send is enabled for free, full, or admin-only states during domain testing.

Dependencies:

- Founder or Chief of Staff Agent must approve the beta webhook policy before real external testing.
- Back-End Agent must align payload fields with the normalized action contract.

Acceptance Criteria:

- Workflow payload includes target, source, revenue motion, contact strategy, next best action, CRM note, source evidence, and workflow readiness.
- Payload excludes secrets, raw connector responses, raw JSON, internal debug data, and hidden paid details in free state.
- Failure messages tell the user what happened and what to do next.
- Domain testers cannot accidentally send to unsafe or unknown endpoints unless that behavior is explicitly approved.

Testing / Verification:

- Send one test opportunity to a safe test webhook or mock endpoint.
- Inspect the payload.
- Confirm visible success/failure states.

Current Result:

- Workflow send now accepts only `scanId`, `opportunityId`, access, and webhook URL from the browser.
- The API verifies full-report access, fetches the stored opportunity for that scan, rebuilds the workflow payload server-side, validates readiness, and sends only the server-owned payload.
- HTTPS/no-credential URL guardrails remain in place.
- A live safe-webhook smoke test is still pending before external beta testers.

### P0-7: Domain Launch Safety And Checkpoint

Owner: Project Management Agent with Chief of Staff Agent

Status: Not Started

Problem: Multiple agents are working toward a live test, so the project needs clean checkpoints and no accidental secret or generated-file commits.

Required Work:

- Check Git status before and after each meaningful work block.
- Confirm no secrets, `.env.local`, `.data`, `.next`, `node_modules`, `output`, or generated artifacts are staged.
- Request or create a checkpoint commit after each accepted P0 bundle.
- Maintain this plan as the shared source of truth for live-domain test readiness.

Dependencies:

- Specialist agents must report changed files, tests run, blockers, and follow-ups.

Acceptance Criteria:

- Every accepted P0 bundle has a checkpoint or a documented reason no checkpoint was made.
- Git status is reviewed before domain testing starts.
- Secret safety is explicitly confirmed before any domain-facing work is considered ready.

Testing / Verification:

- Run `git status --short`.
- Inspect staged files before every checkpoint.
- Record checkpoint commit IDs in the cadence log.

## P1 Task List

### P1-1: Source-Native Contact Extraction

Owner: Connector Agent with Back-End Agent

Status: Not Started

Acceptance Criteria:

- Source-native agency/program/procurement contacts are captured when available.
- Contact path does not default to personal email when the correct path is vendor registration, program office, procurement office, grantee, award recipient, or manual research.
- No connector raw response is exposed in normal user UI.

Testing / Verification:

- Inspect at least one source-native contact example or confirm graceful no-contact fallback.

### P1-2: Connector Health And Source Activation Log

Owner: Connector Agent

Status: Not Started

Acceptance Criteria:

- Admin/source view shows which sources are active, planned, missing credentials, or failing.
- Reports reflect sources checked clearly enough for credibility.
- Source failures do not break the whole report unless the failed source is required.

Testing / Verification:

- Run `pnpm run test:apis`.
- Run `pnpm run test:sam` if `SAM_API_KEY` is configured.
- Manually inspect `/admin/sources`.

### P1-3: CRM-Ready Note And Outreach Angle Polish

Owner: Product Strategy & Product Marketing Agent with Back-End Agent

Status: Not Started

Acceptance Criteria:

- CRM note is short, action-oriented, and includes target, source, reason to pursue, and next step.
- Outreach angle explains why the company is relevant to the buyer/partner/funder.
- Notes are useful even when contact enrichment finds no personal contact.

Testing / Verification:

- Inspect expanded opportunity rows and workflow payloads for Reparel, Jammcard, and SchoolGig.

### P1-4: Homepage Conversion Copy

Owner: Product Strategy & Product Marketing Agent with Front-End Agent

Status: Not Started

Acceptance Criteria:

- Homepage clearly promises public-sector opportunity intelligence, not generic company description.
- Form copy sets the expectation that the product finds sourced signals and recommended next actions.
- Free/full value is understandable before submission.

Testing / Verification:

- Founder or Chief of Staff Agent performs a 60-second homepage review.
- One non-technical tester can explain what the product does after reading the first screen.

### P1-5: Demo Scan Data For Controlled Testing

Owner: Project Management Agent with Back-End Agent

Status: Not Started

Acceptance Criteria:

- Known good Reparel, Jammcard, and SchoolGig report URLs are documented for demos.
- Fresh-scan IDs are recorded separately from golden historical examples.
- Demo data is clearly marked as test/demo and does not confuse production users.

Testing / Verification:

- Confirm report URLs open and match expected vertical lanes.

## Domain Testing Plan

### Test Scope

The first domain test should cover:

- Homepage and scan form.
- Company URL submission.
- Report generation.
- Free report preview.
- Full/admin report state.
- Opportunity Action Table.
- Opportunity detail/workspace page.
- Workflow send beta behavior, if enabled.
- Admin/source status pages only for internal reviewers.

Out of scope for the first domain test:

- Native HubSpot integration.
- Native Zapier app.
- Additional enrichment providers beyond current Snov.io path.
- Multi-user accounts.
- Production payment flow.
- Broad public launch.

### Regression Companies

Use these first:

- Reparel: healthcare, rehab, DME, medical supply, VA/prosthetics/orthotics, healthcare buyer/channel motions.
- Jammcard: music, arts, creative economy, live performance, city/county events, arts grants, creative workforce, tourism, parks and recreation.
- SchoolGig: education, workforce, training, school staffing, arts education, public education funding, district/vendor opportunities.

### Test Passes

1. Internal smoke pass: run all three regression companies and confirm the scan/report flow works.
2. Report quality pass: evaluate relevance, actionability, source credibility, and hidden debug data.
3. Free/full gating pass: verify useful free preview and locked paid action layer.
4. Workflow pass: send one safe test payload or confirm workflow is intentionally disabled.
5. Mobile pass: complete scan and review report on a phone-width viewport.
6. Founder pass: founder or Chief of Staff Agent reviews final domain URLs and decides whether to invite external testers.

### Required Evidence To Capture

- Domain URL tested.
- Date/time tested.
- Environment tested.
- Regression company names and submitted URLs.
- Scan IDs and report URLs.
- Whether each scan completed.
- Number of total signals and visible free signals.
- Any high/medium report quality issues.
- Screenshots or notes for UI defects.
- Workflow payload result, if tested.
- Git checkpoint before and after fixes.

## Go / No-Go Checklist

### Go Criteria

- Homepage scan form works on the domain.
- Reparel, Jammcard, and SchoolGig each generate a report.
- Report UI is credible on desktop and mobile.
- Opportunity Action Table is visible and understandable.
- Every visible opportunity has revenue motion, next best action, contact path, and actionability.
- Free report shows 2-3 real signals and total signals found.
- Full/admin state shows the deeper action layer.
- Debug/raw/internal data is hidden from normal users.
- Workflow send is either safely guarded or intentionally disabled with clear copy.
- Report evaluator returns 0 high-priority issues.
- No known secrets or generated artifacts are staged or committed.
- A checkpoint exists before external testers are invited.

### No-Go Conditions

- Scan submission fails or reports do not load for known regression companies.
- Normal users can see raw JSON, stack traces, debug panels, secrets, or connector internals.
- Opportunity rows lack next best action, contact path, or revenue motion.
- Free/full gating exposes paid-only detail or misleads users about payment/access.
- Workflow send can leak raw/internal data or send to unapproved destinations.
- SchoolGig weak-fit results remain prominent enough to undermine trust.
- TypeScript or report evaluator checks fail with high-priority issues.
- Git status contains unexplained app changes, secrets, or generated artifacts before testing.

## Checkpoint Cadence

### Daily While Domain Test Work Is Active

- PM checks Git status and updates this plan if priorities or blockers change.
- Each specialist agent reports changed files, decisions made, blockers, tests run, and follow-ups.
- Chief of Staff Agent confirms the next highest-leverage action.

### After Each P0 Bundle

- Run the relevant verification checks.
- Record remaining blockers.
- Create or request a checkpoint commit if the work is accepted.
- Do not start broad external testing until the checkpoint is clean.

### Before External Testers

- Confirm go/no-go checklist.
- Confirm secret safety.
- Confirm the intended domain URL.
- Confirm whether workflow send is enabled, disabled, or allowlisted.
- Record known-good report URLs for Reparel, Jammcard, and SchoolGig.

### After External Tester Feedback

- Triage feedback into P0 launch blockers, P1 polish, and P2 later work.
- Do not expand connector/API scope unless the core opportunity-to-action workflow is stable.
- Create a checkpoint after accepted fixes.

## Founder Or Chief Of Staff Decisions Needed

1. Which live domain or preview domain should be used for the first controlled test?
2. Should workflow send be disabled, allowlisted, or enabled for HTTPS-only test webhook URLs during beta?
3. Is the first domain test internal-only, founder-invited testers only, or a small public link?
4. Should payment remain a beta placeholder for the first domain test, or should any paid-access flow be connected before testers see it?

## Definition Of Done For Live MVP Domain Test Readiness

Opportunity Scanner is ready for controlled live-domain testing when the scan/report/action workflow works for Reparel, Jammcard, and SchoolGig; the report is clean and action-oriented; free/full value is credible; workflow behavior is guarded; debug data is hidden; report checks pass with no high-priority issues; and a clean Git checkpoint exists.
