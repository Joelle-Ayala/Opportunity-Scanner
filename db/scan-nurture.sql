create extension if not exists "pgcrypto";

create table if not exists scan_nurture_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 254),
  email_normalized text not null unique check (email_normalized = lower(trim(email_normalized))),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'subscribed' and unsubscribed_at is null)
    or (status = 'unsubscribed' and unsubscribed_at is not null)
  )
);

create table if not exists scan_nurture_enrollments (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  subscriber_id uuid not null references scan_nurture_subscribers(id) on delete cascade,
  recipient_name text check (recipient_name is null or char_length(recipient_name) <= 120),
  company_name text check (company_name is null or char_length(company_name) <= 160),
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scan_id, subscriber_id)
);

create table if not exists scan_nurture_jobs (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references scan_nurture_enrollments(id) on delete cascade,
  touch_number smallint not null check (touch_number between 1 and 5),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'suppressed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text check (provider_message_id is null or char_length(provider_message_id) <= 255),
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (enrollment_id, touch_number)
);

create index if not exists scan_nurture_jobs_due_idx
  on scan_nurture_jobs(scheduled_at, lease_expires_at)
  where status = 'pending';
create index if not exists scan_nurture_enrollments_subscriber_idx
  on scan_nurture_enrollments(subscriber_id, created_at desc);

alter table scan_nurture_subscribers enable row level security;
alter table scan_nurture_enrollments enable row level security;
alter table scan_nurture_jobs enable row level security;

create or replace function enqueue_scan_nurture(
  p_scan_id uuid,
  p_email text,
  p_recipient_name text default null,
  p_company_name text default null
) returns table (
  enrollment_id uuid,
  subscriber_id uuid,
  subscriber_status text,
  queued_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(trim(p_email));
  v_subscriber scan_nurture_subscribers%rowtype;
  v_enrollment_id uuid;
  v_queued_count integer := 0;
begin
  if p_scan_id is null
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(v_email) > 254
    or not exists (select 1 from scans where id = p_scan_id and status = 'completed')
  then
    raise exception 'Invalid scan nurture enrollment';
  end if;

  insert into scan_nurture_subscribers (email, email_normalized)
  values (trim(p_email), v_email)
  on conflict (email_normalized) do update
    set email = excluded.email,
        updated_at = now()
  returning * into v_subscriber;

  insert into scan_nurture_enrollments (
    scan_id,
    subscriber_id,
    recipient_name,
    company_name,
    canceled_at
  ) values (
    p_scan_id,
    v_subscriber.id,
    nullif(left(trim(coalesce(p_recipient_name, '')), 120), ''),
    coalesce(
      nullif(left(trim(coalesce(p_company_name, '')), 160), ''),
      (select nullif(left(trim(coalesce(company_name, '')), 160), '') from scans where id = p_scan_id)
    ),
    case when v_subscriber.status = 'unsubscribed' then now() else null end
  )
  on conflict (scan_id, subscriber_id) do update
    set recipient_name = coalesce(excluded.recipient_name, scan_nurture_enrollments.recipient_name),
        company_name = coalesce(excluded.company_name, scan_nurture_enrollments.company_name),
        canceled_at = case
          when v_subscriber.status = 'unsubscribed' then coalesce(scan_nurture_enrollments.canceled_at, now())
          else scan_nurture_enrollments.canceled_at
        end,
        updated_at = now()
  returning id into v_enrollment_id;

  if v_subscriber.status = 'subscribed' then
    insert into scan_nurture_jobs (enrollment_id, touch_number, scheduled_at)
    select
      v_enrollment_id,
      schedule.touch_number,
      now() + schedule.delay
    from (values
      (1::smallint, interval '0 days'),
      (2::smallint, interval '2 days'),
      (3::smallint, interval '4 days'),
      (4::smallint, interval '7 days'),
      (5::smallint, interval '10 days')
    ) as schedule(touch_number, delay)
    on conflict (enrollment_id, touch_number) do nothing;
    get diagnostics v_queued_count = row_count;
  end if;

  return query select v_enrollment_id, v_subscriber.id, v_subscriber.status, v_queued_count;
end;
$$;

create or replace function claim_due_scan_nurture_jobs(p_limit integer default 10)
returns table (
  job_id uuid,
  enrollment_id uuid,
  subscriber_id uuid,
  scan_id uuid,
  recipient_email text,
  recipient_name text,
  company_name text,
  touch_number smallint,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'Invalid scan nurture claim limit';
  end if;

  return query
  with due as (
    select job.id
    from scan_nurture_jobs job
    join scan_nurture_enrollments enrollment on enrollment.id = job.enrollment_id
    join scan_nurture_subscribers subscriber on subscriber.id = enrollment.subscriber_id
    where job.status = 'pending'
      and job.attempt_count < 5
      and job.scheduled_at <= now()
      and (job.lease_expires_at is null or job.lease_expires_at <= now())
      and enrollment.canceled_at is null
      and subscriber.status = 'subscribed'
    order by job.scheduled_at asc, job.created_at asc
    for update of job skip locked
    limit p_limit
  ), claimed as (
    update scan_nurture_jobs job
    set lease_expires_at = now() + interval '10 minutes',
        last_attempt_at = now(),
        attempt_count = job.attempt_count + 1,
        updated_at = now()
    from due
    where job.id = due.id
    returning job.*
  )
  select
    claimed.id,
    claimed.enrollment_id,
    subscriber.id,
    enrollment.scan_id,
    subscriber.email,
    enrollment.recipient_name,
    enrollment.company_name,
    claimed.touch_number,
    claimed.attempt_count
  from claimed
  join scan_nurture_enrollments enrollment on enrollment.id = claimed.enrollment_id
  join scan_nurture_subscribers subscriber on subscriber.id = enrollment.subscriber_id;
end;
$$;

create or replace function complete_scan_nurture_job(
  p_job_id uuid,
  p_provider_message_id text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update scan_nurture_jobs
  set status = 'sent',
      delivered_at = now(),
      provider_message_id = left(p_provider_message_id, 255),
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  where id = p_job_id and status = 'pending';
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function release_scan_nurture_job(
  p_job_id uuid,
  p_error text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  update scan_nurture_jobs job
  set status = case when job.attempt_count >= 5 then 'dead_letter' else 'pending' end,
      scheduled_at = case
        when job.attempt_count >= 5 then job.scheduled_at
        when job.attempt_count = 1 then now() + interval '15 minutes'
        when job.attempt_count = 2 then now() + interval '30 minutes'
        when job.attempt_count = 3 then now() + interval '1 hour'
        else now() + interval '2 hours'
      end,
      lease_expires_at = null,
      last_error = left(coalesce(nullif(trim(p_error), ''), 'Nurture delivery failed.'), 500),
      updated_at = now()
  where job.id = p_job_id and job.status = 'pending'
  returning job.status into v_status;
  return v_status;
end;
$$;

create or replace function unsubscribe_scan_nurture(p_subscriber_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update scan_nurture_subscribers
  set status = 'unsubscribed',
      unsubscribed_at = coalesce(unsubscribed_at, now()),
      updated_at = now()
  where id = p_subscriber_id;
  get diagnostics v_updated = row_count;

  if v_updated = 1 then
    update scan_nurture_enrollments
    set canceled_at = coalesce(canceled_at, now()), updated_at = now()
    where subscriber_id = p_subscriber_id;

    update scan_nurture_jobs job
    set status = 'suppressed',
        lease_expires_at = null,
        last_error = null,
        updated_at = now()
    from scan_nurture_enrollments enrollment
    where enrollment.id = job.enrollment_id
      and enrollment.subscriber_id = p_subscriber_id
      and job.status = 'pending';
  end if;

  return v_updated = 1;
end;
$$;

revoke all on table scan_nurture_subscribers from public, anon, authenticated;
revoke all on table scan_nurture_enrollments from public, anon, authenticated;
revoke all on table scan_nurture_jobs from public, anon, authenticated;
grant all on table scan_nurture_subscribers to service_role;
grant all on table scan_nurture_enrollments to service_role;
grant all on table scan_nurture_jobs to service_role;

revoke all on function enqueue_scan_nurture(uuid, text, text, text) from public, anon, authenticated;
revoke all on function claim_due_scan_nurture_jobs(integer) from public, anon, authenticated;
revoke all on function complete_scan_nurture_job(uuid, text) from public, anon, authenticated;
revoke all on function release_scan_nurture_job(uuid, text) from public, anon, authenticated;
revoke all on function unsubscribe_scan_nurture(uuid) from public, anon, authenticated;
grant execute on function enqueue_scan_nurture(uuid, text, text, text) to service_role;
grant execute on function claim_due_scan_nurture_jobs(integer) to service_role;
grant execute on function complete_scan_nurture_job(uuid, text) to service_role;
grant execute on function release_scan_nurture_job(uuid, text) to service_role;
grant execute on function unsubscribe_scan_nurture(uuid) to service_role;
