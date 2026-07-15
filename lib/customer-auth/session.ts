import type { CustomerAuthConfig } from "./config";
import { CUSTOMER_AUTH_COOKIES } from "./cookies";
import { CustomerAuthError, fetchCustomerUser, refreshSession } from "./supabase-auth-rest";
import type { CustomerSession } from "./types";

export type CustomerAuthCookieReader = {
  get(name: string): { value: string } | undefined;
};

export type CustomerPageSessionResolution = {
  session: CustomerSession | null;
  refreshRequired: boolean;
};

export async function resolveCustomerPageSession(
  config: CustomerAuthConfig,
  cookieStore: CustomerAuthCookieReader
): Promise<CustomerPageSessionResolution> {
  const accessToken = cookieStore.get(CUSTOMER_AUTH_COOKIES.accessToken)?.value;
  const refreshToken = cookieStore.get(CUSTOMER_AUTH_COOKIES.refreshToken)?.value;
  if (!accessToken) return { session: null, refreshRequired: Boolean(refreshToken) };

  try {
    const user = await fetchCustomerUser(config, accessToken);
    return {
      session: { user, accessToken, refreshedTokens: null },
      refreshRequired: false
    };
  } catch (error) {
    if (!(error instanceof CustomerAuthError) || error.status !== 401) throw error;
    return { session: null, refreshRequired: Boolean(refreshToken) };
  }
}

export async function resolveCustomerSession(
  config: CustomerAuthConfig,
  cookieStore: CustomerAuthCookieReader
): Promise<CustomerSession | null> {
  const accessToken = cookieStore.get(CUSTOMER_AUTH_COOKIES.accessToken)?.value;
  const refreshToken = cookieStore.get(CUSTOMER_AUTH_COOKIES.refreshToken)?.value;
  if (!accessToken && !refreshToken) return null;

  if (accessToken) {
    try {
      const user = await fetchCustomerUser(config, accessToken);
      return { user, accessToken, refreshedTokens: null };
    } catch (error) {
      if (!(error instanceof CustomerAuthError) || error.status !== 401) throw error;
    }
  }

  if (!refreshToken) return null;
  try {
    const refreshedTokens = await refreshSession(config, refreshToken);
    const user = await fetchCustomerUser(config, refreshedTokens.accessToken);
    return { user, accessToken: refreshedTokens.accessToken, refreshedTokens };
  } catch (error) {
    if (error instanceof CustomerAuthError && [400, 401, 403].includes(error.status)) return null;
    throw error;
  }
}
