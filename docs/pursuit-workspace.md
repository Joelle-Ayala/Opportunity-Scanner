# Opportunity Pursuit Workspace

## Customer flow

1. Open an opportunity from a full report.
2. Review the recommended revenue route and authoritative source record.
3. Start a pursuit while signed in.
4. Confirm fit, registration requirements, required documents, owner, deadline, and next step.
5. Save stage changes as the pursuit moves through research, qualification, preparation, submission, and outcome.
6. Resume active work from the Pursuits tab in the customer dashboard.

Opportunity Scanner does not submit arbitrary applications or bids on a customer's behalf. The product prepares and tracks the pursuit, then links to the official source for authoritative instructions.

## Truthful action rules

- Direct-apply grants can be qualified as applications only when the report classifies the company as the applicant.
- Grants that fund another buyer or recipient use buyer or partner pursuit language, not Apply.
- Active procurements use procurement-notice review and response language.
- Historical or expired records use research or monitoring language.
- A source URL is labeled as an official source or instructions page unless a connector provides a separately verified application URL.

## Production migration

Apply `db/customer-opportunity-pursuits.sql` after the production migration ledger is current through `v0029`, then record it as `v0030` using `public.record_schema_migration` in the same transaction.

The table is service-role-only. Browser roles have no direct access. Mutations require:

- a signed-in customer
- same-origin form submission
- customer ownership of the originating report
- full report or active monitoring entitlement
- a completed, quality-ready report
- an opportunity stored in that report

Creation is idempotent across refreshed scans through the customer, scanned-company context, and canonical official-source key.

## Launch verification

Run:

```bash
pnpm run typecheck
pnpm run test:pursuits
pnpm run test:product-analytics
pnpm run test:responsive-ui
node scripts/test-migration-manifest.mjs
```

Then verify with a full-access Reparel, SchoolGig, or Jammcard account:

1. Start the same pursuit twice and confirm only one dashboard row exists.
2. Save owner, next step, deadline, readiness notes, and documents.
3. Confirm an indirect grant never shows direct-application language.
4. Confirm the official source opens in a new tab and the pursuit workspace remains open.
5. Confirm another signed-in account cannot read or update the pursuit.
