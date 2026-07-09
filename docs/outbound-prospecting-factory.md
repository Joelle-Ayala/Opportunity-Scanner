# Opportunity Scanner Outbound Prospecting Factory

Date: July 9, 2026

## Goal

Build a repeatable outbound motion that turns industry-specific public-sector opportunity examples into qualified prospect conversations.

The motion:

1. Identify high-fit companies by industry.
2. Validate relevant founder, growth, sales, partnerships, BD, government sales, grants, or executive contacts.
3. Send an industry sample report as the first proof point.
4. Offer or generate a company-specific free mini-scan as the hook.
5. Convert interested prospects into the full paid Opportunity Scanner report.
6. Use Snov as the campaign execution layer once contacts are verified and safe to send.

## Recommended Flow

### Step 1: Industry Sample Report Hook

Send the prospect a relevant sample report from:

- `/examples/healthcare-dme-opportunity-scan`
- `/examples/education-workforce-opportunity-scan`
- `/examples/creative-economy-live-events-opportunity-scan`
- `/examples/software-ai-b2b-services-opportunity-scan`
- `/examples/construction-infrastructure-opportunity-scan`
- `/examples/clean-energy-facilities-opportunity-scan`
- `/examples/manufacturing-supply-chain-opportunity-scan`
- `/examples/nonprofit-community-services-opportunity-scan`

Position it as:

> This is a fictional company example using real public-sector source categories. We can run a free mini-scan on your actual website to see whether similar public-sector revenue signals exist for you.

### Step 2: Free Mini-Scan

For qualified prospects, run a company URL scan and send back:

- 2-3 sourced opportunity signals
- total signals found
- likely revenue motions
- best contact paths
- one clear next action
- link to industry sample report
- paid unlock CTA

The mini-scan should not include:

- full contact enrichment
- all source links
- full outreach drafts
- CRM-ready notes
- workflow export

Those are paid/full-report value.

### Step 3: Paid Upgrade

The paid upgrade should be positioned as:

> We found real signals. The full report turns them into a pursuit table: buyer/partner targets, source-backed evidence, contact paths, outreach angles, CRM-ready notes, and workflow-ready rows.

## Pilot Industries

Start with three verticals first:

1. Healthcare / DME / Medical Supply
2. Education / Workforce / Training
3. Arts / Creative Economy / Live Events

Why these first:

- They map to existing client examples and regression test companies.
- They produce visibly different sample reports.
- They have clear public-sector money-flow patterns.
- They are easier to explain to non-GovCon buyers.

## Qualification Rules

Qualify companies when:

- The website clearly explains what they sell.
- Their product or service can plausibly support agencies, institutions, schools, nonprofits, funded buyers, healthcare systems, public events, or workforce programs.
- They appear commercially mature enough to act on a report.
- They have a founder, growth, sales, partnerships, BD, government sales, grants, or executive buyer.
- Their industry has recurring public funding, procurement, reimbursement, grant, workforce, or policy demand.

Disqualify companies when:

- They are pure consumer with no institutional buyer path.
- Their offer is too vague to map to public-sector signals.
- They appear too small or inactive to act.
- They only want guaranteed grants or guaranteed contracts.
- They need lobbying, grant writing, capture management, or compliance support instead of opportunity intelligence.
- The prospect requires sensitive compliance review before cold outreach.

## Buyer Roles

Primary:

- Founder / CEO
- Head of Growth
- VP Sales / Sales Director
- Partnerships Lead
- Business Development Lead
- Government Sales Lead
- Grants / Funding Lead
- Executive Director for nonprofits

Secondary:

- Marketing Lead
- Revenue Operations
- Operations Lead
- Program Director

Avoid using procurement officers as the buyer persona. They are usually a contact path inside an opportunity, not the buyer of Opportunity Scanner.

## Contact Validation Rules

Before a contact can be sent to Snov:

- Company domain must be verified.
- Contact must match one of the relevant buying roles.
- Email must be validated by Snov, Clay, or another approved source.
- Duplicate contacts must be suppressed.
- Unsubscribe/suppression status must be checked.
- Contact source and confidence must be recorded.
- The campaign must use a relevant industry sample report or company mini-scan.

Never send to:

- generic scraped emails with no role fit
- source-native grant/procurement contacts unless the message is clearly about the specific public source path
- personal emails that are not work-relevant
- contacts with uncertain company match
- contacts already suppressed or bounced

## Campaign Sequence

### Email 1: Industry Example

Subject options:

- Public-sector revenue signals for companies like yours
- Example scan for your industry
- Curious if this channel applies to {{company}}

Core message:

> I put together an example of how Opportunity Scanner maps public-sector money, funded buyers, and agency demand for companies in your industry.
>
> It is not a generic grant search. The output is an action table: target, source, revenue motion, contact path, and next step.
>
> Want me to run a free mini-scan for {{company}}?

### Email 2: Specific Opportunity Lanes

Mention likely lanes for the segment, such as VA, districts, city events, public works, energy upgrades, manufacturing grants, or community services funding.

CTA:

> I can send back 2-3 sourced signals from your actual website.

### Email 3: Mini-Scan Delivery

Send:

- top 2-3 signals
- total signals found
- best likely revenue motion
- locked paid action layer

CTA:

> Want the full table with source links, contacts/contact paths, outreach angles, and CRM-ready notes?

### Email 4: Paid Upgrade

Position as workflow-ready pipeline, not research volume.

CTA:

> I can turn the scan into a full opportunity table your team can review or push into outreach.

### Email 5: Breakup / Routing

Ask whether public-sector growth is relevant this quarter and whether someone else owns partnerships, growth, government sales, or funding.

## Tooling Plan

### Clay

Use for:

- company enrichment
- decision-maker discovery
- role matching
- LinkedIn/company data
- operator-assisted premium contact pulls

Current blocker:

- The connected Clay app can enrich companies/contacts in-session.
- The live app still needs a production Clay workflow URL before paid enrichment is fully automated from Vercel.

### Snov

Use for:

- email validation
- contact enrichment fallback
- campaign execution

Current blocker:

- The repo supports Snov domain email discovery.
- The repo does not yet support Snov campaign creation, prospect insertion, list assignment, sequence enrollment, or send-status sync.
- `SNOV_CLIENT_ID` and `SNOV_CLIENT_SECRET` were not present in the current shell when checked.

### Opportunity Scanner

Use for:

- company scan
- mini-scan/report generation
- opportunity table
- outreach package export
- paid contact enrichment

Current blocker:

- Single-company scan is working.
- Batch outbound scan queue is not implemented yet.

## Pilot Definition Of Done

First pilot:

- 3 industries
- 20 prospects per industry
- 60 total prospects
- 1-2 validated contacts per company
- 3 industry sample report links
- 20 company-specific mini-scans generated for the highest-fit prospects
- Snov campaign draft or execution path ready
- no unverified contacts sent
- no secrets committed
- all private contact files stored outside Git or in ignored `.data`

## Next Implementation Tasks

### Chief of Staff Agent

- Own the pilot.
- Review industry fit.
- Approve the first 60-account target list.
- Decide which 20 companies get company-specific mini-scans first.
- Keep Clay/report work out of the founder's manual workload.

### Product Strategy & Product Marketing Agent

- Finalize the first 3 industry-specific outbound sequences.
- Tighten paid upgrade copy.
- Create objection handling for "we do not sell to government."

### Connector Agent

- Confirm Clay production endpoint options.
- Confirm Snov campaign API capabilities and required credentials.
- Define normalized contact validation states.

### Back-End Agent

- Add outbound account/contact/campaign schema.
- Add batch mini-scan queue.
- Add Snov campaign connector only after the review layer exists.

### Front-End Agent

- Add internal outbound review dashboard later.
- Show company mini-scan preview, sendability, contact status, and campaign status.

### Project Management Agent

- Track first pilot in 3 phases:
  - account list
  - mini-scan generation
  - campaign execution

## Guardrails

- Do not overpromise guaranteed contracts, grants, or revenue.
- Do not use fake contacts.
- Do not expose private contact data in public pages or committed docs.
- Do not send automated campaigns without suppression checks.
- Do not use source-native government contacts for broad product marketing unless the message is tied to their official source role.
- Do not scale beyond 60 pilot prospects until reply quality and scan quality are reviewed.
