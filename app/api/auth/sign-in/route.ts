import { NextResponse } from "next/server";
import { getCustomerAuthConfig } from "@/lib/customer-auth/config";
import { setPendingAuthCookies } from "@/lib/customer-auth/cookies";
import { isSameOriginRequest, safeSameOriginRedirect } from "@/lib/customer-auth/redirect";
import {
  createCallbackState,
  createPkcePair,
  CustomerAuthError,
  requestMagicLink
} from "@/lib/customer-auth/supabase-auth-rest";

export const runtime = "nodejs";

function signInRedirect(config: { appOrigin: string }, params: string): NextResponse {
  return NextResponse.redirect(new URL(`/auth/sign-in?${params}`, config.appOrigin), 303);
}

export async function POST(request: Request) {
  let config;
  try {
    config = getCustomerAuthConfig(request.url);
  } catch (error) {
    console.error("Customer auth configuration error", error);
    return NextResponse.json({ error: "Customer sign-in is not configured." }, { status: 503 });
  }

  if (!isSameOriginRequest(request, config.appOrigin)) {
    return NextResponse.json({ error: "Invalid sign-in request." }, { status: 403 });
  }

  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const nextPath = safeSameOriginRedirect(String(form.get("next") || ""), config.appOrigin);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return signInRedirect(config, `error=invalid-email&next=${encodeURIComponent(nextPath)}`);
  }

  const { verifier, challenge } = createPkcePair();
  const callbackState = createCallbackState();
  const callbackUrl = new URL("/auth/callback", config.appOrigin);
  callbackUrl.searchParams.set("state", callbackState);

  try {
    await requestMagicLink(config, email, callbackUrl.toString(), challenge);
  } catch (error) {
    const rateLimited = error instanceof CustomerAuthError && error.status === 429;
    console.error("Customer magic-link request failed", rateLimited ? "rate_limited" : "upstream_error");
    return signInRedirect(
      config,
      `error=${rateLimited ? "rate-limited" : "request-failed"}&next=${encodeURIComponent(nextPath)}`
    );
  }

  const response = signInRedirect(config, `status=email-sent&next=${encodeURIComponent(nextPath)}`);
  setPendingAuthCookies(response, { codeVerifier: verifier, callbackState, nextPath });
  return response;
}
