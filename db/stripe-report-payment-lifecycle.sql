-- Make one-time Report grants derive from an event-order-safe PaymentIntent lifecycle.
-- Apply after paid-report-fulfillment-recovery.sql.

alter table public.stripe_report_access_grants
  add column if not exists purchase_email text;

update public.stripe_report_access_grants report_grant
set purchase_email = lower(btrim(stripe_customer.email))
from public.stripe_customers stripe_customer
where stripe_customer.stripe_customer_id = report_grant.stripe_customer_id
  and report_grant.purchase_email is null
  and stripe_customer.email is not null
  and char_length(lower(btrim(stripe_customer.email))) between 3 and 254
  and lower(btrim(stripe_customer.email)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

update public.stripe_report_access_grants report_grant
set purchase_email = lower(btrim(customer_account.email))
from public.customer_report_grant_ownership grant_ownership
join public.customer_accounts customer_account
  on customer_account.id = grant_ownership.customer_account_id
where grant_ownership.report_access_grant_id = report_grant.id
  and report_grant.purchase_email is null
  and char_length(lower(btrim(customer_account.email))) between 3 and 254
  and lower(btrim(customer_account.email)) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';

do $migration$
begin
  if exists (
    select 1
    from public.stripe_report_access_grants
    where purchase_email is null
  ) then
    raise exception 'Every historical Report purchase must have a trustworthy purchase email';
  end if;
end;
$migration$;

alter table public.stripe_report_access_grants
  alter column purchase_email set not null;

alter table public.stripe_report_access_grants
  drop constraint if exists stripe_report_access_grants_purchase_email_check;
alter table public.stripe_report_access_grants
  add constraint stripe_report_access_grants_purchase_email_check check (
    purchase_email = lower(btrim(purchase_email))
    and char_length(purchase_email) between 3 and 254
    and purchase_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  );

comment on column public.stripe_report_access_grants.purchase_email is
  'Immutable normalized email captured from the verified one-time Report purchase.';

create or replace function public.enforce_report_purchase_email_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_purchase_email text;
begin
  if tg_op = 'UPDATE' then
    if new.purchase_email is distinct from old.purchase_email then
      raise exception 'Report purchase email is immutable';
    end if;
    return new;
  end if;

  v_purchase_email := lower(btrim(coalesce(
    new.purchase_email,
    nullif(current_setting('app.report_purchase_email', true), '')
  )));

  if v_purchase_email is null
    or char_length(v_purchase_email) not between 3 and 254
    or v_purchase_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'A valid Report purchase email is required';
  end if;

  new.purchase_email := v_purchase_email;
  return new;
end;
$$;

drop trigger if exists stripe_report_access_grants_purchase_email_immutable
  on public.stripe_report_access_grants;
create trigger stripe_report_access_grants_purchase_email_immutable
before insert or update of purchase_email on public.stripe_report_access_grants
for each row execute function public.enforce_report_purchase_email_immutability();

create table if not exists public.stripe_report_payment_lifecycle (
  stripe_payment_intent_id text primary key
    check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'),
  payment_confirmed_event_created_at timestamptz,
  refund_event_created_at timestamptz,
  dispute_status text not null default 'none'
    check (dispute_status in ('none', 'open', 'won', 'lost', 'cleared')),
  dispute_event_created_at timestamptz,
  latest_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (dispute_status = 'none' and dispute_event_created_at is null)
    or (dispute_status <> 'none' and dispute_event_created_at is not null)
  )
);

comment on table public.stripe_report_payment_lifecycle is
  'Service-only event-time state for one-time Report PaymentIntents.';

alter table public.stripe_report_payment_lifecycle enable row level security;

insert into public.stripe_report_payment_lifecycle (
  stripe_payment_intent_id,
  payment_confirmed_event_created_at,
  refund_event_created_at,
  dispute_status,
  dispute_event_created_at,
  latest_event_created_at
)
select
  report_grant.stripe_payment_intent_id,
  least(report_grant.granted_at, report_grant.stripe_event_created_at),
  case when report_grant.status = 'refunded' then report_grant.stripe_event_created_at end,
  case when report_grant.status = 'disputed' then 'open' else 'none' end,
  case when report_grant.status = 'disputed' then report_grant.stripe_event_created_at end,
  report_grant.stripe_event_created_at
from public.stripe_report_access_grants report_grant
where report_grant.stripe_payment_intent_id is not null
on conflict (stripe_payment_intent_id) do nothing;

create or replace function public.merge_stripe_report_payment_lifecycle(
  p_payment_intent_id text,
  p_lifecycle_event text,
  p_stripe_created_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dispute_status text;
begin
  if p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
    or p_lifecycle_event not in (
      'payment_confirmed',
      'refunded',
      'dispute_open',
      'dispute_won',
      'dispute_lost',
      'dispute_cleared'
    )
    or p_stripe_created_at is null
  then
    raise exception 'Invalid Report payment lifecycle event';
  end if;

  v_dispute_status := case p_lifecycle_event
    when 'dispute_open' then 'open'
    when 'dispute_won' then 'won'
    when 'dispute_lost' then 'lost'
    when 'dispute_cleared' then 'cleared'
    else 'none'
  end;

  insert into public.stripe_report_payment_lifecycle (
    stripe_payment_intent_id,
    payment_confirmed_event_created_at,
    refund_event_created_at,
    dispute_status,
    dispute_event_created_at,
    latest_event_created_at
  ) values (
    p_payment_intent_id,
    case when p_lifecycle_event = 'payment_confirmed' then p_stripe_created_at end,
    case when p_lifecycle_event = 'refunded' then p_stripe_created_at end,
    v_dispute_status,
    case when v_dispute_status <> 'none' then p_stripe_created_at end,
    p_stripe_created_at
  )
  on conflict (stripe_payment_intent_id) do update set
    payment_confirmed_event_created_at = case
      when excluded.payment_confirmed_event_created_at is null
        then stripe_report_payment_lifecycle.payment_confirmed_event_created_at
      when stripe_report_payment_lifecycle.payment_confirmed_event_created_at is null
        or excluded.payment_confirmed_event_created_at
          > stripe_report_payment_lifecycle.payment_confirmed_event_created_at
        then excluded.payment_confirmed_event_created_at
      else stripe_report_payment_lifecycle.payment_confirmed_event_created_at
    end,
    refund_event_created_at = case
      when excluded.refund_event_created_at is null
        then stripe_report_payment_lifecycle.refund_event_created_at
      when stripe_report_payment_lifecycle.refund_event_created_at is null
        or excluded.refund_event_created_at > stripe_report_payment_lifecycle.refund_event_created_at
        then excluded.refund_event_created_at
      else stripe_report_payment_lifecycle.refund_event_created_at
    end,
    dispute_status = case
      when excluded.dispute_event_created_at is null
        then stripe_report_payment_lifecycle.dispute_status
      when stripe_report_payment_lifecycle.dispute_event_created_at is null
        or excluded.dispute_event_created_at > stripe_report_payment_lifecycle.dispute_event_created_at
        or (
          excluded.dispute_event_created_at = stripe_report_payment_lifecycle.dispute_event_created_at
          and case excluded.dispute_status
            when 'lost' then 4
            when 'open' then 3
            when 'won' then 2
            when 'cleared' then 1
            else 0
          end > case stripe_report_payment_lifecycle.dispute_status
            when 'lost' then 4
            when 'open' then 3
            when 'won' then 2
            when 'cleared' then 1
            else 0
          end
        )
        then excluded.dispute_status
      else stripe_report_payment_lifecycle.dispute_status
    end,
    dispute_event_created_at = case
      when excluded.dispute_event_created_at is null
        then stripe_report_payment_lifecycle.dispute_event_created_at
      when stripe_report_payment_lifecycle.dispute_event_created_at is null
        or excluded.dispute_event_created_at > stripe_report_payment_lifecycle.dispute_event_created_at
        or (
          excluded.dispute_event_created_at = stripe_report_payment_lifecycle.dispute_event_created_at
          and case excluded.dispute_status
            when 'lost' then 4
            when 'open' then 3
            when 'won' then 2
            when 'cleared' then 1
            else 0
          end > case stripe_report_payment_lifecycle.dispute_status
            when 'lost' then 4
            when 'open' then 3
            when 'won' then 2
            when 'cleared' then 1
            else 0
          end
        )
        then excluded.dispute_event_created_at
      else stripe_report_payment_lifecycle.dispute_event_created_at
    end,
    latest_event_created_at = greatest(
      stripe_report_payment_lifecycle.latest_event_created_at,
      excluded.latest_event_created_at
    ),
    updated_at = now();
end;
$$;

create or replace function public.stripe_report_grant_status_for_payment_intent(
  p_payment_intent_id text
) returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when lifecycle.payment_confirmed_event_created_at is null then null
    when lifecycle.refund_event_created_at is not null then 'refunded'
    when lifecycle.dispute_status in ('open', 'lost') then 'disputed'
    when lifecycle.dispute_status in ('none', 'won', 'cleared') then 'active'
    else 'disputed'
  end
  from public.stripe_report_payment_lifecycle lifecycle
  where lifecycle.stripe_payment_intent_id = p_payment_intent_id
$$;

create or replace function public.reconcile_stripe_report_access_grant(
  p_payment_intent_id text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grant_status text;
  v_latest_event_created_at timestamptz;
begin
  select
    public.stripe_report_grant_status_for_payment_intent(p_payment_intent_id),
    lifecycle.latest_event_created_at
  into v_grant_status, v_latest_event_created_at
  from public.stripe_report_payment_lifecycle lifecycle
  where lifecycle.stripe_payment_intent_id = p_payment_intent_id;

  if v_grant_status is null then
    return;
  end if;

  update public.stripe_report_access_grants report_grant
  set status = v_grant_status,
    revoked_at = case
      when v_grant_status = 'active' then null
      when report_grant.status is distinct from v_grant_status or report_grant.revoked_at is null then now()
      else report_grant.revoked_at
    end,
    stripe_event_created_at = greatest(
      report_grant.stripe_event_created_at,
      v_latest_event_created_at
    ),
    updated_at = now()
  where report_grant.stripe_payment_intent_id = p_payment_intent_id
    and (
      report_grant.status is distinct from v_grant_status
      or report_grant.stripe_event_created_at < v_latest_event_created_at
      or (v_grant_status = 'active' and report_grant.revoked_at is not null)
    );
end;
$$;

do $migration$
begin
  if to_regprocedure(
    'public.process_stripe_webhook_event_before_report_lifecycle_v0023(text,text,timestamptz,jsonb,jsonb)'
  ) is null then
    if to_regprocedure(
      'public.process_stripe_webhook_event_unchecked(text,text,timestamptz,jsonb,jsonb)'
    ) is null then
      raise exception 'Unchecked Stripe webhook processor must exist before Report lifecycle hardening';
    end if;

    alter function public.process_stripe_webhook_event_unchecked(text, text, timestamptz, jsonb, jsonb)
      rename to process_stripe_webhook_event_before_report_lifecycle_v0023;
  end if;
end;
$migration$;

revoke all on function public.process_stripe_webhook_event_before_report_lifecycle_v0023(
  text, text, timestamptz, jsonb, jsonb
) from public, anon, authenticated, service_role;

create or replace function public.process_stripe_webhook_event_unchecked(
  p_event_id text,
  p_event_type text,
  p_stripe_created_at timestamptz,
  p_payload jsonb,
  p_price_catalog jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_processed boolean;
  v_object jsonb := p_payload #> '{data,object}';
  v_payment_intent_id text;
  v_lifecycle_event text;
  v_purchase_email text;
begin
  perform set_config('app.report_purchase_email', '', true);

  if p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
    and v_object->>'mode' = 'payment'
    and v_object->>'payment_status' = 'paid'
    and v_object #>> '{metadata,product}' = 'report'
    and v_object #>> '{metadata,price_id}' = p_price_catalog->>'report'
  then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'payment_confirmed';
    v_purchase_email := lower(btrim(v_object #>> '{customer_details,email}'));
    perform set_config('app.report_purchase_email', coalesce(v_purchase_email, ''), true);
  elsif p_event_type = 'charge.refunded' then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'refunded';
  elsif p_event_type = 'charge.dispute.created' then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'dispute_open';
  elsif p_event_type = 'charge.dispute.closed' then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := case
      when v_object->>'status' = 'won' then 'dispute_won'
      else 'dispute_lost'
    end;
  elsif p_event_type = 'charge.dispute.funds_reinstated' then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'dispute_cleared';
  end if;

  v_processed := public.process_stripe_webhook_event_before_report_lifecycle_v0023(
    p_event_id,
    p_event_type,
    p_stripe_created_at,
    p_payload,
    p_price_catalog
  );

  if not v_processed then
    return false;
  end if;

  if v_lifecycle_event is not null then
    perform public.merge_stripe_report_payment_lifecycle(
      v_payment_intent_id,
      v_lifecycle_event,
      p_stripe_created_at
    );
    perform public.reconcile_stripe_report_access_grant(v_payment_intent_id);
  end if;

  return true;
end;
$$;

create or replace function public.fulfill_verified_report_checkout(
  p_scan_id uuid,
  p_customer_id text,
  p_customer_email text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_session_created_at timestamptz,
  p_livemode boolean
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grant_status text;
begin
  if p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_customer_email is null
    or p_customer_email <> lower(btrim(p_customer_email))
    or char_length(p_customer_email) not between 3 and 254
    or p_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_checkout_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+$'
    or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
    or p_session_created_at is null
  then
    raise exception 'Invalid verified Report checkout';
  end if;

  perform public.merge_stripe_report_payment_lifecycle(
    p_payment_intent_id,
    'payment_confirmed',
    p_session_created_at
  );
  v_grant_status := public.stripe_report_grant_status_for_payment_intent(p_payment_intent_id);

  insert into public.stripe_customers (
    stripe_customer_id,
    email,
    livemode,
    stripe_event_created_at
  ) values (
    p_customer_id,
    p_customer_email,
    p_livemode,
    p_session_created_at
  )
  on conflict (stripe_customer_id) do update set
    email = coalesce(stripe_customers.email, excluded.email),
    updated_at = now();

  insert into public.stripe_report_access_grants (
    scan_id,
    stripe_customer_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    purchase_email,
    status,
    granted_at,
    revoked_at,
    stripe_event_created_at
  ) values (
    p_scan_id,
    p_customer_id,
    p_checkout_session_id,
    p_payment_intent_id,
    p_customer_email,
    v_grant_status,
    now(),
    case when v_grant_status = 'active' then null else now() end,
    p_session_created_at
  )
  on conflict (stripe_checkout_session_id) do nothing;

  perform public.reconcile_stripe_report_access_grant(p_payment_intent_id);

  return exists (
    select 1
    from public.stripe_report_access_grants report_grant
    where report_grant.scan_id = p_scan_id
      and report_grant.stripe_customer_id = p_customer_id
      and report_grant.stripe_checkout_session_id = p_checkout_session_id
      and report_grant.stripe_payment_intent_id = p_payment_intent_id
      and report_grant.purchase_email = p_customer_email
      and report_grant.status = 'active'
  );
end;
$$;

create or replace function public.fulfill_verified_customer_report_checkout(
  p_auth_user_id uuid,
  p_customer_account_id uuid,
  p_scan_id uuid,
  p_customer_id text,
  p_customer_email text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_session_created_at timestamptz,
  p_livemode boolean
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grant_id uuid;
  v_grant_status text;
begin
  if p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_customer_email is null
    or p_customer_email <> lower(btrim(p_customer_email))
    or char_length(p_customer_email) not between 3 and 254
    or p_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_checkout_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+$'
    or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
    or p_session_created_at is null
  then
    raise exception 'Invalid verified Report checkout';
  end if;

  if not exists (
    select 1
    from public.customer_accounts
    where id = p_customer_account_id
      and auth_user_id = p_auth_user_id
      and lower(email) = p_customer_email
      and (stripe_customer_id is null or stripe_customer_id = p_customer_id)
  ) then
    raise exception 'Report checkout account does not match the authenticated customer';
  end if;

  if exists (
    select 1
    from public.customer_accounts
    where stripe_customer_id = p_customer_id
      and id <> p_customer_account_id
  ) then
    raise exception 'Report checkout customer is already owned by another account';
  end if;

  perform public.merge_stripe_report_payment_lifecycle(
    p_payment_intent_id,
    'payment_confirmed',
    p_session_created_at
  );
  v_grant_status := public.stripe_report_grant_status_for_payment_intent(p_payment_intent_id);

  insert into public.stripe_customers (
    stripe_customer_id,
    email,
    livemode,
    stripe_event_created_at
  ) values (
    p_customer_id,
    p_customer_email,
    p_livemode,
    p_session_created_at
  )
  on conflict (stripe_customer_id) do update set
    email = coalesce(stripe_customers.email, excluded.email),
    livemode = excluded.livemode,
    deleted_at = null,
    stripe_event_created_at = greatest(stripe_customers.stripe_event_created_at, excluded.stripe_event_created_at),
    updated_at = now();

  insert into public.stripe_report_access_grants (
    scan_id,
    stripe_customer_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    purchase_email,
    status,
    granted_at,
    revoked_at,
    stripe_event_created_at
  ) values (
    p_scan_id,
    p_customer_id,
    p_checkout_session_id,
    p_payment_intent_id,
    p_customer_email,
    v_grant_status,
    now(),
    case when v_grant_status = 'active' then null else now() end,
    p_session_created_at
  )
  on conflict (stripe_checkout_session_id) do nothing;

  perform public.reconcile_stripe_report_access_grant(p_payment_intent_id);

  select report_grant.id
  into v_grant_id
  from public.stripe_report_access_grants report_grant
  where report_grant.scan_id = p_scan_id
    and report_grant.stripe_customer_id = p_customer_id
    and report_grant.stripe_checkout_session_id = p_checkout_session_id
    and report_grant.stripe_payment_intent_id = p_payment_intent_id
    and report_grant.purchase_email = p_customer_email
    and report_grant.status = 'active';

  if v_grant_id is null then
    return false;
  end if;

  update public.customer_accounts
  set stripe_customer_id = p_customer_id,
    updated_at = now()
  where id = p_customer_account_id
    and auth_user_id = p_auth_user_id
    and lower(email) = p_customer_email
    and (stripe_customer_id is null or stripe_customer_id = p_customer_id);

  if not found then
    raise exception 'Report checkout account could not be linked';
  end if;

  if exists (
    select 1
    from public.customer_report_grant_ownership
    where report_access_grant_id = v_grant_id
      and customer_account_id <> p_customer_account_id
  ) then
    raise exception 'Report checkout grant is already owned by another account';
  end if;

  insert into public.customer_report_grant_ownership (
    customer_account_id,
    report_access_grant_id
  ) values (
    p_customer_account_id,
    v_grant_id
  )
  on conflict (report_access_grant_id) do nothing;

  -- Paid access remains derived from the active grant; manual/demo full access is untouched.
  insert into public.customer_scan_ownership (
    customer_account_id,
    scan_id,
    ownership_kind,
    access_level
  ) values (
    p_customer_account_id,
    p_scan_id,
    'claimed',
    'free'
  )
  on conflict (scan_id) do nothing;

  return exists (
    select 1
    from public.customer_report_grant_ownership ownership
    join public.stripe_report_access_grants report_grant
      on report_grant.id = ownership.report_access_grant_id
    where ownership.customer_account_id = p_customer_account_id
      and ownership.report_access_grant_id = v_grant_id
      and report_grant.scan_id = p_scan_id
      and report_grant.status = 'active'
  );
end;
$$;

create or replace function public.prepare_paid_report_delivery(
  p_scan_id uuid,
  p_checkout_session_id text
) returns table(delivery_id uuid, recipient_email text, attempt_number integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_grant_id uuid;
  v_email text;
  v_delivery_id uuid;
  v_attempt_number integer;
begin
  if p_checkout_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+$' then
    raise exception 'Invalid Report checkout session';
  end if;

  select report_grant.id, report_grant.purchase_email
  into v_grant_id, v_email
  from public.stripe_report_access_grants report_grant
  where report_grant.scan_id = p_scan_id
    and report_grant.stripe_checkout_session_id = p_checkout_session_id
    and report_grant.status = 'active'
  for update of report_grant;

  if v_grant_id is null then
    return;
  end if;

  insert into public.paid_report_delivery_attempts (
    report_access_grant_id,
    status,
    attempt_count,
    last_attempted_at
  ) values (
    v_grant_id,
    'pending',
    1,
    now()
  )
  on conflict (report_access_grant_id) do update set
    status = 'pending',
    attempt_count = least(50, paid_report_delivery_attempts.attempt_count + 1),
    last_attempted_at = now(),
    last_failure_code = null,
    updated_at = now()
  where paid_report_delivery_attempts.status <> 'delivered'
  returning id, attempt_count into v_delivery_id, v_attempt_number;

  if v_delivery_id is null then
    return;
  end if;

  return query select v_delivery_id, v_email, v_attempt_number;
end;
$$;

create or replace function public.claim_active_report_purchase_by_email(
  p_auth_user_id uuid,
  p_customer_account_id uuid,
  p_scan_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_email text;
  v_account_customer_id text;
  v_grant_id uuid;
  v_grant_customer_id text;
begin
  select lower(email), stripe_customer_id
  into v_account_email, v_account_customer_id
  from public.customer_accounts
  where id = p_customer_account_id
    and auth_user_id = p_auth_user_id
  for update;

  if v_account_email is null then
    return false;
  end if;

  select report_grant.id, report_grant.stripe_customer_id
  into v_grant_id, v_grant_customer_id
  from public.stripe_report_access_grants report_grant
  where report_grant.scan_id = p_scan_id
    and report_grant.status = 'active'
    and report_grant.purchase_email = v_account_email
  order by report_grant.granted_at desc
  limit 1
  for update of report_grant;

  if v_grant_id is null
    or (v_account_customer_id is not null and v_account_customer_id <> v_grant_customer_id)
    or exists (
      select 1 from public.customer_accounts
      where stripe_customer_id = v_grant_customer_id
        and id <> p_customer_account_id
    )
    or exists (
      select 1 from public.customer_report_grant_ownership
      where report_access_grant_id = v_grant_id
        and customer_account_id <> p_customer_account_id
    )
    or exists (
      select 1 from public.customer_scan_ownership
      where scan_id = p_scan_id
        and customer_account_id <> p_customer_account_id
    )
  then
    return false;
  end if;

  update public.customer_accounts
  set stripe_customer_id = v_grant_customer_id,
    updated_at = now()
  where id = p_customer_account_id
    and auth_user_id = p_auth_user_id
    and (stripe_customer_id is null or stripe_customer_id = v_grant_customer_id);

  if not found then
    return false;
  end if;

  insert into public.customer_report_grant_ownership (
    customer_account_id,
    report_access_grant_id
  ) values (
    p_customer_account_id,
    v_grant_id
  )
  on conflict (report_access_grant_id) do nothing;

  insert into public.customer_scan_ownership (
    customer_account_id,
    scan_id,
    ownership_kind,
    access_level
  ) values (
    p_customer_account_id,
    p_scan_id,
    'claimed',
    'free'
  )
  on conflict (scan_id) do nothing;

  return exists (
    select 1
    from public.customer_report_grant_ownership grant_ownership
    join public.stripe_report_access_grants report_grant
      on report_grant.id = grant_ownership.report_access_grant_id
    join public.customer_scan_ownership scan_ownership
      on scan_ownership.customer_account_id = grant_ownership.customer_account_id
      and scan_ownership.scan_id = report_grant.scan_id
    where grant_ownership.customer_account_id = p_customer_account_id
      and grant_ownership.report_access_grant_id = v_grant_id
      and report_grant.scan_id = p_scan_id
      and report_grant.status = 'active'
  );
end;
$$;

revoke all on table public.stripe_report_payment_lifecycle
  from public, anon, authenticated;
revoke all on table public.stripe_report_access_grants
  from public, anon, authenticated;

grant all on table public.stripe_report_payment_lifecycle to service_role;
grant all on table public.stripe_report_access_grants to service_role;

revoke all on function public.enforce_report_purchase_email_immutability()
  from public, anon, authenticated, service_role;
revoke all on function public.merge_stripe_report_payment_lifecycle(text, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.stripe_report_grant_status_for_payment_intent(text)
  from public, anon, authenticated, service_role;
revoke all on function public.reconcile_stripe_report_access_grant(text)
  from public, anon, authenticated, service_role;
revoke all on function public.process_stripe_webhook_event_unchecked(text, text, timestamptz, jsonb, jsonb)
  from public, anon, authenticated, service_role;

revoke all on function public.fulfill_verified_report_checkout(
  uuid, text, text, text, text, timestamptz, boolean
) from public, anon, authenticated;
revoke all on function public.fulfill_verified_customer_report_checkout(
  uuid, uuid, uuid, text, text, text, text, timestamptz, boolean
) from public, anon, authenticated;
revoke all on function public.prepare_paid_report_delivery(uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_active_report_purchase_by_email(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.fulfill_verified_report_checkout(
  uuid, text, text, text, text, timestamptz, boolean
) to service_role;
grant execute on function public.fulfill_verified_customer_report_checkout(
  uuid, uuid, uuid, text, text, text, text, timestamptz, boolean
) to service_role;
grant execute on function public.prepare_paid_report_delivery(uuid, text)
  to service_role;
grant execute on function public.claim_active_report_purchase_by_email(uuid, uuid, uuid)
  to service_role;
