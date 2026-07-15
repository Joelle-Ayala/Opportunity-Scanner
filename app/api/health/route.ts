import { NextResponse } from "next/server";
import { evaluateLaunchHealth } from "@/lib/launchHealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = evaluateLaunchHealth(process.env);

  return NextResponse.json(
    {
      ...health,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local"
    },
    {
      status: health.ready.demo ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
