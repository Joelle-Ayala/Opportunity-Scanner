# Connector Expansion Priorities

**Decision date:** July 10, 2026  
**Owners:** Chief of Staff, Connector, Product Strategy, Back-End  
**Goal:** Improve report actionability, source credibility, and paid value without adding sources merely for coverage volume.

## Executive Decision

The next integration wave is limited to three priorities:

1. Activate and validate the existing SAM.gov connector after quota reset.
2. Resolve funded buyers and award recipients into verified organizations, domains, target types, and contact paths.
3. Prove a small official state/local procurement pilot, starting with one jurisdiction rather than broad portal scraping.

Before adding a new source, it must improve at least one of: live timing, named buyer or recipient, money amount, official contact path, revenue motion, or next best action.

## What Is Live Versus Merely Available

### Live discovery connectors

- **USAspending.gov:** historical awards, agencies, recipients, money flow, and funded-buyer evidence.
- **Grants.gov:** posted and forecasted funding, deadlines, eligibility, award ranges, and program contacts.
- **Federal Register:** policy and emerging-demand context; normally Monitor Policy or Research Only.
- **SAM.gov:** implemented and production-configured, but currently quota-limited and awaiting a fresh three-company validation.

### Implemented but not producing verified opportunities

- **State/local portal routing:** contains official portal routes but is deliberately disabled until a connector can verify a real record, buyer, status, timing, and contact or vendor path.

### Enrichment and workflow, not discovery

- **Clay and Snov:** can enrich contacts only after a commercial target and usable domain are verified.
- **Generic webhook, CSV, and outreach package:** move qualified rows into execution but do not find new opportunities.
- **Apollo, Prospeo, People Data Labs, and Hunter:** health-check/catalog entries only; no report enrichment implementation.

### Health-check or context sources not used in reports

- Regulations.gov, Census, BLS, FRED, O*NET, DOL, USAJOBS, and College Scorecard have credential or smoke-test support but no runtime connector.
- CMS is referenced in product content but has no connector or defined record-to-action contract.

Production credentials exist for the required application variables and the currently tested source set. Credential presence does not mean a source is used in report generation.

## Approved Next Wave

### P0: SAM.gov activation and validation

**Customer value:** Current federal solicitations, sources sought, notices, deadlines, contracting offices, and source-native contacts.

**Acceptance criteria:**

- Fresh Reparel, Jammcard, and SchoolGig scans complete after quota reset.
- Open, expired, award, notice, and sources-sought states are distinct.
- Every accepted row has an official source URL, target office, status, deadline when present, revenue motion, and next action.
- Quota limits, credentials, failures, and zero matches remain distinguishable.
- Historical or award records are never presented as open bids.

### P0: Buyer and recipient resolution

**Customer value:** Turn a recipient name into a verified buyer, distributor, prime, grantee, provider, partner, or research target.

**Acceptance criteria:**

- High-value recipients have an evidence-backed organization type and official or attributable domain.
- Duplicate organizations across awards and grants are consolidated.
- Public agencies route to offices or portals rather than indiscriminate personal-email enrichment.
- Clay or Snov is eligible only after target type and domain validation.
- Uncertain matches stay manual-research tasks with an explicit reason.

### P1: One official state/local pilot

Start with the [NYC Current Solicitations dataset](https://data.cityofnewyork.us/City-Government/Current-Solicitations/3khw-qi8f), then assess whether the same normalized contract can support another high-demand jurisdiction.

**Acceptance criteria:**

- Each surfaced row is a real posting with a direct official URL, jurisdiction, buyer, status, due date or timing, and contact or vendor-registration path.
- Representative terms are manually validated for Reparel, Jammcard, and SchoolGig.
- Truthful zero-match results are acceptable; generic portal links are not opportunity rows.
- State/local failures appear in the same connector diagnostics as federal sources.

## Existing Sources To Improve Before Adding More

- Add USAspending prime/subaward traversal and clearer buyer/recipient types using the [official USAspending endpoints](https://api.usaspending.gov/docs/endpoints).
- Preserve Grants.gov partial-detail failures, forecast status, eligibility, and role-labeled program contacts.
- Correct source-catalog truth so configured, active, health-check-only, and unavailable states are never conflated.
- Surface persisted connector health internally for launch operations.
- Validate one production webhook delivery before building native HubSpot or Zapier integrations.

## Bounded Research Spikes

- **CMS Data and Provider Data:** target enrichment for Reparel, not opportunity generation. Define the exact dataset and resulting action first. [Official API documentation](https://data.cms.gov/api-docs)
- **HRSA Data Warehouse:** named health centers, funded service sites, and program affiliation for Reparel. [Official web services](https://data.hrsa.gov/tools/web-services)
- **NCES CCD/EDGE:** district identity and targeting for SchoolGig, not funding rows. [Official NCES EDGE data](https://nces.ed.gov/programs/edge/Geographic/SchoolLocations)
- **DOL active grants or ETA awards:** named workforce grantees and operators for SchoolGig and creative-workforce lanes. [Official DOL grants](https://www.dol.gov/grants)
- **NEH and IMLS award exports:** cultural recipients and project detail for Jammcard when they add detail beyond USAspending. [NEH Open Data](https://opendata.neh.gov/) and [IMLS awards](https://www.imls.gov/grants/awarded-grants)
- **VA Forecast of Contracting Opportunities:** planning signals for Reparel, always labeled as forecasts rather than active bids. [Official VA forecast portal](https://www.vendorportal.ecms.va.gov/eVP/fco/FCO.aspx)

## Defer Or Reject

- Defer native HubSpot and Zapier until the generic webhook proves customer usage.
- Defer Regulations.gov until it demonstrates incremental action value beyond Federal Register.
- Defer broad CMS, NIH RePORTER, NSF, OpenFEMA, Congress.gov, IRS bulk data, EIA, NREL, EPA, BLS, FRED, Census, O*NET, College Scorecard, and USAJOBS until a specific report decision and action contract are defined.
- Reject additional generic contact vendors for now; they do not fix target quality.
- Reject broad state/local scraping and paid bid aggregators until one official pilot proves incremental paid value and acceptable operating cost.
- Reject unsupported portal scraping that relies on snippets or cannot preserve official record URLs and status.

## Regression Standard

- **Reparel:** one open VA/DME/prosthetics record with deadline, office, procurement route, contact path, Sell to Agency motion, and concrete next action.
- **Jammcard:** one current city, parks, tourism, cultural-programming, or funded-recipient record with timing, source, programming role, and Sell or Partner motion.
- **SchoolGig:** one current district, SEA, workforce, staffing, training, or funded-operator record with program purpose, organization identity, role target, and next action.

## Sequence

1. Complete the production release and live guide/capture verification.
2. Re-test SAM.gov after the quota reset on July 11, 2026 UTC.
3. Run fresh Reparel, Jammcard, and SchoolGig report regressions.
4. Implement buyer/recipient resolution against the existing normalized row contract.
5. Validate one approved webhook delivery.
6. Run the NYC official-data spike and compare incremental paid value.

No new paid vendor, credit-spending workflow, private-data source, or broad production connector is approved by this roadmap without a separate founder decision.
