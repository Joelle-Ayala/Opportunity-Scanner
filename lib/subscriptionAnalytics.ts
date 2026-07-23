import type { BillingInterval, PaymentPlan } from "./payments/contract";

type SubscriptionProduct = Exclude<PaymentPlan, "report">;

export type SubscriptionAnalyticsSubscription = {
  stripe_customer_id?: string | null;
  product?: string | null;
  billing_interval?: string | null;
  status: string;
  livemode: boolean;
  created_at: string;
  canceled_at?: string | null;
};

export type SubscriptionAnalyticsProfile = {
  stripe_customer_id?: string | null;
  status: string;
  created_at: string;
};

export type AvailableMetric<Value> = {
  status: "available";
  value: Value;
};

export type UnavailableMetric = {
  status: "unavailable";
  value: null;
  reason: string;
};

export type MeasuredMetric<Value> = AvailableMetric<Value> | UnavailableMetric;

export type RateValue = {
  numerator: number;
  denominator: number;
  percent: number;
};

export type RetentionByPlanValue = Record<
  SubscriptionProduct,
  {
    retainedSubscriptions: number;
    cohortSubscriptions: number;
    retentionRate: number;
  }
>;

export type SubscriptionLifecycleAnalytics = {
  purchaseToActivationRate: MeasuredMetric<RateValue>;
  medianActivationHours: MeasuredMetric<number>;
  activeWithZeroProfileCount: MeasuredMetric<number>;
  expansionMrr: MeasuredMetric<number>;
  contractionMrr: MeasuredMetric<number>;
  churnMrr: MeasuredMetric<number>;
  pastDueRecoveryRate: MeasuredMetric<RateValue>;
  retentionByPlan: MeasuredMetric<RetentionByPlanValue>;
  notes: string[];
};

type CatalogEntry = {
  product: SubscriptionProduct;
  interval: BillingInterval;
  normalizedMrr: number;
};

const CATALOG: readonly CatalogEntry[] = [
  { product: "monitor", interval: "monthly", normalizedMrr: 99 },
  { product: "monitor", interval: "annual", normalizedMrr: 82.5 },
  { product: "growth", interval: "monthly", normalizedMrr: 249 },
  { product: "growth", interval: "annual", normalizedMrr: 207.5 }
];

const PURCHASE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "canceled"]);
const RETENTION_COHORT_STATUSES = new Set(PURCHASE_STATUSES);
const RETAINED_STATUSES = new Set(["active", "trialing"]);
const NON_CANCELED_PROFILE_STATUSES = new Set(["active", "paused"]);
const HISTORY_REASON =
  "Unavailable: stored subscriptions contain only the latest state, not prior plan or status transitions.";

function unavailable<Value>(reason: string): MeasuredMetric<Value> {
  return { status: "unavailable", value: null, reason };
}

function available<Value>(value: Value): MeasuredMetric<Value> {
  return { status: "available", value };
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function validTimestamp(value: string | null | undefined): number | null {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function catalogEntry(subscription: SubscriptionAnalyticsSubscription): CatalogEntry | null {
  if (!subscription.livemode) return null;
  return CATALOG.find(
    (entry) => entry.product === subscription.product && entry.interval === subscription.billing_interval
  ) ?? null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function buildSubscriptionLifecycleAnalytics(input: {
  subscriptions?: SubscriptionAnalyticsSubscription[];
  profiles?: SubscriptionAnalyticsProfile[];
  startedAt: Date;
  now: Date;
}): SubscriptionLifecycleAnalytics {
  const subscriptions = (input.subscriptions ?? []).filter((subscription) => catalogEntry(subscription));
  const profiles = input.profiles ?? [];
  const hasSubscriptionData = input.subscriptions !== undefined;
  const hasProfileData = input.profiles !== undefined;
  const windowStart = input.startedAt.getTime();
  const windowEnd = input.now.getTime();

  const windowPurchases = subscriptions.filter((subscription) => {
    const createdAt = validTimestamp(subscription.created_at);
    return PURCHASE_STATUSES.has(subscription.status)
      && createdAt !== null
      && createdAt >= windowStart
      && createdAt <= windowEnd;
  });

  const validProfiles = profiles
    .map((profile) => ({
      ...profile,
      customerId: profile.stripe_customer_id?.trim() || null,
      createdAt: validTimestamp(profile.created_at)
    }))
    .filter((profile) => profile.customerId && profile.createdAt !== null);

  const activationDurationsHours: number[] = [];
  let activatedPurchases = 0;
  let activationIdentityComplete = hasSubscriptionData && hasProfileData;
  for (const subscription of windowPurchases) {
    const customerId = subscription.stripe_customer_id?.trim();
    const purchasedAt = validTimestamp(subscription.created_at);
    if (!customerId || purchasedAt === null) {
      activationIdentityComplete = false;
      continue;
    }
    const firstActivation = validProfiles
      .filter(
        (profile) =>
          profile.customerId === customerId
          && profile.createdAt! >= purchasedAt
          && profile.createdAt! <= windowEnd
      )
      .sort((left, right) => left.createdAt! - right.createdAt!)[0];
    if (firstActivation) {
      activatedPurchases += 1;
      activationDurationsHours.push((firstActivation.createdAt! - purchasedAt) / 3_600_000);
    }
  }

  const purchaseToActivationRate = !activationIdentityComplete
    ? unavailable<RateValue>("Unavailable: subscription-to-profile identity or profile data is incomplete.")
    : available({
        numerator: activatedPurchases,
        denominator: windowPurchases.length,
        percent: percentage(activatedPurchases, windowPurchases.length)
      });

  const activationMedian = median(activationDurationsHours);
  const medianActivationHours = !activationIdentityComplete
    ? unavailable<number>("Unavailable: subscription-to-profile identity or profile data is incomplete.")
    : activationMedian === null
      ? unavailable<number>("Unavailable: no purchases activated monitoring during this reporting window.")
      : available(Math.round(activationMedian * 10) / 10);

  const activeSubscriptions = subscriptions.filter((subscription) => RETAINED_STATUSES.has(subscription.status));
  let activeWithZeroProfileCount: MeasuredMetric<number>;
  if (!hasSubscriptionData || !hasProfileData) {
    activeWithZeroProfileCount = unavailable("Unavailable: current subscription or monitoring profile data was not loaded.");
  } else if (activeSubscriptions.some((subscription) => !subscription.stripe_customer_id?.trim())) {
    activeWithZeroProfileCount = unavailable("Unavailable: at least one active subscription lacks a customer identity.");
  } else {
    const customersWithProfiles = new Set(
      validProfiles
        .filter((profile) => NON_CANCELED_PROFILE_STATUSES.has(profile.status))
        .map((profile) => profile.customerId)
    );
    activeWithZeroProfileCount = available(
      activeSubscriptions.filter(
        (subscription) => !customersWithProfiles.has(subscription.stripe_customer_id!.trim())
      ).length
    );
  }

  const churnMrr = hasSubscriptionData
    ? available(
        roundCurrency(
          subscriptions.reduce((total, subscription) => {
            const canceledAt = validTimestamp(subscription.canceled_at);
            const entry = catalogEntry(subscription);
            if (
              subscription.status !== "canceled"
              || canceledAt === null
              || canceledAt < windowStart
              || canceledAt > windowEnd
              || !entry
            ) {
              return total;
            }
            return total + entry.normalizedMrr;
          }, 0)
        )
      )
    : unavailable<number>("Unavailable: subscription data was not loaded.");

  const retentionCohort = subscriptions.filter((subscription) => {
    const createdAt = validTimestamp(subscription.created_at);
    return RETENTION_COHORT_STATUSES.has(subscription.status)
      && createdAt !== null
      && createdAt >= windowStart
      && createdAt <= windowEnd;
  });
  const retentionByPlan = hasSubscriptionData
    ? available(
        (["monitor", "growth"] as const).reduce<RetentionByPlanValue>(
          (result, product) => {
            const cohort = retentionCohort.filter((subscription) => subscription.product === product);
            const retained = cohort.filter((subscription) => RETAINED_STATUSES.has(subscription.status));
            result[product] = {
              retainedSubscriptions: retained.length,
              cohortSubscriptions: cohort.length,
              retentionRate: percentage(retained.length, cohort.length)
            };
            return result;
          },
          {
            monitor: { retainedSubscriptions: 0, cohortSubscriptions: 0, retentionRate: 0 },
            growth: { retainedSubscriptions: 0, cohortSubscriptions: 0, retentionRate: 0 }
          }
        )
      )
    : unavailable<RetentionByPlanValue>("Unavailable: subscription data was not loaded.");

  return {
    purchaseToActivationRate,
    medianActivationHours,
    activeWithZeroProfileCount,
    expansionMrr: unavailable(HISTORY_REASON),
    contractionMrr: unavailable(HISTORY_REASON),
    churnMrr,
    pastDueRecoveryRate: unavailable(HISTORY_REASON),
    retentionByPlan,
    notes: [
      "Activation means a live subscription purchase was followed by creation of a monitoring profile for the same customer.",
      "Retention is the share of subscriptions created in this reporting window that remain active or trialing, grouped by their latest stored plan.",
      "Churn MRR uses the final stored catalog plan for subscriptions canceled during this reporting window.",
      "All output is aggregate; customer, subscription, profile, and report identifiers are excluded."
    ]
  };
}
