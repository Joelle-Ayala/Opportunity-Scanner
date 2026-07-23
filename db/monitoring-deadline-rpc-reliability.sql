-- Repair monitoring deadline RPC resolution and preserve private service access.
-- Apply after deadline-alerts.sql and monitoring-scheduler-heartbeats.sql.

create extension if not exists pgcrypto;

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
      parsed.deadline_date,
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
      parsed.deadline_date,
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
    cross join lateral (
      select public.parse_opportunity_deadline(opportunity.deadline) as deadline_date
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
      parsed.deadline_date,
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

  update public.deadline_alerts as alert
  set delivery_status = 'suppressed',
      delivery_lease_expires_at = null,
      next_attempt_at = null,
      last_error = 'Suppressed because the opportunity deadline has passed.'
  where alert.delivery_status = 'pending'
    and alert.deadline_date < current_date;

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
      and alert.deadline_date >= current_date
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

revoke all on function public.enqueue_due_deadline_alerts(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_pending_deadline_alerts(integer)
  from public, anon, authenticated, service_role;

grant execute on function public.enqueue_due_deadline_alerts(integer) to service_role;
grant execute on function public.claim_pending_deadline_alerts(integer) to service_role;
