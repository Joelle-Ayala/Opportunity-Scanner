import type { StripeServerConfig } from "./config.ts";
import {
  retrieveStripePrice,
  type StripeCatalogPrice,
  type StripeCatalogProduct
} from "./stripeApi.ts";

const SUBSCRIPTION_PRICE_CURRENCY = "usd";
const SUCCESS_CACHE_MS = 5 * 60_000;
const FAILURE_CACHE_MS = 30_000;

type SubscriptionPriceKey =
  | "monitorMonthly"
  | "monitorAnnual"
  | "growthMonthly"
  | "growthAnnual";

type StripeRecurringInterval = "month" | "year";

type StripeSubscriptionCatalogPrice = StripeCatalogPrice & {
  recurring?: {
    interval?: string;
    interval_count?: number;
  } | null;
};

type SubscriptionPriceExpectation = {
  key: SubscriptionPriceKey;
  unitAmount: number;
  interval: StripeRecurringInterval;
};

const SUBSCRIPTION_PRICE_EXPECTATIONS: readonly SubscriptionPriceExpectation[] = [
  { key: "monitorMonthly", unitAmount: 9_900, interval: "month" },
  { key: "monitorAnnual", unitAmount: 99_000, interval: "year" },
  { key: "growthMonthly", unitAmount: 24_900, interval: "month" },
  { key: "growthAnnual", unitAmount: 249_000, interval: "year" }
];

export type SubscriptionCatalogFailureCode =
  | "CONFIGURATION_MISSING"
  | "DUPLICATE_PRICE_ID"
  | "STRIPE_UNAVAILABLE"
  | "PRICE_ID_MISMATCH"
  | "PRICE_INACTIVE"
  | "PRODUCT_INVALID"
  | "PRODUCT_INACTIVE"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "BILLING_TYPE_MISMATCH"
  | "INTERVAL_MISMATCH"
  | "MODE_MISMATCH";

export type SubscriptionCatalogPreflightResult =
  | {
      ok: true;
      code: "VERIFIED";
      reason: "Configured subscription prices verified.";
      checkedAt: string;
    }
  | {
      ok: false;
      code: SubscriptionCatalogFailureCode;
      reason: string;
      checkedAt: string;
    };

type SubscriptionCatalogConfig = Pick<StripeServerConfig, "secretKey" | "prices">;

type SubscriptionCatalogDependencies = {
  retrievePrice: typeof retrieveStripePrice;
  now: () => number;
};

type CacheEntry = {
  expiresAt: number;
  result?: SubscriptionCatalogPreflightResult;
  pending?: Promise<SubscriptionCatalogPreflightResult>;
};

type LaunchHealthShape = {
  ready: {
    subscriptionCheckout: boolean;
    [key: string]: unknown;
  };
  services: {
    subscriptions: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

const defaultDependencies: SubscriptionCatalogDependencies = {
  retrievePrice: retrieveStripePrice,
  now: Date.now
};

const cache = new Map<string, CacheEntry>();

function productFrom(price: StripeCatalogPrice): StripeCatalogProduct | null {
  return price.product && typeof price.product === "object" ? price.product : null;
}

function failure(
  code: SubscriptionCatalogFailureCode,
  reason: string,
  checkedAt: Date
): SubscriptionCatalogPreflightResult {
  return { ok: false, code, reason, checkedAt: checkedAt.toISOString() };
}

function configuredPriceIds(config: SubscriptionCatalogConfig): string[] {
  return SUBSCRIPTION_PRICE_EXPECTATIONS.map(({ key }) => config.prices[key]);
}

export function validateSubscriptionCatalogPrice(
  price: StripeSubscriptionCatalogPrice,
  expectation: SubscriptionPriceExpectation & {
    configuredPriceId: string;
    requireLivemode: boolean;
    checkedAt?: Date;
  }
): SubscriptionCatalogPreflightResult {
  const checkedAt = expectation.checkedAt ?? new Date();
  if (price.id !== expectation.configuredPriceId) {
    return failure(
      "PRICE_ID_MISMATCH",
      "A configured subscription Price ID does not match the Stripe catalog response.",
      checkedAt
    );
  }
  if (price.active !== true) {
    return failure("PRICE_INACTIVE", "A configured subscription price is not active in Stripe.", checkedAt);
  }

  const product = productFrom(price);
  if (!product || typeof product.id !== "string" || !product.id.startsWith("prod_")) {
    return failure(
      "PRODUCT_INVALID",
      "A configured subscription price is not mapped to a valid Stripe product.",
      checkedAt
    );
  }
  if (product.active !== true) {
    return failure("PRODUCT_INACTIVE", "A Stripe product for a subscription price is not active.", checkedAt);
  }
  if (price.unit_amount !== expectation.unitAmount) {
    return failure(
      "AMOUNT_MISMATCH",
      "A configured subscription price does not match the approved catalog amount.",
      checkedAt
    );
  }
  if (price.currency?.toLowerCase() !== SUBSCRIPTION_PRICE_CURRENCY) {
    return failure("CURRENCY_MISMATCH", "All configured subscription prices must use USD.", checkedAt);
  }
  if (price.type !== "recurring" || !price.recurring) {
    return failure(
      "BILLING_TYPE_MISMATCH",
      "All configured subscription prices must use recurring billing.",
      checkedAt
    );
  }
  if (price.recurring.interval !== expectation.interval || price.recurring.interval_count !== 1) {
    return failure(
      "INTERVAL_MISMATCH",
      "A configured subscription price does not match its approved billing interval.",
      checkedAt
    );
  }
  if (expectation.requireLivemode && (price.livemode !== true || product.livemode !== true)) {
    return failure(
      "MODE_MISMATCH",
      "Production subscription checkout requires live-mode Stripe price and product objects.",
      checkedAt
    );
  }

  return {
    ok: true,
    code: "VERIFIED",
    reason: "Configured subscription prices verified.",
    checkedAt: checkedAt.toISOString()
  };
}

export async function verifySubscriptionCatalog(
  config: SubscriptionCatalogConfig,
  dependencies: SubscriptionCatalogDependencies = defaultDependencies
): Promise<SubscriptionCatalogPreflightResult> {
  const checkedAt = new Date(dependencies.now());
  const priceIds = configuredPriceIds(config);
  if (priceIds.some((priceId) => !priceId)) {
    return failure(
      "CONFIGURATION_MISSING",
      "All four subscription prices must be configured before subscription checkout can open.",
      checkedAt
    );
  }
  if (new Set(priceIds).size !== priceIds.length) {
    return failure(
      "DUPLICATE_PRICE_ID",
      "Each subscription plan and billing interval must use a distinct Stripe price.",
      checkedAt
    );
  }

  let prices: StripeSubscriptionCatalogPrice[];
  try {
    prices = await Promise.all(
      priceIds.map((priceId) => dependencies.retrievePrice(config.secretKey, priceId))
    );
  } catch {
    return failure(
      "STRIPE_UNAVAILABLE",
      "Stripe could not verify the configured subscription prices.",
      checkedAt
    );
  }

  for (let index = 0; index < SUBSCRIPTION_PRICE_EXPECTATIONS.length; index += 1) {
    const expectation = SUBSCRIPTION_PRICE_EXPECTATIONS[index];
    const result = validateSubscriptionCatalogPrice(prices[index], {
      ...expectation,
      configuredPriceId: priceIds[index],
      requireLivemode: config.prices.requireLivemode,
      checkedAt
    });
    if (!result.ok) return result;
  }

  return {
    ok: true,
    code: "VERIFIED",
    reason: "Configured subscription prices verified.",
    checkedAt: checkedAt.toISOString()
  };
}

export function verifySubscriptionCatalogCached(
  config: SubscriptionCatalogConfig,
  dependencies: SubscriptionCatalogDependencies = defaultDependencies
): Promise<SubscriptionCatalogPreflightResult> {
  const key = JSON.stringify([
    config.prices.requireLivemode,
    ...configuredPriceIds(config)
  ]);
  const now = dependencies.now();
  const existing = cache.get(key);
  if (existing?.result && existing.expiresAt > now) return Promise.resolve(existing.result);
  if (existing?.pending) return existing.pending;

  const pending = verifySubscriptionCatalog(config, dependencies).then((result) => {
    cache.set(key, {
      result,
      expiresAt: dependencies.now() + (result.ok ? SUCCESS_CACHE_MS : FAILURE_CACHE_MS)
    });
    return result;
  });
  cache.set(key, { pending, expiresAt: now });
  return pending;
}

export function applySubscriptionCatalogHealth<T extends LaunchHealthShape>(
  health: T,
  catalog?: SubscriptionCatalogPreflightResult
) {
  const subscriptionCheckout = health.ready.subscriptionCheckout && catalog?.ok === true;
  return {
    ...health,
    ready: {
      ...health.ready,
      subscriptionCheckout
    },
    services: {
      ...health.services,
      subscriptions: subscriptionCheckout,
      subscriptionCatalog: catalog ? (catalog.ok ? "verified" : "invalid") : "unverified",
      subscriptionCatalogReason: catalog && !catalog.ok ? catalog.reason : null,
      subscriptionCatalogCheckedAt: catalog?.checkedAt ?? null
    }
  };
}

export function clearSubscriptionCatalogPreflightCache(): void {
  cache.clear();
}
