alter table monitoring_alerts
  add column if not exists monitored_profile_id uuid references monitored_profiles(id) on delete cascade,
  add column if not exists dedupe_key text,
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists delivery_lease_expires_at timestamptz,
  add column if not exists provider_message_id text,
  add column if not exists last_error text check (last_error is null or char_length(last_error) <= 500);

update monitoring_alerts alert
set monitored_profile_id = run.monitored_profile_id,
    dedupe_key = coalesce(alert.dedupe_key, 'opportunity:' || alert.opportunity_id::text)
from monitoring_runs run
where alert.monitoring_run_id = run.id
  and (alert.monitored_profile_id is null or alert.dedupe_key is null);

with duplicates as (
  select id,
    row_number() over (
      partition by monitored_profile_id, alert_kind, dedupe_key
      order by created_at asc, id asc
    ) as duplicate_rank
  from monitoring_alerts
  where monitored_profile_id is not null and dedupe_key is not null
)
delete from monitoring_alerts alert
using duplicates
where alert.id = duplicates.id and duplicates.duplicate_rank > 1;

create unique index if not exists monitoring_alerts_profile_dedupe_idx
  on monitoring_alerts(monitored_profile_id, alert_kind, dedupe_key)
  where monitored_profile_id is not null and dedupe_key is not null;

create index if not exists monitoring_alerts_pending_delivery_idx
  on monitoring_alerts(delivery_status, next_attempt_at, created_at)
  where delivery_status = 'pending';

create or replace function record_monitoring_alerts(
  p_monitoring_run_id uuid,
  p_monitored_profile_id uuid,
  p_alerts jsonb
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted integer;
begin
  if jsonb_typeof(p_alerts) <> 'array'
    or not exists (
      select 1 from monitoring_runs run
      where run.id = p_monitoring_run_id
        and run.monitored_profile_id = p_monitored_profile_id
    )
  then
    raise exception 'Invalid monitoring alert batch';
  end if;

  with candidates as (
    select distinct
      (item->>'opportunity_id')::uuid as opportunity_id,
      left(item->>'dedupe_key', 1000) as dedupe_key
    from jsonb_array_elements(p_alerts) item
    where coalesce(item->>'dedupe_key', '') <> ''
  ), inserted as (
    insert into monitoring_alerts (
      monitoring_run_id,
      monitored_profile_id,
      opportunity_id,
      alert_kind,
      delivery_status,
      dedupe_key
    )
    select
      p_monitoring_run_id,
      p_monitored_profile_id,
      candidate.opportunity_id,
      'new_opportunity',
      'pending',
      candidate.dedupe_key
    from candidates candidate
    join monitoring_runs run on run.id = p_monitoring_run_id
    join scan_opportunities scan_opportunity
      on scan_opportunity.scan_id = run.scan_id
     and scan_opportunity.opportunity_id = candidate.opportunity_id
    on conflict (monitored_profile_id, alert_kind, dedupe_key)
      where monitored_profile_id is not null and dedupe_key is not null
      do nothing
    returning id
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

create or replace function claim_pending_monitoring_alerts(p_limit integer default 5)
returns table (
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
    from monitoring_alerts alert
    join monitored_profiles profile on profile.id = alert.monitored_profile_id
    join stripe_customers customer on customer.stripe_customer_id = profile.stripe_customer_id
    where alert.delivery_status = 'pending'
      and alert.attempt_count < 5
      and (alert.next_attempt_at is null or alert.next_attempt_at <= now())
      and (alert.delivery_lease_expires_at is null or alert.delivery_lease_expires_at <= now())
      and customer.deleted_at is null
      and customer.email is not null
      and customer.email like '%@%'
    order by alert.created_at asc
    for update of alert skip locked
    limit p_limit
  ), claimed as (
    update monitoring_alerts alert
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
    customer.email,
    opportunity.title,
    opportunity.agency,
    opportunity.deadline,
    claimed.attempt_count
  from claimed
  join monitoring_runs run on run.id = claimed.monitoring_run_id
  join monitored_profiles profile on profile.id = claimed.monitored_profile_id
  join stripe_customers customer on customer.stripe_customer_id = profile.stripe_customer_id
  join opportunities opportunity on opportunity.id = claimed.opportunity_id;
end;
$$;

create or replace function claim_monitored_profile_by_id(p_profile_id uuid)
returns setof monitored_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  update monitored_profiles profile
  set lease_expires_at = now() + interval '15 minutes', updated_at = now()
  where profile.id = p_profile_id
    and profile.status = 'active'
    and (profile.lease_expires_at is null or profile.lease_expires_at <= now())
    and exists (
      select 1 from stripe_subscriptions subscription
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

revoke all on function record_monitoring_alerts(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function record_monitoring_alerts(uuid, uuid, jsonb) to service_role;
revoke all on function claim_pending_monitoring_alerts(integer) from public, anon, authenticated;
grant execute on function claim_pending_monitoring_alerts(integer) to service_role;
revoke all on function claim_monitored_profile_by_id(uuid) from public, anon, authenticated;
grant execute on function claim_monitored_profile_by_id(uuid) to service_role;
