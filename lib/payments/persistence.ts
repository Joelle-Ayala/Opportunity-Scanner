import { getBillingDatabaseConfig, type StripeServerConfig } from "./config";
import type { StripeCheckoutSession } from "./stripeApi";

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

export async function hasActiveStripeReportGrant(scanId: string): Promise<boolean> {
  const config = getBillingDatabaseConfig();
  const query = new URLSearchParams({
    select: "id",
    scan_id: `eq.${scanId}`,
    status: "eq.active",
    limit: "1"
  });
  const response = await fetch(`${config.url}/rest/v1/stripe_report_access_grants?${query.toString()}`, {
    headers: databaseHeaders(config),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Report access lookup failed with status ${response.status}.`);
  const rows = (await response.json()) as Array<{ id?: string }>;
  return typeof rows[0]?.id === "string";
}

export async function fulfillVerifiedReportCheckout(
  scanId: string,
  session: StripeCheckoutSession
): Promise<boolean> {
  const config = getBillingDatabaseConfig();
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  if (
    !customerId?.startsWith("cus_") ||
    !paymentIntent?.id?.startsWith("pi_") ||
    !Number.isInteger(session.created) ||
    (session.created ?? 0) <= 0
  ) {
    return false;
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/fulfill_verified_report_checkout`, {
    method: "POST",
    headers: {
      ...databaseHeaders(config),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_scan_id: scanId,
      p_customer_id: customerId,
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
