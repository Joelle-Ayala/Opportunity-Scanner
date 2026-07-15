import { NextRequest, NextResponse } from "next/server";
import { getCustomerAuthConfig } from "@/lib/customer-auth/config";
import { clearSessionCookies, setSessionCookies } from "@/lib/customer-auth/cookies";
import { safeSameOriginRedirect } from "@/lib/customer-auth/redirect";
import { resolveCustomerSession } from "@/lib/customer-auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const config = getCustomerAuthConfig(request.url);
    const requestedNext = request.nextUrl.searchParams.get("next");
    const nextPath = requestedNext
      ? safeSameOriginRedirect(requestedNext, config.appOrigin, "/dashboard")
      : null;
    const session = await resolveCustomerSession(config, request.cookies);
    if (!session) {
      const response = nextPath
        ? NextResponse.redirect(new URL(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`, config.appOrigin), 303)
        : NextResponse.json({ user: null }, { status: 401 });
      clearSessionCookies(response);
      return response;
    }

    const response = nextPath
      ? NextResponse.redirect(new URL(nextPath, config.appOrigin), 303)
      : NextResponse.json(
          { user: { id: session.user.id, email: session.user.email || null } },
          { headers: { "Cache-Control": "private, no-store" } }
        );
    if (session.refreshedTokens) setSessionCookies(response, session.refreshedTokens);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Customer session resolution failed", error);
    return NextResponse.json({ error: "Unable to resolve customer session." }, { status: 503 });
  }
}
