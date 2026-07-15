-- Prevent Stripe access and delivery from outrunning report publication.
-- Apply after stripe-report-payment-lifecycle.sql.

create or replace function public.require_published_scan_for_report_access()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'active' and not exists (
    select 1
    from public.scans scan
    where scan.id = new.scan_id
      and scan.status = 'completed'
  ) then
    raise exception 'Report access requires a completed quality-approved scan';
  end if;
  return new;
end;
$$;

drop trigger if exists stripe_report_access_requires_published_scan
  on public.stripe_report_access_grants;
create trigger stripe_report_access_requires_published_scan
before insert or update of scan_id, status
on public.stripe_report_access_grants
for each row execute function public.require_published_scan_for_report_access();

create or replace function public.require_published_scan_for_report_delivery()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.stripe_report_access_grants report_grant
    join public.scans scan on scan.id = report_grant.scan_id
    where report_grant.id = new.report_access_grant_id
      and report_grant.status = 'active'
      and scan.status = 'completed'
  ) then
    raise exception 'Paid report delivery requires an active grant for a completed quality-approved scan';
  end if;
  return new;
end;
$$;

drop trigger if exists paid_report_delivery_requires_published_scan
  on public.paid_report_delivery_attempts;
create trigger paid_report_delivery_requires_published_scan
before insert or update of report_access_grant_id, status
on public.paid_report_delivery_attempts
for each row execute function public.require_published_scan_for_report_delivery();

revoke all on function public.require_published_scan_for_report_access() from public, anon, authenticated;
revoke all on function public.require_published_scan_for_report_delivery() from public, anon, authenticated;
grant execute on function public.require_published_scan_for_report_access() to service_role;
grant execute on function public.require_published_scan_for_report_delivery() to service_role;
