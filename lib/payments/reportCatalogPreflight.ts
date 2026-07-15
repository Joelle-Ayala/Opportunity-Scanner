import type { StripeServerConfig } from "./config.ts";
import {
  retrieveStripePrice,
  type StripeCatalogPrice,
  type StripeCatalogProduct
} from "./stripeApi.ts";

export const REPORT_PRICE_UNIT_AMOUNT = 4_900;
export const REPORT_PRICE_CURRENCY = "usd";

const SUCCESS_CACHE_MS = 5 * 60_000;
const FAILURE_CACHE_MS = 30_000;

export type ReportCatalogFailureCode =
  | "STRIPE_UNAVAILABLE"
  | "PRICE_ID_MISMATCH"
  | "PRICE_INACTIVE"
  | "PRODUCT_INVALID"
  | "PRODUCT_INACTIVE"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "BILLING_TYPE_MISMATCH"
  | "MODE_MISMATCH";

export type ReportCatalogPreflightResult =
  | {
      ok: true;
      code: "VERIFIED";
      reason: "Configured Report price verified.";
      checkedAt: string;
    }
  | {
      ok: false;
      code: ReportCatalogFailureCode;
      reason: string;
      checkedAt: string;
    };

type ReportCatalogExpectation = {
  configuredPriceId: string;
  requireLivemode: boolean;
  checkedAt?: Date;
};

type ReportCatalogConfig = Pick<StripeServerConfig, "secretKey" | "prices">;

type ReportCatalogDependencies = {
  retrievePrice: typeof retrieveStripePrice;
  now: () => number;
};

type CacheEntry = {
  expiresAt: number;
  result?: ReportCatalogPreflightResult;
  pending?: Promise<ReportCatalogPreflightResult>;
};

const defaultDependencies: ReportCatalogDependencies = {
  retrievePrice: retrieveStripePrice,
  now: Date.now
};

const cache = new Map<string, CacheEntry>();

function productFrom(price: StripeCatalogPrice): StripeCatalogProduct | null {
  return price.product && typeof price.product === "object" ? price.product : null;
}

function failure(
  code: ReportCatalogFailureCode,
  reason: string,
  checkedAt: Date
): ReportCatalogPreflightResult {
  return { ok: false, code, reason, checkedAt: checkedAt.toISOString() };
}

export function validateReportCatalogPrice(
  price: StripeCatalogPrice,
  expectation: ReportCatalogExpectation
): ReportCatalogPreflightResult {
  const checkedAt = expectation.checkedAt ?? new Date();
  if (price.id !== expectation.configuredPriceId) {
    return failure(
      "PRICE_ID_MISMATCH",
      "The configured Report Price ID does not match the Stripe catalog response.",
      checkedAt
    );
  }
  if (price.active !== true) {
    return failure("PRICE_INACTIVE", "The configured Report price is not active in Stripe.", checkedAt);
  }

  const product = productFrom(price);
  if (!product || typeof product.id !== "string" || !product.id.startsWith("prod_")) {
    return failure(
      "PRODUCT_INVALID",
      "The configured Report price is not mapped to a valid Stripe product.",
      checkedAt
    );
  }
  if (product.active !== true) {
    return failure("PRODUCT_INACTIVE", "The Stripe product for the Report price is not active.", checkedAt);
  }
  if (price.unit_amount !== REPORT_PRICE_UNIT_AMOUNT) {
    return failure("AMOUNT_MISMATCH", "The configured Report price must be USD $49.00.", checkedAt);
  }
  if (price.currency?.toLowerCase() !== REPORT_PRICE_CURRENCY) {
    return failure("CURRENCY_MISMATCH", "The configured Report price must use USD.", checkedAt);
  }
  if (price.type !== "one_time" || price.recurring != null) {
    return failure(
      "BILLING_TYPE_MISMATCH",
      "The configured Report price must be a one-time payment.",
      checkedAt
    );
  }
  if (expectation.requireLivemode && (price.livemode !== true || product.livemode !== true)) {
    return failure(
      "MODE_MISMATCH",
      "Production Report checkout requires live-mode Stripe price and product objects.",
      checkedAt
    );
  }

  return {
    ok: true,
    code: "VERIFIED",
    reason: "Configured Report price verified.",
    checkedAt: checkedAt.toISOString()
  };
}

export async function verifyReportCatalog(
  config: ReportCatalogConfig,
  dependencies: ReportCatalogDependencies = defaultDependencies
): Promise<ReportCatalogPreflightResult> {
  const checkedAt = new Date(dependencies.now());
  try {
    const price = await dependencies.retrievePrice(config.secretKey, config.prices.report);
    return validateReportCatalogPrice(price, {
      configuredPriceId: config.prices.report,
      requireLivemode: config.prices.requireLivemode,
      checkedAt
    });
  } catch {
    return failure(
      "STRIPE_UNAVAILABLE",
      "Stripe could not verify the configured Report price.",
      checkedAt
    );
  }
}

export function verifyReportCatalogCached(
  config: ReportCatalogConfig,
  dependencies: ReportCatalogDependencies = defaultDependencies
): Promise<ReportCatalogPreflightResult> {
  const key = `${config.prices.requireLivemode ? "live" : "non-live"}:${config.prices.report}`;
  const now = dependencies.now();
  const existing = cache.get(key);
  if (existing?.result && existing.expiresAt > now) return Promise.resolve(existing.result);
  if (existing?.pending) return existing.pending;

  const pending = verifyReportCatalog(config, dependencies).then((result) => {
    cache.set(key, {
      result,
      expiresAt: dependencies.now() + (result.ok ? SUCCESS_CACHE_MS : FAILURE_CACHE_MS)
    });
    return result;
  });
  cache.set(key, { pending, expiresAt: now });
  return pending;
}

export function clearReportCatalogPreflightCache(): void {
  cache.clear();
}
