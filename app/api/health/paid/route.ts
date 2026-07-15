import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { evaluatePaidOpsHealth, paidOpsHealthStatus } from "@/lib/payments/paidOpsHealth";

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

  const health = await evaluatePaidOpsHealth();

  return NextResponse.json(health, {
    status: paidOpsHealthStatus(health),
    headers: PRIVATE_HEADERS
  });
}
