import type { BillingInterval, PaymentPlan } from "./contract";

export type StripeServerConfig = {
  secretKey: string;
  webhookSecret: string;
  appUrl: string;
  subscriptionCheckoutEnabled: boolean;
  prices: StripePriceCatalog;
};

export type StripePriceCatalog = Record<
  "report" | "monitorMonthly" | "monitorAnnual" | "growthMonthly" | "growthAnnual",
  string
> & {
  requireLivemode: boolean;
};

export type BillingDatabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

const REQUIRED_STRIPE_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
  "STRIPE_PRICE_REPORT"
] as const;

const SUBSCRIPTION_PRICE_ENV = [
  "STRIPE_PRICE_MONITOR_MONTHLY",
  "STRIPE_PRICE_MONITOR_ANNUAL",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_ANNUAL"
] as const;

export const SUBSCRIPTION_CHECKOUT_FLAG = "ENABLE_SUBSCRIPTION_CHECKOUT";

function requiredEnvironment(names: readonly string[]): Record<string, string> {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (!value) missing.push(name);
    else values[name] = value;
  }
  if (missing.length > 0) {
    throw new Error(`Payments are not configured. Missing: ${missing.join(", ")}`);
  }
  return values;
}

function normalizedAppUrl(value: string): string {
  const url = new URL(value);
  const localDevelopment = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localDevelopment) || url.username || url.password || url.search || url.hash) {
    throw new Error("APP_URL must be an HTTPS origin without credentials, query, or fragment.");
  }
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

export function requiresLiveStripeObjects(): boolean {
  return process.env.NODE_ENV === "production";
}

export function subscriptionCheckoutIsEnabled(): boolean {
  return process.env[SUBSCRIPTION_CHECKOUT_FLAG]?.trim() === "true";
}

export function getStripeServerConfig(): StripeServerConfig {
  const env = requiredEnvironment(REQUIRED_STRIPE_ENV);
  const subscriptionCheckoutEnabled = subscriptionCheckoutIsEnabled();
  const subscriptionPrices = Object.fromEntries(
    SUBSCRIPTION_PRICE_ENV.map((name) => [name, process.env[name]?.trim() ?? ""])
  ) as Record<(typeof SUBSCRIPTION_PRICE_ENV)[number], string>;
  if (subscriptionCheckoutEnabled) {
    Object.assign(subscriptionPrices, requiredEnvironment(SUBSCRIPTION_PRICE_ENV));
  }
  const requireLivemode = requiresLiveStripeObjects();
  if (
    (!env.STRIPE_SECRET_KEY.startsWith("sk_test_") && !env.STRIPE_SECRET_KEY.startsWith("sk_live_")) ||
    !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")
  ) {
    throw new Error("Stripe server credentials are invalid.");
  }
  if (requireLivemode && !env.STRIPE_SECRET_KEY.startsWith("sk_live_")) {
    throw new Error("Production payments require a Stripe sk_live_* secret key.");
  }
  const priceEnvironment = {
    STRIPE_PRICE_REPORT: env.STRIPE_PRICE_REPORT,
    ...subscriptionPrices
  };
  for (const [name, value] of Object.entries(priceEnvironment)) {
    if (!value) continue;
    if (!value.startsWith("price_")) throw new Error(`${name} must be a Stripe Price ID.`);
  }
  return {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    appUrl: normalizedAppUrl(env.APP_URL),
    subscriptionCheckoutEnabled,
    prices: {
      report: env.STRIPE_PRICE_REPORT,
      monitorMonthly: subscriptionPrices.STRIPE_PRICE_MONITOR_MONTHLY,
      monitorAnnual: subscriptionPrices.STRIPE_PRICE_MONITOR_ANNUAL,
      growthMonthly: subscriptionPrices.STRIPE_PRICE_GROWTH_MONTHLY,
      growthAnnual: subscriptionPrices.STRIPE_PRICE_GROWTH_ANNUAL,
      requireLivemode
    }
  };
}

export function getBillingDatabaseConfig(): BillingDatabaseConfig {
  const env = requiredEnvironment(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("SUPABASE_URL must be a secure server URL.");
  }
  return { url: env.SUPABASE_URL.replace(/\/$/, ""), serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

export function priceFor(config: StripeServerConfig, plan: PaymentPlan, interval: BillingInterval | null): string {
  if (plan === "report") return config.prices.report;
  if (!config.subscriptionCheckoutEnabled) throw new Error("Subscription checkout is disabled.");
  if (plan === "monitor") return interval === "annual" ? config.prices.monitorAnnual : config.prices.monitorMonthly;
  return interval === "annual" ? config.prices.growthAnnual : config.prices.growthMonthly;
}
