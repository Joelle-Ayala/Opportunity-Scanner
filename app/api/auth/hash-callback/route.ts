import { NextRequest, NextResponse } from "next/server";
import { getCustomerAuthConfig } from "@/lib/customer-auth/config";
import {
  clearPendingAuthCookies,
  CUSTOMER_AUTH_COOKIES,
  setSessionCookies
} from "@/lib/customer-auth/cookies";
import { isSameOriginRequest, safeSameOriginRedirect } from "@/lib/customer-auth/redirect";
import { fetchCustomerUser } from "@/lib/customer-auth/supabase-auth-rest";

export const runtime = "nodejs";

type HashHandoffBody = {
  accessToken?: unknown;
  refreshToken?: unknown;
  expiresIn?: unknown;
  tokenType?: unknown;
  state?: unknown;
};

export async function POST(request: NextRequest) {
  let config;
  try {
    config = getCustomerAuthConfig(request.url);
  } catch (error) {
    console.error("Customer auth configuration error", error);
    return NextResponse.json({ error: "Customer sign-in is not configured." }, { status: 503 });
  }

  if (!isSameOriginRequest(request, config.appOrigin)) {
    return NextResponse.json({ error: "Invalid callback request." }, { status: 403 });
  }

  let body: HashHandoffBody;
  try {
    body = (await request.json()) as HashHandoffBody;
  } catch {
    return NextResponse.json({ error: "Invalid callback payload." }, { status: 400 });
  }

  const expectedState = request.cookies.get(CUSTOMER_AUTH_COOKIES.callbackState)?.value;
  const accessToken = typeof body.accessToken === "string" ? body.accessToken : "";
  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken : "";
  const expiresIn = typeof body.expiresIn === "number" ? body.expiresIn : 0;
  if (
    typeof body.state !== "string" ||
    !expectedState ||
    body.state !== expectedState ||
    !accessToken ||
    !refreshToken ||
    !Number.isFinite(expiresIn) ||
    expiresIn < 60 ||
    expiresIn > 60 * 60 * 24
  ) {
    return NextResponse.json({ error: "Invalid callback payload." }, { status: 400 });
  }

  try {
    await fetchCustomerUser(config, accessToken);
  } catch {
    return NextResponse.json({ error: "Unable to verify sign-in session." }, { status: 401 });
  }

  const nextPath = safeSameOriginRedirect(
    request.cookies.get(CUSTOMER_AUTH_COOKIES.nextPath)?.value,
    config.appOrigin
  );
  const response = NextResponse.json({ redirectTo: nextPath }, { headers: { "Cache-Control": "private, no-store" } });
  setSessionCookies(response, {
    accessToken,
    refreshToken,
    expiresIn,
    tokenType: typeof body.tokenType === "string" ? body.tokenType : "bearer"
  });
  clearPendingAuthCookies(response);
  return response;
}
