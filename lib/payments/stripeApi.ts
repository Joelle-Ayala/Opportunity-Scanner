const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2026-02-25.clover";
const STRIPE_TIMEOUT_MS = 10_000;

type StripeRequestOptions = {
  method?: "GET" | "POST";
  form?: Record<string, string>;
  idempotencyKey?: string;
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  status?: string;
  customer?: string | { id?: string } | null;
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
  scanId: string | null;
  requestId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<StripeCheckoutSession> {
  const form: Record<string, string> = {
    mode: input.mode,
    "line_items[0][price]": input.priceId,
    "line_items[0][quantity]": "1",
    customer_email: input.email,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    "metadata[product]": input.plan,
    "metadata[billing_interval]": input.interval ?? "one_time",
    "metadata[price_id]": input.priceId,
    "metadata[request_id]": input.requestId
  };
  if (input.scanId) {
    form.client_reference_id = input.scanId;
    form["metadata[scan_id]"] = input.scanId;
  }
  if (input.mode === "subscription") {
    form["subscription_data[metadata][product]"] = input.plan;
    form["subscription_data[metadata][billing_interval]"] = input.interval ?? "";
    form["subscription_data[metadata][request_id]"] = input.requestId;
  }
  return stripeRequest<StripeCheckoutSession>(input.secretKey, "/checkout/sessions", {
    method: "POST",
    form,
    idempotencyKey: `opportunity-scanner-checkout-${input.requestId}`
  });
}

export function retrieveCheckoutSession(secretKey: string, sessionId: string): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}`);
}

export function createBillingPortalSession(secretKey: string, customerId: string, returnUrl: string) {
  return stripeRequest<{ url?: string | null }>(secretKey, "/billing_portal/sessions", {
    method: "POST",
    form: { customer: customerId, return_url: returnUrl }
  });
}
