-- Recover every active one-time Report purchase for a confirmed account email, even when
-- anonymous Checkout sessions created different Stripe Customer records.
-- Apply after stripe-report-payment-lifecycle.sql.

create or replace function public.claim_active_report_purchases_by_verified_email(
  p_auth_user_id uuid,
  p_customer_account_id uuid,
  p_scan_id uuid default null
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_email text;
  v_claimed_count integer := 0;
  v_grant record;
begin
  select account.email
  into v_account_email
  from public.customer_accounts account
  join auth.users auth_user
    on auth_user.id = account.auth_user_id
  where account.id = p_customer_account_id
    and account.auth_user_id = p_auth_user_id
    and auth_user.email_confirmed_at is not null
    and lower(btrim(auth_user.email)) = account.email
  for update of account;

  if v_account_email is null then
    return 0;
  end if;

  for v_grant in
    select report_grant.id, report_grant.scan_id
    from public.stripe_report_access_grants report_grant
    where report_grant.status = 'active'
      and report_grant.purchase_email = v_account_email
      and (p_scan_id is null or report_grant.scan_id = p_scan_id)
    order by report_grant.granted_at, report_grant.id
    for update of report_grant
  loop
    -- Ownership is immutable across accounts. A conflict leaves both records untouched.
    if exists (
      select 1
      from public.customer_report_grant_ownership grant_ownership
      where grant_ownership.report_access_grant_id = v_grant.id
        and grant_ownership.customer_account_id <> p_customer_account_id
    ) or exists (
      select 1
      from public.customer_scan_ownership scan_ownership
      where scan_ownership.scan_id = v_grant.scan_id
        and scan_ownership.customer_account_id <> p_customer_account_id
    ) then
      continue;
    end if;

    -- The active grant remains the paid entitlement. This row only scopes the report
    -- into the verified account's dashboard and does not preserve refunded access.
    insert into public.customer_scan_ownership (
      customer_account_id,
      scan_id,
      ownership_kind,
      access_level
    ) values (
      p_customer_account_id,
      v_grant.scan_id,
      'claimed',
      'free'
    )
    on conflict (scan_id) do nothing;

    -- Re-check after the insert so a concurrent scan claim can never attach this grant
    -- across account boundaries.
    if not exists (
      select 1
      from public.customer_scan_ownership scan_ownership
      where scan_ownership.customer_account_id = p_customer_account_id
        and scan_ownership.scan_id = v_grant.scan_id
    ) then
      continue;
    end if;

    insert into public.customer_report_grant_ownership (
      customer_account_id,
      report_access_grant_id
    ) values (
      p_customer_account_id,
      v_grant.id
    )
    on conflict (report_access_grant_id) do nothing;

    if exists (
      select 1
      from public.customer_report_grant_ownership grant_ownership
      join public.customer_scan_ownership scan_ownership
        on scan_ownership.customer_account_id = grant_ownership.customer_account_id
       and scan_ownership.scan_id = v_grant.scan_id
      where grant_ownership.customer_account_id = p_customer_account_id
        and grant_ownership.report_access_grant_id = v_grant.id
    ) then
      v_claimed_count := v_claimed_count + 1;
    end if;
  end loop;

  return v_claimed_count;
end;
$$;

-- Preserve report-email claim links, but route them through the same verified-email
-- ownership rules and keep their effect scoped to the requested report.
create or replace function public.claim_active_report_purchase_by_email(
  p_auth_user_id uuid,
  p_customer_account_id uuid,
  p_scan_id uuid
) returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.claim_active_report_purchases_by_verified_email(
    p_auth_user_id,
    p_customer_account_id,
    p_scan_id
  ) > 0;
$$;

revoke all on function public.claim_active_report_purchases_by_verified_email(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_active_report_purchase_by_email(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.claim_active_report_purchases_by_verified_email(uuid, uuid, uuid)
  to service_role;
grant execute on function public.claim_active_report_purchase_by_email(uuid, uuid, uuid)
  to service_role;
