# Report Quality Rules

This document captures refinements discovered while reviewing generated reports. The goal is to turn one-off report feedback into reusable rules that improve future scans across company types.

## Rule Types

### Global Rules

- Use company-neutral language in reusable report UI. Avoid hard-coded example names such as Reparel in generic cards.
- Separate current or recent move-forward signals from older prior examples.
- Do not surface old or indirect records as actionables unless they are explicitly labeled as prior buying-pattern evidence.
- Every surfaced signal should make the likely route clear:
  - recipient/partner route
  - agency/procurement route
  - direct-apply route
  - policy/admin route
  - channel route
- Historical awards are usually market-map or funded-buyer signals, not automatically grants the company can apply for.
- Policy signals should not be treated as direct outreach leads unless paired with a buyer, program, award, grant, or procurement path.
- Active procurement sources like SAM.gov should be added one connector at a time and tested against golden examples before broadening query volume.
- SAM.gov solicitations, combined synopsis/solicitations, sources-sought notices, and pre-solicitations can be move-forward signals when the search lane clearly matches what the company sells.
- SAM.gov award notices are useful as funded-buyer or procurement-pattern evidence, but should not be treated as active bids.
- User-supplied good-fit phrases should expand the search strategy, while user-supplied exclude phrases should suppress matching records across all connectors.

### Medical Supply / Reparel-Like Rules

- Current or recent VA, orthotic, prosthetic, DME, rehab supply, physical therapy supply, distributor, or medical retail records can be actionable.
- Older directly relevant orthotic/prosthetic examples can be included as prior evidence, but not live leads.
- Medicare/DME infrastructure, claims processing, or reimbursement contractor records should usually be hidden from the move-forward list.

### Education Workforce / SchoolGig-Like Rules

- Education workforce scans should require explicit evidence of teachers, educators, principals, substitute teachers, school staffing, teacher shortage, teacher residency, applicant tracking, HR software, job boards, talent acquisition, recruiting, or school/district hiring.
- Generic "workforce development education" is not enough by itself.
- Behavioral health, crisis-line, Medicaid, healthcare, clinical, correctional, reentry, and justice workforce records should be excluded unless they clearly connect to education hiring or school staffing.
- School health records are not automatically SchoolGig opportunities. They need a hiring, staffing, HR, recruiting, or educator-workforce connection.

### Creative Workforce / Jammcard-Like Rules

- Creative workforce scans should require explicit evidence of music, musicians, artists, arts workforce, creative economy, cultural programming, performing arts, live entertainment, event production, venues, festivals, or public arts programs.
- Generic workforce, hiring, jobs, or education language is not enough by itself.
- For Jammcard-like companies, the strongest examples are public buyers or funded recipients needing performers, live music, event entertainment, cultural programming, festival entertainment, concert programming, venue entertainment, or event production services.
- Teacher-staffing, medical, behavioral health, correctional, and reentry workforce records should be excluded unless they clearly relate to arts, music, or cultural programming.

## Golden Examples

Use these reports as quick regression checks:

- Jammcard: `fc74dab7-b9d1-409b-bdc8-66b44821757c`
- SchoolGig: `1261bfcd-33b2-45e4-bbd2-818eadbb1217`
- Reparel: `2e6c26cc-46a2-4bf8-adaa-f59811ba067c`

Expected behavior:

- Reparel example: should include KLM Laboratories as an active/current signal and Sampson's Prosthetic Laboratory only as prior evidence.
- Reparel example: should not surface CGS Administrators or Maine Department as move-forward opportunities.
- SchoolGig example: should include K-12 hiring, educator workforce, and recruiting technology lanes.
- SchoolGig example: should not surface generic behavioral health or 988 crisis-line workforce records.
- SchoolGig example: report cards should say "Can this company move this forward?", not "Can Reparel move this forward?"
- Jammcard example: should include creative workforce, music-industry talent, cultural programming, live events, or public arts lanes.
- Jammcard example: should not surface K-12 teacher-staffing or educator-workforce signals.

## When Reviewing A New Scan

Ask these questions:

- Does the company profile correctly identify what the company sells and who buys it?
- Do the public-sector search terms translate the company into procurement/funding language without overfitting to the last report?
- Are the surfaced signals current or recent enough to act on?
- Is each signal's route clear enough that a user knows whether to contact the recipient, agency, admin, or partner?
- Would a reasonable buyer say, "I understand why this is here"?
