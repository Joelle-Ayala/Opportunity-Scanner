create table if not exists scan_rate_limits (
  subject_type text not null check (subject_type in ('ip', 'email')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_seconds integer not null check (window_seconds between 1 and 86400),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (subject_type, subject_hash, window_seconds, window_started_at)
);

alter table scan_rate_limits enable row level security;

create index if not exists scan_rate_limits_expires_at_idx
  on scan_rate_limits(expires_at);

create or replace function cleanup_scan_rate_limits(p_batch_limit integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if p_batch_limit < 1 or p_batch_limit > 50000 then
    raise exception 'Invalid scan rate-limit cleanup batch size';
  end if;

  with expired as (
    select limit_row.ctid
    from scan_rate_limits limit_row
    where limit_row.expires_at <= now()
    order by limit_row.expires_at asc
    limit p_batch_limit
  )
  delete from scan_rate_limits limit_row
  using expired
  where limit_row.ctid = expired.ctid;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function claim_scan_rate_limits(
  p_ip_hash text,
  p_email_hash text,
  p_ip_limit integer,
  p_ip_window_seconds integer,
  p_email_limit integer,
  p_email_window_seconds integer
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_ip_window_start timestamptz;
  v_email_window_start timestamptz;
  v_ip_count integer := 0;
  v_email_count integer := 0;
  v_ip_allowed boolean := true;
  v_email_allowed boolean := true;
  v_retry_after integer := 0;
begin
  if p_ip_hash is null and p_email_hash is null then
    raise exception 'At least one rate-limit subject is required';
  end if;
  if (p_ip_hash is not null and p_ip_hash !~ '^[0-9a-f]{64}$')
    or (p_email_hash is not null and p_email_hash !~ '^[0-9a-f]{64}$')
  then
    raise exception 'Invalid rate-limit subject hash';
  end if;
  if p_ip_limit < 1 or p_ip_limit > 10000
    or p_email_limit < 1 or p_email_limit > 10000
    or p_ip_window_seconds < 1 or p_ip_window_seconds > 86400
    or p_email_window_seconds < 1 or p_email_window_seconds > 86400
  then
    raise exception 'Invalid scan rate-limit configuration';
  end if;

  -- Keep normal request traffic from allowing expired buckets to accumulate forever.
  perform cleanup_scan_rate_limits(100);

  if p_ip_hash is not null then
    v_ip_window_start := to_timestamp(
      floor(extract(epoch from v_now) / p_ip_window_seconds) * p_ip_window_seconds
    );

    insert into scan_rate_limits (
      subject_type,
      subject_hash,
      window_seconds,
      window_started_at,
      request_count,
      expires_at,
      updated_at
    ) values (
      'ip',
      p_ip_hash,
      p_ip_window_seconds,
      v_ip_window_start,
      1,
      v_ip_window_start + make_interval(secs => p_ip_window_seconds),
      v_now
    )
    on conflict (subject_type, subject_hash, window_seconds, window_started_at)
    do update set
      request_count = scan_rate_limits.request_count + 1,
      updated_at = excluded.updated_at
    returning request_count into v_ip_count;

    v_ip_allowed := v_ip_count <= p_ip_limit;
    if not v_ip_allowed then
      v_retry_after := greatest(
        v_retry_after,
        ceil(extract(epoch from (
          v_ip_window_start + make_interval(secs => p_ip_window_seconds) - v_now
        )))::integer
      );
    end if;
  end if;

  if p_email_hash is not null then
    v_email_window_start := to_timestamp(
      floor(extract(epoch from v_now) / p_email_window_seconds) * p_email_window_seconds
    );

    insert into scan_rate_limits (
      subject_type,
      subject_hash,
      window_seconds,
      window_started_at,
      request_count,
      expires_at,
      updated_at
    ) values (
      'email',
      p_email_hash,
      p_email_window_seconds,
      v_email_window_start,
      1,
      v_email_window_start + make_interval(secs => p_email_window_seconds),
      v_now
    )
    on conflict (subject_type, subject_hash, window_seconds, window_started_at)
    do update set
      request_count = scan_rate_limits.request_count + 1,
      updated_at = excluded.updated_at
    returning request_count into v_email_count;

    v_email_allowed := v_email_count <= p_email_limit;
    if not v_email_allowed then
      v_retry_after := greatest(
        v_retry_after,
        ceil(extract(epoch from (
          v_email_window_start + make_interval(secs => p_email_window_seconds) - v_now
        )))::integer
      );
    end if;
  end if;

  return jsonb_build_object(
    'allowed', v_ip_allowed and v_email_allowed,
    'retry_after_seconds', greatest(v_retry_after, 0)
  );
end;
$$;

revoke all on table scan_rate_limits from public, anon, authenticated;
revoke all on function cleanup_scan_rate_limits(integer) from public, anon, authenticated;
revoke all on function claim_scan_rate_limits(text, text, integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function cleanup_scan_rate_limits(integer) to service_role;
grant execute on function claim_scan_rate_limits(text, text, integer, integer, integer, integer)
  to service_role;
