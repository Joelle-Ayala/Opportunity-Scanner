# Beta Readiness Sprint

Date: 2026-07-01

## Sprint Goal

Move Opportunity Scanner closer to a usable MVP/beta by stabilizing the opportunity-to-action workflow: normalized action fields, credible report UI, clean QA signals, and workflow-ready outputs.

## Current Status

- Agent operating system is defined in `AGENTS.md` and `.agents/`.
- TypeScript check passes when using the Codex runtime Node binary.
- Report quality evaluator runs successfully.
- Latest regression QA result: 3 medium issues, 0 high-priority issues.
- Jammcard latest scan: pass, 0 issues.
- Reparel golden scan: pass, 0 issues.
- SchoolGig latest scan: 3 medium issues remain.
- Initial Git checkpoint exists: `3c07848`.
- Normalized opportunity action contract has been added in code and is pending fresh-scan verification.

## Primary Blockers

1. SchoolGig still surfaces a few weak-fit education/arts-adjacent signals.
2. Free/full report access is still placeholder-level and not production-safe.
3. Workflow webhook works, but needs beta guardrails before real users.
4. Normalized opportunity action fields need fresh-scan verification.

## Included Tasks

### Task 1: Normalize Opportunity Action Fields

Owner: Back-End Agent

Priority: P0

Status: Not Started

Updated Status: In Review

Problem: The report, CSV export, and workflow payload rely on classification logic at render time. This risks mismatched action fields across surfaces.

Required Work:

- Add or persist normalized action fields for opportunity type, buyer/partner type, revenue motion, next best action, contact strategy, actionability, source status, workflow readiness, CRM note, outreach angle, and manual research instruction.
- Ensure report, export, and workflow payload use the same action contract.

Acceptance Criteria:

- Every visible opportunity row has normalized action fields.
- Report UI, CSV export, and workflow payload agree.
- Reparel, Jammcard, and SchoolGig evaluator still run cleanly.

Testing / Verification:

- TypeScript check passes.
- `scripts/evaluate-local-reports.mjs` returns 0 high-priority issues.
- Run one fresh scan and confirm stored opportunity `raw_json` includes `normalized_action`.

### Task 2: Tighten SchoolGig Weak-Fit Filtering

Owner: Back-End Agent with Product Strategy & Product Marketing Agent

Priority: P0

Status: Not Started

Problem: SchoolGig still shows three medium weak-fit signals, including broad cultural/public-arts and a literacy grant that may not clearly map to staffing/recruiting action.

Required Work:

- Review the remaining SchoolGig issues.
- Decide which should be hidden, labeled as research-only, or kept with clearer action framing.
- Tune playbook/actionability rules without breaking Jammcard arts/live-performance fit.

Acceptance Criteria:

- SchoolGig report keeps education workforce, teacher staffing, school arts staffing, and relevant district/vendor lanes.
- Broad cultural/live-event records do not surface as move-forward SchoolGig opportunities unless the staffing/recruiting path is clear.
- Evaluator shows no high-priority issues and ideally no avoidable SchoolGig medium issues.

Testing / Verification:

- Run report evaluator.
- Manually inspect the latest SchoolGig report.

### Task 3: Make Paid Unlock Beta-Credible

Owner: Front-End Agent with Product Strategy & Product Marketing Agent

Priority: P0

Status: Not Started

Problem: The free/full split exists, but unlock is still placeholder-level and should sell a workflow-ready opportunity pipeline.

Required Work:

- Tighten paid unlock copy.
- Preview locked business value without exposing all paid details.
- Make full report value clear: buyer/partner targets, source records, contact path, CRM notes, outreach angles, workflow-ready payloads.

Acceptance Criteria:

- Free report shows 2-3 real signals and total found.
- Paid/full state clearly unlocks the action layer.
- Founder/operator can understand why full report is worth paying for.

Testing / Verification:

- Inspect free and paid report URLs for Reparel, Jammcard, and SchoolGig.

### Task 4: Add Workflow Webhook Beta Guardrails

Owner: Back-End Agent

Priority: P1

Status: Not Started

Problem: Webhook send exists, but before beta it should avoid unsafe or confusing behavior.

Required Work:

- Decide whether beta should allow arbitrary webhook URLs, HTTPS-only URLs, or configured allowlisted webhook destinations.
- Return clear success/failure messages.
- Ensure payload is CRM/workflow-ready and excludes raw/debug source data.

Acceptance Criteria:

- Workflow payload contains target, source, revenue motion, contact strategy, next best action, CRM note, source evidence, and workflow readiness.
- No secrets or internal debug data are sent.
- Failure states are clear to the user.

Testing / Verification:

- Send a test opportunity to a safe test webhook or mock endpoint.

### Task 5: Create Git Checkpoint

Owner: Project Management Agent / Chief of Staff Agent

Priority: P0

Status: Done

Problem: The repo has no commits yet, so meaningful progress is not checkpointed.

Required Work:

- Review Git status.
- Confirm no secrets are staged.
- Create an initial checkpoint commit once approved.

Acceptance Criteria:

- Initial project state and agent operating system are committed.
- `.env.local`, `.data`, `output`, `.next`, and generated artifacts remain uncommitted.
- Commit exists: `3c07848`.

Testing / Verification:

- `git status --short`
- Inspect staged files before commit.

## Out Of Scope

- Native HubSpot integration
- Native Zapier app
- Additional enrichment providers
- Multi-user accounts
- More APIs before the action-table workflow is stable
- Complex admin dashboards

## Definition Of Done

This sprint is done when:

1. Reparel, Jammcard, and SchoolGig scans are stable enough for real beta demos.
2. Every report opportunity has a clear target, revenue motion, next best action, contact strategy, actionability, and workflow-ready state.
3. Free/full report split is credible.
4. Workflow payload is useful for CRM or automation.
5. Debug/internal data stays hidden from normal users.
6. TypeScript check and report evaluator pass.
7. A Git checkpoint exists.
