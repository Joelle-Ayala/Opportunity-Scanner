import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isAllowedWebhookUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    webhookUrl?: string;
    payload?: Record<string, unknown>;
  } | null;

  if (!body?.webhookUrl || !body.payload || !isAllowedWebhookUrl(body.webhookUrl)) {
    return NextResponse.json({ error: "Invalid webhook request." }, { status: 400 });
  }

  const response = await fetch(body.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product: "Opportunity Scanner",
      sent_at: new Date().toISOString(),
      opportunity: body.payload
    })
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Webhook delivery failed." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

