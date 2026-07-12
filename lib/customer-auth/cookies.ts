import type { NextResponse } from "next/server";
import type { CustomerAuthTokens } from "./types";

export const CUSTOMER_AUTH_COOKIES = {
  accessToken: "os-customer-access-token",
  refreshToken: "os-customer-refresh-token",
  codeVerifier: "os-customer-code-verifier",
  callbackState: "os-customer-callback-state",
  nextPath: "os-customer-next-path"
} as const;

const secure = process.env.NODE_ENV === "production";

export function setPendingAuthCookies(
  response: NextResponse,
  values: { codeVerifier: string; callbackState: string; nextPath: string }
): void {
  const options = { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge: 10 * 60 };
  response.cookies.set(CUSTOMER_AUTH_COOKIES.codeVerifier, values.codeVerifier, options);
  response.cookies.set(CUSTOMER_AUTH_COOKIES.callbackState, values.callbackState, options);
  response.cookies.set(CUSTOMER_AUTH_COOKIES.nextPath, values.nextPath, options);
}

export function setSessionCookies(response: NextResponse, tokens: CustomerAuthTokens): void {
  const options = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
  response.cookies.set(CUSTOMER_AUTH_COOKIES.accessToken, tokens.accessToken, {
    ...options,
    maxAge: Math.max(60, tokens.expiresIn)
  });
  response.cookies.set(CUSTOMER_AUTH_COOKIES.refreshToken, tokens.refreshToken, {
    ...options,
    maxAge: 60 * 60 * 24 * 30
  });
}

export function clearPendingAuthCookies(response: NextResponse): void {
  clearCookies(response, [
    CUSTOMER_AUTH_COOKIES.codeVerifier,
    CUSTOMER_AUTH_COOKIES.callbackState,
    CUSTOMER_AUTH_COOKIES.nextPath
  ]);
}

export function clearSessionCookies(response: NextResponse): void {
  clearCookies(response, [CUSTOMER_AUTH_COOKIES.accessToken, CUSTOMER_AUTH_COOKIES.refreshToken]);
}

function clearCookies(response: NextResponse, names: string[]): void {
  for (const name of names) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      expires: new Date(0)
    });
  }
}
