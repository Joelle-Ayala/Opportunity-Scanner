import { createHash, randomBytes } from "node:crypto";
import type { CustomerAuthConfig } from "./config";
import type { CustomerAuthTokens, SupabaseCustomerUser } from "./types";

type SupabaseTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

type SupabaseErrorBody = { code?: string; error_code?: string; msg?: string; message?: string };

export class CustomerAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code = "customer_auth_error"
  ) {
    super(message);
    this.name = "CustomerAuthError";
  }
}

function headers(config: CustomerAuthConfig, accessToken?: string): Record<string, string> {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${accessToken || config.anonKey}`,
    "Content-Type": "application/json"
  };
}

async function authError(response: Response): Promise<CustomerAuthError> {
  let body: SupabaseErrorBody = {};
  try {
    body = (await response.json()) as SupabaseErrorBody;
  } catch {
    // Keep upstream HTML and proxy responses out of user-facing errors.
  }
  return new CustomerAuthError(
    body.message || body.msg || "Supabase authentication request failed.",
    response.status,
    body.error_code || body.code || "supabase_auth_error"
  );
}

function tokensFrom(body: SupabaseTokenResponse): CustomerAuthTokens {
  if (!body.access_token || !body.refresh_token || !body.expires_in) {
    throw new CustomerAuthError("Supabase returned an invalid session.", 502, "invalid_session_response");
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresIn: body.expires_in,
    tokenType: body.token_type || "bearer"
  };
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function createCallbackState(): string {
  return randomBytes(24).toString("base64url");
}

export async function requestMagicLink(
  config: CustomerAuthConfig,
  email: string,
  redirectTo: string,
  codeChallenge: string
): Promise<void> {
  const response = await fetch(`${config.authUrl}/otp`, {
    method: "POST",
    headers: { ...headers(config), "x-supabase-redirect-to": redirectTo },
    body: JSON.stringify({
      email,
      create_user: true,
      data: {},
      code_challenge: codeChallenge,
      code_challenge_method: "s256"
    }),
    cache: "no-store"
  });
  if (!response.ok) throw await authError(response);
}

export async function exchangeAuthCode(
  config: CustomerAuthConfig,
  authCode: string,
  codeVerifier: string
): Promise<CustomerAuthTokens> {
  const response = await fetch(`${config.authUrl}/token?grant_type=pkce`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
    cache: "no-store"
  });
  if (!response.ok) throw await authError(response);
  return tokensFrom((await response.json()) as SupabaseTokenResponse);
}

export async function refreshSession(
  config: CustomerAuthConfig,
  refreshToken: string
): Promise<CustomerAuthTokens> {
  const response = await fetch(`${config.authUrl}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store"
  });
  if (!response.ok) throw await authError(response);
  return tokensFrom((await response.json()) as SupabaseTokenResponse);
}

export async function fetchCustomerUser(
  config: CustomerAuthConfig,
  accessToken: string
): Promise<SupabaseCustomerUser> {
  const response = await fetch(`${config.authUrl}/user`, {
    headers: headers(config, accessToken),
    cache: "no-store"
  });
  if (!response.ok) throw await authError(response);
  return (await response.json()) as SupabaseCustomerUser;
}

export async function revokeSession(config: CustomerAuthConfig, accessToken: string): Promise<void> {
  const response = await fetch(`${config.authUrl}/logout?scope=local`, {
    method: "POST",
    headers: headers(config, accessToken),
    cache: "no-store"
  });
  if (!response.ok && response.status !== 401) throw await authError(response);
}
