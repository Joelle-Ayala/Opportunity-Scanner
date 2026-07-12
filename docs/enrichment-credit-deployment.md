# Enrichment Credit Deployment

## Contract

- Growth includes 30 person-level contact-enrichment attempts per billing month by default.
- Source-native contacts, ineligible targets, and unconfigured providers do not consume a credit.
- A configured Clay/Snov attempt consumes one credit before the provider is called, whether or not it returns a contact.
- Repeated requests for the same opportunity in the same billing month reuse the original ledger debit.
- Monitor and one-time Report access keep their reports, exports, contact paths, and action data, but do not receive paid person-level enrichment credits.

## Deploy Order

1. Apply `db/enrichment-credits.sql` after `db/schema.sql`, `db/stripe-billing-expansion.sql`, and `db/customer-dashboard.sql`.
2. Add `ENRICHMENT_CREDITS_GROWTH_MONTHLY=30` to the application environment. Keep the value aligned with published Growth pricing.
3. Deploy the application only after the migration succeeds. The dashboard intentionally fails closed if the credit RPC is missing.
4. Run `pnpm run test:enrichment-credits` and `pnpm run typecheck` before promotion.
5. Verify with a signed-in Growth account: the dashboard shows 30 remaining, one eligible contact attempt shows 29, and retrying the same opportunity remains 29.

## Rollback

Roll back the application before removing the RPC functions or ledger. Preserve ledger rows for billing support and audit history. Do not lower the configured allowance mid-period without a customer communication and an explicit product decision.
