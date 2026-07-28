-- Truthful, account-scoped demo access without fabricated Stripe records.
-- Apply after subscription-activation-recovery-hardening.sql.

create table if not exists public.customer_demo_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null
    references public.customer_accounts(id) on delete cascade,
  plan text not null check (plan = 'growth'),
  status text not null default 'active'
    check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  created_by text not null
    check (char_length(btrim(created_by)) between 1 and 120),
  note text not null
    check (char_length(btrim(note)) between 1 and 500),
  revoked_at timestamptz,
  revoked_by text
    check (revoked_by is null or char_length(btrim(revoked_by)) between 1 and 120),
  revocation_note text
    check (revocation_note is null or char_length(btrim(revocation_note)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_demo_entitlements_window_check check (
    expires_at > starts_at
    and expires_at <= starts_at + interval '90 days'
  ),
  constraint customer_demo_entitlements_revocation_check check (
    (
      status = 'revoked'
      and revoked_at is not null
      and revoked_by is not null
      and revocation_note is not null
    )
    or (
      status <> 'revoked'
      and revoked_at is null
      and revoked_by is null
      and revocation_note is null
    )
  )
);

create unique index if not exists customer_demo_entitlements_one_active_idx
  on public.customer_demo_entitlements(customer_account_id)
  where status = 'active';

create index if not exists customer_demo_entitlements_active_window_idx
  on public.customer_demo_entitlements(customer_account_id, starts_at, expires_at)
  where status = 'active';

alter table public.customer_demo_entitlements enable row level security;
revoke all on table public.customer_demo_entitlements
  from public, anon, authenticated, service_role;
grant select on table public.customer_demo_entitlements to service_role;

create table if not exists public.customer_demo_entitlement_scans (
  customer_demo_entitlement_id uuid not null
    references public.customer_demo_entitlements(id) on delete cascade,
  scan_id uuid not null
    references public.scans(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (customer_demo_entitlement_id, scan_id)
);

create index if not exists customer_demo_entitlement_scans_scan_idx
  on public.customer_demo_entitlement_scans(scan_id);

alter table public.customer_demo_entitlement_scans enable row level security;
revoke all on table public.customer_demo_entitlement_scans
  from public, anon, authenticated, service_role;
grant select on table public.customer_demo_entitlement_scans to service_role;

create or replace function public.grant_customer_demo_entitlement(
  p_customer_account_id uuid,
  p_plan text,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_created_by text,
  p_note text
) returns setof public.customer_demo_entitlements
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.customer_demo_entitlements%rowtype;
begin
  if p_customer_account_id is null
    or p_plan <> 'growth'
    or p_starts_at is null
    or p_expires_at is null
    or p_starts_at > now() + interval '5 minutes'
    or p_expires_at <= now()
    or p_expires_at <= p_starts_at
    or p_expires_at > p_starts_at + interval '90 days'
    or char_length(btrim(coalesce(p_created_by, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_note, ''))) not between 1 and 500
  then
    raise exception 'Invalid demo entitlement grant';
  end if;

  perform 1
  from public.customer_accounts account
  where account.id = p_customer_account_id
  for update;

  if not found then
    raise exception 'Demo customer account was not found';
  end if;

  update public.customer_demo_entitlements entitlement
  set status = 'expired',
      updated_at = now()
  where entitlement.customer_account_id = p_customer_account_id
    and entitlement.status = 'active'
    and entitlement.expires_at <= now();

  select entitlement.*
  into v_existing
  from public.customer_demo_entitlements entitlement
  where entitlement.customer_account_id = p_customer_account_id
    and entitlement.status = 'active'
    and entitlement.expires_at > now()
  for update;

  if found then
    return next v_existing;
    return;
  end if;

  return query
  insert into public.customer_demo_entitlements (
    customer_account_id,
    plan,
    status,
    starts_at,
    expires_at,
    created_by,
    note
  ) values (
    p_customer_account_id,
    p_plan,
    'active',
    p_starts_at,
    p_expires_at,
    btrim(p_created_by),
    btrim(p_note)
  )
  returning *;
end;
$$;

create or replace function public.revoke_customer_demo_entitlement(
  p_entitlement_id uuid,
  p_revoked_by text,
  p_revocation_note text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_entitlement_id is null
    or char_length(btrim(coalesce(p_revoked_by, ''))) not between 1 and 120
    or char_length(btrim(coalesce(p_revocation_note, ''))) not between 1 and 500
  then
    raise exception 'Invalid demo entitlement revocation';
  end if;

  update public.customer_demo_entitlements entitlement
  set status = 'revoked',
      revoked_at = now(),
      revoked_by = btrim(p_revoked_by),
      revocation_note = btrim(p_revocation_note),
      updated_at = now()
  where entitlement.id = p_entitlement_id
    and entitlement.status = 'active';

  return found;
end;
$$;

create or replace function public.assign_customer_demo_entitlement_scan(
  p_entitlement_id uuid,
  p_scan_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_entitlement_id is null or p_scan_id is null then
    raise exception 'Invalid demo entitlement scan assignment';
  end if;

  if not exists (
    select 1
    from public.customer_demo_entitlements entitlement
    join public.customer_scan_ownership ownership
      on ownership.customer_account_id = entitlement.customer_account_id
     and ownership.scan_id = p_scan_id
    join public.scans scan
      on scan.id = ownership.scan_id
     and scan.status = 'completed'
    where entitlement.id = p_entitlement_id
      and entitlement.plan = 'growth'
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and entitlement.expires_at > now()
  ) then
    raise exception 'Demo entitlement and owned completed scan did not match';
  end if;

  insert into public.customer_demo_entitlement_scans (
    customer_demo_entitlement_id,
    scan_id
  ) values (
    p_entitlement_id,
    p_scan_id
  )
  on conflict do nothing;

  return true;
end;
$$;

revoke all on function public.grant_customer_demo_entitlement(
  uuid, text, timestamptz, timestamptz, text, text
) from public, anon, authenticated;
revoke all on function public.revoke_customer_demo_entitlement(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.assign_customer_demo_entitlement_scan(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.grant_customer_demo_entitlement(
  uuid, text, timestamptz, timestamptz, text, text
) to service_role;
grant execute on function public.revoke_customer_demo_entitlement(uuid, text, text)
  to service_role;
grant execute on function public.assign_customer_demo_entitlement_scan(uuid, uuid)
  to service_role;

alter table public.monitored_profiles
  add column if not exists customer_demo_entitlement_id uuid
    references public.customer_demo_entitlements(id) on delete restrict;

alter table public.monitored_profiles
  alter column stripe_customer_id drop not null;

alter table public.monitored_profiles
  drop constraint if exists monitored_profiles_entitlement_source_check;
alter table public.monitored_profiles
  add constraint monitored_profiles_entitlement_source_check check (
    num_nonnulls(stripe_customer_id, customer_demo_entitlement_id) = 1
  );

create unique index if not exists monitored_profiles_demo_source_unique_idx
  on public.monitored_profiles(customer_demo_entitlement_id, source_scan_id)
  where customer_demo_entitlement_id is not null;

create index if not exists monitored_profiles_demo_entitlement_idx
  on public.monitored_profiles(customer_demo_entitlement_id)
  where customer_demo_entitlement_id is not null;

create or replace function public.monitored_profile_has_active_plan(
  p_profile_id uuid
) returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.monitored_profiles profile
    where profile.id = p_profile_id
      and (
        (
          profile.stripe_customer_id is not null
          and exists (
            select 1
            from public.stripe_subscriptions subscription
            where subscription.stripe_customer_id = profile.stripe_customer_id
              and subscription.livemode = true
              and subscription.status in ('active', 'trialing')
              and (
                (profile.cadence = 'daily' and subscription.product = 'growth')
                or (
                  profile.cadence = 'weekly'
                  and subscription.product in ('monitor', 'growth')
                )
              )
          )
        )
        or (
          profile.customer_demo_entitlement_id is not null
          and exists (
            select 1
            from public.customer_demo_entitlements entitlement
            join public.customer_demo_entitlement_scans entitlement_scan
              on entitlement_scan.customer_demo_entitlement_id = entitlement.id
             and entitlement_scan.scan_id = profile.source_scan_id
            join public.customer_monitored_profile_ownership ownership
              on ownership.monitored_profile_id = profile.id
             and ownership.customer_account_id = entitlement.customer_account_id
            where entitlement.plan = 'growth'
              and entitlement.status = 'active'
              and entitlement.starts_at <= now()
              and entitlement.expires_at > now()
          )
        )
      )
  );
$$;

revoke all on function public.monitored_profile_has_active_plan(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.claim_due_monitored_profiles(
  p_limit integer default 5
) returns setof public.monitored_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Invalid monitoring claim limit';
  end if;

  perform public.recover_stale_monitoring_claims(greatest(20, p_limit * 4));

  return query
  with due as (
    select profile.id
    from public.monitored_profiles profile
    where profile.status = 'active'
      and profile.dead_lettered_at is null
      and profile.failure_attempt_count < 5
      and profile.next_run_at <= now()
      and profile.lease_token is null
      and (profile.lease_expires_at is null or profile.lease_expires_at <= now())
      and public.monitored_profile_has_active_plan(profile.id)
    order by profile.next_run_at asc, profile.id asc
    for update skip locked
    limit p_limit
  )
  update public.monitored_profiles profile
  set lease_expires_at = now() + interval '2 minutes',
      lease_token = gen_random_uuid(),
      updated_at = now()
  from due
  where profile.id = due.id
  returning profile.*;
end;
$$;

create or replace function public.claim_monitored_profile_by_id(
  p_profile_id uuid
) returns setof public.monitored_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.recover_stale_monitoring_claims(20);

  return query
  update public.monitored_profiles profile
  set lease_expires_at = now() + interval '2 minutes',
      lease_token = gen_random_uuid(),
      updated_at = now()
  where profile.id = p_profile_id
    and profile.status = 'active'
    and profile.dead_lettered_at is null
    and profile.failure_attempt_count < 5
    and profile.lease_token is null
    and (profile.lease_expires_at is null or profile.lease_expires_at <= now())
    and public.monitored_profile_has_active_plan(profile.id)
  returning profile.*;
end;
$$;

create or replace function public.start_monitoring_profile_run(
  p_profile_id uuid,
  p_scan_id uuid,
  p_lease_token uuid
) returns setof public.monitoring_runs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_lease_token is null then
    raise exception 'Monitoring lease token is required';
  end if;

  return query
  insert into public.monitoring_runs (
    monitored_profile_id,
    scan_id,
    status,
    claim_token
  )
  select p_profile_id, p_scan_id, 'running', p_lease_token
  from public.monitored_profiles profile
  where profile.id = p_profile_id
    and profile.status = 'active'
    and profile.dead_lettered_at is null
    and profile.lease_token = p_lease_token
    and public.monitored_profile_has_active_plan(profile.id)
  on conflict (monitored_profile_id, claim_token)
    where claim_token is not null
    do nothing
  returning monitoring_runs.*;
end;
$$;

create or replace function public.complete_monitoring_profile_run(
  p_profile_id uuid,
  p_run_id uuid,
  p_scan_id uuid,
  p_lease_token uuid,
  p_new_opportunity_count integer,
  p_alerts jsonb,
  p_completed_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.monitored_profiles%rowtype;
begin
  if p_lease_token is null
    or p_new_opportunity_count < 0
    or jsonb_typeof(p_alerts) <> 'array'
  then
    raise exception 'Invalid monitoring completion';
  end if;

  select profile.* into v_profile
  from public.monitored_profiles profile
  where profile.id = p_profile_id
    and profile.lease_token = p_lease_token
    and profile.dead_lettered_at is null
  for update;

  if not found then
    return false;
  end if;

  if v_profile.stripe_customer_id is not null then
    perform 1
    from public.stripe_subscriptions subscription
    where subscription.stripe_customer_id = v_profile.stripe_customer_id
      and subscription.livemode = true
      and subscription.status in ('active', 'trialing')
      and (
        (v_profile.cadence = 'daily' and subscription.product = 'growth')
        or (
          v_profile.cadence = 'weekly'
          and subscription.product in ('monitor', 'growth')
        )
      )
    for share of subscription;
  elsif v_profile.customer_demo_entitlement_id is not null then
    perform 1
    from public.customer_demo_entitlements entitlement
    join public.customer_demo_entitlement_scans entitlement_scan
      on entitlement_scan.customer_demo_entitlement_id = entitlement.id
     and entitlement_scan.scan_id = v_profile.source_scan_id
    join public.customer_monitored_profile_ownership ownership
      on ownership.monitored_profile_id = v_profile.id
     and ownership.customer_account_id = entitlement.customer_account_id
    where entitlement.plan = 'growth'
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and entitlement.expires_at > now()
    for share of entitlement;
  else
    return false;
  end if;

  if not found then
    return false;
  end if;

  if not exists (
    select 1
    from public.monitoring_runs run
    where run.id = p_run_id
      and run.monitored_profile_id = p_profile_id
      and run.scan_id = p_scan_id
      and run.claim_token = p_lease_token
      and run.status = 'running'
  ) then
    return false;
  end if;

  if jsonb_array_length(p_alerts) > 0 then
    perform public.record_monitoring_alerts(p_run_id, p_profile_id, p_alerts);
  end if;

  update public.monitoring_runs
  set status = 'completed',
      new_opportunity_count = p_new_opportunity_count,
      completed_at = p_completed_at,
      error_message = null
  where id = p_run_id;

  update public.monitored_profiles
  set latest_scan_id = p_scan_id,
      last_run_at = p_completed_at,
      next_run_at = p_completed_at + case v_profile.cadence
        when 'daily' then interval '1 day'
        else interval '7 days'
      end,
      failure_attempt_count = 0,
      last_failure_at = null,
      last_error = null,
      dead_lettered_at = null,
      lease_expires_at = null,
      lease_token = null,
      updated_at = p_completed_at
  where id = p_profile_id
    and lease_token = p_lease_token;

  return found;
end;
$$;

-- The prior monitoring alert claim returned customer_account_id. PostgreSQL
-- cannot replace a function when its OUT row shape changes, so recreate it.
drop function if exists public.claim_pending_monitoring_alerts(integer);
create or replace function public.claim_pending_monitoring_alerts(
  p_limit integer default 5
) returns table (
  alert_id uuid,
  monitoring_run_id uuid,
  scan_id uuid,
  recipient_email text,
  opportunity_title text,
  agency_or_funder text,
  deadline text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Invalid monitoring alert claim limit';
  end if;

  return query
  with due as (
    select alert.id
    from public.monitoring_alerts alert
    join public.monitored_profiles profile
      on profile.id = alert.monitored_profile_id
    left join public.stripe_customers customer
      on customer.stripe_customer_id = profile.stripe_customer_id
    left join public.customer_monitored_profile_ownership ownership
      on ownership.monitored_profile_id = profile.id
    left join public.customer_accounts account
      on account.id = ownership.customer_account_id
    where alert.delivery_status = 'pending'
      and alert.attempt_count < 5
      and (alert.next_attempt_at is null or alert.next_attempt_at <= now())
      and (alert.delivery_lease_expires_at is null or alert.delivery_lease_expires_at <= now())
      and public.monitored_profile_has_active_plan(profile.id)
      and (
        (
          profile.stripe_customer_id is not null
          and customer.deleted_at is null
          and customer.email is not null
          and customer.email like '%@%'
        )
        or (
          profile.customer_demo_entitlement_id is not null
          and account.email is not null
          and account.email like '%@%'
        )
      )
    order by alert.created_at asc
    for update of alert skip locked
    limit p_limit
  ), claimed as (
    update public.monitoring_alerts alert
    set delivery_lease_expires_at = now() + interval '10 minutes',
        last_attempt_at = now(),
        attempt_count = alert.attempt_count + 1
    from due
    where alert.id = due.id
    returning alert.*
  )
  select
    claimed.id,
    claimed.monitoring_run_id,
    run.scan_id,
    case
      when profile.stripe_customer_id is not null then customer.email
      else account.email
    end,
    opportunity.title,
    opportunity.agency,
    opportunity.deadline,
    claimed.attempt_count
  from claimed
  join public.monitoring_runs run
    on run.id = claimed.monitoring_run_id
  join public.monitored_profiles profile
    on profile.id = claimed.monitored_profile_id
  left join public.stripe_customers customer
    on customer.stripe_customer_id = profile.stripe_customer_id
  left join public.customer_monitored_profile_ownership ownership
    on ownership.monitored_profile_id = profile.id
  left join public.customer_accounts account
    on account.id = ownership.customer_account_id
  join public.opportunities opportunity
    on opportunity.id = claimed.opportunity_id;
end;
$$;

create or replace function public.create_customer_monitored_search(
  p_auth_user_id uuid,
  p_scan_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.customer_accounts%rowtype;
  v_subscription public.stripe_subscriptions%rowtype;
  v_demo public.customer_demo_entitlements%rowtype;
  v_scan public.scans%rowtype;
  v_plan text;
  v_entitlement_source text;
  v_limit integer;
  v_saved_search_id uuid;
  v_version_id uuid;
  v_profile_id uuid;
  v_search_name text;
begin
  select account.*
  into v_account
  from public.customer_accounts account
  where account.auth_user_id = p_auth_user_id
  for update;

  if not found then
    return jsonb_build_object('error_code', 'AUTHENTICATION_REQUIRED');
  end if;

  if v_account.stripe_customer_id is not null then
    select subscription.*
    into v_subscription
    from public.stripe_subscriptions subscription
    where subscription.stripe_customer_id = v_account.stripe_customer_id
      and subscription.livemode = true
      and subscription.status in ('active', 'trialing')
      and subscription.product in ('monitor', 'growth')
    order by subscription.created_at desc
    limit 1
    for share;
  end if;

  if v_subscription.stripe_subscription_id is not null then
    v_plan := v_subscription.product;
    v_entitlement_source := 'stripe';
  else
    select entitlement.*
    into v_demo
    from public.customer_demo_entitlements entitlement
    where entitlement.customer_account_id = v_account.id
      and entitlement.plan = 'growth'
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and entitlement.expires_at > now()
    order by entitlement.expires_at desc
    limit 1
    for share;

    if not found then
      return jsonb_build_object('error_code', 'PLAN_REQUIRED');
    end if;

    v_plan := v_demo.plan;
    v_entitlement_source := 'demo';
  end if;

  v_limit := case when v_plan = 'growth' then 3 else 1 end;
  if (
    select count(*)
    from public.customer_monitored_profile_ownership ownership
    join public.monitored_profiles profile
      on profile.id = ownership.monitored_profile_id
    where ownership.customer_account_id = v_account.id
      and profile.status <> 'canceled'
  ) >= v_limit then
    return jsonb_build_object('error_code', 'LIMIT_REACHED');
  end if;

  select scan.*
  into v_scan
  from public.scans scan
  join public.customer_scan_ownership ownership
    on ownership.scan_id = scan.id
   and ownership.customer_account_id = v_account.id
  where scan.id = p_scan_id
    and scan.status = 'completed'
    and (
      v_entitlement_source <> 'demo'
      or exists (
        select 1
        from public.customer_demo_entitlement_scans entitlement_scan
        where entitlement_scan.customer_demo_entitlement_id = v_demo.id
          and entitlement_scan.scan_id = scan.id
      )
    )
    and not exists (
      select 1
      from public.customer_monitored_profile_ownership profile_ownership
      join public.monitored_profiles profile
        on profile.id = profile_ownership.monitored_profile_id
      where profile_ownership.customer_account_id = v_account.id
        and profile.source_scan_id = scan.id
        and profile.status <> 'canceled'
    )
    and not exists (
      select 1
      from public.customer_scan_saved_search_versions scan_version
      where scan_version.scan_id = scan.id
    )
  for share of scan;

  if not found then
    return jsonb_build_object('error_code', 'REPORT_NOT_ELIGIBLE');
  end if;

  v_search_name := left(
    coalesce(
      nullif(btrim(v_scan.company_name), ''),
      nullif(
        regexp_replace(v_scan.company_url, '^https?://(www\.)?|/.*$', '', 'gi'),
        ''
      ),
      'Saved search'
    ),
    120
  );

  insert into public.customer_saved_searches (
    customer_account_id,
    name,
    status
  ) values (
    v_account.id,
    v_search_name,
    'active'
  )
  returning id into v_saved_search_id;

  insert into public.customer_saved_search_versions (
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
  )
  returning id into v_version_id;

  update public.customer_saved_searches
  set current_version_id = v_version_id,
      updated_at = now()
  where id = v_saved_search_id;

  insert into public.monitored_profiles (
    stripe_customer_id,
    customer_demo_entitlement_id,
    source_scan_id,
    latest_scan_id,
    cadence,
    status,
    next_run_at
  ) values (
    case when v_entitlement_source = 'stripe' then v_account.stripe_customer_id end,
    case when v_entitlement_source = 'demo' then v_demo.id end,
    p_scan_id,
    p_scan_id,
    case when v_plan = 'growth' then 'daily' else 'weekly' end,
    'active',
    now()
  )
  returning id into v_profile_id;

  insert into public.customer_scan_saved_search_versions (
    scan_id,
    saved_search_version_id
  ) values (
    p_scan_id,
    v_version_id
  );

  insert into public.customer_monitored_profile_ownership (
    customer_account_id,
    monitored_profile_id
  ) values (
    v_account.id,
    v_profile_id
  );

  insert into public.customer_monitored_profile_saved_search_versions (
    monitored_profile_id,
    saved_search_version_id
  ) values (
    v_profile_id,
    v_version_id
  );

  return jsonb_build_object(
    'saved_search_id', v_saved_search_id,
    'entitlement_source', v_entitlement_source
  );
end;
$$;

create or replace function public.get_monitoring_queue_health()
returns table (
  backlog_count bigint,
  oldest_due_at timestamptz,
  oldest_due_age_seconds bigint,
  leased_count bigint,
  stale_lease_count bigint,
  retrying_count bigint,
  dead_letter_count bigint,
  last_success_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with entitled as (
    select profile.*
    from public.monitored_profiles profile
    where profile.status = 'active'
      and public.monitored_profile_has_active_plan(profile.id)
  ), aggregate_profiles as (
    select
      count(*) filter (
        where dead_lettered_at is null
          and next_run_at <= now()
          and (lease_token is null or lease_expires_at <= now())
      ) as backlog_count,
      min(next_run_at) filter (
        where dead_lettered_at is null
          and next_run_at <= now()
          and (lease_token is null or lease_expires_at <= now())
      ) as oldest_due_at,
      count(*) filter (
        where lease_token is not null and lease_expires_at > now()
      ) as leased_count,
      count(*) filter (
        where lease_token is not null and lease_expires_at <= now()
      ) as stale_lease_count,
      count(*) filter (
        where dead_lettered_at is null and failure_attempt_count between 1 and 4
      ) as retrying_count,
      count(*) filter (where dead_lettered_at is not null) as dead_letter_count
    from entitled
  )
  select
    aggregate_profiles.backlog_count,
    aggregate_profiles.oldest_due_at,
    case
      when aggregate_profiles.oldest_due_at is null then null
      else greatest(
        0,
        extract(epoch from (now() - aggregate_profiles.oldest_due_at))::bigint
      )
    end,
    aggregate_profiles.leased_count,
    aggregate_profiles.stale_lease_count,
    aggregate_profiles.retrying_count,
    aggregate_profiles.dead_letter_count,
    (
      select max(run.completed_at)
      from public.monitoring_runs run
      where run.status = 'completed'
    )
  from aggregate_profiles;
$$;

revoke all on function public.claim_due_monitored_profiles(integer)
  from public, anon, authenticated;
revoke all on function public.claim_monitored_profile_by_id(uuid)
  from public, anon, authenticated;
revoke all on function public.start_monitoring_profile_run(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.complete_monitoring_profile_run(
  uuid, uuid, uuid, uuid, integer, jsonb, timestamptz
) from public, anon, authenticated;
revoke all on function public.claim_pending_monitoring_alerts(integer)
  from public, anon, authenticated;
revoke all on function public.create_customer_monitored_search(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.get_monitoring_queue_health()
  from public, anon, authenticated;

grant execute on function public.claim_due_monitored_profiles(integer)
  to service_role;
grant execute on function public.claim_monitored_profile_by_id(uuid)
  to service_role;
grant execute on function public.start_monitoring_profile_run(uuid, uuid, uuid)
  to service_role;
grant execute on function public.complete_monitoring_profile_run(
  uuid, uuid, uuid, uuid, integer, jsonb, timestamptz
) to service_role;
grant execute on function public.claim_pending_monitoring_alerts(integer)
  to service_role;
grant execute on function public.create_customer_monitored_search(uuid, uuid)
  to service_role;
grant execute on function public.get_monitoring_queue_health()
  to service_role;
