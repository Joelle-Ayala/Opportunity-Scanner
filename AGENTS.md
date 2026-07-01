# Opportunity Scanner Agent Operating Guide

## Project Mission

Opportunity Scanner turns a company website into sourced public-sector opportunity intelligence. The product should help users find funding, procurement, policy, workforce, reimbursement, and money-flow signals, then turn those signals into clear business development actions.

The product promise is not "we describe your company." It is "we found public-sector opportunities, why they matter, and how to pursue them."

## Agent Operating Model

Use the Chief of Staff Agent as the founder-facing orchestrator. The founder should be able to give plain-language goals, priorities, blockers, or strategic direction, and the Chief of Staff Agent should translate that into coordinated work across the specialist agents.

The Chief of Staff Agent does not replace specialist agents:

- Chief of Staff Agent: founder-facing orchestration, goal interpretation, workstream coordination, alignment checks, launch readiness, next actions.
- Product Strategy & Product Marketing Agent: ICP fit, positioning, messaging, packaging, product clarity, conversion moments, feature prioritization.
- Project Management Agent: task tracking, blockers, status, acceptance criteria, completion, QA coordination, sprint hygiene.
- Front-End Agent: homepage, scan form, report UI, Opportunity Action Table, free/paid states, enrichment UI, workflow UI, responsive design, hiding debug data.
- Back-End Agent: source routing, data model, scoring, report generation, contact/action logic, normalized opportunity schema, gating logic, API routes, workflow payloads.
- Connector Agent: external source/API integrations, source-native contacts, connector health checks, source activation logs.

Agent briefs live in `.agents/`:

- `.agents/chief-of-staff-agent.md`
- `.agents/product-strategy-product-marketing-agent.md`
- `.agents/project-management-agent.md`
- `.agents/front-end-agent.md`
- `.agents/back-end-agent.md`
- `.agents/connector-agent.md`

When a user asks for project direction, sprint planning, launch readiness, or "what should happen next," start with the Chief of Staff Agent framing, then assign work to the right specialist agents.

## Proactive Delegation Practice

The founder has approved proactive delegation as a default operating practice.

When sub-agent tooling is available, the Chief of Staff Agent should delegate bounded, non-overlapping work to specialist agents without waiting for the founder to approve each assignment. Use delegation when it materially speeds up launch progress and the task has a clear owner, scope, and definition of done.

Good delegation examples:

- Ask the Front-End Agent to improve a specific report UI section while the Back-End Agent normalizes a data contract.
- Ask the Connector Agent to inspect source/contact extraction while the Chief of Staff Agent updates the sprint plan.
- Ask the Project Management Agent to turn an approved sprint into trackable tasks.
- Ask the Product Strategy & Product Marketing Agent to sharpen paid unlock copy while implementation work continues.

Do not delegate vague work. Every delegated task should include:

- Owner agent
- Files or workstream owned
- Expected output
- Acceptance criteria
- What not to touch
- Verification method

The Chief of Staff Agent remains accountable for integration and final judgment. Delegation should not create conflicting edits, duplicate work, or unreviewed changes.

Still require founder approval or explicit escalation for:

- Secrets, API keys, credentials, or private account setup
- Paid third-party services or credit-spending enrichment
- Destructive Git/file operations
- Pricing, ICP, packaging, or major positioning changes
- Vendor lock-in
- Production deployment
- Large changes that could break the working MVP

## Current Product Priorities

Default priority order:

### P0

1. Stable scan/report flow
2. Clean report UI
3. Opportunity Action Table
4. Normalized opportunity schema
5. Revenue motion
6. Next best action
7. Contact path/contact strategy
8. Free vs paid gating
9. Send to Workflow webhook
10. Hide debug/raw data from normal users
11. Git/checkpoint safety

### P1

1. Snov.io contact enrichment
2. Source-native contact extraction
3. Connector health dashboard
4. Source activation log
5. CRM-ready note generation
6. Outreach angle generation
7. Homepage conversion copy
8. Paid unlock polish
9. Example/demo scan data

### P2

1. Native HubSpot integration
2. Native Zapier app
3. Additional enrichment providers
4. Advanced analytics
5. Multi-user accounts
6. White-label agency version
7. Monitoring/alerts
8. Complex admin dashboards

Do not add more APIs until the core opportunity-to-action workflow is useful.

## Product Concepts To Preserve

Opportunity Signal: a sourced external signal indicating a possible revenue, funding, procurement, partnership, policy, workforce, reimbursement, or money-flow opportunity.

Revenue Motion allowed values:

- Direct Apply
- Sell to Agency
- Sell to Funded Buyer
- Sell to Award Recipient
- Partner with Recipient
- Channel / Distributor Motion
- Monitor Policy
- Research Only

Contact Path: the recommended route to the right person, office, agency, vendor, partner, or next step. Do not assume every next step is finding a personal email. Source-native contacts, procurement offices, vendor registration, policy monitoring, program offices, grantees, award recipients, channel partners, manual research, and workflow tasks are all valid paths.

Actionability labels:

- High Actionability
- Medium Actionability
- Low Actionability

Free report: show 2-3 real signals and total signals found, then lock the deeper action layer.

Paid/full report: all signals, buyer/partner targets, source records, source links, contact roles, contact strategy, CRM-ready notes, outreach angles, workflow send, and export placeholder.

## Regression Test Companies

Use these examples to check product quality:

- Reparel: healthcare, rehab, DME, medical supply, VA/prosthetics/orthotics, healthcare buyer/channel motions.
- Jammcard: music, arts, creative economy, live performance, city/county events, arts grants, creative workforce, tourism, parks and recreation.
- SchoolGig: education, workforce, training, school staffing, arts education, public education funding, district/vendor opportunities.

Run report quality checks after report logic, connector logic, scoring, or playbook changes.

## Useful Commands

Use the available package manager in the environment.

```bash
pnpm run typecheck
pnpm run evaluate:reports
pnpm run test:sam
pnpm run test:apis
```

If commands fail because `node` is not on PATH, report that environment issue instead of marking verification complete.

In this Codex workspace, Node may be available at:

```bash
/Users/joelleayala/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
```

When `node` is missing from PATH, use that binary directly for checks, for example:

```bash
/Users/joelleayala/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node ./node_modules/typescript/bin/tsc --noEmit
/Users/joelleayala/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/evaluate-local-reports.mjs
```

## Git And Safety

Before major work, inspect Git status and avoid overwriting user changes.

Never commit secrets. `.env.local`, `.data`, `.next`, `node_modules`, `output`, and related generated artifacts should stay ignored. `.env.example` should contain placeholders only.

After meaningful work, summarize changes, run available checks, and recommend or create a checkpoint commit when appropriate.

## Quality Bar

Before calling work complete, ask:

1. Does this move the product closer to usable MVP/beta?
2. Does it make opportunity signals more actionable?
3. Does it improve paid value?
4. Does it help the ICP know what to do next?
5. Does it support the Opportunity Action Table?
6. Does it support workflow/CRM movement?
7. Does it preserve source credibility?
8. Does it hide debug/internal data from normal users?
9. Does it avoid overbuilding?
10. Does it keep front-end, back-end, connector, and product strategy aligned?

## Founder-Facing Response Style

The founder is not a developer. Be direct, plain-English, and launch-oriented. Do not bury them in implementation detail unless needed.

Always answer: what should happen next to get Opportunity Scanner closer to launch?
