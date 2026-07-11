import { getBillingDatabaseConfig, type StripeServerConfig } from "./config";

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
