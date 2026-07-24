import type { DashboardBillingState } from "./types";

export type EffectiveMonitoringPlan = {
  id: string;
  source: "stripe" | "demo";
  product: "monitor" | "growth";
  billingInterval: "monthly" | "annual" | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
};

function monitoringSubscriptions(billing: DashboardBillingState) {
  return billing.subscriptions.filter(
    (subscription) => subscription.product === "monitor" || subscription.product === "growth"
  );
}

export function activeMonitoringPlan(
  billing: DashboardBillingState
): EffectiveMonitoringPlan | null {
  const activeStripe = monitoringSubscriptions(billing).find(
    (subscription) => subscription.status === "active" || subscription.status === "trialing"
  );
  if (activeStripe?.product) {
    return { ...activeStripe, source: "stripe", product: activeStripe.product };
  }
  if (billing.demoPlan) {
    return {
      id: "demo-growth",
      source: "demo",
      product: billing.demoPlan.plan,
      billingInterval: null,
      status: billing.demoPlan.status,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: billing.demoPlan.expiresAt
    };
  }
  return null;
}

export function displayedMonitoringPlan(
  billing: DashboardBillingState
): EffectiveMonitoringPlan | null {
  const active = activeMonitoringPlan(billing);
  if (active) return active;
  const latestStripe = monitoringSubscriptions(billing)[0];
  return latestStripe?.product
    ? { ...latestStripe, source: "stripe", product: latestStripe.product }
    : null;
}
