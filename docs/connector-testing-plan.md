# Connector Testing Plan

Opportunity Scanner should add sources one at a time, then test whether the new source improves the reports for known company types.

## Current Baseline Reports

Use these local reports as quick regression checks:

- Jammcard: `fc74dab7-b9d1-409b-bdc8-66b44821757c`
- SchoolGig: `1261bfcd-33b2-45e4-bbd2-818eadbb1217`
- Reparel: `2e6c26cc-46a2-4bf8-adaa-f59811ba067c`

Run:

```bash
npm run evaluate:reports
```

This checks the latest Jammcard, SchoolGig, and Reparel scans. Use `npm run evaluate:reports -- --all` for the full local database, or `npm run evaluate:reports -- --scan [scan_id]` for one report.

## Source Rollout Loop

1. Add or enable one connector.
2. Run the connector smoke test when available.
3. Generate fresh scans for Jammcard, SchoolGig, and Reparel.
4. Compare source counts, yes/maybe counts, and high-priority issues.
5. Tune playbooks, include/exclude terms, and actionability rules before adding the next source.

## SAM.gov

Purpose:

- Active solicitations and combined synopsis/solicitations
- Sources-sought and market-research notices
- Award notices as funded-buyer or procurement-pattern evidence

Setup:

- Add `SAM_API_KEY` to `.env.local`.
- Restart the local preview server so the scan pipeline can read the key.
- Official SAM.gov API docs: `https://open.gsa.gov/api/get-opportunities-public-api/`
- SAM.gov states that the Opportunities API requires a public API key, uses the production endpoint `https://api.sam.gov/opportunities/v2/search`, and requires `postedFrom` / `postedTo` dates on requests.
- In SAM.gov, registered users can request a public API key from the Account Details page.

Smoke test:

```bash
npm run test:sam
npm run test:sam -- "live music services"
npm run test:sam -- "teacher recruitment"
```

Quality gates:

- Jammcard should surface live music, entertainment, cultural programming, public event, parks/recreation, tourism, or arts procurement notices.
- SchoolGig should surface teacher recruitment, school staffing, HR/recruiting tech, or educator workforce notices.
- Reparel should surface orthotic, prosthetic, DME, rehab supply, medical supply, VA, or distributor-related notices.
- SAM award notices should not be framed as active bids.

## Next Sources

1. Grants.gov: active grants and program funding. The official XML extract is available daily, but it is a large bulk file, so the MVP should either use a cached/indexed version or a carefully scoped API/search route before adding it to live scans.
2. NEA/state arts councils: arts, culture, creative economy, live performance.
3. State and city procurement portals: local bids and vendor opportunities.
4. State education departments/workforce boards: educator workforce and training funds.
