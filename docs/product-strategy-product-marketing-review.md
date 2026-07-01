# Product Strategy & Product Marketing Review

Date: 2026-06-30

Agent: Product Strategy & Product Marketing Agent

## Product Review Summary

Opportunity Scanner already has a strong MVP direction: the homepage positions the product as public-sector opportunity intelligence, the report includes an Opportunity Action Table, and the opportunity workspace turns a signal into a work item with evidence, contact roles, enrichment actions, and workflow send.

The biggest weakness is not concept. It is normalization and packaging. The product has many of the right ideas in UI helper functions, but the back-end schema does not yet store enough first-class product fields for action path, buyer/partner type, source-native contact, actionability score, pursuit difficulty, time sensitivity, or workflow readiness. That causes several important concepts to be inferred in the front end instead of guaranteed by the opportunity record.

The current report also contains some hard-coded vertical logic, especially Jammcard/live-music specific screening in `app/reports/[id]/page.tsx` and `lib/actionability.ts`. That may improve one demo report, but it risks making the product less credible across the stated ICPs.

What should change first:

- Make every opportunity carry a normalized action path: revenue motion, buyer/partner type, contact strategy, next best action, time sensitivity, pursuit difficulty, and workflow-ready payload fields.
- Make the report table action-first, not score-first.
- Make the paid unlock sell exact business outputs: buyer/partner targets, source-backed evidence, recommended contact path, CRM note, outreach angle, and workflow payload.
- Separate live opportunities, historical market evidence, and policy signals in both data and UI.
- Replace front-end-only action/contact inference with shared back-end fields so workflow payloads and UI labels match.

## Current Product Experience Summary

Homepage:

- Clearer than a generic grant finder. It uses "public-sector opportunity intelligence," "public-sector money-flow," and "buyer-channel intelligence."
- The form asks for company URL, email, industry, region, customer type, signal priorities, and optional context.
- The page explains free versus full report, but the paid outcome still reads as a feature list rather than a business result.

Free report:

- Shows executive summary, opportunity screening, visible signals, locked signals, unlock CTA, and sources scanned.
- Free value is visible, but locked teasers could better show the delta between "interesting source match" and "workflow-ready opportunity."
- Unlock is currently a placeholder, which is fine for MVP, but the moment should make the full report feel like a revenue pipeline rather than a larger report.

Opportunity Action Table:

- Strong MVP asset. Columns include opportunity, target organization, source, signal type, revenue motion, revenue fit, contact path, enrichment status, next step, and workflow.
- Rows expand into evidence, why it matters, contact roles, CRM note, outreach angle, and recommended next step.
- The table needs stronger data support: many columns are derived from helper functions instead of stored fields.

Contact enrichment:

- The opportunity workspace correctly distinguishes source contacts from target role suggestions.
- "Find Contacts" still risks implying that email enrichment is always the next action.
- Contact logic should classify the target first: agency, vendor, distributor, grantee, program office, prime, or company domain. Use Snov only when the target is a company/domain.

Workflow/Zapier:

- The webhook concept is a good MVP path before native integrations.
- Payload has useful fields, but it should include action path metadata, source-native contact, recommended roles, time sensitivity, pursuit difficulty, and workflow readiness.

Report credibility:

- Sources are visible, source records are linked in paid state, and screening reasons exist.
- Need clearer separation between active opportunities, historical market evidence, policy signals, and source routes.

## ICP Impact

B2B founders/operators:

- The product is close to serving them because it reduces research time and points toward buyer/partner paths.
- Gaps: too much value sits behind labels like "Revenue fit" and "Scores" rather than a clear "Do this next" command. Founder users need confidence, path, and expected payoff quickly.

Agencies/consultants:

- The report structure could become a strong client deliverable.
- Gaps: not enough white-label strategy framing yet. It needs an executive-ready "Top opportunities, why they matter, action plan, buyer/partner targets, evidence appendix" structure.

B2B sales/growth teams:

- Workflow send, CRM note, outreach angle, and contact roles are directly relevant.
- Gaps: payload is not yet rich enough for CRM routing. It needs stage, owner action, target account, contact strategy, source URL, source date, actionability score, and follow-up task copy.

Public-sector adjacent companies:

- The website scan and playbook system help translate companies into public-sector buying language.
- Gaps: vertical rules are currently uneven. Jammcard-specific logic can harm healthcare, workforce, education, SaaS, manufacturing, or professional services scans.

Economic development/workforce/government-adjacent operators:

- Sources and funding/procurement/policy distinctions are promising.
- Gaps: policy and workforce signals should be labeled as market evidence or emerging demand unless there is a direct grant/procurement/funded-buyer path.

## Biggest Gaps From An ICP / Value Perspective

1. The product is still too dependent on front-end inference for strategy fields that should be normalized by the back end.
2. "Find Contacts" is too broad as a universal CTA; the correct action may be inspect procurement record, register as vendor, contact program office, monitor policy, research award recipient, or create a CRM task.
3. Paid value is present but not sharp enough. It should sell "workflow-ready opportunity pipeline," not "more signals."
4. Actionability should be a score and reasoned category, not just yes/maybe/unlikely or strong/medium fit.
5. The report does not consistently distinguish active opportunity, historical market evidence, and policy signal.
6. Source credibility is visible but not always enough to support a sales decision: source date, status, source-native contact, and evidence snippet should be easier to scan.
7. Hard-coded vertical rules create product risk outside the current demo examples.
8. Workflow payload is helpful but not yet CRM-ready enough for sales teams.
9. Free report teasers show "additional opportunity signal" but should preview locked business value without revealing everything.
10. The current naming still mixes internal concepts such as debug/admin/status with customer-facing intelligence language.

## Top 10 Product Improvements

1. Add `next_best_action` as a first-class field and display it as the primary row CTA.
2. Add `contact_strategy` and `buyer_partner_type` before enrichment. Do not run contact enrichment until the target type is known.
3. Add `estimated_opportunity_type`: active_opportunity, historical_market_evidence, policy_signal, source_route, research_only.
4. Add `actionability_score`, `pursuit_difficulty`, and `time_sensitivity` to make prioritization legible.
5. Redesign the Action Table hierarchy so each row reads: Signal -> Target -> Motion -> Next best action -> Contact path -> Workflow.
6. Upgrade paid unlock copy to emphasize "buyer/partner targets, source-backed evidence, contact path, CRM note, outreach angle, and workflow-ready payload."
7. Add source credibility chips: source name, status, date/deadline, source URL state, and source-native contact availability.
8. Move vertical-specific screening rules out of generic report UI and into reusable playbook/back-end classification logic.
9. Expand webhook payload into a CRM-ready opportunity object with task text, target account, contact roles, source evidence, and recommended follow-up.
10. Add a report-level "Pursuit Plan" that groups opportunities into contact now, inspect/register, partner/channel, monitor, and research.

## Recommended Report / Action-Table Structure

Recommended report order:

1. Executive brief: top public-sector money-flow pattern, best opportunity lane, recommended next action.
2. Opportunity pipeline summary: counts by active opportunity, historical market evidence, policy signal, research only.
3. Top action paths: contact now, inspect procurement/register, sell to funded buyer, partner/channel, monitor policy.
4. Opportunity Action Table.
5. Buyer/partner targets.
6. Source-backed evidence appendix.
7. Workflow/export section.
8. Paid unlock CTA for free state.

Recommended Action Table columns:

- Opportunity signal
- Opportunity type
- Target organization
- Buyer/partner type
- Revenue motion
- Source and status
- Time sensitivity
- Actionability
- Next best action
- Contact strategy
- Workflow

Recommended row detail:

- Why this fits this company
- Source-backed evidence
- How to pursue
- Recommended contact roles
- Source-native contact, if available
- CRM note
- Outreach angle
- Manual research instruction
- Workflow payload preview

## Required Back-End Fields For Better Front-End / Product Value

Add or normalize these fields on stored opportunity signals:

- `opportunity_id`
- `opportunity_title`
- `opportunity_lane`
- `signal_type`
- `source_name`
- `source_url`
- `source_status`
- `source_published_date`
- `source_deadline`
- `evidence_summary`
- `why_it_matters`
- `why_this_target`
- `target_organization`
- `buyer_partner_type`
- `revenue_motion`
- `next_best_action`
- `contact_strategy`
- `recommended_contact_roles`
- `source_native_contact`
- `enrichment_status`
- `enriched_contacts`
- `manual_research_instruction`
- `crm_note`
- `outreach_angle`
- `workflow_payload_ready`
- `relevance_score`
- `novelty_score`
- `confidence_score`
- `actionability_score`
- `pursuit_difficulty`
- `time_sensitivity`
- `estimated_opportunity_type`

Suggested `buyer_partner_type` values:

- agency
- procurement_office
- program_office
- funded_buyer
- award_recipient
- prime_vendor
- distributor
- grantee
- channel_partner
- policy_owner
- research_target

Suggested `revenue_motion` values:

- direct_apply
- procurement_bid
- sell_to_agency
- sell_to_funded_buyer
- sell_to_award_recipient
- partner_with_recipient
- channel_or_distributor
- register_as_vendor
- monitor_policy
- research_only

Suggested `contact_strategy` values:

- use_source_native_contact
- inspect_procurement_record
- contact_procurement_office
- contact_program_office
- contact_grants_manager
- contact_award_recipient
- research_prime_or_vendor
- identify_distributor
- enrich_company_domain
- monitor_source
- create_manual_research_task

## Recommended Contact-Strategy Logic

1. Classify the opportunity type.
   Active procurement should prioritize solicitation review, procurement contact, and vendor registration. Active grant should prioritize eligibility, program officer, and source-native contact. Historical award should prioritize award recipient, awarded vendor, prime, distributor, or market evidence. Policy signal should prioritize monitoring and program office research.

2. Classify the target.
   Use `buyer_partner_type` before enrichment. A public agency, grant office, or procurement office should not be treated like a company domain.

3. Choose contact path.
   Use source-native contact first when present. Use search/manual instructions for public offices. Use Snov only when the target is a company or recipient with a usable domain.

4. Preserve non-contact actions.
   When the next best action is inspect, register, monitor, research, partner, or create task, do not force "Find Contacts" as the primary CTA.

5. Record enrichment state.
   Use `enrichment_status` values like not_started, source_contact_available, role_targets_identified, enrichment_available, enrichment_requested, contacts_found, no_contacts_found, manual_research_required.

## Recommended Paid / Free Packaging Improvements

Free report should include:

- 2-3 opportunity signals
- High-level source name and signal type
- One visible next best action per signal
- One example buyer/partner target
- Locked source links and CRM/workflow fields
- Clear explanation of what is unlocked

Full report should include:

- All prioritized opportunities
- Source URLs and source-native contacts
- Buyer/partner targets
- Contact strategy
- Recommended contact roles
- CRM-ready notes
- Outreach angles
- Workflow send
- PDF/export
- Pursuit plan grouped by action path

Suggested unlock copy:

"Unlock the full opportunity pipeline: all prioritized public-sector signals, source-backed evidence, buyer/partner targets, contact paths, CRM notes, outreach angles, and workflow-ready payloads."

Avoid selling the unlock as only "more signals." Sell it as "what to pursue, why, who to target, and what to do next."

## Messaging / Positioning Recommendations

Homepage H1 option:

"Find public-sector money flows your business can act on."

Supporting copy:

"Opportunity Scanner turns your company website into a source-backed pipeline of funding, procurement, policy, workforce, reimbursement, and public spending signals. Each signal includes the target, revenue motion, contact path, and next best action."

Paid outcome copy:

"The free scan previews sourced opportunity signals. The full scan turns them into a workflow-ready pursuit plan with buyer/partner targets, source records, contact strategies, CRM notes, outreach angles, and webhook export."

CTA copy:

- Primary: "Run Free Opportunity Scan"
- Paid: "Unlock Full Opportunity Pipeline"
- Row CTA examples: "Review solicitation," "Find source contact," "Research award recipient," "Create CRM task," "Monitor policy signal"

## UX / Report Recommendations

- Replace the row-level primary action from generic "Find Contacts" with the opportunity-specific `next_best_action`.
- Keep "Find Contacts" as a secondary action only when contact enrichment is appropriate.
- Add an "Opportunity type" chip to every row: Active, Historical evidence, Policy signal, Source route, Research only.
- Add time sensitivity labels: urgent, active, recent, evergreen, expired, monitor.
- Show source credibility inline: source, date/deadline, linked source, source-native contact availability.
- Change "Scores" display from R/N/C abbreviations to customer-facing labels or hide them behind details.
- Keep admin/debug information only in admin view.
- Make locked rows show the type of value locked: target, action path, CRM note, source link, workflow payload.

## Front-End Requirements

- Add a first-class "Next best action" CTA in the Opportunity Action Table.
- Add chips for `estimated_opportunity_type`, `buyer_partner_type`, `time_sensitivity`, and `pursuit_difficulty`.
- Reorder table columns around decision-making: opportunity, type, target, motion, action, contact path, source, workflow.
- Update locked-state copy to sell workflow-ready value.
- Update report cards to avoid showing raw score abbreviations as primary customer-facing value.
- Update workflow modal to preview the CRM-ready payload fields before sending.
- In opportunity detail, show source-native contact and manual research instruction as separate paths.
- Update "Find Contacts" button copy based on contact strategy.

## Data / Back-End Requirements

- Move actionability and report-screening logic into shared classification output, not page-local functions.
- Generate `next_best_action`, `contact_strategy`, `buyer_partner_type`, `estimated_opportunity_type`, and `workflow_payload_ready` when storing each opportunity.
- Store source dates/status in normalized fields instead of requiring front-end parsing from `raw_json`.
- Store source-native contacts in a normalized object.
- Add `manual_research_instruction` for cases where enrichment is not the right next action.
- Add `actionability_score`, `pursuit_difficulty`, and `time_sensitivity`.
- Remove hard-coded company/vertical-specific report logic from generic UI; attach vertical-specific rules to playbooks.

## Prioritized Build Recommendations

P0:

- Normalize action-path fields on every opportunity.
- Replace generic "Find Contacts" primary CTA with `next_best_action`.
- Add opportunity type separation: active opportunity, historical evidence, policy signal, source route, research only.
- Expand workflow payload to be CRM-ready.
- Remove or isolate hard-coded Jammcard/live-music logic from generic report UI.

P1:

- Improve paid unlock messaging and locked row teasers.
- Add source credibility chips and source-native contact display.
- Add report-level pursuit plan grouped by action path.
- Add contact-strategy-aware enrichment routing.
- Add customer-facing actionability score and time sensitivity.

P2:

- Add agency/consultant white-label report export.
- Add saved pipeline views and filtering.
- Add native CRM integrations after webhook workflow is validated.
- Add more connectors after the core report-to-action workflow is consistently useful.

## Codex-Ready Tickets

### Ticket 1: Normalize Opportunity Action Path Fields

Owner: Back End

Priority: P0

Problem: The UI derives critical strategy fields from helper functions, so the report, opportunity workspace, and workflow payload can disagree or lose context.

Required change: Add normalized fields to stored opportunity signals: `estimated_opportunity_type`, `buyer_partner_type`, `revenue_motion`, `next_best_action`, `contact_strategy`, `recommended_contact_roles`, `manual_research_instruction`, `actionability_score`, `pursuit_difficulty`, `time_sensitivity`, and `workflow_payload_ready`.

Acceptance criteria:

- Every stored opportunity has these fields populated or explicitly set to a fallback value.
- Active procurements, active grants, historical awards, policy signals, and source routes receive distinct action paths.
- Front-end no longer needs to infer these values from `raw_json` for primary display.

### Ticket 2: Make Next Best Action The Primary Table CTA

Owner: Front End

Priority: P0

Problem: The current table shows "Find Contacts" and "Send to Workflow" as the main row actions, even when the correct next step is inspect, register, monitor, research, or partner.

Required change: Display `next_best_action` as the primary row action. Make contact enrichment secondary and conditional on `contact_strategy`.

Acceptance criteria:

- Each row has a visible next-best-action CTA or label.
- "Find Contacts" appears only when `contact_strategy` supports enrichment.
- Policy and historical evidence rows do not imply immediate email outreach.

### Ticket 3: Add Opportunity Type And Source Credibility Chips

Owner: Front End

Priority: P0

Problem: Users cannot quickly distinguish active money available now from historical market evidence or policy signals.

Required change: Add chips for `estimated_opportunity_type`, `source_status`, `time_sensitivity`, and source-native contact availability in the report table and opportunity cards.

Acceptance criteria:

- Active opportunities, historical evidence, policy signals, and research-only rows are visibly distinct.
- Source date/deadline is visible without opening raw details.
- Paid users can open source records from row detail.

### Ticket 4: Expand Workflow Payload For CRM Readiness

Owner: Back End

Priority: P0

Problem: Current webhook payload is useful but too thin for HubSpot, Airtable, Slack, Notion, or CRM workflows.

Required change: Add a normalized workflow payload builder with target account, buyer/partner type, revenue motion, next best action, contact strategy, recommended roles, source evidence, source URL, time sensitivity, pursuit difficulty, CRM note, outreach angle, and follow-up task text.

Acceptance criteria:

- Workflow payload is stable across report and opportunity detail.
- Payload can create a CRM deal, account research task, Slack alert, or Airtable row without manual rewriting.
- Payload includes a `workflow_payload_ready` boolean and reason when false.

### Ticket 5: Contact Strategy Before Contact Enrichment

Owner: Back End

Priority: P0

Problem: Contact enrichment currently routes `find_contacts` directly through Snov when requested, but many opportunity paths should use source-native contacts, public office research, or manual instructions instead.

Required change: Classify target type and contact strategy before enrichment. Use Snov only for company/domain targets. For public agencies and grants, prefer source-native contact, procurement office, program office, or grants manager instructions.

Acceptance criteria:

- `find_contacts` does not call Snov for agency-only or no-domain targets.
- Enrichment result explains when manual research is the correct next action.
- Source-native contacts are displayed before enriched contacts.

### Ticket 6: Remove Generic UI Dependence On Jammcard-Specific Screening

Owner: Back End

Priority: P0

Problem: Generic report rendering contains live-music-specific logic, which may suppress valid opportunities for healthcare, education, workforce, manufacturing, SaaS, and professional services ICPs.

Required change: Move vertical-specific rules into playbook/classification logic and expose generic normalized fields to the report UI.

Acceptance criteria:

- Report page does not contain company-specific screening logic.
- Playbook-specific rules can still tune Jammcard, SchoolGig, and Reparel reports.
- Evaluation reports still pass golden-example expectations.

### Ticket 7: Improve Paid Unlock Moment

Owner: Product / Front End

Priority: P1

Problem: The paid unlock lists features but does not strongly communicate the business outcome.

Required change: Rewrite free/full packaging and locked row teasers around "full opportunity pipeline" value: targets, source evidence, contact paths, CRM notes, outreach angles, and workflow-ready payloads.

Acceptance criteria:

- Unlock CTA uses business-outcome language.
- Locked teasers show what type of action value is locked without revealing the full target/source.
- Free report still demonstrates enough credibility to justify paying.

### Ticket 8: Add Report-Level Pursuit Plan

Owner: Front End

Priority: P1

Problem: Users see rows, but not a concise action plan grouped by how to pursue each opportunity.

Required change: Add a pursuit plan section that groups signals into contact now, inspect/register, sell to funded buyer, partner/channel, monitor policy, and research only.

Acceptance criteria:

- Full report includes a grouped action plan.
- Each group shows count, top rows, and recommended workflow action.
- Free report previews the plan structure with locked details.

### Ticket 9: Add Connector Extraction For Source-Native Contacts

Owner: Connector

Priority: P1

Problem: Source-native contact details are more credible than generic enrichment for many grants and procurements, but they are not normalized across connectors.

Required change: Extract and normalize source-native contact fields from SAM.gov, Grants.gov, and other connectors where available.

Acceptance criteria:

- Connectors populate `source_native_contact` when source records include contact information.
- Contact source is visible in the opportunity workspace.
- Missing contact data falls back to recommended roles and manual research instructions.

### Ticket 10: Update Product Naming And Customer-Facing Labels

Owner: Product / Front End

Priority: P1

Problem: Some customer-facing labels still expose internal concepts such as score abbreviations, debug/admin/status, or generic report language.

Required change: Replace or hide internal labels in non-admin views. Use product terms like opportunity signal, source-backed evidence, actionability, buyer/partner target, contact path, and workflow-ready.

Acceptance criteria:

- Non-admin report does not show debug/internal terminology.
- Scores are explained or moved behind details.
- Labels consistently reinforce Opportunity Scanner's positioning as an opportunity intelligence and action workspace.

