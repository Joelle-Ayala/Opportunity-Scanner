import { NextRequest, NextResponse } from "next/server";
import { getCustomerAuthConfig } from "@/lib/customer-auth/config";
import {
  clearPendingAuthCookies,
  CUSTOMER_AUTH_COOKIES,
  setSessionCookies
} from "@/lib/customer-auth/cookies";
import { safeSameOriginRedirect } from "@/lib/customer-auth/redirect";
import { exchangeAuthCode } from "@/lib/customer-auth/supabase-auth-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashHandoffResponse(): NextResponse {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><title>Completing sign in</title></head>
<body><p>Completing secure sign in...</p><script nonce="${nonce}">
(async()=>{const p=new URLSearchParams(location.hash.slice(1));const body={accessToken:p.get("access_token"),refreshToken:p.get("refresh_token"),expiresIn:Number(p.get("expires_in")),tokenType:p.get("token_type"),state:new URLSearchParams(location.search).get("state")};history.replaceState(null,"",location.pathname+location.search);if(!body.accessToken||!body.refreshToken){location.replace("/auth/sign-in?error=invalid-link");return}try{const r=await fetch("/api/auth/hash-callback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),credentials:"same-origin"});const result=await r.json();location.replace(r.ok&&result.redirectTo?result.redirectTo:"/auth/sign-in?error=expired-link")}catch{location.replace("/auth/sign-in?error=request-failed")}})();
</script></body></html>`;
  return new NextResponse(html, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'`,
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET(request: NextRequest) {
  let config;
  try {
    config = getCustomerAuthConfig(request.url);
  } catch (error) {
    console.error("Customer auth configuration error", error);
    return NextResponse.json({ error: "Customer sign-in is not configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(CUSTOMER_AUTH_COOKIES.callbackState)?.value;
  const codeVerifier = request.cookies.get(CUSTOMER_AUTH_COOKIES.codeVerifier)?.value;
  const stateMismatch = Boolean(state && state !== expectedState);
  const nextPath = safeSameOriginRedirect(
    request.cookies.get(CUSTOMER_AUTH_COOKIES.nextPath)?.value,
    config.appOrigin
  );

  if (!expectedState || stateMismatch || !codeVerifier) {
    const response = NextResponse.redirect(new URL("/auth/sign-in?error=invalid-link", config.appOrigin), 303);
    clearPendingAuthCookies(response);
    return response;
  }

  if (!code) return hashHandoffResponse();

  try {
    const tokens = await exchangeAuthCode(config, code, codeVerifier);
    const response = NextResponse.redirect(new URL(nextPath, config.appOrigin), 303);
    setSessionCookies(response, tokens);
    clearPendingAuthCookies(response);
    return response;
  } catch {
    console.error("Customer auth code exchange failed");
    const response = NextResponse.redirect(new URL("/auth/sign-in?error=expired-link", config.appOrigin), 303);
    clearPendingAuthCookies(response);
    return response;
  }
}
