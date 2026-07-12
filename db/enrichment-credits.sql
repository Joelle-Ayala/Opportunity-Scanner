-- Atomic paid contact-enrichment credit accounting.
-- Apply after schema.sql, stripe-billing-expansion.sql, and customer-dashboard.sql.
-- The application passes ENRICHMENT_CREDITS_GROWTH_MONTHLY (default 30) to these
-- service-role-only functions. Deploy this migration before deploying the app code.

create table if not exists enrichment_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references customer_accounts(id) on delete cascade,
  stripe_subscription_id text not null references stripe_subscriptions(stripe_subscription_id) on delete restrict,
  scan_id uuid not null references scans(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  delta integer not null check (delta <> 0),
  reason text not null check (reason in ('contact_enrichment')),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  unique (customer_account_id, period_start, idempotency_key)
);

create index if not exists enrichment_credit_ledger_account_period_idx
  on enrichment_credit_ledger(customer_account_id, period_start, created_at desc);
create index if not exists enrichment_credit_ledger_subscription_idx
  on enrichment_credit_ledger(stripe_subscription_id, created_at desc);

alter table enrichment_credit_ledger enable row level security;
revoke all on enrichment_credit_ledger from public, anon, authenticated;
revoke all on enrichment_credit_ledger from service_role;
grant select on enrichment_credit_ledger to service_role;

create or replace function enrichment_credit_period(
  p_billing_interval text,
  p_subscription_start timestamptz,
  p_subscription_end timestamptz,
  p_now timestamptz default now()
) returns table(period_start timestamptz, period_end timestamptz)
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_anchor timestamptz;
  v_month_offset integer;
begin
  v_anchor := coalesce(p_subscription_start, date_trunc('month', p_now));

  if p_billing_interval = 'annual' and v_anchor <= p_now then
    v_month_offset := greatest(
      0,
      (extract(year from age(p_now, v_anchor))::integer * 12)
        + extract(month from age(p_now, v_anchor))::integer
    );
    period_start := v_anchor + make_interval(months => v_month_offset);
    period_end := least(
      v_anchor + make_interval(months => v_month_offset + 1),
      coalesce(p_subscription_end, v_anchor + make_interval(months => v_month_offset + 1))
    );
  elsif p_subscription_start is not null
    and p_subscription_end is not null
    and p_subscription_end > p_now
  then
    period_start := p_subscription_start;
    period_end := p_subscription_end;
  else
    period_start := date_trunc('month', p_now);
    period_end := date_trunc('month', p_now) + interval '1 month';
  end if;

  return next;
end;
$$;

create or replace function get_enrichment_credit_balance(
  p_auth_user_id uuid,
  p_credit_limit integer default 30
) returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_account customer_accounts%rowtype;
  v_subscription stripe_subscriptions%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used integer := 0;
begin
  if p_credit_limit < 1 or p_credit_limit > 10000 then
    raise exception 'Invalid enrichment credit limit';
  end if;

  select * into v_account
  from customer_accounts
  where auth_user_id = p_auth_user_id;

  if v_account.id is null or v_account.stripe_customer_id is null then
    return jsonb_build_object('entitled', false, 'limit', 0, 'used', 0, 'remaining', 0);
  end if;

  select * into v_subscription
  from stripe_subscriptions
  where stripe_customer_id = v_account.stripe_customer_id
    and product = 'growth'
    and status in ('active', 'trialing')
    and (current_period_end is null or current_period_end > now())
  order by updated_at desc
  limit 1;

  if v_subscription.stripe_subscription_id is null then
    return jsonb_build_object('entitled', false, 'limit', 0, 'used', 0, 'remaining', 0);
  end if;

  select period_start, period_end into v_period_start, v_period_end
  from enrichment_credit_period(
    v_subscription.billing_interval,
    v_subscription.current_period_start,
    v_subscription.current_period_end,
    now()
  );

  select coalesce(-sum(delta), 0)::integer into v_used
  from enrichment_credit_ledger
  where customer_account_id = v_account.id
    and period_start = v_period_start
    and delta < 0;

  return jsonb_build_object(
    'entitled', true,
    'limit', p_credit_limit,
    'used', least(p_credit_limit, greatest(0, v_used)),
    'remaining', greatest(0, p_credit_limit - v_used),
    'periodStart', v_period_start,
    'periodEnd', v_period_end
  );
end;
$$;

create or replace function reserve_enrichment_credit(
  p_auth_user_id uuid,
  p_scan_id uuid,
  p_opportunity_id uuid,
  p_idempotency_key text,
  p_credit_limit integer default 30
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account customer_accounts%rowtype;
  v_subscription stripe_subscriptions%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used integer := 0;
  v_existing_id uuid;
  v_ledger_id uuid;
begin
  if p_credit_limit < 1 or p_credit_limit > 10000
    or char_length(coalesce(p_idempotency_key, '')) not between 1 and 200
  then
    raise exception 'Invalid enrichment credit reservation';
  end if;

  select * into v_account
  from customer_accounts
  where auth_user_id = p_auth_user_id;

  if v_account.id is null or v_account.stripe_customer_id is null then
    return jsonb_build_object('status', 'not_entitled', 'limit', 0, 'used', 0, 'remaining', 0);
  end if;

  if not exists (
    select 1 from customer_scan_ownership
    where customer_account_id = v_account.id and scan_id = p_scan_id
  ) or not exists (
    select 1 from scan_opportunities
    where scan_id = p_scan_id and opportunity_id = p_opportunity_id
  ) then
    return jsonb_build_object('status', 'not_owned', 'limit', 0, 'used', 0, 'remaining', 0);
  end if;

  select * into v_subscription
  from stripe_subscriptions
  where stripe_customer_id = v_account.stripe_customer_id
    and product = 'growth'
    and status in ('active', 'trialing')
    and (current_period_end is null or current_period_end > now())
  order by updated_at desc
  limit 1;

  if v_subscription.stripe_subscription_id is null then
    return jsonb_build_object('status', 'not_entitled', 'limit', 0, 'used', 0, 'remaining', 0);
  end if;

  select period_start, period_end into v_period_start, v_period_end
  from enrichment_credit_period(
    v_subscription.billing_interval,
    v_subscription.current_period_start,
    v_subscription.current_period_end,
    now()
  );

  perform pg_advisory_xact_lock(hashtextextended(v_account.id::text || ':' || v_period_start::text, 0));

  select id into v_existing_id
  from enrichment_credit_ledger
  where customer_account_id = v_account.id
    and period_start = v_period_start
    and idempotency_key = p_idempotency_key;

  select coalesce(-sum(delta), 0)::integer into v_used
  from enrichment_credit_ledger
  where customer_account_id = v_account.id
    and period_start = v_period_start
    and delta < 0;

  if v_existing_id is not null then
    return jsonb_build_object(
      'status', 'already_reserved', 'ledgerId', v_existing_id,
      'limit', p_credit_limit, 'used', v_used,
      'remaining', greatest(0, p_credit_limit - v_used),
      'periodStart', v_period_start, 'periodEnd', v_period_end
    );
  end if;

  if v_used >= p_credit_limit then
    return jsonb_build_object(
      'status', 'limit_reached', 'limit', p_credit_limit, 'used', v_used,
      'remaining', 0, 'periodStart', v_period_start, 'periodEnd', v_period_end
    );
  end if;

  insert into enrichment_credit_ledger (
    customer_account_id, stripe_subscription_id, scan_id, opportunity_id,
    period_start, period_end, delta, reason, idempotency_key
  ) values (
    v_account.id, v_subscription.stripe_subscription_id, p_scan_id, p_opportunity_id,
    v_period_start, v_period_end, -1, 'contact_enrichment', p_idempotency_key
  ) returning id into v_ledger_id;

  v_used := v_used + 1;
  return jsonb_build_object(
    'status', 'reserved', 'ledgerId', v_ledger_id,
    'limit', p_credit_limit, 'used', v_used,
    'remaining', greatest(0, p_credit_limit - v_used),
    'periodStart', v_period_start, 'periodEnd', v_period_end
  );
end;
$$;

revoke all on function enrichment_credit_period(text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function get_enrichment_credit_balance(uuid, integer) from public, anon, authenticated;
revoke all on function reserve_enrichment_credit(uuid, uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function get_enrichment_credit_balance(uuid, integer) to service_role;
grant execute on function reserve_enrichment_credit(uuid, uuid, uuid, text, integer) to service_role;
