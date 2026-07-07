# Policy Opportunity Scanner

Lightweight B2B MVP that turns a company URL into a structured company profile, opportunity search strategy, and sourced public-sector opportunity report.

## Milestone 1

- Scan form for company URL and optional context
- Search strategy inputs for priority, good-fit phrases, exclude phrases, and signal types
- Supabase-compatible database schema
- Website scraper capped at 8 same-domain pages and 40,000 extracted characters
- Initial company profile JSON generator
- Report/profile page for each scan
- Admin view of completed scans at `/admin/reports`
- Local development storage fallback when Supabase variables are not configured

## Run

```bash
npm install
npm run dev
```

Create the Supabase tables with `db/schema.sql`, then set the variables in `.env.local`.

## Local Preview Without npm

In this Codex workspace, a zero-dependency preview runner is available for quick testing:

```bash
node scripts/local-preview.mjs
```

It uses the same local `.data/local-db.json` storage fallback and mirrors the Milestone 1 form, profile page, and admin completed-scans view.

## Report Quality Checks

Refinements discovered during report review are tracked in `docs/report-quality-rules.md`.

Run the local evaluator after changing report logic or adding new industry rules:

```bash
npm run evaluate:reports
```

The evaluator defaults to the latest Jammcard, SchoolGig, and Reparel scans so source changes can be regression-tested quickly. Use `npm run evaluate:reports -- --all` to audit every completed local scan, or `npm run evaluate:reports -- --scan [scan_id]` to target one report. It flags likely relevance mistakes, prints source/actionability counts, and writes the latest QA output to `output/quality/report-quality-latest.json`.

Connector rollout steps are tracked in `docs/connector-testing-plan.md`.

## Opportunity Playbooks

Vertical playbooks live in `lib/playbooks.ts`. A scan is classified into one or more reusable playbooks after company profiling. Selected playbooks enrich:

- opportunity lanes
- public-sector search terms
- active and planned source categories
- likely revenue motions
- suggested contact roles
- report guidance

Implemented playbooks currently include Healthcare / Rehab / DME, Music / Arts / Creative Economy, and Education / Workforce / Training. Additional playbooks are stubbed as planned so the source engine can be expanded iteratively.

## Source Connectors

Active or wired sources:

- Company website scraper for profile generation
- USAspending.gov for historical award and funded-buyer signals
- Federal Register for policy/regulatory demand signals
- SAM.gov connector for active procurement opportunities when `SAM_API_KEY` is configured

Reports include a Sources Checked panel. Sources that are modeled but not connected yet are shown as planned rather than silently implied.

SAM.gov can be smoke-tested without creating a scan:

```bash
npm run test:sam
npm run test:sam -- "live music services"
```

## Environment

Copy `.env.example` to `.env.local`.

- `OPENAI_API_KEY` enables AI-generated company profiles.
- `SAM_API_KEY` enables SAM.gov active opportunity search.
- `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY` enables Supabase storage.
- `OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE` unlocks full-report beta access.
- `OPPORTUNITY_SCANNER_ADMIN_CODE` unlocks admin/operator workspaces.
- Without Supabase variables, scans are stored locally in `.data/local-db.json` for development. Production requires Supabase unless `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true` is set for temporary internal testing.

## Routes

- `/` scan form
- `/reports/[id]` free report preview
- `/reports/[id]?access=[REPORT_ACCESS_CODE]` full beta report
- `/reports/[id]?access=[ADMIN_CODE]` full internal report with research details
- `/opportunities/[id]?scanId=[scan_id]&access=[REPORT_ACCESS_CODE]` opportunity profile and enrichment queue
- `/admin/reports?access=[ADMIN_CODE]` completed scan list
- `/admin/feedback?access=[ADMIN_CODE]` feedback review for good-fit and bad-fit opportunity labels
- `/admin/sources?access=[ADMIN_CODE]` connector/source coverage
