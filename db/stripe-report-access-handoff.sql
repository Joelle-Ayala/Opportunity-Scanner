create or replace function fulfill_verified_report_checkout(
  p_scan_id uuid,
  p_customer_id text,
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
    or p_checkout_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9]+$'
    or p_payment_intent_id !~ '^pi_[A-Za-z0-9]+$'
    or p_session_created_at is null
  then
    raise exception 'Invalid verified Report checkout';
  end if;

  insert into stripe_customers (
    stripe_customer_id,
    livemode,
    stripe_event_created_at
  ) values (
    p_customer_id,
    p_livemode,
    p_session_created_at
  )
  on conflict (stripe_customer_id) do nothing;

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

revoke all on function fulfill_verified_report_checkout(uuid, text, text, text, timestamptz, boolean) from public;
revoke all on function fulfill_verified_report_checkout(uuid, text, text, text, timestamptz, boolean) from anon;
revoke all on function fulfill_verified_report_checkout(uuid, text, text, text, timestamptz, boolean) from authenticated;
grant execute on function fulfill_verified_report_checkout(uuid, text, text, text, timestamptz, boolean) to service_role;
