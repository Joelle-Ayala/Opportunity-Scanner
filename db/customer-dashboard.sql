-- Customer dashboard identity, ownership, and saved-search history.
-- Apply after schema.sql, stripe-billing-expansion.sql, and monitoring.sql.

create table if not exists customer_accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique references stripe_customers(stripe_customer_id) on delete set null,
  email text not null check (
    char_length(email) between 3 and 254
    and email = lower(btrim(email))
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_scan_ownership (
  customer_account_id uuid not null references customer_accounts(id) on delete cascade,
  scan_id uuid not null unique references scans(id) on delete cascade,
  ownership_kind text not null default 'created' check (ownership_kind in ('created', 'claimed')),
  created_at timestamptz not null default now(),
  primary key (customer_account_id, scan_id)
);

create table if not exists customer_report_grant_ownership (
  customer_account_id uuid not null references customer_accounts(id) on delete cascade,
  report_access_grant_id uuid not null unique references stripe_report_access_grants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_account_id, report_access_grant_id)
);

create table if not exists customer_monitored_profile_ownership (
  customer_account_id uuid not null references customer_accounts(id) on delete cascade,
  monitored_profile_id uuid not null unique references monitored_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_account_id, monitored_profile_id)
);

create table if not exists customer_saved_searches (
  id uuid primary key default gen_random_uuid(),
  customer_account_id uuid not null references customer_accounts(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_saved_search_versions (
  id uuid primary key default gen_random_uuid(),
  saved_search_id uuid not null references customer_saved_searches(id) on delete cascade,
  version integer not null check (version > 0),
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  created_by_auth_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (saved_search_id, version),
  unique (saved_search_id, id)
);

alter table customer_saved_searches
  drop constraint if exists customer_saved_searches_current_version_fkey;
alter table customer_saved_searches
  add constraint customer_saved_searches_current_version_fkey
  foreign key (id, current_version_id)
  references customer_saved_search_versions(saved_search_id, id)
  on delete no action
  deferrable initially deferred;

create or replace function reject_customer_saved_search_version_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Saved search versions are immutable; insert a new version instead.';
end;
$$;

drop trigger if exists customer_saved_search_versions_immutable
  on customer_saved_search_versions;
create trigger customer_saved_search_versions_immutable
before update on customer_saved_search_versions
for each row execute function reject_customer_saved_search_version_update();

create table if not exists customer_scan_saved_search_versions (
  scan_id uuid primary key references scans(id) on delete cascade,
  saved_search_version_id uuid not null references customer_saved_search_versions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists customer_monitored_profile_saved_search_versions (
  monitored_profile_id uuid primary key references monitored_profiles(id) on delete cascade,
  saved_search_version_id uuid not null references customer_saved_search_versions(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists customer_accounts_email_unique_idx
  on customer_accounts(lower(email));
create index if not exists customer_scan_ownership_account_created_idx
  on customer_scan_ownership(customer_account_id, created_at desc);
create index if not exists customer_report_grant_ownership_account_idx
  on customer_report_grant_ownership(customer_account_id);
create index if not exists customer_monitored_profile_ownership_account_idx
  on customer_monitored_profile_ownership(customer_account_id);
create index if not exists customer_saved_searches_account_updated_idx
  on customer_saved_searches(customer_account_id, updated_at desc);
create index if not exists customer_saved_search_versions_search_created_idx
  on customer_saved_search_versions(saved_search_id, created_at desc);
create index if not exists customer_scan_saved_search_versions_version_idx
  on customer_scan_saved_search_versions(saved_search_version_id);

alter table customer_accounts enable row level security;
alter table customer_scan_ownership enable row level security;
alter table customer_report_grant_ownership enable row level security;
alter table customer_monitored_profile_ownership enable row level security;
alter table customer_saved_searches enable row level security;
alter table customer_saved_search_versions enable row level security;
alter table customer_scan_saved_search_versions enable row level security;
alter table customer_monitored_profile_saved_search_versions enable row level security;

-- Dashboard reads are server-side only. RLS remains closed to browser roles.
revoke all on customer_accounts from anon, authenticated;
revoke all on customer_scan_ownership from anon, authenticated;
revoke all on customer_report_grant_ownership from anon, authenticated;
revoke all on customer_monitored_profile_ownership from anon, authenticated;
revoke all on customer_saved_searches from anon, authenticated;
revoke all on customer_saved_search_versions from anon, authenticated;
revoke all on customer_scan_saved_search_versions from anon, authenticated;
revoke all on customer_monitored_profile_saved_search_versions from anon, authenticated;

grant all on customer_accounts to service_role;
grant all on customer_scan_ownership to service_role;
grant all on customer_report_grant_ownership to service_role;
grant all on customer_monitored_profile_ownership to service_role;
grant all on customer_saved_searches to service_role;
grant all on customer_saved_search_versions to service_role;
grant all on customer_scan_saved_search_versions to service_role;
grant all on customer_monitored_profile_saved_search_versions to service_role;

revoke all on function reject_customer_saved_search_version_update() from public;
