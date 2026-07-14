create table if not exists stripe_customers (
  stripe_customer_id text primary key check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  email text check (email is null or char_length(email) between 3 and 254),
  livemode boolean not null default false,
  deleted_at timestamptz,
  stripe_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stripe_subscriptions (
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  stripe_customer_id text not null references stripe_customers(stripe_customer_id) on delete restrict,
  stripe_price_id text check (stripe_price_id is null or stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
  product text check (product is null or product in ('monitor', 'growth')),
  billing_interval text check (billing_interval is null or billing_interval in ('monthly', 'annual')),
  status text not null,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  livemode boolean not null default false,
  stripe_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stripe_report_access_grants (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  stripe_customer_id text not null references stripe_customers(stripe_customer_id) on delete restrict,
  stripe_checkout_session_id text not null unique check (stripe_checkout_session_id ~ '^cs_(test_|live_)?[A-Za-z0-9]+$'),
  stripe_payment_intent_id text unique check (
    stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9]+$'
  ),
  status text not null check (status in ('active', 'refunded', 'disputed')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  stripe_event_created_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table stripe_report_access_grants
  drop constraint if exists stripe_report_access_grants_status_check;
alter table stripe_report_access_grants
  add constraint stripe_report_access_grants_status_check
  check (status in ('active', 'refunded', 'disputed'));

create table if not exists stripe_webhook_events (
  stripe_event_id text primary key check (stripe_event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null,
  stripe_created_at timestamptz not null,
  processed_at timestamptz not null default now()
);

create index if not exists stripe_customers_email_idx on stripe_customers(lower(email));
create index if not exists stripe_subscriptions_customer_idx on stripe_subscriptions(stripe_customer_id);
create index if not exists stripe_subscriptions_status_idx on stripe_subscriptions(status);
create index if not exists stripe_report_access_scan_idx on stripe_report_access_grants(scan_id, status);

alter table stripe_customers enable row level security;
alter table stripe_subscriptions enable row level security;
alter table stripe_report_access_grants enable row level security;
alter table stripe_webhook_events enable row level security;

create or replace function process_stripe_webhook_event(
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
  v_claimed text;
  v_object jsonb := p_payload #> '{data,object}';
  v_customer_id text;
  v_email text;
  v_subscription_id text;
  v_product text;
  v_interval text;
  v_price_id text;
  v_scan_id uuid;
  v_period_start timestamptz;
  v_period_end timestamptz;
begin
  if p_event_id !~ '^evt_[A-Za-z0-9]+$'
    or coalesce(p_event_type, '') = ''
    or v_object is null
    or p_payload->>'id' <> p_event_id
    or p_payload->>'type' <> p_event_type
  then
    raise exception 'Invalid Stripe event envelope';
  end if;

  insert into stripe_webhook_events (stripe_event_id, event_type, stripe_created_at)
  values (p_event_id, p_event_type, p_stripe_created_at)
  on conflict (stripe_event_id) do nothing
  returning stripe_event_id into v_claimed;

  if v_claimed is null then
    return false;
  end if;

  if p_event_type in ('customer.created', 'customer.updated', 'customer.deleted') then
    v_customer_id := v_object->>'id';
    if v_customer_id !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid Stripe customer'; end if;
    v_email := nullif(lower(v_object->>'email'), '');
    insert into stripe_customers (stripe_customer_id, email, livemode, deleted_at, stripe_event_created_at)
    values (
      v_customer_id,
      v_email,
      coalesce((p_payload->>'livemode')::boolean, false),
      case when p_event_type = 'customer.deleted' then now() else null end,
      p_stripe_created_at
    )
    on conflict (stripe_customer_id) do update set
      email = coalesce(excluded.email, stripe_customers.email),
      livemode = excluded.livemode,
      deleted_at = excluded.deleted_at,
      stripe_event_created_at = excluded.stripe_event_created_at,
      updated_at = now()
    where stripe_customers.stripe_event_created_at <= excluded.stripe_event_created_at;

  elsif p_event_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded') then
    v_customer_id := v_object->>'customer';
    v_email := nullif(lower(v_object #>> '{customer_details,email}'), '');
    if v_customer_id !~ '^cus_[A-Za-z0-9]+$' then raise exception 'Invalid checkout customer'; end if;
    insert into stripe_customers (stripe_customer_id, email, livemode, stripe_event_created_at)
    values (v_customer_id, v_email, coalesce((p_payload->>'livemode')::boolean, false), p_stripe_created_at)
    on conflict (stripe_customer_id) do update set
      email = coalesce(excluded.email, stripe_customers.email),
      livemode = excluded.livemode,
      deleted_at = null,
      stripe_event_created_at = excluded.stripe_event_created_at,
      updated_at = now()
    where stripe_customers.stripe_event_created_at <= excluded.stripe_event_created_at;

    if v_object->>'mode' = 'payment'
      and v_object->>'payment_status' = 'paid'
      and v_object #>> '{metadata,product}' = 'report'
      and v_object #>> '{metadata,price_id}' = p_price_catalog->>'report'
    then
      if coalesce(v_object #>> '{metadata,scan_id}', '') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
      then
        raise exception 'Invalid report scan metadata';
      end if;
      v_scan_id := (v_object #>> '{metadata,scan_id}')::uuid;
      insert into stripe_report_access_grants (
        scan_id,
        stripe_customer_id,
        stripe_checkout_session_id,
        stripe_payment_intent_id,
        status,
        stripe_event_created_at
      ) values (
        v_scan_id,
        v_customer_id,
        v_object->>'id',
        nullif(v_object->>'payment_intent', ''),
        'active',
        p_stripe_created_at
      )
      on conflict (stripe_checkout_session_id) do update set
        stripe_payment_intent_id = coalesce(excluded.stripe_payment_intent_id, stripe_report_access_grants.stripe_payment_intent_id),
        status = 'active',
        revoked_at = null,
        stripe_event_created_at = excluded.stripe_event_created_at,
        updated_at = now()
      where stripe_report_access_grants.stripe_event_created_at < excluded.stripe_event_created_at;
    end if;

  elsif p_event_type in ('customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted') then
    v_subscription_id := v_object->>'id';
    v_customer_id := v_object->>'customer';
    v_price_id := nullif(v_object #>> '{items,data,0,price,id}', '');
    if v_subscription_id !~ '^sub_[A-Za-z0-9]+$' or v_customer_id !~ '^cus_[A-Za-z0-9]+$' then
      raise exception 'Invalid Stripe subscription';
    end if;
    -- Price is authoritative because portal plan changes do not rewrite subscription metadata.
    case v_price_id
      when p_price_catalog->>'monitorMonthly' then v_product := 'monitor'; v_interval := 'monthly';
      when p_price_catalog->>'monitorAnnual' then v_product := 'monitor'; v_interval := 'annual';
      when p_price_catalog->>'growthMonthly' then v_product := 'growth'; v_interval := 'monthly';
      when p_price_catalog->>'growthAnnual' then v_product := 'growth'; v_interval := 'annual';
      else raise exception 'Subscription Price does not match the server catalog';
    end case;

    if coalesce(v_object->>'current_period_start', '') ~ '^[0-9]+$' then
      v_period_start := to_timestamp((v_object->>'current_period_start')::double precision);
    elsif coalesce(v_object #>> '{items,data,0,current_period_start}', '') ~ '^[0-9]+$' then
      v_period_start := to_timestamp((v_object #>> '{items,data,0,current_period_start}')::double precision);
    end if;
    if coalesce(v_object->>'current_period_end', '') ~ '^[0-9]+$' then
      v_period_end := to_timestamp((v_object->>'current_period_end')::double precision);
    elsif coalesce(v_object #>> '{items,data,0,current_period_end}', '') ~ '^[0-9]+$' then
      v_period_end := to_timestamp((v_object #>> '{items,data,0,current_period_end}')::double precision);
    end if;

    insert into stripe_customers (stripe_customer_id, livemode, stripe_event_created_at)
    values (v_customer_id, coalesce((p_payload->>'livemode')::boolean, false), p_stripe_created_at)
    on conflict (stripe_customer_id) do update set
      deleted_at = null,
      stripe_event_created_at = excluded.stripe_event_created_at,
      updated_at = now()
    where stripe_customers.stripe_event_created_at <= excluded.stripe_event_created_at;

    insert into stripe_subscriptions (
      stripe_subscription_id,
      stripe_customer_id,
      stripe_price_id,
      product,
      billing_interval,
      status,
      cancel_at_period_end,
      current_period_start,
      current_period_end,
      canceled_at,
      livemode,
      stripe_event_created_at
    ) values (
      v_subscription_id,
      v_customer_id,
      v_price_id,
      v_product,
      v_interval,
      case when p_event_type = 'customer.subscription.deleted' then 'canceled' else coalesce(v_object->>'status', 'unknown') end,
      coalesce((v_object->>'cancel_at_period_end')::boolean, false),
      v_period_start,
      v_period_end,
      case
        when coalesce(v_object->>'canceled_at', '') ~ '^[0-9]+$'
          then to_timestamp((v_object->>'canceled_at')::double precision)
        when p_event_type = 'customer.subscription.deleted' then now()
        else null
      end,
      coalesce((p_payload->>'livemode')::boolean, false),
      p_stripe_created_at
    )
    on conflict (stripe_subscription_id) do update set
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_price_id = coalesce(excluded.stripe_price_id, stripe_subscriptions.stripe_price_id),
      product = coalesce(excluded.product, stripe_subscriptions.product),
      billing_interval = coalesce(excluded.billing_interval, stripe_subscriptions.billing_interval),
      status = excluded.status,
      cancel_at_period_end = excluded.cancel_at_period_end,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      canceled_at = excluded.canceled_at,
      livemode = excluded.livemode,
      stripe_event_created_at = excluded.stripe_event_created_at,
      updated_at = now()
    where stripe_subscriptions.stripe_event_created_at < excluded.stripe_event_created_at
      or (
        stripe_subscriptions.stripe_event_created_at = excluded.stripe_event_created_at
        and excluded.status = 'canceled'
      );

  elsif p_event_type in ('invoice.payment_failed', 'invoice.payment_action_required') then
    v_subscription_id := coalesce(
      nullif(v_object->>'subscription', ''),
      nullif(v_object #>> '{parent,subscription_details,subscription}', '')
    );
    if v_subscription_id ~ '^sub_[A-Za-z0-9]+$' then
      update stripe_subscriptions
      set status = case
          when p_event_type = 'invoice.payment_failed' then 'past_due'
          else 'incomplete'
        end,
        stripe_event_created_at = p_stripe_created_at,
        updated_at = now()
      where stripe_subscription_id = v_subscription_id
        and stripe_event_created_at <= p_stripe_created_at;
    end if;

  elsif p_event_type = 'charge.refunded' and coalesce((v_object->>'refunded')::boolean, false) then
    update stripe_report_access_grants
    set status = 'refunded', revoked_at = now(), stripe_event_created_at = p_stripe_created_at, updated_at = now()
    where stripe_payment_intent_id = v_object->>'payment_intent'
      and stripe_event_created_at <= p_stripe_created_at;

  elsif p_event_type = 'charge.dispute.created' then
    update stripe_report_access_grants
    set status = 'disputed', revoked_at = now(), stripe_event_created_at = p_stripe_created_at, updated_at = now()
    where stripe_payment_intent_id = v_object->>'payment_intent'
      and stripe_event_created_at <= p_stripe_created_at;
  end if;

  return true;
end;
$$;

revoke all on function process_stripe_webhook_event(text, text, timestamptz, jsonb, jsonb) from public;
revoke all on function process_stripe_webhook_event(text, text, timestamptz, jsonb, jsonb) from anon;
revoke all on function process_stripe_webhook_event(text, text, timestamptz, jsonb, jsonb) from authenticated;
grant execute on function process_stripe_webhook_event(text, text, timestamptz, jsonb, jsonb) to service_role;
