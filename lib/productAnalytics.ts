export const PRODUCT_ANALYTICS_BROWSER_EVENT = "opportunity-scanner:product-analytics";

export type SignalCountBucket = "0" | "1-3" | "4-10" | "11+";
export type ScanDurationBucket = "under_30_seconds" | "30-89_seconds" | "90_seconds_or_more";
export type ReportTier = "free" | "full";
export type PurchasePlan = "full_report" | "monitor" | "growth";
export type BillingPeriod = "one_time" | "monthly" | "annual";
export type SubscriptionPlan = "none" | "monitor" | "growth";
export type MonitoringOnboardingState = "eligible_report" | "report_required" | "limit_reached";
export type SavedSearchStatus = "active" | "paused" | "archived";
export type ComparisonFilter = "new" | "changed" | "expired" | "removed" | "unchanged";
export type DashboardAction = "open_report" | "refresh_report" | "new_report" | "view_plans" | "setup_monitoring";
export type ReportValueAction =
  | "open_opportunity"
  | "open_source"
  | "review_solicitation"
  | "check_eligibility"
  | "research_target"
  | "monitor_signal"
  | "validate_fit"
  | "review_source"
  | "send_to_workflow"
  | "export_report"
  | "export_outreach_csv"
  | "export_outreach_markdown";

export type ProductAnalyticsEventMap = {
  scan_started: {
    entry_point: "homepage" | "sample_report" | "resource" | "unknown";
  };
  scan_completed: {
    outcome: "success" | "error";
    signal_count_bucket: SignalCountBucket;
    duration_bucket: ScanDurationBucket;
  };
  scan_viewed: {
    report_tier: ReportTier;
    signal_count_bucket: SignalCountBucket;
  };
  email_captured: {
    surface: "scan" | "lead_magnet" | "checkout";
    marketing_consent: boolean;
  };
  pricing_viewed: {
    source: "navigation" | "report_gate" | "checkout_return" | "nurture" | "unknown";
  };
  checkout_started: {
    plan: PurchasePlan;
    billing_period: BillingPeriod;
  };
  purchase_completed: {
    plan: PurchasePlan;
    billing_period: BillingPeriod;
  };
  checkout_return_viewed: {
    plan: PurchasePlan;
    billing_period: BillingPeriod;
  };
  dashboard_viewed: {
    subscription_plan: SubscriptionPlan;
    has_active_monitoring: boolean;
  };
  dashboard_action_selected: {
    action: DashboardAction;
  };
  report_value_action_selected: {
    action: ReportValueAction;
    report_tier: ReportTier;
  };
  monitoring_onboarding_viewed: {
    subscription_plan: Exclude<SubscriptionPlan, "none">;
    state: MonitoringOnboardingState;
  };
  monitoring_onboarding_completed: {
    subscription_plan: Exclude<SubscriptionPlan, "none">;
  };
  saved_search_changed: {
    change_type: "criteria";
  };
  saved_search_status_changed: {
    status: SavedSearchStatus;
  };
  saved_search_run_requested: {
    source: "dashboard";
  };
  comparison_viewed: {
    initial_filter: ComparisonFilter;
  };
  billing_portal_opened: {
    source: "dashboard";
  };
};

export type ProductAnalyticsEventName = keyof ProductAnalyticsEventMap;
export type ProductAnalyticsProperties = ProductAnalyticsEventMap[ProductAnalyticsEventName];

export type ProductAnalyticsEnvelope<Name extends ProductAnalyticsEventName = ProductAnalyticsEventName> = {
  name: Name;
  properties: ProductAnalyticsEventMap[Name];
};

const EVENT_NAMES = new Set<ProductAnalyticsEventName>([
  "scan_started",
  "scan_completed",
  "scan_viewed",
  "email_captured",
  "pricing_viewed",
  "checkout_started",
  "purchase_completed",
  "checkout_return_viewed",
  "dashboard_viewed",
  "dashboard_action_selected",
  "report_value_action_selected",
  "monitoring_onboarding_viewed",
  "monitoring_onboarding_completed",
  "saved_search_changed",
  "saved_search_status_changed",
  "saved_search_run_requested",
  "comparison_viewed",
  "billing_portal_opened"
]);

const SIGNAL_COUNT_BUCKETS = ["0", "1-3", "4-10", "11+"] as const;
const SCAN_DURATION_BUCKETS = ["under_30_seconds", "30-89_seconds", "90_seconds_or_more"] as const;
const REPORT_TIERS = ["free", "full"] as const;
const PURCHASE_PLANS = ["full_report", "monitor", "growth"] as const;
const BILLING_PERIODS = ["one_time", "monthly", "annual"] as const;
const SUBSCRIPTION_PLANS = ["none", "monitor", "growth"] as const;
const PAID_SUBSCRIPTION_PLANS = ["monitor", "growth"] as const;
const MONITORING_ONBOARDING_STATES = ["eligible_report", "report_required", "limit_reached"] as const;
const SAVED_SEARCH_STATUSES = ["active", "paused", "archived"] as const;
const COMPARISON_FILTERS = ["new", "changed", "expired", "removed", "unchanged"] as const;
const DASHBOARD_ACTIONS = ["open_report", "refresh_report", "new_report", "view_plans", "setup_monitoring"] as const;
const REPORT_VALUE_ACTIONS = [
  "open_opportunity",
  "open_source",
  "review_solicitation",
  "check_eligibility",
  "research_target",
  "monitor_signal",
  "validate_fit",
  "review_source",
  "send_to_workflow",
  "export_report",
  "export_outreach_csv",
  "export_outreach_markdown"
] as const;

export function signalCountBucket(count: number): SignalCountBucket {
  if (count <= 0) return "0";
  if (count <= 3) return "1-3";
  if (count <= 10) return "4-10";
  return "11+";
}

export function scanDurationBucket(startedAt: string, completedAt?: string | null): ScanDurationBucket {
  const started = Date.parse(startedAt);
  const completed = completedAt ? Date.parse(completedAt) : Number.NaN;
  const duration = completed - started;
  if (!Number.isFinite(duration) || duration < 0) return "90_seconds_or_more";
  if (duration < 30_000) return "under_30_seconds";
  if (duration < 90_000) return "30-89_seconds";
  return "90_seconds_or_more";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<const Value extends string>(value: unknown, allowed: readonly Value[]): value is Value {
  return typeof value === "string" && allowed.includes(value as Value);
}

export function isProductAnalyticsEventName(value: unknown): value is ProductAnalyticsEventName {
  return typeof value === "string" && EVENT_NAMES.has(value as ProductAnalyticsEventName);
}

/**
 * Rebuilds each payload from an allowlist so accidental PII or arbitrary event
 * properties cannot cross the browser analytics boundary.
 */
export function sanitizeProductAnalyticsEvent(
  name: unknown,
  properties: unknown
): ProductAnalyticsEnvelope | null {
  if (!isProductAnalyticsEventName(name) || !isRecord(properties)) return null;

  switch (name) {
    case "scan_started":
      return isOneOf(properties.entry_point, ["homepage", "sample_report", "resource", "unknown"])
        ? { name, properties: { entry_point: properties.entry_point } }
        : null;
    case "scan_completed":
      return isOneOf(properties.outcome, ["success", "error"])
        && isOneOf(properties.signal_count_bucket, SIGNAL_COUNT_BUCKETS)
        && isOneOf(properties.duration_bucket, SCAN_DURATION_BUCKETS)
        ? {
            name,
            properties: {
              outcome: properties.outcome,
              signal_count_bucket: properties.signal_count_bucket,
              duration_bucket: properties.duration_bucket
            }
          }
        : null;
    case "scan_viewed":
      return isOneOf(properties.report_tier, REPORT_TIERS)
        && isOneOf(properties.signal_count_bucket, SIGNAL_COUNT_BUCKETS)
        ? {
            name,
            properties: {
              report_tier: properties.report_tier,
              signal_count_bucket: properties.signal_count_bucket
            }
          }
        : null;
    case "email_captured":
      return isOneOf(properties.surface, ["scan", "lead_magnet", "checkout"])
        && typeof properties.marketing_consent === "boolean"
        ? {
            name,
            properties: {
              surface: properties.surface,
              marketing_consent: properties.marketing_consent
            }
          }
        : null;
    case "pricing_viewed":
      return isOneOf(properties.source, ["navigation", "report_gate", "checkout_return", "nurture", "unknown"])
        ? { name, properties: { source: properties.source } }
        : null;
    case "checkout_started":
    case "purchase_completed":
    case "checkout_return_viewed":
      return isOneOf(properties.plan, PURCHASE_PLANS)
        && isOneOf(properties.billing_period, BILLING_PERIODS)
        ? {
            name,
            properties: {
              plan: properties.plan,
              billing_period: properties.billing_period
            }
          }
        : null;
    case "dashboard_viewed":
      return isOneOf(properties.subscription_plan, SUBSCRIPTION_PLANS)
        && typeof properties.has_active_monitoring === "boolean"
        ? {
            name,
            properties: {
              subscription_plan: properties.subscription_plan,
              has_active_monitoring: properties.has_active_monitoring
            }
          }
        : null;
    case "dashboard_action_selected":
      return isOneOf(properties.action, DASHBOARD_ACTIONS)
        ? { name, properties: { action: properties.action } }
        : null;
    case "report_value_action_selected":
      return isOneOf(properties.action, REPORT_VALUE_ACTIONS)
        && isOneOf(properties.report_tier, REPORT_TIERS)
        ? {
            name,
            properties: {
              action: properties.action,
              report_tier: properties.report_tier
            }
          }
        : null;
    case "monitoring_onboarding_viewed":
      return isOneOf(properties.subscription_plan, PAID_SUBSCRIPTION_PLANS)
        && isOneOf(properties.state, MONITORING_ONBOARDING_STATES)
        ? {
            name,
            properties: {
              subscription_plan: properties.subscription_plan,
              state: properties.state
            }
          }
        : null;
    case "monitoring_onboarding_completed":
      return isOneOf(properties.subscription_plan, PAID_SUBSCRIPTION_PLANS)
        ? { name, properties: { subscription_plan: properties.subscription_plan } }
        : null;
    case "saved_search_changed":
      return properties.change_type === "criteria"
        ? { name, properties: { change_type: "criteria" } }
        : null;
    case "saved_search_status_changed":
      return isOneOf(properties.status, SAVED_SEARCH_STATUSES)
        ? { name, properties: { status: properties.status } }
        : null;
    case "saved_search_run_requested":
      return properties.source === "dashboard"
        ? { name, properties: { source: "dashboard" } }
        : null;
    case "comparison_viewed":
      return isOneOf(properties.initial_filter, COMPARISON_FILTERS)
        ? { name, properties: { initial_filter: properties.initial_filter } }
        : null;
    case "billing_portal_opened":
      return properties.source === "dashboard"
        ? { name, properties: { source: "dashboard" } }
        : null;
  }
}

export function stripUrlQuery(value: string): string {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0] ?? "";
  }
}

export function trackProductEvent<Name extends ProductAnalyticsEventName>(
  name: Name,
  properties: ProductAnalyticsEventMap[Name]
): boolean {
  const event = sanitizeProductAnalyticsEvent(name, properties);
  if (
    !event
    || typeof window === "undefined"
    || typeof window.dispatchEvent !== "function"
    || typeof CustomEvent === "undefined"
  ) {
    return false;
  }

  window.dispatchEvent(new CustomEvent(PRODUCT_ANALYTICS_BROWSER_EVENT, { detail: event }));
  return true;
}
