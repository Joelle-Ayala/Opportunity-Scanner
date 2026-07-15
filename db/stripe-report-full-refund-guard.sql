-- Preserve Report access for partial refunds while keeping full refunds terminal.
-- Apply immediately after stripe-report-payment-lifecycle.sql.

create or replace function public.process_stripe_webhook_event_unchecked(
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
declare
  v_processed boolean;
  v_object jsonb := p_payload #> '{data,object}';
  v_payment_intent_id text;
  v_lifecycle_event text;
  v_purchase_email text;
begin
  perform set_config('app.report_purchase_email', '', true);

  if p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
    and v_object->>'mode' = 'payment'
    and v_object->>'payment_status' = 'paid'
    and v_object #>> '{metadata,product}' = 'report'
    and v_object #>> '{metadata,price_id}' = p_price_catalog->>'report'
  then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'payment_confirmed';
    v_purchase_email := lower(btrim(v_object #>> '{customer_details,email}'));
    perform set_config('app.report_purchase_email', coalesce(v_purchase_email, ''), true);
  elsif p_event_type = 'charge.refunded'
    and coalesce((v_object->>'refunded')::boolean, false)
  then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'refunded';
  elsif p_event_type = 'charge.dispute.created' then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'dispute_open';
  elsif p_event_type = 'charge.dispute.closed' then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := case
      when v_object->>'status' = 'won' then 'dispute_won'
      else 'dispute_lost'
    end;
  elsif p_event_type = 'charge.dispute.funds_reinstated' then
    v_payment_intent_id := nullif(v_object->>'payment_intent', '');
    v_lifecycle_event := 'dispute_cleared';
  end if;

  v_processed := public.process_stripe_webhook_event_before_report_lifecycle_v0023(
    p_event_id,
    p_event_type,
    p_stripe_created_at,
    p_payload,
    p_price_catalog
  );

  if not v_processed then
    return false;
  end if;

  if v_lifecycle_event is not null then
    perform public.merge_stripe_report_payment_lifecycle(
      v_payment_intent_id,
      v_lifecycle_event,
      p_stripe_created_at
    );
    perform public.reconcile_stripe_report_access_grant(v_payment_intent_id);
  end if;

  return true;
end;
$$;

revoke all on function public.process_stripe_webhook_event_unchecked(
  text, text, timestamptz, jsonb, jsonb
) from public, anon, authenticated, service_role;
