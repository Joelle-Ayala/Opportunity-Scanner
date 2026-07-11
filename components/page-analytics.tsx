"use client";

import { useEffect } from "react";
import {
  scanDurationBucket,
  signalCountBucket,
  trackProductEvent,
  type ReportTier
} from "@/lib/productAnalytics";

export function PricingAnalytics({ source }: { source: "navigation" | "report_gate" | "checkout_return" | "unknown" }) {
  useEffect(() => {
    trackProductEvent("pricing_viewed", { source });
  }, [source]);

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
