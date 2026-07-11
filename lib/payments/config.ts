import type { BillingInterval, PaymentPlan } from "./contract";

export type StripeServerConfig = {
  secretKey: string;
  webhookSecret: string;
  appUrl: string;
  prices: Record<"report" | "monitorMonthly" | "monitorAnnual" | "growthMonthly" | "growthAnnual", string>;
};

export type BillingDatabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

const REQUIRED_STRIPE_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "APP_URL",
  "STRIPE_PRICE_REPORT",
  "STRIPE_PRICE_MONITOR_MONTHLY",
  "STRIPE_PRICE_MONITOR_ANNUAL",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_ANNUAL"
] as const;

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

export function getStripeServerConfig(): StripeServerConfig {
  const env = requiredEnvironment(REQUIRED_STRIPE_ENV);
  if (!env.STRIPE_SECRET_KEY.startsWith("sk_") || !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
    throw new Error("Stripe server credentials are invalid.");
  }
  for (const name of REQUIRED_STRIPE_ENV.filter((item) => item.startsWith("STRIPE_PRICE_"))) {
    if (!env[name].startsWith("price_")) throw new Error(`${name} must be a Stripe Price ID.`);
  }
  return {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    appUrl: normalizedAppUrl(env.APP_URL),
    prices: {
      report: env.STRIPE_PRICE_REPORT,
      monitorMonthly: env.STRIPE_PRICE_MONITOR_MONTHLY,
      monitorAnnual: env.STRIPE_PRICE_MONITOR_ANNUAL,
      growthMonthly: env.STRIPE_PRICE_GROWTH_MONTHLY,
      growthAnnual: env.STRIPE_PRICE_GROWTH_ANNUAL
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
  if (plan === "monitor") return interval === "annual" ? config.prices.monitorAnnual : config.prices.monitorMonthly;
  return interval === "annual" ? config.prices.growthAnnual : config.prices.growthMonthly;
}
