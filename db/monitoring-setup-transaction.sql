-- Atomically turn one completed, account-owned report into a monitored saved search.
-- Apply after customer-dashboard.sql and customer-owned-report-access.sql.

create or replace function create_customer_monitored_search(
  p_auth_user_id uuid,
  p_scan_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account customer_accounts%rowtype;
  v_subscription stripe_subscriptions%rowtype;
  v_scan scans%rowtype;
  v_limit integer;
  v_saved_search_id uuid;
  v_version_id uuid;
  v_profile_id uuid;
  v_search_name text;
begin
  select account.*
  into v_account
  from customer_accounts account
  where account.auth_user_id = p_auth_user_id
  for update;

  if not found then
    return jsonb_build_object('error_code', 'AUTHENTICATION_REQUIRED');
  end if;

  if v_account.stripe_customer_id is null then
    return jsonb_build_object('error_code', 'PLAN_REQUIRED');
  end if;

  select subscription.*
  into v_subscription
  from stripe_subscriptions subscription
  where subscription.stripe_customer_id = v_account.stripe_customer_id
    and subscription.status in ('active', 'trialing')
    and subscription.product in ('monitor', 'growth')
  order by subscription.created_at desc
  limit 1
  for share;

  if not found then
    return jsonb_build_object('error_code', 'PLAN_REQUIRED');
  end if;

  v_limit := case when v_subscription.product = 'growth' then 3 else 1 end;
  if (
    select count(*)
    from customer_monitored_profile_ownership ownership
    join monitored_profiles profile on profile.id = ownership.monitored_profile_id
    where ownership.customer_account_id = v_account.id
      and profile.status <> 'canceled'
  ) >= v_limit then
    return jsonb_build_object('error_code', 'LIMIT_REACHED');
  end if;

  select scan.*
  into v_scan
  from scans scan
  join customer_scan_ownership ownership
    on ownership.scan_id = scan.id
   and ownership.customer_account_id = v_account.id
  where scan.id = p_scan_id
    and scan.status = 'completed'
    and not exists (
      select 1
      from monitored_profiles profile
      where profile.stripe_customer_id = v_account.stripe_customer_id
        and profile.source_scan_id = scan.id
    )
    and not exists (
      select 1
      from customer_scan_saved_search_versions scan_version
      where scan_version.scan_id = scan.id
    )
  for share of scan;

  if not found then
    return jsonb_build_object('error_code', 'REPORT_NOT_ELIGIBLE');
  end if;

  v_search_name := left(
    coalesce(
      nullif(btrim(v_scan.company_name), ''),
      nullif(regexp_replace(v_scan.company_url, '^https?://(www\.)?|/.*$', '', 'gi'), ''),
      'Saved search'
    ),
    120
  );

  insert into customer_saved_searches (customer_account_id, name, status)
  values (v_account.id, v_search_name, 'active')
  returning id into v_saved_search_id;

  insert into customer_saved_search_versions (
    saved_search_id,
    version,
    configuration,
    created_by_auth_user_id
  ) values (
    v_saved_search_id,
    1,
    jsonb_build_object(
      'companyUrl', v_scan.company_url,
      'industry', v_scan.industry,
      'headquartersState', v_scan.headquarters_state,
      'targetStates', v_scan.target_states,
      'customerType', v_scan.customer_type,
      'opportunityFocus', v_scan.opportunity_focus,
      'includeTerms', v_scan.include_terms,
      'excludeTerms', v_scan.exclude_terms,
      'prioritySignals', v_scan.priority_signals
    ),
    p_auth_user_id
  ) returning id into v_version_id;

  update customer_saved_searches
  set current_version_id = v_version_id,
      updated_at = now()
  where id = v_saved_search_id;

  insert into monitored_profiles (
    stripe_customer_id,
    source_scan_id,
    latest_scan_id,
    cadence,
    status,
    next_run_at
  ) values (
    v_account.stripe_customer_id,
    p_scan_id,
    p_scan_id,
    case when v_subscription.product = 'growth' then 'daily' else 'weekly' end,
    'active',
    now()
  ) returning id into v_profile_id;

  insert into customer_scan_saved_search_versions (scan_id, saved_search_version_id)
  values (p_scan_id, v_version_id);

  insert into customer_monitored_profile_ownership (customer_account_id, monitored_profile_id)
  values (v_account.id, v_profile_id);

  insert into customer_monitored_profile_saved_search_versions (
    monitored_profile_id,
    saved_search_version_id
  ) values (v_profile_id, v_version_id);

  return jsonb_build_object('saved_search_id', v_saved_search_id);
end;
$$;

revoke all on function create_customer_monitored_search(uuid, uuid) from public;
revoke all on function create_customer_monitored_search(uuid, uuid) from anon;
revoke all on function create_customer_monitored_search(uuid, uuid) from authenticated;
grant execute on function create_customer_monitored_search(uuid, uuid) to service_role;
