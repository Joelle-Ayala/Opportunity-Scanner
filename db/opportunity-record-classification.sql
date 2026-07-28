-- Separate live opportunities from historical funded-buyer evidence.
-- Apply after monitoring-deadline-rpc-reliability.sql and customer-demo-entitlements.sql.

alter table public.opportunities
  add column if not exists record_class text,
  add column if not exists current_validated_at timestamptz,
  add column if not exists award_year integer,
  add column if not exists period_end date,
  add column if not exists close_date date;

create or replace function public.parse_opportunity_deadline(p_deadline text)
returns date
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  v_value text := btrim(p_deadline);
  v_match text[];
begin
  if v_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([^0-9]|$)' then
    return substring(v_value from 1 for 10)::date;
  end if;

  v_match := regexp_match(v_value, '^([0-9]{1,2})/([0-9]{1,2})/([0-9]{4})([^0-9]|$)');
  if v_match is not null then
    return make_date(v_match[3]::integer, v_match[1]::integer, v_match[2]::integer);
  end if;

  return null;
exception when others then
  return null;
end;
$$;

create or replace function public.normalize_opportunity_record_dates()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original_deadline text := nullif(btrim(new.deadline), '');
  v_parsed_deadline date;
  v_raw_class text;
  v_source_name text;
  v_source_type text;
  v_raw_period_end date;
  v_raw_award_date text;
  v_award_year integer;
  v_current_validated_at timestamptz;
  v_evidence_hint boolean;
  v_raw_json jsonb;
begin
  v_raw_json := case
    when jsonb_typeof(new.raw_json) = 'object' then new.raw_json
    else '{}'::jsonb
  end;
  v_parsed_deadline := public.parse_opportunity_deadline(v_original_deadline);
  v_raw_class := lower(nullif(btrim(v_raw_json ->> 'record_class'), ''));
  v_source_name := lower(coalesce(nullif(btrim(new.source), ''), v_raw_json ->> 'source_name', ''));
  v_source_type := lower(coalesce(nullif(btrim(new.category), ''), v_raw_json ->> 'source_type', ''));
  v_raw_period_end := public.parse_opportunity_deadline(v_raw_json ->> 'period_end');
  begin
    v_current_validated_at := coalesce(
      new.current_validated_at,
      nullif(v_raw_json ->> 'current_validated_at', '')::timestamptz
    );
  exception when others then
    v_current_validated_at := null;
  end;

  v_evidence_hint :=
    new.record_class = 'evidence'
    or v_raw_class = 'evidence'
    or v_source_type in ('historical_award', 'funded_buyer', 'policy_signal')
    or v_source_name like '%usaspending%'
    or v_source_name like '%federal register%';

  if v_parsed_deadline is not null
    and v_parsed_deadline > current_date
    and v_current_validated_at between now() - interval '7 days' and now() + interval '5 minutes'
    and not v_evidence_hint
  then
    new.record_class := 'current';
    new.current_validated_at := v_current_validated_at;
    new.close_date := v_parsed_deadline;
    new.deadline := v_original_deadline;
    new.award_year := null;
    new.period_end := null;
  else
    new.record_class := 'evidence';
    new.current_validated_at := null;
    new.close_date := null;
    new.deadline := null;
    new.period_end := coalesce(new.period_end, v_raw_period_end, v_parsed_deadline);

    v_award_year := new.award_year;
    if v_award_year is null and (v_raw_json ->> 'award_year') ~ '^[0-9]{4}$' then
      v_award_year := (v_raw_json ->> 'award_year')::integer;
    end if;
    if v_award_year is null then
      v_raw_award_date := coalesce(
        v_raw_json #>> '{raw_json,Award Date}',
        v_raw_json #>> '{raw_json,Start Date}',
        v_raw_json #>> '{raw_json,award,date}'
      );
      if v_raw_award_date is not null then
        v_award_year := substring(v_raw_award_date from '19[0-9]{2}|20[0-9]{2}')::integer;
      end if;
    end if;
    new.award_year := case
      when v_award_year between 1900 and 2100 then v_award_year
      else null
    end;
  end if;

  new.raw_json := v_raw_json || jsonb_build_object(
    'record_class', new.record_class,
    'current_validated_at', case
      when new.current_validated_at is null then null
      else new.current_validated_at::text
    end,
    'award_year', new.award_year,
    'period_end', case when new.period_end is null then null else new.period_end::text end,
    'deadline', coalesce(new.deadline, '')
  );

  return new;
end;
$$;

drop trigger if exists opportunities_normalize_record_dates on public.opportunities;
create trigger opportunities_normalize_record_dates
before insert or update of source, category, record_class, current_validated_at, award_year, period_end, close_date, deadline, raw_json
on public.opportunities
for each row
execute function public.normalize_opportunity_record_dates();

-- Re-run every stored row through the same rules used for future ingestion.
update public.opportunities
set deadline = deadline;

alter table public.opportunities
  alter column record_class set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_record_class_check'
  ) then
    alter table public.opportunities
      add constraint opportunities_record_class_check
      check (record_class in ('evidence', 'current'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_award_year_check'
  ) then
    alter table public.opportunities
      add constraint opportunities_award_year_check
      check (award_year is null or award_year between 1900 and 2100);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.opportunities'::regclass
      and conname = 'opportunities_record_date_semantics_check'
  ) then
    alter table public.opportunities
      add constraint opportunities_record_date_semantics_check
      check (
        (
          record_class = 'evidence'
          and current_validated_at is null
          and deadline is null
          and close_date is null
        )
        or
        (
          record_class = 'current'
          and current_validated_at is not null
          and deadline is not null
          and close_date is not null
          and period_end is null
          and award_year is null
          and public.parse_opportunity_deadline(deadline) = close_date
        )
      );
  end if;
end;
$$;

create index if not exists opportunities_current_close_date_idx
  on public.opportunities(close_date)
  where record_class = 'current';

create or replace function public.enqueue_due_deadline_alerts(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_inserted integer;
begin
  if p_limit < 1 or p_limit > 500 then
    raise exception 'Invalid deadline alert enqueue limit';
  end if;

  with candidates as (
    select distinct on (
      preferences.customer_account_id,
      encode(
        digest(
          lower(
            btrim(
              coalesce(
                nullif(opportunity.url, ''),
                nullif(opportunity.source_id, ''),
                opportunity.source || ':' || opportunity.title
              )
            )
          ),
          'sha256'::text
        ),
        'hex'
      ),
      opportunity.close_date,
      reminders.reminder_days
    )
      preferences.customer_account_id,
      profile.id as monitored_profile_id,
      profile.latest_scan_id as scan_id,
      opportunity.id as opportunity_id,
      encode(
        digest(
          lower(
            btrim(
              coalesce(
                nullif(opportunity.url, ''),
                nullif(opportunity.source_id, ''),
                opportunity.source || ':' || opportunity.title
              )
            )
          ),
          'sha256'::text
        ),
        'hex'
      ) as opportunity_key,
      opportunity.close_date as deadline_date,
      reminders.reminder_days
    from public.monitored_profiles profile
    join public.customer_monitored_profile_ownership ownership
      on ownership.monitored_profile_id = profile.id
    join public.customer_alert_preferences preferences
      on preferences.customer_account_id = ownership.customer_account_id
    join public.customer_accounts account
      on account.id = preferences.customer_account_id
    join auth.users auth_user
      on auth_user.id = account.auth_user_id
     and auth_user.email_confirmed_at is not null
    join public.scan_opportunities scan_opportunity
      on scan_opportunity.scan_id = profile.latest_scan_id
     and scan_opportunity.hidden = false
    join public.opportunities opportunity
      on opportunity.id = scan_opportunity.opportunity_id
    cross join lateral unnest(preferences.deadline_reminder_days) reminders(reminder_days)
    where profile.status = 'active'
      and preferences.email_enabled = true
      and preferences.deadline_email_enabled = true
      and preferences.unsubscribed_at is null
      and lower(account.email) = lower(auth_user.email)
      and opportunity.record_class = 'current'
      and opportunity.current_validated_at >= now() - interval '7 days'
      and opportunity.close_date > current_date
      and public.parse_opportunity_deadline(opportunity.deadline) = opportunity.close_date
      and opportunity.close_date - current_date = reminders.reminder_days
      and exists (
        select 1
        from public.stripe_subscriptions subscription
        where subscription.stripe_customer_id = profile.stripe_customer_id
          and subscription.status in ('active', 'trialing')
          and subscription.product in ('monitor', 'growth')
      )
    order by
      preferences.customer_account_id,
      encode(
        digest(
          lower(
            btrim(
              coalesce(
                nullif(opportunity.url, ''),
                nullif(opportunity.source_id, ''),
                opportunity.source || ':' || opportunity.title
              )
            )
          ),
          'sha256'::text
        ),
        'hex'
      ),
      opportunity.close_date,
      reminders.reminder_days,
      profile.id
    limit p_limit
  ), inserted as (
    insert into public.deadline_alerts (
      customer_account_id,
      monitored_profile_id,
      scan_id,
      opportunity_id,
      opportunity_key,
      deadline_date,
      reminder_days
    )
    select
      candidate.customer_account_id,
      candidate.monitored_profile_id,
      candidate.scan_id,
      candidate.opportunity_id,
      candidate.opportunity_key,
      candidate.deadline_date,
      candidate.reminder_days
    from candidates candidate
    on conflict (customer_account_id, opportunity_key, deadline_date, reminder_days)
      do nothing
    returning id
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

create or replace function public.claim_pending_deadline_alerts(p_limit integer default 5)
returns table (
  alert_id uuid,
  customer_account_id uuid,
  scan_id uuid,
  recipient_email text,
  opportunity_title text,
  agency_or_funder text,
  deadline_date date,
  reminder_days integer,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Invalid deadline alert claim limit';
  end if;

  update public.deadline_alerts alert
  set delivery_status = 'suppressed',
      delivery_lease_expires_at = null,
      next_attempt_at = null,
      last_error = 'Suppressed because the opportunity no longer has a verified future deadline.'
  where alert.delivery_status = 'pending'
    and not exists (
      select 1
      from public.opportunities opportunity
      where opportunity.id = alert.opportunity_id
        and opportunity.record_class = 'current'
        and opportunity.current_validated_at >= now() - interval '7 days'
        and opportunity.close_date = alert.deadline_date
        and opportunity.close_date > current_date
        and public.parse_opportunity_deadline(opportunity.deadline) = opportunity.close_date
    );

  update public.deadline_alerts alert
  set delivery_status = 'suppressed',
      delivery_lease_expires_at = null,
      next_attempt_at = null,
      last_error = 'Suppressed by customer alert preferences or account eligibility.'
  where alert.delivery_status = 'pending'
    and not exists (
      select 1
      from public.customer_alert_preferences preferences
      join public.customer_accounts account on account.id = preferences.customer_account_id
      join auth.users auth_user
        on auth_user.id = account.auth_user_id
       and auth_user.email_confirmed_at is not null
       and lower(auth_user.email) = lower(account.email)
      join public.monitored_profiles profile on profile.id = alert.monitored_profile_id
      where preferences.customer_account_id = alert.customer_account_id
        and preferences.email_enabled = true
        and preferences.deadline_email_enabled = true
        and preferences.unsubscribed_at is null
        and alert.reminder_days = any(preferences.deadline_reminder_days)
        and profile.status = 'active'
        and exists (
          select 1
          from public.stripe_subscriptions subscription
          where subscription.stripe_customer_id = profile.stripe_customer_id
            and subscription.status in ('active', 'trialing')
            and subscription.product in ('monitor', 'growth')
        )
    );

  return query
  with due as (
    select alert.id
    from public.deadline_alerts alert
    join public.opportunities opportunity
      on opportunity.id = alert.opportunity_id
    join public.customer_alert_preferences preferences
      on preferences.customer_account_id = alert.customer_account_id
    join public.customer_accounts account on account.id = preferences.customer_account_id
    join auth.users auth_user
      on auth_user.id = account.auth_user_id
     and auth_user.email_confirmed_at is not null
     and lower(auth_user.email) = lower(account.email)
    where alert.delivery_status = 'pending'
      and preferences.email_enabled = true
      and preferences.deadline_email_enabled = true
      and preferences.unsubscribed_at is null
      and alert.attempt_count < 5
      and opportunity.record_class = 'current'
      and opportunity.current_validated_at >= now() - interval '7 days'
      and opportunity.close_date = alert.deadline_date
      and opportunity.close_date > current_date
      and public.parse_opportunity_deadline(opportunity.deadline) = opportunity.close_date
      and alert.reminder_days = any(preferences.deadline_reminder_days)
      and (alert.next_attempt_at is null or alert.next_attempt_at <= now())
      and (alert.delivery_lease_expires_at is null or alert.delivery_lease_expires_at <= now())
    order by alert.deadline_date asc, alert.created_at asc
    for update of alert skip locked
    limit p_limit
  ), claimed as (
    update public.deadline_alerts alert
    set delivery_lease_expires_at = now() + interval '10 minutes',
        last_attempt_at = now(),
        attempt_count = alert.attempt_count + 1
    from due
    where alert.id = due.id
    returning alert.*
  )
  select
    claimed.id,
    claimed.customer_account_id,
    claimed.scan_id,
    account.email,
    opportunity.title,
    opportunity.agency,
    claimed.deadline_date,
    claimed.reminder_days,
    claimed.attempt_count
  from claimed
  join public.customer_accounts account on account.id = claimed.customer_account_id
  join public.opportunities opportunity on opportunity.id = claimed.opportunity_id;
end;
$$;

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
    case
      when opportunity.record_class = 'current'
        and opportunity.current_validated_at >= now() - interval '7 days'
        and opportunity.close_date > current_date
        and public.parse_opportunity_deadline(opportunity.deadline) = opportunity.close_date
      then opportunity.deadline
      else null
    end,
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

revoke all on function public.parse_opportunity_deadline(text)
  from public, anon, authenticated, service_role;
revoke all on function public.normalize_opportunity_record_dates()
  from public, anon, authenticated, service_role;
revoke all on function public.enqueue_due_deadline_alerts(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_pending_deadline_alerts(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_pending_monitoring_alerts(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.parse_opportunity_deadline(text) to service_role;
grant execute on function public.enqueue_due_deadline_alerts(integer) to service_role;
grant execute on function public.claim_pending_deadline_alerts(integer) to service_role;
grant execute on function public.claim_pending_monitoring_alerts(integer) to service_role;
