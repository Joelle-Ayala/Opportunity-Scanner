type VerifiedPurchase = {
  plan: "full_report" | "monitor" | "growth";
  billingPeriod: "one_time" | "monthly" | "annual";
};

function eventObject(event: Record<string, unknown>): Record<string, unknown> | null {
  const data = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const object = (data as Record<string, unknown>).object;
  return object && typeof object === "object" && !Array.isArray(object)
    ? object as Record<string, unknown>
    : null;
}

export function verifiedPurchaseFromStripeEvent(event: Record<string, unknown>): VerifiedPurchase | null {
  const eventType = typeof event.type === "string" ? event.type : "";
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(eventType)) return null;
  const object = eventObject(event);
  if (!object) return null;
  if (eventType === "checkout.session.completed" && object.payment_status !== "paid") return null;
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const product = (metadata as Record<string, unknown>).product;
  const interval = (metadata as Record<string, unknown>).billing_interval;
  const plan = product === "report" ? "full_report" : product;
  if (!['full_report', 'monitor', 'growth'].includes(String(plan))) return null;
  if (!['one_time', 'monthly', 'annual'].includes(String(interval))) return null;
  return {
    plan: plan as VerifiedPurchase["plan"],
    billingPeriod: interval as VerifiedPurchase["billingPeriod"]
  };
}

export async function trackVerifiedStripePurchase(event: Record<string, unknown>): Promise<boolean> {
  const purchase = verifiedPurchaseFromStripeEvent(event);
  if (!purchase) return false;
  const { track } = await import("@vercel/analytics/server");
  await track("purchase_completed", {
    plan: purchase.plan,
    billing_period: purchase.billingPeriod
  });
  return true;
}
