create table if not exists monitored_profiles (
  id uuid primary key default gen_random_uuid(),
  stripe_customer_id text not null references stripe_customers(stripe_customer_id) on delete restrict,
  source_scan_id uuid not null references scans(id) on delete restrict,
  latest_scan_id uuid references scans(id) on delete set null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  status text not null default 'active' check (status in ('active', 'paused', 'canceled')),
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stripe_customer_id, source_scan_id)
);

create table if not exists monitoring_runs (
  id uuid primary key default gen_random_uuid(),
  monitored_profile_id uuid not null references monitored_profiles(id) on delete cascade,
  scan_id uuid not null references scans(id) on delete cascade,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  new_opportunity_count integer not null default 0 check (new_opportunity_count >= 0),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists monitoring_alerts (
  id uuid primary key default gen_random_uuid(),
  monitoring_run_id uuid not null references monitoring_runs(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  alert_kind text not null default 'new_opportunity' check (alert_kind = 'new_opportunity'),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed', 'suppressed')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (monitoring_run_id, opportunity_id)
);

create index if not exists monitored_profiles_due_idx
  on monitored_profiles(status, next_run_at)
  where status = 'active';
create index if not exists monitoring_runs_profile_started_idx
  on monitoring_runs(monitored_profile_id, started_at desc);
create index if not exists monitoring_alerts_delivery_idx
  on monitoring_alerts(delivery_status, created_at);

alter table monitored_profiles enable row level security;
alter table monitoring_runs enable row level security;
alter table monitoring_alerts enable row level security;

create or replace function claim_due_monitored_profiles(p_limit integer default 1)
returns setof monitored_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Invalid monitoring claim limit';
  end if;

  return query
  with due as (
    select profile.id
    from monitored_profiles profile
    where profile.status = 'active'
      and profile.next_run_at <= now()
      and (profile.lease_expires_at is null or profile.lease_expires_at <= now())
      and exists (
        select 1
        from stripe_subscriptions subscription
        where subscription.stripe_customer_id = profile.stripe_customer_id
          and subscription.status in ('active', 'trialing')
          and (
            (profile.cadence = 'daily' and subscription.product = 'growth')
            or (profile.cadence = 'weekly' and subscription.product in ('monitor', 'growth'))
          )
      )
    order by profile.next_run_at asc
    for update skip locked
    limit p_limit
  )
  update monitored_profiles profile
  set lease_expires_at = now() + interval '15 minutes', updated_at = now()
  from due
  where profile.id = due.id
  returning profile.*;
end;
$$;

revoke all on function claim_due_monitored_profiles(integer) from public;
revoke all on function claim_due_monitored_profiles(integer) from anon;
revoke all on function claim_due_monitored_profiles(integer) from authenticated;
grant execute on function claim_due_monitored_profiles(integer) to service_role;
