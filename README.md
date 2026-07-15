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

Paid launch operations are documented in [`docs/paid-launch-runbook.md`](docs/paid-launch-runbook.md). Before publishing a production release, configure the production services and run:

```bash
pnpm run check:launch-env
pnpm run verify:launch
```

`check:launch-env` requires the production scan, Supabase Auth, Stripe live payment, monitoring cron, Resend, unsubscribe, and rate-limit configuration. `verify:launch` runs the launch contract suite, report regressions, typecheck, and production build. Use `GET /api/health` on the deployed release to distinguish demo readiness from real paid-signup readiness without exposing configuration values. Paid Report readiness also requires configured customer email delivery and product analytics. The health route checks configuration and Stripe mode only; it does not query production migration-manifest/ledger parity, which remains a separate launch-runbook check.

Production access is account- and purchase-based. A customer buys a one-time full report from an existing free report. Monitor and Growth remain unavailable unless both `ENABLE_SUBSCRIPTION_CHECKOUT=true` and `MONITORING_SCHEDULER_READY=true`; when enabled, a customer signs in with a Supabase magic link before buying either subscription. Legacy `?access=` report and admin codes are local-development tools only unless the explicit emergency production override is enabled.

## Environment

Copy `.env.example` to `.env.local`.

- `OPENAI_API_KEY` enables AI-generated company profiles.
- `SAM_API_KEY` enables SAM.gov active opportunity search.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` enable production storage and customer magic-link authentication.
- `APP_URL`, the Stripe live secret and webhook secret, and `STRIPE_PRICE_REPORT` enable one-time Report checkout.
- `ENABLE_SUBSCRIPTION_CHECKOUT=true`, `MONITORING_SCHEDULER_READY=true`, and all four Monitor/Growth Stripe Price IDs explicitly enable subscription checkout. Any other state keeps subscriptions unavailable.
- `CRON_SECRET` enables authenticated monitoring and nurture jobs.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the alert/nurture unsubscribe secrets enable customer email delivery.
- Enable Vercel Web Analytics and set `VERCEL_WEB_ANALYTICS_ENABLED=true` for privacy-friendly traffic and UTM reporting. `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` optionally add privacy-limited product events.
- `OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE` and `OPPORTUNITY_SCANNER_ADMIN_CODE` are legacy local-only URL access codes. Production ignores them unless `OPPORTUNITY_SCANNER_EMERGENCY_ENABLE_LEGACY_URL_ACCESS_CODES_IN_PRODUCTION=true`; any emergency code must be at least 32 characters.
- Without Supabase variables, scans are stored locally in `.data/local-db.json` for development. Production requires Supabase unless `ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true` is set for temporary internal testing.

## Routes

- `/` scan form
- `/reports/[id]` free report preview
- `/pricing` live Report checkout when Stripe is configured; Monitor and Growth are shown as unavailable until explicitly enabled
- `/auth/sign-in` customer magic-link sign-in
- `/dashboard` account-owned reports, saved searches, monitoring, and billing
- `/dashboard/onboarding` post-purchase monitoring setup
- `/opportunities/[id]?scanId=[scan_id]` paid opportunity workspace for an entitled customer
- `/admin/reports` internal completed scan list
- `/admin/feedback` internal feedback review for good-fit and bad-fit labels
- `/admin/sources` internal connector/source coverage
