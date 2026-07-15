import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const [sql, manifestSource] = await Promise.all([
  readFile(new URL("../db/stripe-report-payment-lifecycle.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/migration-manifest.json", import.meta.url), "utf8")
]);
const manifest = JSON.parse(manifestSource);
const migration = manifest.migrations.at(-1);

assert.deepEqual(migration, {
  version: "v0023",
  file: "db/stripe-report-payment-lifecycle.sql",
  description: "Event-order-safe one-time Report payment lifecycle and immutable purchase email.",
  prerequisites: ["v0018", "v0022"],
  sha256: createHash("sha256").update(sql).digest("hex"),
  requiredInProduction: true
});

assert.match(sql, /add column if not exists purchase_email text/);
assert.match(sql, /alter column purchase_email set not null/);
assert.match(sql, /purchase_email = lower\(btrim\(purchase_email\)\)/);
assert.match(sql, /Report purchase email is immutable/);
assert.match(sql, /before insert or update of purchase_email/);

assert.match(sql, /create table if not exists public\.stripe_report_payment_lifecycle/);
assert.match(sql, /stripe_payment_intent_id text primary key/);
assert.match(sql, /payment_confirmed_event_created_at timestamptz/);
assert.match(sql, /refund_event_created_at timestamptz/);
assert.match(sql, /dispute_status in \('none', 'open', 'won', 'lost', 'cleared'\)/);
assert.match(sql, /latest_event_created_at = greatest/);
assert.match(sql, /when 'lost' then 4[\s\S]*when 'open' then 3/);

assert.match(sql, /charge\.refunded/);
assert.match(sql, /charge\.dispute\.created/);
assert.match(sql, /charge\.dispute\.closed/);
assert.match(sql, /charge\.dispute\.funds_reinstated/);
assert.match(sql, /when v_object->>'status' = 'won' then 'dispute_won'/);
assert.match(sql, /else 'dispute_lost'/);
assert.doesNotMatch(sql, /charge\.refunded'[\s\S]{0,200}v_object->>'refunded'/);
assert.match(sql, /create or replace function public\.fulfill_verified_report_checkout[\s\S]*purchase_email,[\s\S]*p_customer_email/);
assert.match(sql, /create or replace function public\.fulfill_verified_customer_report_checkout[\s\S]*purchase_email,[\s\S]*p_customer_email/);

const deliveryFunction = sql.match(
  /create or replace function public\.prepare_paid_report_delivery[\s\S]*?\n\$\$;/
)?.[0];
assert.ok(deliveryFunction, "replacement delivery function is required");
assert.match(deliveryFunction, /report_grant\.purchase_email/);
assert.doesNotMatch(deliveryFunction, /stripe_customers|stripe_customer\.email/);

const claimFunction = sql.match(
  /create or replace function public\.claim_active_report_purchase_by_email[\s\S]*?\n\$\$;/
)?.[0];
assert.ok(claimFunction, "replacement claim function is required");
assert.match(claimFunction, /report_grant\.purchase_email = v_account_email/);
assert.doesNotMatch(claimFunction, /join public\.stripe_customers/);
assert.match(claimFunction, /customer_account_id <> p_customer_account_id/);
assert.match(claimFunction, /'claimed',[\s\S]*'free'/);
assert.match(claimFunction, /on conflict \(scan_id\) do nothing/);

assert.match(sql, /enable row level security/);
assert.match(
  sql,
  /revoke all on table public\.stripe_report_payment_lifecycle[\s\S]*from public, anon, authenticated/
);
assert.match(
  sql,
  /revoke all on table public\.stripe_report_access_grants[\s\S]*from public, anon, authenticated/
);
assert.match(
  sql,
  /revoke all on function public\.process_stripe_webhook_event_unchecked[\s\S]*service_role/
);
assert.match(sql, /grant execute on function public\.fulfill_verified_report_checkout[\s\S]*to service_role/);

const disputePriority = { none: 0, cleared: 1, won: 2, open: 3, lost: 4 };

function mergeLifecycle(events) {
  const state = {
    paymentConfirmedAt: null,
    refundedAt: null,
    disputeStatus: "none",
    disputeAt: null
  };

  for (const event of events) {
    if (event.kind === "payment_confirmed") {
      if (state.paymentConfirmedAt === null || event.created > state.paymentConfirmedAt) {
        state.paymentConfirmedAt = event.created;
      }
      continue;
    }
    if (event.kind === "refunded") {
      if (state.refundedAt === null || event.created > state.refundedAt) {
        state.refundedAt = event.created;
      }
      continue;
    }

    const incoming = {
      dispute_open: "open",
      dispute_won: "won",
      dispute_lost: "lost",
      dispute_cleared: "cleared"
    }[event.kind];
    assert.ok(incoming, `unknown lifecycle event ${event.kind}`);
    if (
      state.disputeAt === null ||
      event.created > state.disputeAt ||
      (event.created === state.disputeAt && disputePriority[incoming] > disputePriority[state.disputeStatus])
    ) {
      state.disputeStatus = incoming;
      state.disputeAt = event.created;
    }
  }

  if (state.paymentConfirmedAt === null) return null;
  if (state.refundedAt !== null) return "refunded";
  if (["open", "lost"].includes(state.disputeStatus)) return "disputed";
  return "active";
}

const checkout = { kind: "payment_confirmed", created: 100 };
const refund = { kind: "refunded", created: 300 };
const dispute = { kind: "dispute_open", created: 200 };
const won = { kind: "dispute_won", created: 400 };
const cleared = { kind: "dispute_cleared", created: 500 };

assert.equal(mergeLifecycle([refund, checkout]), "refunded");
assert.equal(mergeLifecycle([checkout, refund, checkout]), "refunded");
assert.equal(mergeLifecycle([dispute, checkout]), "disputed");
assert.equal(mergeLifecycle([won, dispute, checkout]), "active");
assert.equal(mergeLifecycle([checkout, dispute, won]), "active");
assert.equal(mergeLifecycle([checkout, refund, won]), "refunded");
assert.equal(mergeLifecycle([checkout, { kind: "dispute_lost", created: 400 }, cleared]), "active");
assert.equal(mergeLifecycle([checkout, won, won]), "active");

const equalTimeOpen = { kind: "dispute_open", created: 600 };
const equalTimeWon = { kind: "dispute_won", created: 600 };
assert.equal(mergeLifecycle([checkout, equalTimeWon, equalTimeOpen]), "disputed");
assert.equal(mergeLifecycle([checkout, equalTimeOpen, equalTimeWon]), "disputed");

console.log("Report payment lifecycle migration contract checks passed.");
