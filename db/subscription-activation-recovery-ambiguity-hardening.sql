-- Replace subscription activation recovery RPCs with definitions that cannot
-- collide with PL/pgSQL output variables or identifiers. This migration is
-- idempotent and preserves the service-only execution contract.

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

  -- Recover older live subscriptions only when identity and source report are unambiguous.
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
        and subscription.livemode = true
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
    subscription.stripe_subscription_id,
    account.id,
    latest_scan.scan_id,
    'pending',
    greatest(subscription.stripe_event_created_at + interval '15 minutes', now())
  from public.stripe_subscriptions subscription
  join public.customer_accounts account
    on account.stripe_customer_id = subscription.stripe_customer_id
  join lateral (
    select
      ownership.scan_id
    from public.customer_scan_ownership ownership
    join public.scans scan
      on scan.id = ownership.scan_id
     and scan.status = 'completed'
    where ownership.customer_account_id = account.id
      and not exists (
        select 1
        from public.customer_scan_saved_search_versions scan_version
        where scan_version.scan_id = ownership.scan_id
      )
    order by
      coalesce(scan.completed_at, scan.created_at) desc,
      ownership.created_at desc,
      ownership.scan_id desc
    limit 1
  ) latest_scan on true
  where subscription.livemode = true
    and subscription.status in ('active', 'trialing')
    and subscription.product in ('monitor', 'growth')
    and subscription.created_at <= now() - interval '15 minutes'
    and not exists (
      select 1
      from public.subscription_activation_recoveries existing_recovery
      where existing_recovery.stripe_subscription_id = subscription.stripe_subscription_id
    )
    and not exists (
      select 1
      from public.customer_monitored_profile_ownership profile_ownership
      join public.monitored_profiles profile
        on profile.id = profile_ownership.monitored_profile_id
      where profile_ownership.customer_account_id = account.id
        and profile.status <> 'canceled'
    )
  on conflict do nothing;

  update public.subscription_activation_recoveries recovery
  set status = 'canceled',
      lease_token = null,
      lease_expires_at = null,
      updated_at = now()
  where recovery.status in ('pending', 'dead_letter')
    and not exists (
      select 1
      from public.stripe_subscriptions subscription
      where subscription.stripe_subscription_id = recovery.stripe_subscription_id
        and subscription.livemode = true
        and subscription.status in ('active', 'trialing')
        and subscription.product in ('monitor', 'growth')
    );

  update public.subscription_activation_recoveries recovery
  set status = 'activated',
      activated_at = coalesce(recovery.activated_at, now()),
      lease_token = null,
      lease_expires_at = null,
      last_error_code = null,
      updated_at = now()
  where recovery.status in ('pending', 'dead_letter')
    and exists (
      select 1
      from public.customer_monitored_profile_ownership ownership
      join public.monitored_profiles profile
        on profile.id = ownership.monitored_profile_id
      where ownership.customer_account_id = recovery.customer_account_id
        and profile.status <> 'canceled'
    );

  update public.subscription_activation_recoveries recovery
  set status = 'dead_letter',
      lease_token = null,
      lease_expires_at = null,
      last_error_code = coalesce(
        recovery.last_error_code,
        'RECOVERY_ATTEMPTS_EXHAUSTED'
      ),
      updated_at = now()
  where recovery.status = 'pending'
    and recovery.attempt_count >= 5
    and (recovery.lease_expires_at is null or recovery.lease_expires_at <= now());

  insert into public.subscription_activation_reminders (
    recovery_id,
    reminder_sequence,
    status,
    scheduled_at
  )
  select recovery.id, 1, 'pending', now()
  from public.subscription_activation_recoveries recovery
  where recovery.status = 'dead_letter'
    and exists (
      select 1
      from public.stripe_subscriptions subscription
      where subscription.stripe_subscription_id = recovery.stripe_subscription_id
        and subscription.livemode = true
        and subscription.status in ('active', 'trialing')
        and subscription.product in ('monitor', 'growth')
    )
    and not exists (
      select 1
      from public.customer_monitored_profile_ownership ownership
      join public.monitored_profiles profile
        on profile.id = ownership.monitored_profile_id
      where ownership.customer_account_id = recovery.customer_account_id
        and profile.status <> 'canceled'
    )
  on conflict do nothing;

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
  with due_recoveries as (
    select recovery.id as due_recovery_id
    from public.subscription_activation_recoveries recovery
    join public.stripe_subscriptions subscription
      on subscription.stripe_subscription_id = recovery.stripe_subscription_id
    where recovery.status = 'pending'
      and recovery.attempt_count < 5
      and recovery.next_attempt_at <= now()
      and (recovery.lease_expires_at is null or recovery.lease_expires_at <= now())
      and subscription.livemode = true
      and subscription.status in ('active', 'trialing')
      and subscription.product in ('monitor', 'growth')
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
  ), claimed_recoveries as (
    update public.subscription_activation_recoveries recovery
    set lease_token = gen_random_uuid(),
        lease_expires_at = now() + interval '10 minutes',
        last_attempt_at = now(),
        attempt_count = recovery.attempt_count + 1,
        updated_at = now()
    from due_recoveries
    where recovery.id = due_recoveries.due_recovery_id
    returning
      recovery.id as claimed_recovery_id,
      recovery.lease_token as claimed_lease_token,
      recovery.attempt_count as claimed_attempt_count
  )
  select
    claimed_recoveries.claimed_recovery_id,
    claimed_recoveries.claimed_lease_token,
    claimed_recoveries.claimed_attempt_count
  from claimed_recoveries;
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

  perform 1
  from public.stripe_subscriptions subscription
  where subscription.stripe_subscription_id = v_recovery.stripe_subscription_id
    and subscription.livemode = true
    and subscription.status in ('active', 'trialing')
    and subscription.product in ('monitor', 'growth')
  for share;

  if not found then
    update public.subscription_activation_recoveries recovery
    set status = 'canceled',
        lease_token = null,
        lease_expires_at = null,
        updated_at = now()
    where recovery.id = v_recovery.id;
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
    update public.subscription_activation_recoveries recovery
    set status = 'activated',
        activated_at = coalesce(recovery.activated_at, now()),
        lease_token = null,
        lease_expires_at = null,
        last_error_code = null,
        updated_at = now()
    where recovery.id = v_recovery.id;

    update public.subscription_activation_reminders reminder
    set status = 'suppressed',
        lease_token = null,
        lease_expires_at = null,
        last_error = null,
        updated_at = now()
    where reminder.recovery_id = v_recovery.id
      and reminder.status in ('pending', 'dead_letter');

    return jsonb_build_object('status', 'activated');
  end if;

  v_error_code := coalesce(v_error_code, 'TEMPORARY_SETUP_FAILURE');

  update public.subscription_activation_recoveries recovery
  set status = case
        when recovery.attempt_count >= 5 then 'dead_letter'
        else 'pending'
      end,
      next_attempt_at = case
        when recovery.attempt_count >= 5 then recovery.next_attempt_at
        when recovery.attempt_count = 1 then now() + interval '15 minutes'
        when recovery.attempt_count = 2 then now() + interval '30 minutes'
        when recovery.attempt_count = 3 then now() + interval '1 hour'
        else now() + interval '2 hours'
      end,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = left(
        regexp_replace(upper(v_error_code), '[^A-Z0-9_]', '_', 'g'),
        80
      ),
      updated_at = now()
  where recovery.id = v_recovery.id;

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
  on conflict do nothing;

  return jsonb_build_object(
    'status',
    case when v_recovery.attempt_count >= 5 then 'dead_letter' else 'retrying' end
  );
end;
$$;

create or replace function public.release_subscription_activation_recovery(
  p_recovery_id uuid,
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
  update public.subscription_activation_recoveries recovery
  set status = case
        when recovery.attempt_count >= 5 then 'dead_letter'
        else 'pending'
      end,
      next_attempt_at = case
        when recovery.attempt_count >= 5 then recovery.next_attempt_at
        when recovery.attempt_count = 1 then now() + interval '15 minutes'
        when recovery.attempt_count = 2 then now() + interval '30 minutes'
        when recovery.attempt_count = 3 then now() + interval '1 hour'
        else now() + interval '2 hours'
      end,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = left(
        regexp_replace(
          upper(coalesce(nullif(btrim(p_error), ''), 'RECOVERY_ATTEMPT_FAILED')),
          '[^A-Z0-9_]',
          '_',
          'g'
        ),
        80
      ),
      updated_at = now()
  where recovery.id = p_recovery_id
    and recovery.status = 'pending'
    and recovery.lease_token = p_lease_token
  returning recovery.status into v_status;

  if v_status is not null then
    insert into public.subscription_activation_reminders (
      recovery_id,
      reminder_sequence,
      status,
      scheduled_at
    ) values (
      p_recovery_id,
      1,
      'pending',
      now()
    )
    on conflict do nothing;
  end if;

  return v_status;
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
  set status = 'dead_letter',
      lease_token = null,
      lease_expires_at = null,
      last_error = coalesce(
        reminder.last_error,
        'Reminder delivery attempts exhausted.'
      ),
      updated_at = now()
  where reminder.status = 'pending'
    and reminder.attempt_count >= 5
    and (reminder.lease_expires_at is null or reminder.lease_expires_at <= now());

  update public.subscription_activation_reminders reminder
  set status = 'suppressed',
      lease_token = null,
      lease_expires_at = null,
      last_error = null,
      updated_at = now()
  from public.subscription_activation_recoveries recovery
  where recovery.id = reminder.recovery_id
    and reminder.status in ('pending', 'dead_letter')
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
          and subscription.livemode = true
          and subscription.status in ('active', 'trialing')
          and subscription.product in ('monitor', 'growth')
      )
    );

  return query
  with due_reminders as (
    select reminder.id as due_reminder_id
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
      and subscription.livemode = true
      and subscription.status in ('active', 'trialing')
      and subscription.product in ('monitor', 'growth')
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
  ), claimed_reminders as (
    update public.subscription_activation_reminders reminder
    set lease_token = gen_random_uuid(),
        lease_expires_at = now() + interval '10 minutes',
        attempt_count = reminder.attempt_count + 1,
        updated_at = now()
    from due_reminders
    where reminder.id = due_reminders.due_reminder_id
    returning
      reminder.id as claimed_reminder_id,
      reminder.recovery_id as claimed_recovery_id,
      reminder.lease_token as claimed_lease_token,
      reminder.attempt_count as claimed_attempt_count
  )
  select
    claimed_reminders.claimed_reminder_id,
    claimed_reminders.claimed_lease_token,
    recovery.source_scan_id,
    account.email,
    claimed_reminders.claimed_attempt_count
  from claimed_reminders
  join public.subscription_activation_recoveries recovery
    on recovery.id = claimed_reminders.claimed_recovery_id
  join public.customer_accounts account
    on account.id = recovery.customer_account_id;
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
  with eligible_subscriptions as (
    select
      subscription.stripe_subscription_id,
      subscription.created_at as subscription_created_at,
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
    where subscription.livemode = true
      and subscription.status in ('active', 'trialing')
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
    (select count(*) from eligible_subscriptions),
    (
      select count(*)
      from eligible_subscriptions eligible
      where not exists (
        select 1
        from public.subscription_activation_recoveries recovery
        where recovery.stripe_subscription_id = eligible.stripe_subscription_id
      )
    ),
    (
      select count(*)
      from public.subscription_activation_recoveries recovery
      join public.stripe_subscriptions subscription
        on subscription.stripe_subscription_id = recovery.stripe_subscription_id
      where recovery.status = 'pending'
        and subscription.livemode = true
    ),
    (
      select count(*)
      from public.subscription_activation_recoveries recovery
      join public.stripe_subscriptions subscription
        on subscription.stripe_subscription_id = recovery.stripe_subscription_id
      where recovery.status = 'pending'
        and recovery.next_attempt_at < now() - interval '15 minutes'
        and subscription.livemode = true
    ),
    (
      select count(*)
      from public.subscription_activation_recoveries recovery
      join public.stripe_subscriptions subscription
        on subscription.stripe_subscription_id = recovery.stripe_subscription_id
      where recovery.status = 'dead_letter'
        and subscription.livemode = true
        and not exists (
          select 1
          from public.customer_monitored_profile_ownership ownership
          join public.monitored_profiles profile
            on profile.id = ownership.monitored_profile_id
          where ownership.customer_account_id = recovery.customer_account_id
            and profile.status <> 'canceled'
        )
    ),
    (
      select count(*)
      from public.subscription_activation_reminders reminder
      join public.subscription_activation_recoveries recovery
        on recovery.id = reminder.recovery_id
      join public.stripe_subscriptions subscription
        on subscription.stripe_subscription_id = recovery.stripe_subscription_id
      where reminder.status = 'pending'
        and subscription.livemode = true
    ),
    (
      select count(*)
      from public.subscription_activation_reminders reminder
      join public.subscription_activation_recoveries recovery
        on recovery.id = reminder.recovery_id
      join public.stripe_subscriptions subscription
        on subscription.stripe_subscription_id = recovery.stripe_subscription_id
      where reminder.status = 'dead_letter'
        and subscription.livemode = true
        and not exists (
          select 1
          from public.customer_monitored_profile_ownership ownership
          join public.monitored_profiles profile
            on profile.id = ownership.monitored_profile_id
          where ownership.customer_account_id = recovery.customer_account_id
            and profile.status <> 'canceled'
        )
    ),
    coalesce((
      select greatest(
        0,
        floor(
          extract(epoch from (now() - min(eligible.subscription_created_at)))
        )::bigint
      )
      from eligible_subscriptions eligible
    ), 0);
$$;

revoke all on function public.claim_due_subscription_activation_recoveries(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.attempt_subscription_activation_recovery(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.release_subscription_activation_recovery(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_pending_subscription_activation_reminders(integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_subscription_activation_recovery_health()
  from public, anon, authenticated, service_role;

grant execute on function public.claim_due_subscription_activation_recoveries(integer)
  to service_role;
grant execute on function public.attempt_subscription_activation_recovery(uuid, uuid)
  to service_role;
grant execute on function public.release_subscription_activation_recovery(uuid, uuid, text)
  to service_role;
grant execute on function public.claim_pending_subscription_activation_reminders(integer)
  to service_role;
grant execute on function public.get_subscription_activation_recovery_health()
  to service_role;
