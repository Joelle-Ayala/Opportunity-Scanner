const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2026-02-25.clover";
const STRIPE_TIMEOUT_MS = 10_000;

type StripeRequestOptions = {
  method?: "GET" | "POST";
  form?: Record<string, string>;
  idempotencyKey?: string;
};

export type StripeCheckoutSession = {
  id: string;
  created?: number;
  livemode?: boolean;
  url?: string | null;
  client_reference_id?: string | null;
  status?: string;
  mode?: string;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  customer?: string | { id?: string } | null;
  customer_details?: { email?: string | null } | null;
  line_items?: {
    has_more?: boolean;
    data?: Array<{
      quantity?: number | null;
      price?: string | { id?: string } | null;
    }>;
  } | null;
  subscription?:
    | string
    | {
        id?: string;
        customer?: string | { id?: string } | null;
        status?: string;
        current_period_start?: number;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
        metadata?: Record<string, string> | null;
        items?: {
          data?: Array<{
            current_period_start?: number;
            current_period_end?: number;
            price?: string | { id?: string } | null;
          }>;
        };
      }
    | null;
  payment_intent?:
    | string
    | {
        id?: string;
        latest_charge?: string | { id?: string; refunded?: boolean; amount_refunded?: number } | null;
      }
    | null;
  metadata?: Record<string, string> | null;
};

export type StripeCatalogProduct = {
  id?: string;
  active?: boolean;
  livemode?: boolean;
};

export type StripeCatalogPrice = {
  id?: string;
  active?: boolean;
  currency?: string;
  livemode?: boolean;
  product?: string | StripeCatalogProduct | null;
  recurring?: { interval?: string } | null;
  type?: string;
  unit_amount?: number | null;
};

async function stripeRequest<T>(secretKey: string, path: string, options: StripeRequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": STRIPE_API_VERSION
  };
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.form) headers["Content-Type"] = "application/x-www-form-urlencoded";

  try {
    const response = await fetch(`${STRIPE_API_BASE}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.form ? new URLSearchParams(options.form).toString() : undefined,
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Stripe request failed with status ${response.status}.`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createCheckoutSession(input: {
  secretKey: string;
  priceId: string;
  mode: "payment" | "subscription";
  plan: string;
  interval: string | null;
  email: string;
  customerId: string | null;
  scanId: string | null;
  requestId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  const form: Record<string, string> = {
    mode: input.mode,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[product]": input.plan,
    "metadata[billing_interval]": input.interval ?? "one_time",
    "metadata[price_id]": input.priceId,
    "metadata[request_id]": input.requestId
  };
  if (input.customerId) {
    form.customer = input.customerId;
  } else {
    form.customer_email = input.email;
    // Anonymous payment-mode purchases must create a durable, isolated Stripe Customer.
    if (input.mode === "payment") form.customer_creation = "always";
  }
  if (input.scanId) {
    form.client_reference_id = input.scanId;
    form["metadata[scan_id]"] = input.scanId;
  }
  if (input.mode === "subscription") {
    form["subscription_data[metadata][product]"] = input.plan;
    form["subscription_data[metadata][billing_interval]"] = input.interval ?? "";
    form["subscription_data[metadata][request_id]"] = input.requestId;
    if (input.scanId) form["subscription_data[metadata][scan_id]"] = input.scanId;
  }
  return stripeRequest<StripeCheckoutSession>(input.secretKey, "/checkout/sessions", {
    method: "POST",
    form,
    idempotencyKey: `opportunity-scanner-checkout-${input.requestId}`
  });
}

export function retrieveStripePrice(secretKey: string, priceId: string): Promise<StripeCatalogPrice> {
  const query = new URLSearchParams({ "expand[]": "product" });
  return stripeRequest<StripeCatalogPrice>(
    secretKey,
    `/prices/${encodeURIComponent(priceId)}?${query.toString()}`
  );
}

export function retrieveCheckoutSession(secretKey: string, sessionId: string): Promise<StripeCheckoutSession> {
  const query = new URLSearchParams();
  for (const expansion of [
    "payment_intent.latest_charge",
    "line_items.data.price",
    "subscription",
    "subscription.items.data.price"
  ]) {
    query.append("expand[]", expansion);
  }
  return stripeRequest<StripeCheckoutSession>(
    secretKey,
    `/checkout/sessions/${encodeURIComponent(sessionId)}?${query.toString()}`
  );
}

export function createBillingPortalSession(secretKey: string, customerId: string, returnUrl: string) {
  return stripeRequest<{ url?: string | null }>(secretKey, "/billing_portal/sessions", {
    method: "POST",
    form: { customer: customerId, return_url: returnUrl }
  });
}
