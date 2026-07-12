import { NextResponse } from "next/server";
import { unsubscribeScanNurture } from "@/lib/nurture/storage";
import { getNurtureUnsubscribeSecret, readUnsubscribeToken } from "@/lib/nurture/token";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = getNurtureUnsubscribeSecret();
  if (!secret) return Response.json({ ok: false, error: "Unsubscribe is not configured." }, { status: 503 });

  let bodyToken = "";
  try {
    const form = await request.formData();
    bodyToken = String(form.get("token") || "");
  } catch {
    // One-click unsubscribe clients may send no form body.
  }

  const token = bodyToken || new URL(request.url).searchParams.get("token") || "";
  const subscriberId = readUnsubscribeToken(token, secret);
  if (!subscriberId) {
    return Response.json({ ok: false, error: "Invalid unsubscribe link." }, { status: 400 });
  }

  try {
    await unsubscribeScanNurture(subscriberId);
  } catch {
    return Response.json({ ok: false, error: "Unsubscribe is temporarily unavailable." }, { status: 503 });
  }

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/unsubscribe?status=unsubscribed", request.url), 303);
  }
  return Response.json({ ok: true });
}
