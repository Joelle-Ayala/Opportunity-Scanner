-- Repair the recovery claim's reminder insert without rewriting migration history.
-- The function returns a recovery_id column, so naming recovery_id again in an
-- ON CONFLICT target is ambiguous inside PL/pgSQL. The insert is idempotent on
-- every unique constraint, making the targetless form equivalent and unambiguous.

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

  if position('on conflict do nothing' in v_definition) > 0 then
    return;
  end if;

  if position('on conflict (recovery_id, reminder_sequence) do nothing' in v_definition) = 0 then
    raise exception 'Unexpected subscription activation recovery claim definition';
  end if;

  execute replace(
    v_definition,
    'on conflict (recovery_id, reminder_sequence) do nothing',
    'on conflict do nothing'
  );
end;
$migration$;

revoke all on function public.claim_due_subscription_activation_recoveries(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_due_subscription_activation_recoveries(integer)
  to service_role;
