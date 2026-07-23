import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSubscriptionActivationRecoveryHealth } from "@/lib/payments/subscriptionActivationRecovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
  Expires: "0"
};

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !authorization?.startsWith("Bearer ")) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, {
      status: 401,
      headers: PRIVATE_HEADERS
    });
  }

  try {
    const activation = await getSubscriptionActivationRecoveryHealth();
    const ok = activation.active_without_profile_count === 0
      && activation.untracked_count === 0
      && activation.stale_recovery_count === 0
      && activation.dead_letter_recovery_count === 0
      && activation.dead_letter_reminder_count === 0;
    return NextResponse.json({
      ok,
      checkedAt: new Date().toISOString(),
      gracePeriodMinutes: 15,
      activation
    }, {
      status: ok ? 200 : 503,
      headers: PRIVATE_HEADERS
    });
  } catch {
    return NextResponse.json({
      ok: false,
      checkedAt: new Date().toISOString(),
      gracePeriodMinutes: 15,
      activation: null
    }, {
      status: 503,
      headers: PRIVATE_HEADERS
    });
  }
}
