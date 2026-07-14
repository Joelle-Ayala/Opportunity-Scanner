drop function if exists fulfill_verified_report_checkout(uuid, text, text, text, timestamptz, boolean);

create or replace function fulfill_verified_report_checkout(
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
    updated_at = now();

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

  return exists (
    select 1
    from stripe_report_access_grants
    where scan_id = p_scan_id
      and stripe_checkout_session_id = p_checkout_session_id
      and stripe_payment_intent_id = p_payment_intent_id
      and status = 'active'
  );
end;
$$;

revoke all on function fulfill_verified_report_checkout(uuid, text, text, text, text, timestamptz, boolean) from public;
revoke all on function fulfill_verified_report_checkout(uuid, text, text, text, text, timestamptz, boolean) from anon;
revoke all on function fulfill_verified_report_checkout(uuid, text, text, text, text, timestamptz, boolean) from authenticated;
grant execute on function fulfill_verified_report_checkout(uuid, text, text, text, text, timestamptz, boolean) to service_role;

drop function if exists fulfill_verified_subscription_checkout(
  uuid, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, boolean
);

create or replace function fulfill_verified_subscription_checkout(
  p_auth_user_id uuid,
  p_customer_account_id uuid,
  p_customer_id text,
  p_customer_email text,
  p_subscription_id text,
  p_price_id text,
  p_product text,
  p_billing_interval text,
  p_subscription_status text,
  p_cancel_at_period_end boolean,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_session_created_at timestamptz,
  p_livemode boolean
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    or p_price_id !~ '^price_[A-Za-z0-9]+$'
    or p_customer_email is null
    or p_customer_email <> lower(btrim(p_customer_email))
    or char_length(p_customer_email) not between 3 and 254
    or p_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_product not in ('monitor', 'growth')
    or p_billing_interval not in ('monthly', 'annual')
    or p_subscription_status not in ('active', 'trialing')
    or p_session_created_at is null
    or (p_current_period_start is not null and p_current_period_end is not null
      and p_current_period_end <= p_current_period_start)
  then
    raise exception 'Invalid verified subscription checkout';
  end if;

  if not exists (
    select 1
    from customer_accounts
    where id = p_customer_account_id
      and auth_user_id = p_auth_user_id
      and lower(email) = p_customer_email
      and (stripe_customer_id is null or stripe_customer_id = p_customer_id)
  ) then
    raise exception 'Subscription checkout account does not match the authenticated customer';
  end if;

  if exists (
    select 1 from customer_accounts
    where stripe_customer_id = p_customer_id
      and id <> p_customer_account_id
  ) or exists (
    select 1 from stripe_customers
    where stripe_customer_id = p_customer_id
      and email is not null
      and lower(email) <> p_customer_email
  ) or exists (
    select 1 from stripe_subscriptions
    where stripe_subscription_id = p_subscription_id
      and stripe_customer_id <> p_customer_id
  ) then
    raise exception 'Subscription checkout is already owned by another customer';
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
    raise exception 'Subscription checkout account could not be linked';
  end if;

  insert into stripe_subscriptions (
    stripe_subscription_id,
    stripe_customer_id,
    stripe_price_id,
    product,
    billing_interval,
    status,
    cancel_at_period_end,
    current_period_start,
    current_period_end,
    livemode,
    stripe_event_created_at
  ) values (
    p_subscription_id,
    p_customer_id,
    p_price_id,
    p_product,
    p_billing_interval,
    p_subscription_status,
    p_cancel_at_period_end,
    p_current_period_start,
    p_current_period_end,
    p_livemode,
    p_session_created_at
  )
  on conflict (stripe_subscription_id) do update set
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_price_id = excluded.stripe_price_id,
    product = excluded.product,
    billing_interval = excluded.billing_interval,
    status = excluded.status,
    cancel_at_period_end = excluded.cancel_at_period_end,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    livemode = excluded.livemode,
    stripe_event_created_at = greatest(stripe_subscriptions.stripe_event_created_at, excluded.stripe_event_created_at),
    updated_at = now();

  return exists (
    select 1
    from stripe_subscriptions
    where stripe_subscription_id = p_subscription_id
      and stripe_customer_id = p_customer_id
      and stripe_price_id = p_price_id
      and product = p_product
      and billing_interval = p_billing_interval
      and status in ('active', 'trialing')
  );
end;
$$;

revoke all on function fulfill_verified_subscription_checkout(
  uuid, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, boolean
) from public;
revoke all on function fulfill_verified_subscription_checkout(
  uuid, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, boolean
) from anon;
revoke all on function fulfill_verified_subscription_checkout(
  uuid, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, boolean
) from authenticated;
grant execute on function fulfill_verified_subscription_checkout(
  uuid, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz, timestamptz, boolean
) to service_role;
