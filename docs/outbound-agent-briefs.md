# Outbound Factory Agent Briefs

Date: July 9, 2026

## Chief of Staff Agent

Mission: own the outbound factory pilot end to end.

Tasks:

- Use `docs/outbound-prospecting-factory.md` as the operating plan.
- Use `docs/outbound-pilot-seed-list.md` as the first seed account list.
- Keep actual contacts, emails, Clay exports, and campaign files out of Git.
- Decide the first 20 companies for company-specific mini-scans.
- Make sure every mini-scan has a clear industry sample report link, 2-3 real signals, total signals found, and paid upgrade CTA.

Definition of done:

- 60 seed accounts reviewed.
- 20 highest-fit companies selected for mini-scans.
- Clay/Snov enrichment path confirmed.
- No unverified contacts sent.

## Product Strategy & Product Marketing Agent

Mission: create conversion-oriented outbound messaging.

Tasks:

- Draft 5-touch sequences for Healthcare/DME, Education/Workforce, and Arts/Creative.
- Keep messaging focused on public-sector revenue as a new channel.
- Do not overpromise guaranteed grants, contracts, or revenue.
- Make paid upgrade about actionability: contacts/contact paths, source evidence, outreach drafts, CRM notes, workflow rows.

Definition of done:

- Three industry-specific sequences are ready.
- Each sequence has subject lines, body copy, CTA, and objection handling.

## Connector Agent

Mission: make Clay/Snov execution real.

Tasks:

- Confirm whether Clay can expose a production workflow endpoint for contact enrichment.
- Confirm Snov campaign API capabilities available to this account.
- Define required fields to add a prospect to a Snov campaign.
- Confirm suppression, unsubscribe, bounce, and duplicate handling.

Definition of done:

- Production Clay endpoint path documented or created.
- Snov campaign execution path documented.
- Required env vars identified.

## Back-End Agent

Mission: design and then implement the outbound data layer.

Tasks:

- Propose schema for outbound accounts, contacts, mini-scans, campaigns, touches, and suppression records.
- Add a batch mini-scan queue after schema is approved.
- Add Snov campaign connector only after the review gate exists.

Definition of done:

- Outbound schema proposal exists.
- Batch mini-scan flow is scoped.
- Snov connector tasks are acceptance-criteria ready.

## Front-End Agent

Mission: create an internal review experience before automation scales.

Tasks:

- Design an internal outbound review dashboard.
- Show company fit, sample report link, mini-scan status, contact validation status, and campaign readiness.
- Do not expose internal/prospecting dashboard publicly.

Definition of done:

- Internal dashboard spec is ready.
- UI makes it impossible to send unverified/unreviewed contacts.

## Project Management Agent

Mission: track the pilot.

Tasks:

- Track phases:
  - seed list
  - contact validation
  - mini-scan generation
  - campaign draft
  - send/reply tracking
- Track blockers:
  - Clay endpoint
  - Snov campaign access
  - sender identity
  - suppression list
  - batch scan queue

Definition of done:

- Pilot board has owners, statuses, acceptance criteria, and blockers.
