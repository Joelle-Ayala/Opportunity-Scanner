type LaunchHealthEnvironment = Record<string, string | undefined>;

function configured(env: LaunchHealthEnvironment, name: string): boolean {
  return Boolean(env[name]?.trim());
}

function stripeMode(env: LaunchHealthEnvironment) {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_live_")) return "live" as const;
  if (key.startsWith("sk_test_")) return "test" as const;
  return "unconfigured" as const;
}

function validEmail(value: string | undefined): boolean {
  return Boolean(value?.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
}

export function evaluateLaunchHealth(env: LaunchHealthEnvironment) {
  const database = configured(env, "SUPABASE_URL") && configured(env, "SUPABASE_SERVICE_ROLE_KEY");
  const auth = database && configured(env, "SUPABASE_ANON_KEY");
  const scans = database && configured(env, "OPENAI_API_KEY") && configured(env, "SCAN_RATE_LIMIT_HASH_SECRET");
  const reportPrice = configured(env, "STRIPE_PRICE_REPORT");
  const subscriptionPrices = [
    "STRIPE_PRICE_MONITOR_MONTHLY",
    "STRIPE_PRICE_MONITOR_ANNUAL",
    "STRIPE_PRICE_GROWTH_MONTHLY",
    "STRIPE_PRICE_GROWTH_ANNUAL"
  ].every((name) => configured(env, name));
  const subscriptionsEnabled = env.ENABLE_SUBSCRIPTION_CHECKOUT?.trim() === "true";
  const mode = stripeMode(env);
  const payments = mode !== "unconfigured" && configured(env, "STRIPE_WEBHOOK_SECRET") && reportPrice;
  const email = configured(env, "RESEND_API_KEY") && validEmail(env.RESEND_FROM_EMAIL);
  const support = validEmail(env.OPPORTUNITY_SCANNER_CONTACT_EMAIL);
  const monitoring = scans && configured(env, "CRON_SECRET");
  const analytics = configured(env, "NEXT_PUBLIC_POSTHOG_KEY") && configured(env, "NEXT_PUBLIC_POSTHOG_HOST");
  const demoReady = scans && auth;
  const paidSignupReady = demoReady && payments && mode === "live" && email && support && analytics;
  const subscriptionCheckoutReady = paidSignupReady && subscriptionsEnabled && subscriptionPrices;

  return {
    ok: demoReady,
    ready: {
      demo: demoReady,
      paidSignup: paidSignupReady,
      reportCheckout: paidSignupReady,
      subscriptionCheckout: subscriptionCheckoutReady
    },
    services: {
      database,
      auth,
      scans,
      payments,
      subscriptions: subscriptionCheckoutReady,
      stripeMode: mode,
      email,
      support,
      monitoring,
      analytics
    }
  };
}
