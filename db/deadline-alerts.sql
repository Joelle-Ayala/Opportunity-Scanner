-- Customer-controlled opportunity alert preferences and deadline reminder delivery.
-- Apply after monitoring-alert-delivery.sql and customer-dashboard.sql.

create table if not exists customer_alert_preferences (
  customer_account_id uuid primary key references customer_accounts(id) on delete cascade,
  email_enabled boolean not null default true,
  new_opportunity_email_enabled boolean not null default true,
  deadline_email_enabled boolean not null default true,
  deadline_reminder_days integer[] not null default array[14, 7, 1]::integer[],
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deadline_reminder_days <@ array[14, 7, 1]::integer[]),
  check (array_length(deadline_reminder_days, 1) is null or array_length(deadline_reminder_days, 1) <= 3)
);

insert into customer_alert_preferences (customer_account_id)
select account.id
from customer_accounts account
on conflict (customer_account_id) do nothing;

create table if not exists deadline_alerts (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references customer_accounts(id) on delete cascade,
  monitored_profile_id uuid not null references monitored_profiles(id) on delete cascade,
  scan_id uuid not null references scans(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  opportunity_key text not null check (char_length(opportunity_key) = 64),
  deadline_date date not null,
  reminder_days integer not null check (reminder_days in (14, 7, 1)),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed', 'suppressed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  delivery_lease_expires_at timestamptz,
  provider_message_id text,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (customer_account_id, opportunity_key, deadline_date, reminder_days)
);

create index if not exists deadline_alerts_pending_delivery_idx
  on deadline_alerts(delivery_status, next_attempt_at, created_at)
  where delivery_status = 'pending';

alter table customer_alert_preferences enable row level security;
alter table deadline_alerts enable row level security;
revoke all on customer_alert_preferences, deadline_alerts from anon, authenticated;
grant all on customer_alert_preferences, deadline_alerts to service_role;

create or replace function parse_opportunity_deadline(p_deadline text)
returns date
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  v_date_text text;
begin
  v_date_text := substring(btrim(p_deadline) from 1 for 10);
  if v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
  return v_date_text::date;
exception when others then
  return null;
end;
$$;

create or replace function enqueue_due_deadline_alerts(p_limit integer default 100)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
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
      encode(digest(lower(btrim(coalesce(nullif(opportunity.url, ''), nullif(opportunity.source_id, ''), opportunity.source || ':' || opportunity.title))), 'sha256'), 'hex'),
      parsed.deadline_date,
      reminders.reminder_days
    )
      preferences.customer_account_id,
      profile.id as monitored_profile_id,
      profile.latest_scan_id as scan_id,
      opportunity.id as opportunity_id,
      encode(digest(lower(btrim(coalesce(nullif(opportunity.url, ''), nullif(opportunity.source_id, ''), opportunity.source || ':' || opportunity.title))), 'sha256'), 'hex') as opportunity_key,
      parsed.deadline_date,
      reminders.reminder_days
    from monitored_profiles profile
    join customer_monitored_profile_ownership ownership
      on ownership.monitored_profile_id = profile.id
    join customer_alert_preferences preferences
      on preferences.customer_account_id = ownership.customer_account_id
    join customer_accounts account
      on account.id = preferences.customer_account_id
    join auth.users auth_user
      on auth_user.id = account.auth_user_id
     and auth_user.email_confirmed_at is not null
    join scan_opportunities scan_opportunity
      on scan_opportunity.scan_id = profile.latest_scan_id
     and scan_opportunity.hidden = false
    join opportunities opportunity
      on opportunity.id = scan_opportunity.opportunity_id
    cross join lateral (
      select parse_opportunity_deadline(opportunity.deadline) as deadline_date
    ) parsed
    cross join lateral unnest(preferences.deadline_reminder_days) reminders(reminder_days)
    where profile.status = 'active'
      and preferences.email_enabled = true
      and preferences.deadline_email_enabled = true
      and preferences.unsubscribed_at is null
      and lower(account.email) = lower(auth_user.email)
      and parsed.deadline_date is not null
      and parsed.deadline_date - current_date = reminders.reminder_days
      and exists (
        select 1
        from stripe_subscriptions subscription
        where subscription.stripe_customer_id = profile.stripe_customer_id
          and subscription.status in ('active', 'trialing')
          and subscription.product in ('monitor', 'growth')
      )
    order by
      preferences.customer_account_id,
      encode(digest(lower(btrim(coalesce(nullif(opportunity.url, ''), nullif(opportunity.source_id, ''), opportunity.source || ':' || opportunity.title))), 'sha256'), 'hex'),
      parsed.deadline_date,
      reminders.reminder_days,
      profile.id
    limit p_limit
  ), inserted as (
    insert into deadline_alerts (
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

create or replace function claim_pending_deadline_alerts(p_limit integer default 5)
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

  update deadline_alerts
  set delivery_status = 'suppressed',
      delivery_lease_expires_at = null,
      next_attempt_at = null,
      last_error = 'Suppressed because the opportunity deadline has passed.'
  where delivery_status = 'pending'
    and deadline_date < current_date;

  update deadline_alerts alert
  set delivery_status = 'suppressed',
      delivery_lease_expires_at = null,
      next_attempt_at = null,
      last_error = 'Suppressed by customer alert preferences or account eligibility.'
  where alert.delivery_status = 'pending'
    and not exists (
      select 1
      from customer_alert_preferences preferences
      join customer_accounts account on account.id = preferences.customer_account_id
      join auth.users auth_user
        on auth_user.id = account.auth_user_id
       and auth_user.email_confirmed_at is not null
       and lower(auth_user.email) = lower(account.email)
      join monitored_profiles profile on profile.id = alert.monitored_profile_id
      where preferences.customer_account_id = alert.customer_account_id
        and preferences.email_enabled = true
        and preferences.deadline_email_enabled = true
        and preferences.unsubscribed_at is null
        and alert.reminder_days = any(preferences.deadline_reminder_days)
        and profile.status = 'active'
        and exists (
          select 1 from stripe_subscriptions subscription
          where subscription.stripe_customer_id = profile.stripe_customer_id
            and subscription.status in ('active', 'trialing')
            and subscription.product in ('monitor', 'growth')
        )
    );

  return query
  with due as (
    select alert.id
    from deadline_alerts alert
    join customer_alert_preferences preferences
      on preferences.customer_account_id = alert.customer_account_id
    join customer_accounts account on account.id = preferences.customer_account_id
    join auth.users auth_user
      on auth_user.id = account.auth_user_id
     and auth_user.email_confirmed_at is not null
     and lower(auth_user.email) = lower(account.email)
    where alert.delivery_status = 'pending'
      and preferences.email_enabled = true
      and preferences.deadline_email_enabled = true
      and preferences.unsubscribed_at is null
      and alert.attempt_count < 5
      and alert.deadline_date >= current_date
      and alert.reminder_days = any(preferences.deadline_reminder_days)
      and (alert.next_attempt_at is null or alert.next_attempt_at <= now())
      and (alert.delivery_lease_expires_at is null or alert.delivery_lease_expires_at <= now())
    order by alert.deadline_date asc, alert.created_at asc
    for update of alert skip locked
    limit p_limit
  ), claimed as (
    update deadline_alerts alert
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
  join customer_accounts account on account.id = claimed.customer_account_id
  join opportunities opportunity on opportunity.id = claimed.opportunity_id;
end;
$$;

-- Replaces the original claim with account ownership, verification, and preferences gates.
drop function if exists claim_pending_monitoring_alerts(integer);
create or replace function claim_pending_monitoring_alerts(p_limit integer default 5)
returns table (
  alert_id uuid,
  monitoring_run_id uuid,
  customer_account_id uuid,
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

  update monitoring_alerts alert
  set delivery_status = 'suppressed',
      delivery_lease_expires_at = null,
      next_attempt_at = null,
      last_error = 'Suppressed by customer alert preferences or account eligibility.'
  where alert.delivery_status = 'pending'
    and not exists (
      select 1
      from customer_monitored_profile_ownership ownership
      join customer_alert_preferences preferences
        on preferences.customer_account_id = ownership.customer_account_id
      join customer_accounts account on account.id = preferences.customer_account_id
      join auth.users auth_user
        on auth_user.id = account.auth_user_id
       and auth_user.email_confirmed_at is not null
       and lower(auth_user.email) = lower(account.email)
      where ownership.monitored_profile_id = alert.monitored_profile_id
        and preferences.email_enabled = true
        and preferences.new_opportunity_email_enabled = true
        and preferences.unsubscribed_at is null
    );

  return query
  with due as (
    select alert.id
    from monitoring_alerts alert
    join customer_monitored_profile_ownership ownership
      on ownership.monitored_profile_id = alert.monitored_profile_id
    join customer_alert_preferences preferences
      on preferences.customer_account_id = ownership.customer_account_id
    join customer_accounts account on account.id = preferences.customer_account_id
    join auth.users auth_user
      on auth_user.id = account.auth_user_id
     and auth_user.email_confirmed_at is not null
     and lower(auth_user.email) = lower(account.email)
    where alert.delivery_status = 'pending'
      and preferences.email_enabled = true
      and preferences.new_opportunity_email_enabled = true
      and preferences.unsubscribed_at is null
      and alert.attempt_count < 5
      and (alert.next_attempt_at is null or alert.next_attempt_at <= now())
      and (alert.delivery_lease_expires_at is null or alert.delivery_lease_expires_at <= now())
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
    account.id,
    run.scan_id,
    account.email,
    opportunity.title,
    opportunity.agency,
    opportunity.deadline,
    claimed.attempt_count
  from claimed
  join monitoring_runs run on run.id = claimed.monitoring_run_id
  join customer_monitored_profile_ownership ownership
    on ownership.monitored_profile_id = claimed.monitored_profile_id
  join customer_accounts account on account.id = ownership.customer_account_id
  join opportunities opportunity on opportunity.id = claimed.opportunity_id;
end;
$$;

revoke all on function parse_opportunity_deadline(text) from public, anon, authenticated;
revoke all on function enqueue_due_deadline_alerts(integer) from public, anon, authenticated;
revoke all on function claim_pending_deadline_alerts(integer) from public, anon, authenticated;
revoke all on function claim_pending_monitoring_alerts(integer) from public, anon, authenticated;
grant execute on function enqueue_due_deadline_alerts(integer) to service_role;
grant execute on function claim_pending_deadline_alerts(integer) to service_role;
grant execute on function claim_pending_monitoring_alerts(integer) to service_role;
