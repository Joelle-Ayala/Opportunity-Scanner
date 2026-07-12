import { NextRequest, NextResponse } from "next/server";
import { getCustomerAuthConfig } from "@/lib/customer-auth/config";
import { clearPendingAuthCookies, clearSessionCookies, CUSTOMER_AUTH_COOKIES } from "@/lib/customer-auth/cookies";
import { isSameOriginRequest, safeSameOriginRedirect } from "@/lib/customer-auth/redirect";
import { revokeSession } from "@/lib/customer-auth/supabase-auth-rest";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let config;
  try {
    config = getCustomerAuthConfig(request.url);
  } catch (error) {
    console.error("Customer auth configuration error", error);
    return NextResponse.json({ error: "Customer sign-in is not configured." }, { status: 503 });
  }

  if (!isSameOriginRequest(request, config.appOrigin)) {
    return NextResponse.json({ error: "Invalid sign-out request." }, { status: 403 });
  }

  let nextPath = "/auth/sign-in?status=signed-out";
  try {
    const form = await request.formData();
    nextPath = safeSameOriginRedirect(String(form.get("next") || ""), config.appOrigin, nextPath);
  } catch {
    // An empty body is a valid sign-out request.
  }

  const accessToken = request.cookies.get(CUSTOMER_AUTH_COOKIES.accessToken)?.value;
  if (accessToken) {
    try {
      await revokeSession(config, accessToken);
    } catch {
      console.error("Supabase session revocation failed; local session was still cleared");
    }
  }

  const response = NextResponse.redirect(new URL(nextPath, config.appOrigin), 303);
  clearSessionCookies(response);
  clearPendingAuthCookies(response);
  return response;
}
