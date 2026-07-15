do $migration$
begin
  if to_regprocedure(
    'public.process_stripe_webhook_event_unchecked(text,text,timestamptz,jsonb,jsonb)'
  ) is null then
    if to_regprocedure(
      'public.process_stripe_webhook_event(text,text,timestamptz,jsonb,jsonb)'
    ) is null then
      raise exception 'process_stripe_webhook_event must exist before live-mode enforcement';
    end if;

    alter function public.process_stripe_webhook_event(text, text, timestamptz, jsonb, jsonb)
      rename to process_stripe_webhook_event_unchecked;
  end if;
end;
$migration$;

revoke all on function public.process_stripe_webhook_event_unchecked(text, text, timestamptz, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.process_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_stripe_created_at timestamptz,
  p_payload jsonb,
  p_price_catalog jsonb
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce((p_price_catalog->>'requireLivemode')::boolean, false) then
    if p_payload->'livemode' is distinct from 'true'::jsonb
      or p_payload #> '{data,object,livemode}' is distinct from 'true'::jsonb
    then
      raise exception 'Production Stripe webhook event and object must be live mode';
    end if;

    if p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
      and coalesce(p_payload #>> '{data,object,id}', '') !~ '^cs_live_[A-Za-z0-9]+$'
    then
      raise exception 'Production Stripe Checkout session must be live mode';
    end if;
  end if;

  return public.process_stripe_webhook_event_unchecked(
    p_event_id,
    p_event_type,
    p_stripe_created_at,
    p_payload,
    p_price_catalog
  );
end;
$$;

revoke all on function public.process_stripe_webhook_event(text, text, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.process_stripe_webhook_event(text, text, timestamptz, jsonb, jsonb)
  to service_role;
