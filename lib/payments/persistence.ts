import { getBillingDatabaseConfig, type StripeServerConfig } from "./config.ts";
import type { StripeCheckoutSession } from "./stripeApi.ts";
import type { VerifiedSubscriptionCheckout } from "./accessContract.ts";

function databaseHeaders(config: ReturnType<typeof getBillingDatabaseConfig>): Record<string, string> {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`
  };
}

export async function reportScanExists(scanId: string): Promise<boolean> {
  const config = getBillingDatabaseConfig();
  const query = new URLSearchParams({ select: "id", id: `eq.${scanId}`, limit: "1" });
  const response = await fetch(`${config.url}/rest/v1/scans?${query.toString()}`, {
    headers: databaseHeaders(config),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Report scan lookup failed with status ${response.status}.`);
  const rows = (await response.json()) as Array<{ id?: string }>;
  return rows[0]?.id === scanId;
}

export async function fulfillVerifiedReportCheckout(
  scanId: string,
  session: StripeCheckoutSession,
  account?: { authUserId: string; accountId: string }
): Promise<boolean> {
  const config = getBillingDatabaseConfig();
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const customerEmail = session.customer_details?.email?.trim().toLowerCase();
  const paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  if (
    !customerId?.startsWith("cus_") ||
    !customerEmail ||
    customerEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
    !paymentIntent?.id?.startsWith("pi_") ||
    !Number.isInteger(session.created) ||
    (session.created ?? 0) <= 0
  ) {
    return false;
  }

  const hasVerifiedAccount = Boolean(
    account &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(account.authUserId) &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(account.accountId)
  );
  if (account && !hasVerifiedAccount) return false;
  const rpc = hasVerifiedAccount
    ? "fulfill_verified_customer_report_checkout"
    : "fulfill_verified_report_checkout";
  const response = await fetch(`${config.url}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      ...databaseHeaders(config),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...(hasVerifiedAccount ? {
        p_auth_user_id: account!.authUserId,
        p_customer_account_id: account!.accountId
      } : {}),
      p_scan_id: scanId,
      p_customer_id: customerId,
      p_customer_email: customerEmail,
      p_checkout_session_id: session.id,
      p_payment_intent_id: paymentIntent.id,
      p_session_created_at: new Date((session.created ?? 0) * 1000).toISOString(),
      p_livemode: session.livemode === true
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Report checkout fulfillment failed with status ${response.status}.`);
  return (await response.json()) === true;
}

export async function fulfillVerifiedSubscriptionCheckout(
  account: { authUserId: string; accountId: string },
  checkout: VerifiedSubscriptionCheckout
): Promise<boolean> {
  const config = getBillingDatabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/fulfill_verified_subscription_checkout`, {
    method: "POST",
    headers: {
      ...databaseHeaders(config),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_auth_user_id: account.authUserId,
      p_customer_account_id: account.accountId,
      p_customer_id: checkout.customerId,
      p_customer_email: checkout.customerEmail,
      p_subscription_id: checkout.subscriptionId,
      p_price_id: checkout.priceId,
      p_product: checkout.product,
      p_billing_interval: checkout.billingInterval,
      p_subscription_status: checkout.status,
      p_cancel_at_period_end: checkout.cancelAtPeriodEnd,
      p_current_period_start: checkout.currentPeriodStart
        ? new Date(checkout.currentPeriodStart * 1000).toISOString()
        : null,
      p_current_period_end: checkout.currentPeriodEnd
        ? new Date(checkout.currentPeriodEnd * 1000).toISOString()
        : null,
      p_session_created_at: new Date(checkout.sessionCreated * 1000).toISOString(),
      p_livemode: checkout.livemode
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Subscription checkout fulfillment failed with status ${response.status}.`);
  return (await response.json()) === true;
}

export async function persistStripeWebhookEvent(
  event: Record<string, unknown>,
  prices: StripeServerConfig["prices"]
): Promise<boolean> {
  const config = getBillingDatabaseConfig();
  const eventId = typeof event.id === "string" ? event.id : "";
  const eventType = typeof event.type === "string" ? event.type : "";
  const created = typeof event.created === "number" ? event.created : 0;
  if (!/^evt_[A-Za-z0-9]+$/.test(eventId) || !eventType || !Number.isInteger(created) || created <= 0) {
    throw new Error("Stripe event envelope is invalid.");
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/process_stripe_webhook_event`, {
    method: "POST",
    headers: {
      ...databaseHeaders(config),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_event_id: eventId,
      p_event_type: eventType,
      p_stripe_created_at: new Date(created * 1000).toISOString(),
      p_payload: event,
      p_price_catalog: prices
    }),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Billing persistence failed with status ${response.status}.`);
  return (await response.json()) === true;
}
