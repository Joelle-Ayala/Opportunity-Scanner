alter table public.monitored_profiles
  add column if not exists failure_attempt_count integer not null default 0,
  add column if not exists last_failure_at timestamptz,
  add column if not exists last_error text,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists lease_token uuid;

alter table public.monitoring_runs
  add column if not exists claim_token uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monitored_profiles_failure_attempt_count_check'
      and conrelid = 'public.monitored_profiles'::regclass
  ) then
    alter table public.monitored_profiles
      add constraint monitored_profiles_failure_attempt_count_check
      check (failure_attempt_count between 0 and 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'monitored_profiles_last_error_check'
      and conrelid = 'public.monitored_profiles'::regclass
  ) then
    alter table public.monitored_profiles
      add constraint monitored_profiles_last_error_check
      check (last_error is null or char_length(last_error) <= 500);
  end if;
end;
$$;

update public.monitored_profiles
set lease_token = gen_random_uuid()
where lease_expires_at is not null
  and lease_token is null;

create index if not exists monitored_profiles_reliable_due_idx
  on public.monitored_profiles(next_run_at, failure_attempt_count)
  where status = 'active' and dead_lettered_at is null;

create index if not exists monitored_profiles_dead_letter_idx
  on public.monitored_profiles(dead_lettered_at)
  where dead_lettered_at is not null;

create index if not exists monitoring_runs_claim_token_idx
  on public.monitoring_runs(monitored_profile_id, claim_token)
  where status = 'running';

create unique index if not exists monitoring_runs_profile_claim_unique_idx
  on public.monitoring_runs(monitored_profile_id, claim_token)
  where claim_token is not null;

create or replace function public.monitoring_retry_delay(p_failure_attempt_count integer)
returns interval
language sql
immutable
strict
set search_path = public, pg_temp
as $$
  select make_interval(
    mins => least(120, 15 * (2 ^ greatest(0, p_failure_attempt_count - 1))::integer)
  );
$$;

create or replace function public.recover_stale_monitoring_claims(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recovered integer := 0;
begin
  if p_limit < 1 or p_limit > 500 then
    raise exception 'Invalid stale monitoring recovery limit';
  end if;

  update public.monitored_profiles profile
  set lease_token = null,
      updated_at = now()
  where profile.lease_token is not null
    and profile.lease_expires_at is null
    and not exists (
      select 1
      from public.monitoring_runs run
      where run.monitored_profile_id = profile.id
        and run.claim_token = profile.lease_token
        and run.status = 'running'
    );

  with stale as (
    select profile.id, profile.lease_token, profile.failure_attempt_count
    from public.monitored_profiles profile
    where profile.status = 'active'
      and profile.dead_lettered_at is null
      and profile.lease_token is not null
      and profile.lease_expires_at <= now()
    order by profile.lease_expires_at asc
    for update skip locked
    limit p_limit
  ), failed_runs as (
    update public.monitoring_runs run
    set status = 'failed',
        error_message = 'Monitoring worker lease expired before completion.',
        completed_at = now()
    from stale
    where run.monitored_profile_id = stale.id
      and (run.claim_token = stale.lease_token or run.claim_token is null)
      and run.status = 'running'
    returning run.id
  ), recovered as (
    update public.monitored_profiles profile
    set failure_attempt_count = least(profile.failure_attempt_count + 1, 5),
        last_failure_at = now(),
        last_error = 'Monitoring worker lease expired before completion.',
        dead_lettered_at = case
          when profile.failure_attempt_count + 1 >= 5 then now()
          else null
        end,
        next_run_at = case
          when profile.failure_attempt_count + 1 >= 5 then profile.next_run_at
          else now() + public.monitoring_retry_delay(profile.failure_attempt_count + 1)
        end,
        lease_expires_at = null,
        lease_token = null,
        updated_at = now()
    from stale
    where profile.id = stale.id
      and profile.lease_token = stale.lease_token
    returning profile.id
  )
  select count(*) into v_recovered from recovered;

  return v_recovered;
end;
$$;

create or replace function public.claim_due_monitored_profiles(p_limit integer default 5)
returns setof public.monitored_profiles
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
      and exists (
        select 1
        from public.stripe_subscriptions subscription
        where subscription.stripe_customer_id = profile.stripe_customer_id
          and subscription.status in ('active', 'trialing')
          and (
            (profile.cadence = 'daily' and subscription.product = 'growth')
            or (profile.cadence = 'weekly' and subscription.product in ('monitor', 'growth'))
          )
      )
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

create or replace function public.claim_monitored_profile_by_id(p_profile_id uuid)
returns setof public.monitored_profiles
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
    and exists (
      select 1
      from public.stripe_subscriptions subscription
      where subscription.stripe_customer_id = profile.stripe_customer_id
        and subscription.status in ('active', 'trialing')
        and (
          (profile.cadence = 'daily' and subscription.product = 'growth')
          or (profile.cadence = 'weekly' and subscription.product in ('monitor', 'growth'))
        )
    )
  returning profile.*;
end;
$$;

create or replace function public.start_monitoring_profile_run(
  p_profile_id uuid,
  p_scan_id uuid,
  p_lease_token uuid
)
returns setof public.monitoring_runs
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

create or replace function public.fail_monitoring_profile_run(
  p_profile_id uuid,
  p_run_id uuid,
  p_lease_token uuid,
  p_error_message text,
  p_failed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.monitored_profiles%rowtype;
  v_attempt_count integer;
  v_message text;
  v_next_run_at timestamptz;
  v_dead_lettered_at timestamptz;
begin
  if p_lease_token is null then
    raise exception 'Monitoring lease token is required';
  end if;

  v_message := left(coalesce(nullif(btrim(p_error_message), ''), 'Monitoring run failed.'), 500);

  select profile.* into v_profile
  from public.monitored_profiles profile
  where profile.id = p_profile_id
    and profile.lease_token = p_lease_token
    and profile.dead_lettered_at is null
  for update;

  if not found then
    return jsonb_build_object('finalized', false);
  end if;

  if p_run_id is not null and not exists (
    select 1
    from public.monitoring_runs run
    where run.id = p_run_id
      and run.monitored_profile_id = p_profile_id
      and run.claim_token = p_lease_token
      and run.status = 'running'
  ) then
    return jsonb_build_object('finalized', false);
  end if;

  v_attempt_count := least(v_profile.failure_attempt_count + 1, 5);
  v_dead_lettered_at := case when v_attempt_count >= 5 then p_failed_at else null end;
  v_next_run_at := case
    when v_attempt_count >= 5 then v_profile.next_run_at
    else p_failed_at + public.monitoring_retry_delay(v_attempt_count)
  end;

  if p_run_id is not null then
    update public.monitoring_runs run
    set status = 'failed',
        error_message = v_message,
        completed_at = p_failed_at
    where run.id = p_run_id
      and run.monitored_profile_id = p_profile_id
      and run.claim_token = p_lease_token
      and run.status = 'running';
  end if;

  update public.monitored_profiles
  set failure_attempt_count = v_attempt_count,
      last_failure_at = p_failed_at,
      last_error = v_message,
      dead_lettered_at = v_dead_lettered_at,
      next_run_at = v_next_run_at,
      lease_expires_at = null,
      lease_token = null,
      updated_at = p_failed_at
  where id = p_profile_id
    and lease_token = p_lease_token;

  return jsonb_build_object(
    'finalized', found,
    'attemptCount', v_attempt_count,
    'nextRunAt', case when v_dead_lettered_at is null then v_next_run_at else null end,
    'deadLetteredAt', v_dead_lettered_at
  );
end;
$$;

create or replace function public.release_monitoring_profile_claim(
  p_profile_id uuid,
  p_lease_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.monitored_profiles profile
  set lease_expires_at = null,
      lease_token = null,
      updated_at = now()
  where profile.id = p_profile_id
    and profile.lease_token = p_lease_token
    and not exists (
      select 1
      from public.monitoring_runs run
      where run.monitored_profile_id = profile.id
        and run.claim_token = p_lease_token
        and run.status = 'running'
    );

  return found;
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
      and exists (
        select 1
        from public.stripe_subscriptions subscription
        where subscription.stripe_customer_id = profile.stripe_customer_id
          and subscription.status in ('active', 'trialing')
          and (
            (profile.cadence = 'daily' and subscription.product = 'growth')
            or (profile.cadence = 'weekly' and subscription.product in ('monitor', 'growth'))
          )
      )
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
      else greatest(0, extract(epoch from (now() - aggregate_profiles.oldest_due_at))::bigint)
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

revoke all on function public.monitoring_retry_delay(integer) from public, anon, authenticated;
revoke all on function public.recover_stale_monitoring_claims(integer) from public, anon, authenticated;
revoke all on function public.claim_due_monitored_profiles(integer) from public, anon, authenticated;
revoke all on function public.claim_monitored_profile_by_id(uuid) from public, anon, authenticated;
revoke all on function public.start_monitoring_profile_run(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_monitoring_profile_run(uuid, uuid, uuid, uuid, integer, jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_monitoring_profile_run(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.release_monitoring_profile_claim(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_monitoring_queue_health() from public, anon, authenticated;

grant execute on function public.recover_stale_monitoring_claims(integer) to service_role;
grant execute on function public.claim_due_monitored_profiles(integer) to service_role;
grant execute on function public.claim_monitored_profile_by_id(uuid) to service_role;
grant execute on function public.start_monitoring_profile_run(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_monitoring_profile_run(uuid, uuid, uuid, uuid, integer, jsonb, timestamptz) to service_role;
grant execute on function public.fail_monitoring_profile_run(uuid, uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.release_monitoring_profile_claim(uuid, uuid) to service_role;
grant execute on function public.get_monitoring_queue_health() to service_role;
