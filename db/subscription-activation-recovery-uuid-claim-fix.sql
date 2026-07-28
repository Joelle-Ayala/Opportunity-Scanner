-- Repair the v0033 recovery claim's UUID aggregate without rewriting history.
-- PostgreSQL does not define min(uuid); the existing count(*) = 1 guard means
-- taking the first aggregated UUID preserves the intended unambiguous match.

do $migration$
declare
  v_function regprocedure;
  v_definition text;
begin
  v_function := to_regprocedure(
    'public.claim_due_subscription_activation_recoveries(integer)'
  );
  if v_function is null then
    raise exception 'claim_due_subscription_activation_recoveries(integer) is missing';
  end if;

  select pg_get_functiondef(v_function)
  into v_definition;

  if position('(array_agg(candidate.scan_id))[1]' in v_definition) > 0 then
    return;
  end if;

  if position('min(candidate.scan_id)' in v_definition) = 0 then
    raise exception 'Unexpected subscription activation recovery claim definition';
  end if;

  execute replace(
    v_definition,
    'min(candidate.scan_id)',
    '(array_agg(candidate.scan_id))[1]'
  );
end;
$migration$;

revoke all on function public.claim_due_subscription_activation_recoveries(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_due_subscription_activation_recoveries(integer)
  to service_role;
