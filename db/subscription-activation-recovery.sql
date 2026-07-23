-- Durable recovery for paid subscriptions that have not activated monitoring.
-- Apply after monitoring-setup-transaction.sql and monitoring-throughput-reliability.sql.

create table if not exists public.subscription_activation_recoveries (
  id uuid primary key default gen_random_uuid(),
  stripe_subscription_id text not null unique
    references public.stripe_subscriptions(stripe_subscription_id) on delete cascade,
  customer_account_id uuid not null
    references public.customer_accounts(id) on delete cascade,
  source_scan_id uuid not null references public.scans(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending', 'activated', 'dead_letter', 'canceled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null,
  lease_token uuid,
  lease_expires_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text check (
    last_error_code is null
    or (
      char_length(last_error_code) between 1 and 80
      and last_error_code ~ '^[A-Z0-9_]+$'
    )
  ),
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  )
);

create table if not exists public.subscription_activation_reminders (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null
    references public.subscription_activation_recoveries(id) on delete cascade,
  reminder_sequence smallint not null default 1 check (reminder_sequence between 1 and 3),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'dead_letter', 'suppressed')),
  scheduled_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  lease_token uuid,
  lease_expires_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text check (
    provider_message_id is null or char_length(provider_message_id) between 1 and 255
  ),
  last_error text check (last_error is null or char_length(last_error) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recovery_id, reminder_sequence),
  check (
    (lease_token is null and lease_expires_at is null)
    or (lease_token is not null and lease_expires_at is not null)
  )
);

create index if not exists subscription_activation_recoveries_due_idx
  on public.subscription_activation_recoveries(next_attempt_at, created_at)
  where status = 'pending';
create index if not exists subscription_activation_reminders_due_idx
  on public.subscription_activation_reminders(scheduled_at, created_at)
  where status = 'pending';

alter table public.subscription_activation_recoveries enable row level security;
alter table public.subscription_activation_reminders enable row level security;

create or replace function public.register_subscription_activation_recovery(
  p_customer_id text,
  p_customer_email text,
  p_subscription_id text,
  p_scan_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.customer_accounts%rowtype;
  v_subscription public.stripe_subscriptions%rowtype;
  v_customer_email text;
  v_has_active_profile boolean;
begin
  if p_customer_id !~ '^cus_[A-Za-z0-9]+$'
    or p_subscription_id !~ '^sub_[A-Za-z0-9]+$'
    or p_scan_id is null
    or (
      p_customer_email is not null
      and (
        p_customer_email <> lower(btrim(p_customer_email))
        or char_length(p_customer_email) not between 3 and 254
        or p_customer_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
  then
    return false;
  end if;

  select subscription.*
  into v_subscription
  from public.stripe_subscriptions subscription
  where subscription.stripe_subscription_id = p_subscription_id
    and subscription.stripe_customer_id = p_customer_id
    and subscription.status in ('active', 'trialing')
    and subscription.product in ('monitor', 'growth')
  for share;

  if not found then
    return false;
  end if;

  select coalesce(p_customer_email, customer.email)
  into v_customer_email
  from public.stripe_customers customer
  where customer.stripe_customer_id = p_customer_id
    and customer.deleted_at is null;

  if v_customer_email is null then
    return false;
  end if;

  if p_customer_email is not null and exists (
    select 1
    from public.stripe_customers customer
    where customer.stripe_customer_id = p_customer_id
      and customer.email is not null
      and lower(customer.email) <> p_customer_email
  ) then
    return false;
  end if;

  select account.*
  into v_account
  from public.customer_accounts account
  where lower(account.email) = v_customer_email
    and (account.stripe_customer_id is null or account.stripe_customer_id = p_customer_id)
  for update;

  if not found
    or exists (
      select 1
      from public.customer_accounts other_account
      where other_account.stripe_customer_id = p_customer_id
        and other_account.id <> v_account.id
    )
    or not exists (
      select 1
      from public.customer_scan_ownership ownership
      join public.scans scan on scan.id = ownership.scan_id
      where ownership.customer_account_id = v_account.id
        and ownership.scan_id = p_scan_id
        and scan.status = 'completed'
    )
  then
    return false;
  end if;

  update public.customer_accounts
  set stripe_customer_id = p_customer_id,
      updated_at = now()
  where id = v_account.id
    and (stripe_customer_id is null or stripe_customer_id = p_customer_id);

  select exists (
    select 1
    from public.customer_monitored_profile_ownership ownership
    join public.monitored_profiles profile
      on profile.id = ownership.monitored_profile_id
    where ownership.customer_account_id = v_account.id
      and profile.status <> 'canceled'
  ) into v_has_active_profile;

  insert into public.subscription_activation_recoveries (
    stripe_subscription_id,
    customer_account_id,
    source_scan_id,
    status,
    next_attempt_at,
    activated_at
  ) values (
    p_subscription_id,
    v_account.id,
    p_scan_id,
    case when v_has_active_profile then 'activated' else 'pending' end,
    greatest(v_subscription.stripe_event_created_at + interval '15 minutes', now()),
    case when v_has_active_profile then now() else null end
  )
  on conflict (stripe_subscription_id) do update set
    customer_account_id = excluded.customer_account_id,
    source_scan_id = case
      when subscription_activation_recoveries.status = 'activated'
        then subscription_activation_recoveries.source_scan_id
      else excluded.source_scan_id
    end,
    status = case
      when subscription_activation_recoveries.status = 'activated' or v_has_active_profile
        then 'activated'
      when subscription_activation_recoveries.status = 'canceled'
        then 'pending'
      else subscription_activation_recoveries.status
    end,
    next_attempt_at = case
      when subscription_activation_recoveries.status in ('activated', 'dead_letter')
        then subscription_activation_recoveries.next_attempt_at
      else least(subscription_activation_recoveries.next_attempt_at, excluded.next_attempt_at)
    end,
    activated_at = case
      when subscription_activation_recoveries.status = 'activated'
        then subscription_activation_recoveries.activated_at
      when v_has_active_profile then now()
      else null
    end,
    updated_at = now();

  return true;
end;
$$;

create or replace function public.claim_due_subscription_activation_recoveries(
  p_limit integer default 5
) returns table (
  recovery_id uuid,
  lease_token uuid,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Invalid subscription activation recovery claim limit';
  end if;

  -- Recover older subscriptions only when customer identity and source report are unambiguous.
  update public.customer_accounts account
  set stripe_customer_id = customer.stripe_customer_id,
      updated_at = now()
  from public.stripe_customers customer
  where account.stripe_customer_id is null
    and customer.email is not null
    and customer.deleted_at is null
    and lower(account.email) = lower(customer.email)
    and exists (
      select 1
      from public.stripe_subscriptions subscription
      where subscription.stripe_customer_id = customer.stripe_customer_id
        and subscription.status in ('active', 'trialing')
        and subscription.product in ('monitor', 'growth')
    )
    and not exists (
      select 1
      from public.customer_accounts other_account
      where other_account.stripe_customer_id = customer.stripe_customer_id
        and other_account.id <> account.id
    );

  insert into public.subscription_activation_recoveries (
    stripe_subscription_id,
    customer_account_id,
    source_scan_id,
    status,
    next_attempt_at
  )
  select
    candidate.stripe_subscription_id,
    candidate.customer_account_id,
    min(candidate.scan_id),
    'pending',
    greatest(candidate.stripe_event_created_at + interval '15 minutes', now())
  from (
    select
      subscription.stripe_subscription_id,
      subscription.stripe_event_created_at,
      account.id as customer_account_id,
      ownership.scan_id
    from public.stripe_subscriptions subscription
    join public.customer_accounts account
      on account.stripe_customer_id = subscription.stripe_customer_id
    join public.customer_scan_ownership ownership
      on ownership.customer_account_id = account.id
    join public.scans scan
      on scan.id = ownership.scan_id
     and scan.status = 'completed'
    where subscription.status in ('active', 'trialing')
      and subscription.product in ('monitor', 'growth')
      and subscription.created_at <= now() - interval '15 minutes'
      and not exists (
        select 1
        from public.subscription_activation_recoveries recovery
        where recovery.stripe_subscription_id = subscription.stripe_subscription_id
      )
      and not exists (
        select 1
        from public.customer_monitored_profile_ownership profile_ownership
        join public.monitored_profiles profile
          on profile.id = profile_ownership.monitored_profile_id
        where profile_ownership.customer_account_id = account.id
          and profile.status <> 'canceled'
      )
      and not exists (
        select 1
        from public.customer_scan_saved_search_versions scan_version
        where scan_version.scan_id = ownership.scan_id
      )
  ) candidate
  group by
    candidate.stripe_subscription_id,
    candidate.customer_account_id,
    candidate.stripe_event_created_at
  having count(*) = 1
  on conflict (stripe_subscription_id) do nothing;

  update public.subscription_activation_recoveries recovery
  set status = 'canceled',
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where recovery.status = 'pending'
    and not exists (
      select 1
      from public.stripe_subscriptions subscription
      where subscription.stripe_subscription_id = recovery.stripe_subscription_id
        and subscription.status in ('active', 'trialing')
    );

  update public.subscription_activation_recoveries recovery
  set status = 'activated',
      activated_at = coalesce(recovery.activated_at, now()),
      lease_token = null,
      lease_expires_at = null,
      last_error_code = null,
      updated_at = now()
  where recovery.status = 'pending'
    and exists (
      select 1
      from public.customer_monitored_profile_ownership ownership
      join public.monitored_profiles profile
        on profile.id = ownership.monitored_profile_id
      where ownership.customer_account_id = recovery.customer_account_id
        and profile.status <> 'canceled'
    );

  update public.subscription_activation_reminders reminder
  set status = 'suppressed',
      lease_token = null,
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  from public.subscription_activation_recoveries recovery
  where recovery.id = reminder.recovery_id
    and recovery.status in ('activated', 'canceled')
    and reminder.status = 'pending';

  return query
  with due as (
    select recovery.id
    from public.subscription_activation_recoveries recovery
    join public.stripe_subscriptions subscription
      on subscription.stripe_subscription_id = recovery.stripe_subscription_id
    where recovery.status = 'pending'
      and recovery.attempt_count < 5
      and recovery.next_attempt_at <= now()
      and (recovery.lease_expires_at is null or recovery.lease_expires_at <= now())
      and subscription.status in ('active', 'trialing')
      and not exists (
        select 1
        from public.customer_monitored_profile_ownership ownership
        join public.monitored_profiles profile
          on profile.id = ownership.monitored_profile_id
        where ownership.customer_account_id = recovery.customer_account_id
          and profile.status <> 'canceled'
      )
    order by recovery.next_attempt_at asc, recovery.created_at asc
    for update of recovery skip locked
    limit p_limit
  ), claimed as (
    update public.subscription_activation_recoveries recovery
    set lease_token = gen_random_uuid(),
        lease_expires_at = now() + interval '10 minutes',
        last_attempt_at = now(),
        attempt_count = recovery.attempt_count + 1,
        updated_at = now()
    from due
    where recovery.id = due.id
    returning recovery.id, recovery.lease_token, recovery.attempt_count
  )
  select claimed.id, claimed.lease_token, claimed.attempt_count
  from claimed;
end;
$$;

create or replace function public.attempt_subscription_activation_recovery(
  p_recovery_id uuid,
  p_lease_token uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_recovery public.subscription_activation_recoveries%rowtype;
  v_auth_user_id uuid;
  v_setup jsonb;
  v_error_code text;
  v_activated boolean;
begin
  select recovery.*
  into v_recovery
  from public.subscription_activation_recoveries recovery
  where recovery.id = p_recovery_id
    and recovery.status = 'pending'
    and recovery.lease_token = p_lease_token
    and recovery.lease_expires_at > now()
  for update;

  if not found then
    return jsonb_build_object('status', 'stale_claim');
  end if;

  if not exists (
    select 1
    from public.stripe_subscriptions subscription
    where subscription.stripe_subscription_id = v_recovery.stripe_subscription_id
      and subscription.status in ('active', 'trialing')
  ) then
    update public.subscription_activation_recoveries
    set status = 'canceled',
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where id = v_recovery.id;
    return jsonb_build_object('status', 'canceled');
  end if;

  select exists (
    select 1
    from public.customer_monitored_profile_ownership ownership
    join public.monitored_profiles profile
      on profile.id = ownership.monitored_profile_id
    where ownership.customer_account_id = v_recovery.customer_account_id
      and profile.status <> 'canceled'
  ) into v_activated;

  if not v_activated then
    select account.auth_user_id
    into v_auth_user_id
    from public.customer_accounts account
    where account.id = v_recovery.customer_account_id;

    if v_auth_user_id is not null then
      v_setup := public.create_customer_monitored_search(
        v_auth_user_id,
        v_recovery.source_scan_id
      );
      v_error_code := nullif(v_setup->>'error_code', '');
      v_activated := v_setup ? 'saved_search_id';
    else
      v_error_code := 'ACCOUNT_NOT_FOUND';
    end if;
  end if;

  if not v_activated then
    select exists (
      select 1
      from public.customer_monitored_profile_ownership ownership
      join public.monitored_profiles profile
        on profile.id = ownership.monitored_profile_id
      where ownership.customer_account_id = v_recovery.customer_account_id
        and profile.status <> 'canceled'
    ) into v_activated;
  end if;

  if v_activated then
    update public.subscription_activation_recoveries
    set status = 'activated',
        activated_at = coalesce(activated_at, now()),
        lease_token = null,
        lease_expires_at = null,
        last_error_code = null,
        updated_at = now()
    where id = v_recovery.id;

    update public.subscription_activation_reminders
    set status = 'suppressed',
        lease_token = null,
        lease_expires_at = null,
        last_error = null,
        updated_at = now()
    where recovery_id = v_recovery.id
      and status = 'pending';

    return jsonb_build_object('status', 'activated');
  end if;

  v_error_code := coalesce(v_error_code, 'TEMPORARY_SETUP_FAILURE');

  update public.subscription_activation_recoveries
  set status = case when attempt_count >= 5 then 'dead_letter' else 'pending' end,
      next_attempt_at = case
        when attempt_count >= 5 then next_attempt_at
        when attempt_count = 1 then now() + interval '15 minutes'
        when attempt_count = 2 then now() + interval '30 minutes'
        when attempt_count = 3 then now() + interval '1 hour'
        else now() + interval '2 hours'
      end,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = left(regexp_replace(upper(v_error_code), '[^A-Z0-9_]', '_', 'g'), 80),
      updated_at = now()
  where id = v_recovery.id;

  insert into public.subscription_activation_reminders (
    recovery_id,
    reminder_sequence,
    status,
    scheduled_at
  ) values (
    v_recovery.id,
    1,
    'pending',
    now()
  )
  on conflict (recovery_id, reminder_sequence) do nothing;

  return jsonb_build_object(
    'status',
    case when v_recovery.attempt_count >= 5 then 'dead_letter' else 'retrying' end
  );
end;
$$;

create or replace function public.claim_pending_subscription_activation_reminders(
  p_limit integer default 5
) returns table (
  reminder_id uuid,
  lease_token uuid,
  source_scan_id uuid,
  recipient_email text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Invalid subscription activation reminder claim limit';
  end if;

  update public.subscription_activation_reminders reminder
  set status = 'suppressed',
      lease_token = null,
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  from public.subscription_activation_recoveries recovery
  where recovery.id = reminder.recovery_id
    and reminder.status = 'pending'
    and (
      recovery.status in ('activated', 'canceled')
      or exists (
        select 1
        from public.customer_monitored_profile_ownership ownership
        join public.monitored_profiles profile
          on profile.id = ownership.monitored_profile_id
        where ownership.customer_account_id = recovery.customer_account_id
          and profile.status <> 'canceled'
      )
      or not exists (
        select 1
        from public.stripe_subscriptions subscription
        where subscription.stripe_subscription_id = recovery.stripe_subscription_id
          and subscription.status in ('active', 'trialing')
      )
    );

  return query
  with due as (
    select reminder.id
    from public.subscription_activation_reminders reminder
    join public.subscription_activation_recoveries recovery
      on recovery.id = reminder.recovery_id
    join public.stripe_subscriptions subscription
      on subscription.stripe_subscription_id = recovery.stripe_subscription_id
    where reminder.status = 'pending'
      and reminder.attempt_count < 5
      and reminder.scheduled_at <= now()
      and (reminder.lease_expires_at is null or reminder.lease_expires_at <= now())
      and recovery.status in ('pending', 'dead_letter')
      and subscription.status in ('active', 'trialing')
      and not exists (
        select 1
        from public.customer_monitored_profile_ownership ownership
        join public.monitored_profiles profile
          on profile.id = ownership.monitored_profile_id
        where ownership.customer_account_id = recovery.customer_account_id
          and profile.status <> 'canceled'
      )
    order by reminder.scheduled_at asc, reminder.created_at asc
    for update of reminder skip locked
    limit p_limit
  ), claimed as (
    update public.subscription_activation_reminders reminder
    set lease_token = gen_random_uuid(),
        lease_expires_at = now() + interval '10 minutes',
        attempt_count = reminder.attempt_count + 1,
        updated_at = now()
    from due
    where reminder.id = due.id
    returning reminder.*
  )
  select
    claimed.id,
    claimed.lease_token,
    recovery.source_scan_id,
    account.email,
    claimed.attempt_count
  from claimed
  join public.subscription_activation_recoveries recovery
    on recovery.id = claimed.recovery_id
  join public.customer_accounts account
    on account.id = recovery.customer_account_id;
end;
$$;

create or replace function public.complete_subscription_activation_reminder(
  p_reminder_id uuid,
  p_lease_token uuid,
  p_provider_message_id text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.subscription_activation_reminders
  set status = 'sent',
      delivered_at = now(),
      provider_message_id = left(p_provider_message_id, 255),
      lease_token = null,
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  where id = p_reminder_id
    and status = 'pending'
    and lease_token = p_lease_token
    and lease_expires_at > now()
    and char_length(btrim(p_provider_message_id)) between 1 and 255;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.release_subscription_activation_reminder(
  p_reminder_id uuid,
  p_lease_token uuid,
  p_error text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
begin
  update public.subscription_activation_reminders reminder
  set status = case when reminder.attempt_count >= 5 then 'dead_letter' else 'pending' end,
      scheduled_at = case
        when reminder.attempt_count >= 5 then reminder.scheduled_at
        when reminder.attempt_count = 1 then now() + interval '15 minutes'
        when reminder.attempt_count = 2 then now() + interval '30 minutes'
        when reminder.attempt_count = 3 then now() + interval '1 hour'
        else now() + interval '2 hours'
      end,
      lease_token = null,
      lease_expires_at = null,
      last_error = left(
        coalesce(nullif(btrim(p_error), ''), 'Subscription activation reminder failed.'),
        500
      ),
      updated_at = now()
  where reminder.id = p_reminder_id
    and reminder.status = 'pending'
    and reminder.lease_token = p_lease_token
  returning reminder.status into v_status;
  return v_status;
end;
$$;

create or replace function public.get_subscription_activation_recovery_health()
returns table (
  active_without_profile_count bigint,
  untracked_count bigint,
  pending_recovery_count bigint,
  stale_recovery_count bigint,
  dead_letter_recovery_count bigint,
  pending_reminder_count bigint,
  dead_letter_reminder_count bigint,
  oldest_unactivated_age_seconds bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with eligible as (
    select
      subscription.stripe_subscription_id,
      subscription.created_at,
      account.id as customer_account_id
    from public.stripe_subscriptions subscription
    join public.stripe_customers customer
      on customer.stripe_customer_id = subscription.stripe_customer_id
    join public.customer_accounts account
      on account.stripe_customer_id = subscription.stripe_customer_id
      or (
        account.stripe_customer_id is null
        and customer.email is not null
        and lower(account.email) = lower(customer.email)
      )
    where subscription.status in ('active', 'trialing')
      and subscription.product in ('monitor', 'growth')
      and subscription.created_at <= now() - interval '15 minutes'
      and not exists (
        select 1
        from public.customer_monitored_profile_ownership ownership
        join public.monitored_profiles profile
          on profile.id = ownership.monitored_profile_id
        where ownership.customer_account_id = account.id
          and profile.status <> 'canceled'
      )
  )
  select
    (select count(*) from eligible),
    (
      select count(*)
      from eligible
      where not exists (
        select 1
        from public.subscription_activation_recoveries recovery
        where recovery.stripe_subscription_id = eligible.stripe_subscription_id
      )
    ),
    (
      select count(*)
      from public.subscription_activation_recoveries recovery
      where recovery.status = 'pending'
    ),
    (
      select count(*)
      from public.subscription_activation_recoveries recovery
      where recovery.status = 'pending'
        and recovery.next_attempt_at < now() - interval '15 minutes'
    ),
    (
      select count(*)
      from public.subscription_activation_recoveries recovery
      where recovery.status = 'dead_letter'
    ),
    (
      select count(*)
      from public.subscription_activation_reminders reminder
      where reminder.status = 'pending'
    ),
    (
      select count(*)
      from public.subscription_activation_reminders reminder
      where reminder.status = 'dead_letter'
    ),
    coalesce((
      select greatest(
        0,
        floor(extract(epoch from (now() - min(eligible.created_at))))::bigint
      )
      from eligible
    ), 0);
$$;

revoke all on table public.subscription_activation_recoveries
  from public, anon, authenticated;
revoke all on table public.subscription_activation_reminders
  from public, anon, authenticated;
grant all on table public.subscription_activation_recoveries to service_role;
grant all on table public.subscription_activation_reminders to service_role;

revoke all on function public.register_subscription_activation_recovery(
  text, text, text, uuid
) from public, anon, authenticated;
revoke all on function public.claim_due_subscription_activation_recoveries(integer)
  from public, anon, authenticated;
revoke all on function public.attempt_subscription_activation_recovery(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_pending_subscription_activation_reminders(integer)
  from public, anon, authenticated;
revoke all on function public.complete_subscription_activation_reminder(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.release_subscription_activation_reminder(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.get_subscription_activation_recovery_health()
  from public, anon, authenticated;

grant execute on function public.register_subscription_activation_recovery(
  text, text, text, uuid
) to service_role;
grant execute on function public.claim_due_subscription_activation_recoveries(integer)
  to service_role;
grant execute on function public.attempt_subscription_activation_recovery(uuid, uuid)
  to service_role;
grant execute on function public.claim_pending_subscription_activation_reminders(integer)
  to service_role;
grant execute on function public.complete_subscription_activation_reminder(uuid, uuid, text)
  to service_role;
grant execute on function public.release_subscription_activation_reminder(uuid, uuid, text)
  to service_role;
grant execute on function public.get_subscription_activation_recovery_health()
  to service_role;
