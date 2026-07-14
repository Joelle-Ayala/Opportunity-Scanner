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

Set the variables in `.env.local`. For Supabase database setup, use the ordered migration process below rather than applying `db/schema.sql` alone.

## Database Setup And Upgrades

[`db/migration-manifest.json`](db/migration-manifest.json) is the production database source of truth. Its entries are append-only and contain a stable version, ordered prerequisites, and the SHA-256 checksum of every required SQL file. This includes billing, scan nurture, scan attribution, account ownership and report access, lead-magnet capture expansion, monitoring, and alert delivery.

Run the credential-free parity check before any database change:

```bash
node scripts/test-migration-manifest.mjs
```

The check fails if a production SQL file is missing from the manifest, a dependency moves after its consumer, a historical migration changes without a new version, or the ledger contract is weakened. In pull requests and pushes to `main`, the launch workflow fetches full Git history and supplies the trusted base commit through `MIGRATION_BASE_REF`. The test then requires existing manifest entries to remain an exact prefix and requires every migration SQL file present at the merge base to remain byte-for-byte unchanged. Updating historical SQL and its checksum together therefore still fails.

To run the same history comparison locally against the shared base branch:

```bash
git fetch origin main
MIGRATION_BASE_REF=origin/main node scripts/test-migration-manifest.mjs
```

Without `MIGRATION_BASE_REF`, the test still runs current-tree parity, dependency, checksum, ledger-idempotency, and ledger-security checks, but it cannot prove Git history immutability. Never put a database URL, password, or service key in the manifest, ledger, workflow, or commands committed to the repository.

### Clean Install

1. Back up the target database and confirm that it is the intended Supabase project.
2. Apply `db/schema-migrations.sql` first. It safely creates the operator-owned, append-only `public.schema_migrations` ledger and can be run more than once.
3. Apply every manifest entry in listed order. Use one transaction per entry and stop on the first error.
4. In the same transaction, call `public.record_schema_migration` with the entry's version, file, checksum, and manifest version. The call is idempotent, serializes concurrent operator writes, requires the immediately preceding version, and rejects metadata that disagrees with an existing version.
5. Compare the ledger with the manifest before deploying application code.

With a database URL supplied through the operator's environment, the transaction shape for one entry is:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
  --file db/schema.sql \
  --command "select public.record_schema_migration('v0001', 'db/schema.sql', '790001580a9cc77ca2dbae13dd13f6837edf211e8d7b68a83a98805813179bc7', 1);"
```

Repeat that shape for each manifest entry using its exact metadata. The URL remains in the environment and is never written into a repository file. In the Supabase SQL editor, use the same order: run the migration and its matching `record_schema_migration` call together as a transaction.

### Upgrade

1. Re-run `db/schema-migrations.sql` so the latest idempotent ledger contract exists.
2. Read `public.schema_migrations` ordered by `version` and compare each recorded file and checksum with the manifest.
3. Apply only unrecorded manifest entries, in order, after confirming all listed prerequisites are recorded.
4. Record each successful entry in the same transaction as its SQL. Stop if a checksum or existing ledger record differs; do not edit or relabel an applied migration.
5. Run `node scripts/test-migration-manifest.mjs`, then the normal launch checks.

For a database created before the ledger existed, do not assume that every historical migration ran. Verify the expected tables, columns, functions, and deployment history for each manifest entry, then call `public.record_schema_migration` in order only for versions confirmed present. Apply any first missing version and all later required versions through the normal upgrade flow.

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

## Launch Checks

Before publishing to the domain, configure production environment variables and run:

```bash
npm run build
npm run check:launch-env
```

For controlled beta, the required production variables are `OPENAI_API_KEY`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE`,
and `OPPORTUNITY_SCANNER_ADMIN_CODE`. `OPPORTUNITY_SCANNER_CONTACT_EMAIL` controls where
full-report requests are sent. `SAM_API_KEY` and Snov credentials are recommended
for stronger active-opportunity and contact-enrichment coverage.

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
