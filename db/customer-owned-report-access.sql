alter table customer_scan_ownership
  add column if not exists access_level text not null default 'free';

alter table customer_scan_ownership
  drop constraint if exists customer_scan_ownership_access_level_check;

alter table customer_scan_ownership
  add constraint customer_scan_ownership_access_level_check
  check (access_level in ('free', 'full'));

create index if not exists customer_scan_ownership_full_access_idx
  on customer_scan_ownership(customer_account_id, scan_id)
  where access_level = 'full';
