-- Harden subscription activation recovery after the initial recovery rollout.
-- Apply after subscription-activation-recovery.sql.

create table if not exists public.schema_migration_corrections (
  version text primary key references public.schema_migrations(version) on delete restrict,
  recorded_checksum_sha256 text not null check (recorded_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  applied_checksum_sha256 text not null check (applied_checksum_sha256 ~ '^[0-9a-f]{64}$'),
  reason text not null check (char_length(reason) between 1 and 500),
  corrected_at timestamptz not null default now(),
  corrected_by text not null default current_user
);

alter table public.schema_migration_corrections enable row level security;
revoke all on table public.schema_migration_corrections
  from public, anon, authenticated, service_role;

drop trigger if exists schema_migration_corrections_reject_update_delete
  on public.schema_migration_corrections;
create trigger schema_migration_corrections_reject_update_delete
before update or delete on public.schema_migration_corrections
for each statement execute function public.reject_schema_migration_mutation();

drop trigger if exists schema_migration_corrections_reject_truncate
  on public.schema_migration_corrections;
create trigger schema_migration_corrections_reject_truncate
before truncate on public.schema_migration_corrections
for each statement execute function public.reject_schema_migration_mutation();

do $$
declare
  existing public.schema_migration_corrections%rowtype;
  recorded_checksum text;
begin
  select migration.checksum_sha256
  into recorded_checksum
  from public.schema_migrations migration
  where migration.version = 'v0032';

  if recorded_checksum is null then
    raise exception 'v0032 must be recorded before applying v0033';
  end if;

  if recorded_checksum = '1025299c3b390e4d36e7af59d0f982f9b3573cee418d757f70939771d1bb6f0b' then
    return;
  end if;

  if recorded_checksum <> 'a291754b0456a734d41881e6b439b11c21200795e3d30eef84083dbfd6311e4a' then
    raise exception 'Unexpected v0032 migration checksum: %', recorded_checksum;
  end if;

  select *
  into existing
  from public.schema_migration_corrections
  where version = 'v0032';

  if found then
    if existing.recorded_checksum_sha256 <> 'a291754b0456a734d41881e6b439b11c21200795e3d30eef84083dbfd6311e4a'
      or existing.applied_checksum_sha256 <> '1025299c3b390e4d36e7af59d0f982f9b3573cee418d757f70939771d1bb6f0b'
    then
      raise exception 'Conflicting v0032 migration correction';
    end if;
    return;
  end if;

  insert into public.schema_migration_corrections (
    version,
    recorded_checksum_sha256,
    applied_checksum_sha256,
    reason
  ) values (
    'v0032',
    'a291754b0456a734d41881e6b439b11c21200795e3d30eef84083dbfd6311e4a',
    '1025299c3b390e4d36e7af59d0f982f9b3573cee418d757f70939771d1bb6f0b',
    'The v0032 ledger entry used a provisional checksum while the complete reviewed v0032 SQL was applied in the same transaction.'
  );
end;
$$;

create or replace view public.schema_migration_effective_checksums
with (security_invoker = true)
as
select
  migration.version,
  migration.migration_file,
  migration.checksum_sha256 as recorded_checksum_sha256,
  coalesce(correction.applied_checksum_sha256, migration.checksum_sha256)
    as effective_checksum_sha256,
  migration.manifest_version,
  migration.applied_at,
  correction.corrected_at
from public.schema_migrations migration
left join public.schema_migration_corrections correction
  on correction.version = migration.version;

revoke all on table public.schema_migration_effective_checksums
  from public, anon, authenticated, service_role;

create or replace function public.enforce_live_subscription_activation_recovery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.stripe_subscriptions subscription
    where subscription.stripe_subscription_id = new.stripe_subscription_id
      and subscription.livemode = true
  ) then
    return new;
  end if;

  new.status := 'canceled';
  new.lease_token := null;
  new.lease_expires_at := null;
  new.last_error_code := 'NON_LIVE_SUBSCRIPTION';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists subscription_activation_recovery_live_mode
  on public.subscription_activation_recoveries;
create trigger subscription_activation_recovery_live_mode
before insert or update on public.subscription_activation_recoveries
for each row execute function public.enforce_live_subscription_activation_recovery();

update public.subscription_activation_recoveries recovery
set status = 'canceled',
    lease_token = null,
    lease_expires_at = null,
    last_error_code = 'NON_LIVE_SUBSCRIPTION',
    updated_at = now()
where not exists (
  select 1
  from public.stripe_subscriptions subscription
  where subscription.stripe_subscription_id = recovery.stripe_subscription_id
    and subscription.livemode = true
);

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
    and subscription.livemode = true
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
    where subscription.livemode = true
      and subscription.status in ('active', 'trialing')
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
      last_error_code = coalesce(recovery.last_error_code, 'RECOVERY_ATTEMPTS_EXHAUSTED'),
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
  on conflict (recovery_id, reminder_sequence) do nothing;

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

-- Keep entitlement selection live-only even when test and live Stripe records
-- share a customer identifier in the same database.
create or replace function public.create_customer_monitored_search(
  p_auth_user_id uuid,
  p_scan_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.customer_accounts%rowtype;
  v_subscription public.stripe_subscriptions%rowtype;
  v_scan public.scans%rowtype;
  v_limit integer;
  v_saved_search_id uuid;
  v_version_id uuid;
  v_profile_id uuid;
  v_search_name text;
begin
  select account.*
  into v_account
  from public.customer_accounts account
  where account.auth_user_id = p_auth_user_id
  for update;

  if not found then
    return jsonb_build_object('error_code', 'AUTHENTICATION_REQUIRED');
  end if;

  if v_account.stripe_customer_id is null then
    return jsonb_build_object('error_code', 'PLAN_REQUIRED');
  end if;

  select subscription.*
  into v_subscription
  from public.stripe_subscriptions subscription
  where subscription.stripe_customer_id = v_account.stripe_customer_id
    and subscription.livemode = true
    and subscription.status in ('active', 'trialing')
    and subscription.product in ('monitor', 'growth')
  order by subscription.created_at desc
  limit 1
  for share;

  if not found then
    return jsonb_build_object('error_code', 'PLAN_REQUIRED');
  end if;

  v_limit := case when v_subscription.product = 'growth' then 3 else 1 end;
  if (
    select count(*)
    from public.customer_monitored_profile_ownership ownership
    join public.monitored_profiles profile
      on profile.id = ownership.monitored_profile_id
    where ownership.customer_account_id = v_account.id
      and profile.status <> 'canceled'
  ) >= v_limit then
    return jsonb_build_object('error_code', 'LIMIT_REACHED');
  end if;

  select scan.*
  into v_scan
  from public.scans scan
  join public.customer_scan_ownership ownership
    on ownership.scan_id = scan.id
   and ownership.customer_account_id = v_account.id
  where scan.id = p_scan_id
    and scan.status = 'completed'
    and not exists (
      select 1
      from public.monitored_profiles profile
      where profile.stripe_customer_id = v_account.stripe_customer_id
        and profile.source_scan_id = scan.id
    )
    and not exists (
      select 1
      from public.customer_scan_saved_search_versions scan_version
      where scan_version.scan_id = scan.id
    )
  for share of scan;

  if not found then
    return jsonb_build_object('error_code', 'REPORT_NOT_ELIGIBLE');
  end if;

  v_search_name := left(
    coalesce(
      nullif(btrim(v_scan.company_name), ''),
      nullif(
        regexp_replace(v_scan.company_url, '^https?://(www\.)?|/.*$', '', 'gi'),
        ''
      ),
      'Saved search'
    ),
    120
  );

  insert into public.customer_saved_searches (
    customer_account_id,
    name,
    status
  ) values (
    v_account.id,
    v_search_name,
    'active'
  )
  returning id into v_saved_search_id;

  insert into public.customer_saved_search_versions (
    saved_search_id,
    version,
    configuration,
    created_by_auth_user_id
  ) values (
    v_saved_search_id,
    1,
    jsonb_build_object(
      'companyUrl', v_scan.company_url,
      'industry', v_scan.industry,
      'headquartersState', v_scan.headquarters_state,
      'targetStates', v_scan.target_states,
      'customerType', v_scan.customer_type,
      'opportunityFocus', v_scan.opportunity_focus,
      'includeTerms', v_scan.include_terms,
      'excludeTerms', v_scan.exclude_terms,
      'prioritySignals', v_scan.priority_signals
    ),
    p_auth_user_id
  )
  returning id into v_version_id;

  update public.customer_saved_searches
  set current_version_id = v_version_id,
      updated_at = now()
  where id = v_saved_search_id;

  insert into public.monitored_profiles (
    stripe_customer_id,
    source_scan_id,
    latest_scan_id,
    cadence,
    status,
    next_run_at
  ) values (
    v_account.stripe_customer_id,
    p_scan_id,
    p_scan_id,
    case when v_subscription.product = 'growth' then 'daily' else 'weekly' end,
    'active',
    now()
  )
  returning id into v_profile_id;

  insert into public.customer_scan_saved_search_versions (
    scan_id,
    saved_search_version_id
  ) values (
    p_scan_id,
    v_version_id
  );

  insert into public.customer_monitored_profile_ownership (
    customer_account_id,
    monitored_profile_id
  ) values (
    v_account.id,
    v_profile_id
  );

  insert into public.customer_monitored_profile_saved_search_versions (
    monitored_profile_id,
    saved_search_version_id
  ) values (
    v_profile_id,
    v_version_id
  );

  return jsonb_build_object('saved_search_id', v_saved_search_id);
end;
$$;

revoke all on function public.create_customer_monitored_search(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_customer_monitored_search(uuid, uuid)
  to service_role;

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
      and status in ('pending', 'dead_letter');

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
  set status = case when recovery.attempt_count >= 5 then 'dead_letter' else 'pending' end,
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
    on conflict (recovery_id, reminder_sequence) do nothing;
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
      last_error = coalesce(reminder.last_error, 'Reminder delivery attempts exhausted.'),
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
        floor(extract(epoch from (now() - min(eligible.created_at))))::bigint
      )
      from eligible
    ), 0);
$$;

revoke all on function public.enforce_live_subscription_activation_recovery()
  from public, anon, authenticated, service_role;
revoke all on function public.register_subscription_activation_recovery(text, text, text, uuid)
  from public, anon, authenticated, service_role;
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
grant execute on function public.register_subscription_activation_recovery(text, text, text, uuid)
  to service_role;
grant execute on function public.attempt_subscription_activation_recovery(uuid, uuid)
  to service_role;
grant execute on function public.release_subscription_activation_recovery(uuid, uuid, text)
  to service_role;
grant execute on function public.claim_pending_subscription_activation_reminders(integer)
  to service_role;
grant execute on function public.get_subscription_activation_recovery_health()
  to service_role;
