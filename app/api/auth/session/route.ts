import { NextRequest, NextResponse } from "next/server";
import { getCustomerAuthConfig } from "@/lib/customer-auth/config";
import { clearSessionCookies, setSessionCookies } from "@/lib/customer-auth/cookies";
import { resolveCustomerSession } from "@/lib/customer-auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const config = getCustomerAuthConfig(request.url);
    const session = await resolveCustomerSession(config, request.cookies);
    if (!session) {
      const response = NextResponse.json({ user: null }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }

    const response = NextResponse.json(
      { user: { id: session.user.id, email: session.user.email || null } },
      { headers: { "Cache-Control": "private, no-store" } }
    );
    if (session.refreshedTokens) setSessionCookies(response, session.refreshedTokens);
    return response;
  } catch (error) {
    console.error("Customer session resolution failed", error);
    return NextResponse.json({ error: "Unable to resolve customer session." }, { status: 503 });
  }
}
