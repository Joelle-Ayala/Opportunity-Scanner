-- Keep scheduled monitoring scans in the owning customer's report library.
-- Apply after customer-dashboard.sql and monitoring.sql.

create or replace function attach_monitoring_scan_to_customer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into customer_scan_ownership (customer_account_id, scan_id, ownership_kind)
  select ownership.customer_account_id, new.scan_id, 'created'
  from customer_monitored_profile_ownership ownership
  where ownership.monitored_profile_id = new.monitored_profile_id
  on conflict (scan_id) do nothing;
  return new;
end;
$$;

drop trigger if exists monitoring_runs_attach_customer_scan on monitoring_runs;
create trigger monitoring_runs_attach_customer_scan
after insert on monitoring_runs
for each row execute function attach_monitoring_scan_to_customer();

insert into customer_scan_ownership (customer_account_id, scan_id, ownership_kind)
select ownership.customer_account_id, run.scan_id, 'created'
from monitoring_runs run
join customer_monitored_profile_ownership ownership
  on ownership.monitored_profile_id = run.monitored_profile_id
on conflict (scan_id) do nothing;

revoke all on function attach_monitoring_scan_to_customer() from public, anon, authenticated;
