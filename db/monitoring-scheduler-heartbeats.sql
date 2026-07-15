-- Aggregate-only monitoring scheduler heartbeat and capacity evidence.
-- Apply after monitoring-throughput-reliability.sql.

create table if not exists public.monitoring_scheduler_runs (
  invocation_id uuid primary key,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  duration_ms bigint not null check (duration_ms between 0 and 900000),
  http_status integer not null check (http_status between 100 and 599),
  outcome text not null check (
    outcome in ('completed', 'configuration_error', 'storage_error', 'delivery_failed', 'run_failed')
  ),
  profiles_claimed integer not null check (profiles_claimed >= 0),
  profiles_completed integer not null check (profiles_completed >= 0),
  profiles_failed integer not null check (profiles_failed >= 0),
  profiles_deferred integer not null check (profiles_deferred >= 0),
  monitoring_alerts_claimed integer not null check (monitoring_alerts_claimed >= 0),
  monitoring_alerts_delivered integer not null check (monitoring_alerts_delivered >= 0),
  monitoring_alerts_failed integer not null check (monitoring_alerts_failed >= 0),
  monitoring_alerts_retried integer not null check (monitoring_alerts_retried >= 0),
  monitoring_alerts_dead_lettered integer not null check (monitoring_alerts_dead_lettered >= 0),
  deadline_alerts_enqueued integer not null check (deadline_alerts_enqueued >= 0),
  deadline_alerts_claimed integer not null check (deadline_alerts_claimed >= 0),
  deadline_alerts_delivered integer not null check (deadline_alerts_delivered >= 0),
  deadline_alerts_failed integer not null check (deadline_alerts_failed >= 0),
  deadline_alerts_retried integer not null check (deadline_alerts_retried >= 0),
  deadline_alerts_dead_lettered integer not null check (deadline_alerts_dead_lettered >= 0),
  configuration_failure_count integer not null check (configuration_failure_count >= 0),
  storage_failure_count integer not null check (storage_failure_count >= 0),
  queue_health_available boolean not null,
  queue_backlog_count bigint check (queue_backlog_count is null or queue_backlog_count >= 0),
  queue_oldest_due_age_seconds bigint check (
    queue_oldest_due_age_seconds is null or queue_oldest_due_age_seconds >= 0
  ),
  queue_leased_count bigint check (queue_leased_count is null or queue_leased_count >= 0),
  queue_stale_lease_count bigint check (
    queue_stale_lease_count is null or queue_stale_lease_count >= 0
  ),
  queue_retrying_count bigint check (queue_retrying_count is null or queue_retrying_count >= 0),
  queue_dead_letter_count bigint check (
    queue_dead_letter_count is null or queue_dead_letter_count >= 0
  ),
  recorded_at timestamptz not null default now(),
  check (completed_at >= started_at),
  check (profiles_completed + profiles_failed + profiles_deferred = profiles_claimed),
  check (
    queue_health_available
    or (
      queue_backlog_count is null
      and queue_oldest_due_age_seconds is null
      and queue_leased_count is null
      and queue_stale_lease_count is null
      and queue_retrying_count is null
      and queue_dead_letter_count is null
    )
  )
);

comment on table public.monitoring_scheduler_runs is
  'Service-only aggregate scheduler outcomes. Contains no profile identifiers, company names, emails, or user data.';

create index if not exists monitoring_scheduler_runs_started_at_idx
  on public.monitoring_scheduler_runs(started_at desc);

alter table public.monitoring_scheduler_runs enable row level security;
revoke all on table public.monitoring_scheduler_runs
  from public, anon, authenticated, service_role;

create or replace function public.record_monitoring_scheduler_run(
  p_invocation_id uuid,
  p_started_at timestamptz,
  p_completed_at timestamptz,
  p_duration_ms bigint,
  p_http_status integer,
  p_outcome text,
  p_profiles_claimed integer,
  p_profiles_completed integer,
  p_profiles_failed integer,
  p_profiles_deferred integer,
  p_monitoring_alerts_claimed integer,
  p_monitoring_alerts_delivered integer,
  p_monitoring_alerts_failed integer,
  p_monitoring_alerts_retried integer,
  p_monitoring_alerts_dead_lettered integer,
  p_deadline_alerts_enqueued integer,
  p_deadline_alerts_claimed integer,
  p_deadline_alerts_delivered integer,
  p_deadline_alerts_failed integer,
  p_deadline_alerts_retried integer,
  p_deadline_alerts_dead_lettered integer,
  p_configuration_failure_count integer,
  p_storage_failure_count integer,
  p_queue_health_available boolean,
  p_queue_backlog_count bigint,
  p_queue_oldest_due_age_seconds bigint,
  p_queue_leased_count bigint,
  p_queue_stale_lease_count bigint,
  p_queue_retrying_count bigint,
  p_queue_dead_letter_count bigint
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_invocation_id is null then
    raise exception 'Monitoring scheduler invocation ID is required';
  end if;

  -- The authorized scheduler invocation is the retention mechanism, so stale
  -- evidence is removed before every idempotent heartbeat write.
  delete from public.monitoring_scheduler_runs
  where started_at < now() - interval '90 days';

  insert into public.monitoring_scheduler_runs (
    invocation_id,
    started_at,
    completed_at,
    duration_ms,
    http_status,
    outcome,
    profiles_claimed,
    profiles_completed,
    profiles_failed,
    profiles_deferred,
    monitoring_alerts_claimed,
    monitoring_alerts_delivered,
    monitoring_alerts_failed,
    monitoring_alerts_retried,
    monitoring_alerts_dead_lettered,
    deadline_alerts_enqueued,
    deadline_alerts_claimed,
    deadline_alerts_delivered,
    deadline_alerts_failed,
    deadline_alerts_retried,
    deadline_alerts_dead_lettered,
    configuration_failure_count,
    storage_failure_count,
    queue_health_available,
    queue_backlog_count,
    queue_oldest_due_age_seconds,
    queue_leased_count,
    queue_stale_lease_count,
    queue_retrying_count,
    queue_dead_letter_count
  ) values (
    p_invocation_id,
    p_started_at,
    p_completed_at,
    p_duration_ms,
    p_http_status,
    p_outcome,
    p_profiles_claimed,
    p_profiles_completed,
    p_profiles_failed,
    p_profiles_deferred,
    p_monitoring_alerts_claimed,
    p_monitoring_alerts_delivered,
    p_monitoring_alerts_failed,
    p_monitoring_alerts_retried,
    p_monitoring_alerts_dead_lettered,
    p_deadline_alerts_enqueued,
    p_deadline_alerts_claimed,
    p_deadline_alerts_delivered,
    p_deadline_alerts_failed,
    p_deadline_alerts_retried,
    p_deadline_alerts_dead_lettered,
    p_configuration_failure_count,
    p_storage_failure_count,
    p_queue_health_available,
    p_queue_backlog_count,
    p_queue_oldest_due_age_seconds,
    p_queue_leased_count,
    p_queue_stale_lease_count,
    p_queue_retrying_count,
    p_queue_dead_letter_count
  )
  on conflict (invocation_id) do update
  set started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      duration_ms = excluded.duration_ms,
      http_status = excluded.http_status,
      outcome = excluded.outcome,
      profiles_claimed = excluded.profiles_claimed,
      profiles_completed = excluded.profiles_completed,
      profiles_failed = excluded.profiles_failed,
      profiles_deferred = excluded.profiles_deferred,
      monitoring_alerts_claimed = excluded.monitoring_alerts_claimed,
      monitoring_alerts_delivered = excluded.monitoring_alerts_delivered,
      monitoring_alerts_failed = excluded.monitoring_alerts_failed,
      monitoring_alerts_retried = excluded.monitoring_alerts_retried,
      monitoring_alerts_dead_lettered = excluded.monitoring_alerts_dead_lettered,
      deadline_alerts_enqueued = excluded.deadline_alerts_enqueued,
      deadline_alerts_claimed = excluded.deadline_alerts_claimed,
      deadline_alerts_delivered = excluded.deadline_alerts_delivered,
      deadline_alerts_failed = excluded.deadline_alerts_failed,
      deadline_alerts_retried = excluded.deadline_alerts_retried,
      deadline_alerts_dead_lettered = excluded.deadline_alerts_dead_lettered,
      configuration_failure_count = excluded.configuration_failure_count,
      storage_failure_count = excluded.storage_failure_count,
      queue_health_available = excluded.queue_health_available,
      queue_backlog_count = excluded.queue_backlog_count,
      queue_oldest_due_age_seconds = excluded.queue_oldest_due_age_seconds,
      queue_leased_count = excluded.queue_leased_count,
      queue_stale_lease_count = excluded.queue_stale_lease_count,
      queue_retrying_count = excluded.queue_retrying_count,
      queue_dead_letter_count = excluded.queue_dead_letter_count,
      recorded_at = now();
end;
$$;

create or replace function public.get_monitoring_scheduler_evidence(
  p_since timestamptz default now() - interval '48 hours',
  p_limit integer default 500
)
returns table (
  invocation_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms bigint,
  interval_since_previous_seconds bigint,
  http_status integer,
  outcome text,
  profiles_claimed integer,
  profiles_completed integer,
  profiles_failed integer,
  profiles_deferred integer,
  completed_profiles_per_minute numeric,
  monitoring_alerts_claimed integer,
  monitoring_alerts_delivered integer,
  monitoring_alerts_failed integer,
  monitoring_alerts_retried integer,
  monitoring_alerts_dead_lettered integer,
  deadline_alerts_enqueued integer,
  deadline_alerts_claimed integer,
  deadline_alerts_delivered integer,
  deadline_alerts_failed integer,
  deadline_alerts_retried integer,
  deadline_alerts_dead_lettered integer,
  configuration_failure_count integer,
  storage_failure_count integer,
  queue_health_available boolean,
  queue_backlog_count bigint,
  queue_oldest_due_age_seconds bigint,
  queue_leased_count bigint,
  queue_stale_lease_count bigint,
  queue_retrying_count bigint,
  queue_dead_letter_count bigint,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_since is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid monitoring scheduler evidence window';
  end if;

  return query
  with recent as (
    select run.*
    from public.monitoring_scheduler_runs run
    where run.started_at >= greatest(p_since, now() - interval '90 days')
    order by run.started_at desc
    limit p_limit
  ), timed as (
    select
      recent.*,
      lag(recent.started_at) over (order by recent.started_at asc) as previous_started_at
    from recent
  )
  select
    timed.invocation_id,
    timed.started_at,
    timed.completed_at,
    timed.duration_ms,
    case
      when timed.previous_started_at is null then null
      else extract(epoch from (timed.started_at - timed.previous_started_at))::bigint
    end,
    timed.http_status,
    timed.outcome,
    timed.profiles_claimed,
    timed.profiles_completed,
    timed.profiles_failed,
    timed.profiles_deferred,
    case
      when timed.duration_ms = 0 then null
      else round((timed.profiles_completed::numeric * 60000) / timed.duration_ms, 3)
    end,
    timed.monitoring_alerts_claimed,
    timed.monitoring_alerts_delivered,
    timed.monitoring_alerts_failed,
    timed.monitoring_alerts_retried,
    timed.monitoring_alerts_dead_lettered,
    timed.deadline_alerts_enqueued,
    timed.deadline_alerts_claimed,
    timed.deadline_alerts_delivered,
    timed.deadline_alerts_failed,
    timed.deadline_alerts_retried,
    timed.deadline_alerts_dead_lettered,
    timed.configuration_failure_count,
    timed.storage_failure_count,
    timed.queue_health_available,
    timed.queue_backlog_count,
    timed.queue_oldest_due_age_seconds,
    timed.queue_leased_count,
    timed.queue_stale_lease_count,
    timed.queue_retrying_count,
    timed.queue_dead_letter_count,
    timed.recorded_at
  from timed
  order by timed.started_at desc;
end;
$$;

revoke all on function public.record_monitoring_scheduler_run(
  uuid, timestamptz, timestamptz, bigint, integer, text,
  integer, integer, integer, integer,
  integer, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer,
  integer, integer, boolean,
  bigint, bigint, bigint, bigint, bigint, bigint
) from public, anon, authenticated, service_role;
revoke all on function public.get_monitoring_scheduler_evidence(timestamptz, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.record_monitoring_scheduler_run(
  uuid, timestamptz, timestamptz, bigint, integer, text,
  integer, integer, integer, integer,
  integer, integer, integer, integer, integer,
  integer, integer, integer, integer, integer, integer,
  integer, integer, boolean,
  bigint, bigint, bigint, bigint, bigint, bigint
) to service_role;
grant execute on function public.get_monitoring_scheduler_evidence(timestamptz, integer)
  to service_role;
