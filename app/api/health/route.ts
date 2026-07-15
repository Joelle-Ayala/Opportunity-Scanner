import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function stripeMode() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (key.startsWith("sk_live_")) return "live" as const;
  if (key.startsWith("sk_test_")) return "test" as const;
  return "unconfigured" as const;
}

function validEmail(value: string | undefined) {
  return Boolean(value?.trim().match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/));
}

export async function GET() {
  const database = configured("SUPABASE_URL") && configured("SUPABASE_SERVICE_ROLE_KEY");
  const auth = database && configured("SUPABASE_ANON_KEY");
  const scans = database && configured("OPENAI_API_KEY") && configured("SCAN_RATE_LIMIT_HASH_SECRET");
  const prices = [
    "STRIPE_PRICE_REPORT",
    "STRIPE_PRICE_MONITOR_MONTHLY",
    "STRIPE_PRICE_MONITOR_ANNUAL",
    "STRIPE_PRICE_GROWTH_MONTHLY",
    "STRIPE_PRICE_GROWTH_ANNUAL"
  ].every(configured);
  const mode = stripeMode();
  const payments = mode !== "unconfigured" && configured("STRIPE_WEBHOOK_SECRET") && prices;
  const email = configured("RESEND_API_KEY") && validEmail(process.env.RESEND_FROM_EMAIL);
  const monitoring = scans && configured("CRON_SECRET");
  const analytics = configured("NEXT_PUBLIC_POSTHOG_KEY") && configured("NEXT_PUBLIC_POSTHOG_HOST");
  const demoReady = scans && auth;
  const paidSignupReady = demoReady && payments && mode === "live";

  return NextResponse.json(
    {
      ok: demoReady,
      ready: {
        demo: demoReady,
        paidSignup: paidSignupReady
      },
      services: {
        database,
        auth,
        scans,
        payments,
        stripeMode: mode,
        email,
        monitoring,
        analytics
      },
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local"
    },
    {
      status: demoReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
