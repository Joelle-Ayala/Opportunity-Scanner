"use client";

import { useEffect } from "react";
import {
  scanDurationBucket,
  signalCountBucket,
  trackProductEvent,
  type BillingPeriod,
  type MonitoringOnboardingState,
  type PurchasePlan,
  type ReportTier,
  type SubscriptionPlan
} from "@/lib/productAnalytics";

export function PurchaseCompletedAnalytics({
  plan,
  billingPeriod,
  eventKey
}: {
  plan: PurchasePlan;
  billingPeriod: BillingPeriod;
  eventKey: string;
}) {
  useEffect(() => {
    const storageKey = `opportunity-scanner:purchase-completed:${eventKey}`;
    if (window.sessionStorage.getItem(storageKey)) return;
    trackProductEvent("purchase_completed", { plan, billing_period: billingPeriod });
    window.sessionStorage.setItem(storageKey, "1");
  }, [billingPeriod, eventKey, plan]);

  return null;
}

export function PricingAnalytics({ source }: { source: "navigation" | "report_gate" | "checkout_return" | "unknown" }) {
  useEffect(() => {
    trackProductEvent("pricing_viewed", { source });
  }, [source]);

  return null;
}

export function DashboardAnalytics({
  subscriptionPlan,
  hasActiveMonitoring,
  onboardingCompleted = false
}: {
  subscriptionPlan: SubscriptionPlan;
  hasActiveMonitoring: boolean;
  onboardingCompleted?: boolean;
}) {
  useEffect(() => {
    trackProductEvent("dashboard_viewed", {
      subscription_plan: subscriptionPlan,
      has_active_monitoring: hasActiveMonitoring
    });
    if (onboardingCompleted && subscriptionPlan !== "none") {
      trackProductEvent("monitoring_onboarding_completed", { subscription_plan: subscriptionPlan });
    }
  }, [hasActiveMonitoring, onboardingCompleted, subscriptionPlan]);

  return null;
}

export function MonitoringOnboardingAnalytics({
  subscriptionPlan,
  state
}: {
  subscriptionPlan: Exclude<SubscriptionPlan, "none">;
  state: MonitoringOnboardingState;
}) {
  useEffect(() => {
    trackProductEvent("monitoring_onboarding_viewed", {
      subscription_plan: subscriptionPlan,
      state
    });
  }, [state, subscriptionPlan]);

  return null;
}

export function ReportAnalytics({
  scanId,
  tier,
  signalCount,
  createdAt,
  completedAt
}: {
  scanId: string;
  tier: ReportTier;
  signalCount: number;
  createdAt: string;
  completedAt?: string | null;
}) {
  useEffect(() => {
    const countBucket = signalCountBucket(signalCount);
    trackProductEvent("scan_viewed", { report_tier: tier, signal_count_bucket: countBucket });

    const completionKey = `opportunity-scanner:scan-completed:${scanId}`;
    if (window.sessionStorage.getItem(completionKey)) return;
    trackProductEvent("scan_completed", {
      outcome: "success",
      signal_count_bucket: countBucket,
      duration_bucket: scanDurationBucket(createdAt, completedAt)
    });
    window.sessionStorage.setItem(completionKey, "1");
  }, [completedAt, createdAt, scanId, signalCount, tier]);

  return null;
}
