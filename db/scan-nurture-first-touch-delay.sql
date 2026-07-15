-- Delay the first nurture message until one day after consent so it adds to the
-- immediate transactional report-ready email instead of repeating it.

create or replace function enqueue_scan_nurture(
  p_scan_id uuid,
  p_email text,
  p_recipient_name text default null,
  p_company_name text default null,
  p_consented_at timestamptz default null,
  p_consent_source text default null
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
#variable_conflict use_column
declare
  v_email text := lower(trim(p_email));
  v_subscriber scan_nurture_subscribers%rowtype;
  v_enrollment_id uuid;
  v_queued_count integer := 0;
begin
  if p_scan_id is null
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(v_email) > 254
    or p_consented_at is null
    or p_consented_at < now() - interval '1 day'
    or p_consented_at > now() + interval '5 minutes'
    or p_consent_source <> 'homepage_scan'
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
    marketing_consent,
    consented_at,
    consent_source,
    canceled_at
  ) values (
    p_scan_id,
    v_subscriber.id,
    nullif(left(trim(coalesce(p_recipient_name, '')), 120), ''),
    coalesce(
      nullif(left(trim(coalesce(p_company_name, '')), 160), ''),
      (select nullif(left(trim(coalesce(company_name, '')), 160), '') from scans where id = p_scan_id)
    ),
    true,
    p_consented_at,
    p_consent_source,
    case when v_subscriber.status = 'unsubscribed' then now() else null end
  )
  on conflict on constraint scan_nurture_enrollments_scan_id_subscriber_id_key do update
    set recipient_name = coalesce(excluded.recipient_name, scan_nurture_enrollments.recipient_name),
        company_name = coalesce(excluded.company_name, scan_nurture_enrollments.company_name),
        marketing_consent = true,
        consented_at = excluded.consented_at,
        consent_source = excluded.consent_source,
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
      p_consented_at + schedule.delay
    from (values
      (1::smallint, interval '1 day'),
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

-- Move only untouched pending first-touch jobs. Leased, attempted, sent, failed,
-- suppressed, and dead-letter jobs retain their existing lifecycle timestamps.
update scan_nurture_jobs job
set scheduled_at = greatest(job.scheduled_at, enrollment.consented_at + interval '1 day'),
    updated_at = now()
from scan_nurture_enrollments enrollment
where enrollment.id = job.enrollment_id
  and enrollment.consented_at is not null
  and job.touch_number = 1
  and job.status = 'pending'
  and job.attempt_count = 0
  and job.last_attempt_at is null
  and job.lease_expires_at is null
  and job.scheduled_at < enrollment.consented_at + interval '1 day';

revoke all on function enqueue_scan_nurture(uuid, text, text, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function enqueue_scan_nurture(uuid, text, text, text, timestamptz, text)
  to service_role;
