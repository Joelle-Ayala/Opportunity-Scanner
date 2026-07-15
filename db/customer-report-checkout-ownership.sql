-- Atomically assign a verified one-time report purchase to an authenticated customer account.
-- Apply after stripe-report-access-handoff.sql and customer-owned-report-access.sql.

create or replace function fulfill_verified_customer_report_checkout(
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
    from customer_accounts
    where id = p_customer_account_id
      and auth_user_id = p_auth_user_id
      and lower(email) = p_customer_email
      and (stripe_customer_id is null or stripe_customer_id = p_customer_id)
  ) then
    raise exception 'Report checkout account does not match the authenticated customer';
  end if;

  if exists (
    select 1
    from customer_accounts
    where stripe_customer_id = p_customer_id
      and id <> p_customer_account_id
  ) or exists (
    select 1
    from stripe_customers
    where stripe_customer_id = p_customer_id
      and email is not null
      and lower(email) <> p_customer_email
  ) then
    raise exception 'Report checkout customer is already owned by another account';
  end if;

  insert into stripe_customers (
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

  update customer_accounts
  set stripe_customer_id = p_customer_id,
    updated_at = now()
  where id = p_customer_account_id
    and auth_user_id = p_auth_user_id
    and lower(email) = p_customer_email
    and (stripe_customer_id is null or stripe_customer_id = p_customer_id);

  if not found then
    raise exception 'Report checkout account could not be linked';
  end if;

  insert into stripe_report_access_grants (
    scan_id,
    stripe_customer_id,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    status,
    granted_at,
    stripe_event_created_at
  ) values (
    p_scan_id,
    p_customer_id,
    p_checkout_session_id,
    p_payment_intent_id,
    'active',
    now(),
    p_session_created_at
  )
  on conflict (stripe_checkout_session_id) do nothing;

  select id
  into v_grant_id
  from stripe_report_access_grants
  where scan_id = p_scan_id
    and stripe_customer_id = p_customer_id
    and stripe_checkout_session_id = p_checkout_session_id
    and stripe_payment_intent_id = p_payment_intent_id
    and status = 'active';

  if v_grant_id is null then
    return false;
  end if;

  if exists (
    select 1
    from customer_report_grant_ownership
    where report_access_grant_id = v_grant_id
      and customer_account_id <> p_customer_account_id
  ) then
    raise exception 'Report checkout grant is already owned by another account';
  end if;

  insert into customer_report_grant_ownership (
    customer_account_id,
    report_access_grant_id
  ) values (
    p_customer_account_id,
    v_grant_id
  )
  on conflict (report_access_grant_id) do nothing;

  -- The paid grant still belongs to the buyer when another account already owns the scan.
  -- Never replace that ownership; only attach or upgrade an unowned/same-account scan.
  insert into customer_scan_ownership (
    customer_account_id,
    scan_id,
    ownership_kind,
    access_level
  ) values (
    p_customer_account_id,
    p_scan_id,
    'claimed',
    'full'
  )
  on conflict (scan_id) do update set
    access_level = 'full'
  where customer_scan_ownership.customer_account_id = excluded.customer_account_id;

  return exists (
    select 1
    from customer_report_grant_ownership ownership
    join stripe_report_access_grants report_grant
      on report_grant.id = ownership.report_access_grant_id
    where ownership.customer_account_id = p_customer_account_id
      and ownership.report_access_grant_id = v_grant_id
      and report_grant.scan_id = p_scan_id
      and report_grant.status = 'active'
  );
end;
$$;

revoke all on function fulfill_verified_customer_report_checkout(
  uuid, uuid, uuid, text, text, text, text, timestamptz, boolean
) from public;
revoke all on function fulfill_verified_customer_report_checkout(
  uuid, uuid, uuid, text, text, text, text, timestamptz, boolean
) from anon;
revoke all on function fulfill_verified_customer_report_checkout(
  uuid, uuid, uuid, text, text, text, text, timestamptz, boolean
) from authenticated;
grant execute on function fulfill_verified_customer_report_checkout(
  uuid, uuid, uuid, text, text, text, text, timestamptz, boolean
) to service_role;
