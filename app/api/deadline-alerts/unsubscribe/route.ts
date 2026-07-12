import { NextResponse } from "next/server";
import { unsubscribeCustomerAlerts } from "@/lib/deadlineAlerts/preferences";
import { getAlertUnsubscribeSecret, readAlertUnsubscribeToken } from "@/lib/deadlineAlerts/token";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const secret = getAlertUnsubscribeSecret();
  if (!secret) return Response.json({ ok: false, error: "Alert unsubscribe is not configured." }, { status: 503 });

  let bodyToken = "";
  try {
    const form = await request.formData();
    bodyToken = String(form.get("token") || "");
  } catch {
    // One-click unsubscribe clients may send no form body.
  }
  const token = bodyToken || new URL(request.url).searchParams.get("token") || "";
  const accountId = readAlertUnsubscribeToken(token, secret);
  if (!accountId) return Response.json({ ok: false, error: "Invalid unsubscribe link." }, { status: 400 });

  try {
    await unsubscribeCustomerAlerts(accountId);
  } catch {
    return Response.json({ ok: false, error: "Unsubscribe is temporarily unavailable." }, { status: 503 });
  }

  if (request.headers.get("accept")?.includes("text/html")) {
    return NextResponse.redirect(new URL("/alerts/unsubscribe?status=unsubscribed", request.url), 303);
  }
  return Response.json({ ok: true });
}

