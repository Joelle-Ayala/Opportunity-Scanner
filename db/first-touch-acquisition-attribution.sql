alter table public.scans add column if not exists first_touch_id uuid;
alter table public.scans add column if not exists first_touch_at timestamptz;
alter table public.scans add column if not exists first_touch_landing_path text;
alter table public.scans add column if not exists first_touch_referrer_host text;

alter table public.scans drop constraint if exists scans_first_touch_complete;
alter table public.scans add constraint scans_first_touch_complete check (
  (
    first_touch_id is null
    and first_touch_at is null
    and first_touch_landing_path is null
    and first_touch_referrer_host is null
  )
  or (
    first_touch_id is not null
    and first_touch_at is not null
    and first_touch_landing_path is not null
  )
);

alter table public.scans drop constraint if exists scans_first_touch_at_window;
alter table public.scans add constraint scans_first_touch_at_window check (
  first_touch_at is null
  or (
    first_touch_at >= created_at - interval '90 days'
    and first_touch_at <= created_at + interval '5 minutes'
  )
);

alter table public.scans drop constraint if exists scans_first_touch_landing_path_format;
alter table public.scans add constraint scans_first_touch_landing_path_format check (
  first_touch_landing_path is null
  or (
    octet_length(first_touch_landing_path) between 1 and 512
    and left(first_touch_landing_path, 1) = '/'
    and left(first_touch_landing_path, 2) <> '//'
    and first_touch_landing_path !~ '[?#]'
  )
);

alter table public.scans drop constraint if exists scans_first_touch_referrer_host_format;
alter table public.scans add constraint scans_first_touch_referrer_host_format check (
  first_touch_referrer_host is null
  or (
    octet_length(first_touch_referrer_host) between 1 and 253
    and first_touch_referrer_host = lower(first_touch_referrer_host)
    and first_touch_referrer_host !~ '[[:space:]/@?#]'
  )
);

create index if not exists scans_first_touch_id_created_at_idx
  on public.scans(first_touch_id, created_at desc)
  where first_touch_id is not null;
