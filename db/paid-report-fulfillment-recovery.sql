-- Make an active one-time Report purchase recoverable after the Stripe return tab is closed.
-- Apply after stripe-report-access-revocation.sql.

create table if not exists public.paid_report_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  report_access_grant_id uuid not null unique
    references public.stripe_report_access_grants(id) on delete cascade,
  status text not null check (status in ('pending', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 50),
  provider_message_id text check (
    provider_message_id is null or char_length(provider_message_id) between 1 and 255
  ),
  last_failure_code text check (
    last_failure_code is null or last_failure_code ~ '^[a-z_]{3,64}$'
  ),
  last_attempted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists paid_report_delivery_status_idx
  on public.paid_report_delivery_attempts(status, updated_at desc);

alter table public.paid_report_delivery_attempts enable row level security;

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

  select report_grant.id, lower(stripe_customer.email)
  into v_grant_id, v_email
  from public.stripe_report_access_grants report_grant
  join public.stripe_customers stripe_customer
    on stripe_customer.stripe_customer_id = report_grant.stripe_customer_id
  where report_grant.scan_id = p_scan_id
    and report_grant.stripe_checkout_session_id = p_checkout_session_id
    and report_grant.status = 'active'
    and stripe_customer.deleted_at is null
    and stripe_customer.email is not null
    and char_length(stripe_customer.email) between 3 and 254
    and stripe_customer.email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
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

create or replace function public.record_paid_report_delivery(
  p_delivery_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_failure_code text default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('delivered', 'failed')
    or (p_provider_message_id is not null and char_length(p_provider_message_id) not between 1 and 255)
    or (p_failure_code is not null and p_failure_code !~ '^[a-z_]{3,64}$')
  then
    raise exception 'Invalid paid Report delivery result';
  end if;

  update public.paid_report_delivery_attempts
  set status = p_status,
    provider_message_id = case when p_status = 'delivered' then p_provider_message_id else null end,
    last_failure_code = case when p_status = 'failed' then p_failure_code else null end,
    delivered_at = case when p_status = 'delivered' then now() else null end,
    updated_at = now()
  where id = p_delivery_id
    and status <> 'delivered';

  return found or exists (
    select 1
    from public.paid_report_delivery_attempts
    where id = p_delivery_id and status = 'delivered'
  );
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
  join public.stripe_customers stripe_customer
    on stripe_customer.stripe_customer_id = report_grant.stripe_customer_id
  where report_grant.scan_id = p_scan_id
    and report_grant.status = 'active'
    and stripe_customer.deleted_at is null
    and lower(stripe_customer.email) = v_account_email
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

revoke all on table public.paid_report_delivery_attempts from public, anon, authenticated;
revoke all on function public.prepare_paid_report_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.record_paid_report_delivery(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_active_report_purchase_by_email(uuid, uuid, uuid) from public, anon, authenticated;

grant all on table public.paid_report_delivery_attempts to service_role;
grant execute on function public.prepare_paid_report_delivery(uuid, text) to service_role;
grant execute on function public.record_paid_report_delivery(uuid, text, text, text) to service_role;
grant execute on function public.claim_active_report_purchase_by_email(uuid, uuid, uuid) to service_role;
