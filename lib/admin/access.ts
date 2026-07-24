import type { NextRequest } from "next/server";
import { getCustomerAuthConfig } from "@/lib/customer-auth/config";
import { isSameOriginRequest } from "@/lib/customer-auth/redirect";
import {
  resolveCustomerPageSession,
  resolveCustomerSession,
  type CustomerAuthCookieReader
} from "@/lib/customer-auth/session";
import type { CustomerAuthTokens } from "@/lib/customer-auth/types";
import { hasAdminAccess } from "@/lib/access";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AdminOperatorAccess =
  | { status: "authorized"; source: "session" | "local_legacy" }
  | { status: "signed_out" | "refresh_required" | "denied" | "unavailable" };

export type AdminMutationAccess = {
  authorized: boolean;
  refreshedTokens: CustomerAuthTokens | null;
};

export function configuredAdminOperatorEmails(
  env: Record<string, string | undefined> = process.env
): ReadonlySet<string> {
  const configured = env.ADMIN_OPERATOR_EMAILS?.trim();
  if (!configured) return new Set();

  const entries = configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0 || entries.some((email) => !EMAIL_PATTERN.test(email))) {
    return new Set();
  }
  return new Set(entries);
}

export function isConfiguredAdminOperator(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (!email) return false;
  return configuredAdminOperatorEmails(env).has(email.trim().toLowerCase());
}

export async function resolveAdminPageAccess(
  cookieStore: CustomerAuthCookieReader,
  legacyAccess?: string
): Promise<AdminOperatorAccess> {
  if (process.env.NODE_ENV !== "production" && hasAdminAccess(legacyAccess)) {
    return { status: "authorized", source: "local_legacy" };
  }

  try {
    const resolution = await resolveCustomerPageSession(getCustomerAuthConfig(), cookieStore);
    if (resolution.refreshRequired) return { status: "refresh_required" };
    if (!resolution.session) return { status: "signed_out" };
    if (
      !resolution.session.user.email_confirmed_at
      || !isConfiguredAdminOperator(resolution.session.user.email)
    ) {
      return { status: "denied" };
    }
    return { status: "authorized", source: "session" };
  } catch {
    return { status: "unavailable" };
  }
}

export async function authorizeAdminMutation(
  request: NextRequest,
  legacyAccess?: string
): Promise<AdminMutationAccess> {
  let config;
  try {
    config = getCustomerAuthConfig(request.url);
  } catch {
    const origin = request.headers.get("origin");
    let safeLocalOrigin = false;
    try {
      const requestUrl = new URL(request.url);
      const requestOrigin = new URL(origin || "");
      safeLocalOrigin = requestUrl.origin === requestOrigin.origin
        && ["localhost", "127.0.0.1"].includes(requestUrl.hostname);
    } catch {
      safeLocalOrigin = false;
    }
    if (
      process.env.NODE_ENV !== "production"
      && safeLocalOrigin
      && hasAdminAccess(legacyAccess)
    ) {
      return { authorized: true, refreshedTokens: null };
    }
    return { authorized: false, refreshedTokens: null };
  }

  const origin = request.headers.get("origin");
  if (!origin || !isSameOriginRequest(request, config.appOrigin)) {
    return { authorized: false, refreshedTokens: null };
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    return { authorized: false, refreshedTokens: null };
  }

  try {
    const session = await resolveCustomerSession(config, request.cookies);
    if (
      session?.user.email_confirmed_at
      && isConfiguredAdminOperator(session.user.email)
    ) {
      return { authorized: true, refreshedTokens: session.refreshedTokens };
    }
  } catch {
    return { authorized: false, refreshedTokens: null };
  }

  if (process.env.NODE_ENV !== "production" && hasAdminAccess(legacyAccess)) {
    return { authorized: true, refreshedTokens: null };
  }
  return { authorized: false, refreshedTokens: null };
}
