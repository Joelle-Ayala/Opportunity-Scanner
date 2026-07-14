-- Operator-owned migration history. Apply this file before the manifest migrations.
-- This file is idempotent and intentionally contains no connection configuration.

create table if not exists public.schema_migrations (
  version text primary key check (version ~ '^v[0-9]{4}$'),
  migration_file text not null unique check (migration_file ~ '^db/[a-z0-9][a-z0-9-]*\.sql$'),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_version integer not null check (manifest_version > 0),
  applied_at timestamptz not null default now(),
  applied_by text not null default current_user
);

comment on table public.schema_migrations is
  'Append-only operator ledger for db/migration-manifest.json.';

alter table public.schema_migrations enable row level security;
revoke all on table public.schema_migrations from public, anon, authenticated, service_role;

create or replace function public.reject_schema_migration_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'schema_migrations is append-only';
end;
$$;

drop trigger if exists schema_migrations_reject_update_delete on public.schema_migrations;
create trigger schema_migrations_reject_update_delete
before update or delete on public.schema_migrations
for each row execute function public.reject_schema_migration_mutation();

drop trigger if exists schema_migrations_reject_truncate on public.schema_migrations;
create trigger schema_migrations_reject_truncate
before truncate on public.schema_migrations
for each statement execute function public.reject_schema_migration_mutation();

create or replace function public.record_schema_migration(
  p_version text,
  p_migration_file text,
  p_checksum_sha256 text,
  p_manifest_version integer
) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  existing public.schema_migrations%rowtype;
  version_number integer;
  previous_version text;
begin
  -- Serialize operator writes so two deploys cannot record history out of order.
  perform pg_advisory_xact_lock(hashtextextended('public.schema_migrations', 0));

  select *
  into existing
  from public.schema_migrations
  where version = p_version;

  if found then
    if existing.migration_file is distinct from p_migration_file
      or existing.checksum_sha256 is distinct from p_checksum_sha256
      or existing.manifest_version is distinct from p_manifest_version
    then
      raise exception 'Migration % is already recorded with different metadata', p_version;
    end if;

    return;
  end if;

  if p_version !~ '^v[0-9]{4}$' then
    raise exception 'Invalid migration version %', p_version;
  end if;

  version_number := substring(p_version from 2)::integer;
  if version_number < 1 then
    raise exception 'Migration versions start at v0001';
  end if;

  if version_number > 1 then
    previous_version := 'v' || lpad((version_number - 1)::text, 4, '0');
    if not exists (
      select 1
      from public.schema_migrations
      where version = previous_version
    ) then
      raise exception 'Migration % requires % to be recorded first', p_version, previous_version;
    end if;
  end if;

  insert into public.schema_migrations (
    version,
    migration_file,
    checksum_sha256,
    manifest_version
  ) values (
    p_version,
    p_migration_file,
    p_checksum_sha256,
    p_manifest_version
  );
end;
$$;

revoke all on function public.reject_schema_migration_mutation()
  from public, anon, authenticated, service_role;
revoke all on function public.record_schema_migration(text, text, text, integer)
  from public, anon, authenticated, service_role;
