export type CustomerAuthConfig = {
  appOrigin: string;
  anonKey: string;
  authUrl: string;
};

function normalizedOrigin(value: string, name: string): string {
  const url = new URL(value);
  const isLocal = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !isLocal) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a secure origin without credentials, query, or fragment.`);
  }
  return url.origin;
}

export function getCustomerAuthConfig(requestUrl?: string): CustomerAuthConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  const appUrl = process.env.APP_URL?.trim() || (process.env.NODE_ENV !== "production" ? requestUrl : undefined);

  const missing = [
    !supabaseUrl ? "SUPABASE_URL" : null,
    !anonKey ? "SUPABASE_ANON_KEY" : null,
    !appUrl ? "APP_URL" : null
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Customer authentication is not configured. Missing: ${missing.join(", ")}`);
  }

  const supabaseOrigin = normalizedOrigin(supabaseUrl!, "SUPABASE_URL");
  return {
    appOrigin: normalizedOrigin(appUrl!, "APP_URL"),
    anonKey: anonKey!,
    authUrl: `${supabaseOrigin}/auth/v1`
  };
}
