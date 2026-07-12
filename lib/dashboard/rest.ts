type RestValue = string | number | boolean;

function serviceRoleConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Dashboard repository requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, key };
}

export async function dashboardSelect<T>(
  table: string,
  parameters: Record<string, RestValue | null | undefined>
): Promise<T[]> {
  const config = serviceRoleConfig();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value !== null && value !== undefined) query.set(key, String(value));
  }

  const response = await fetch(`${config.url}/rest/v1/${table}?${query.toString()}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Dashboard ${table} lookup failed (${response.status}): ${detail}`);
  }
  return (await response.json()) as T[];
}

export async function dashboardSelectOne<T>(
  table: string,
  parameters: Record<string, RestValue | null | undefined>
): Promise<T | null> {
  const rows = await dashboardSelect<T>(table, { ...parameters, limit: 1 });
  return rows[0] ?? null;
}

export async function dashboardInsert<T>(
  table: string,
  payload: Record<string, unknown>,
  options: { onConflict?: string; ignoreDuplicates?: boolean } = {}
): Promise<T | null> {
  const config = serviceRoleConfig();
  const query = options.onConflict ? `?on_conflict=${encodeURIComponent(options.onConflict)}` : "";
  const response = await fetch(`${config.url}/rest/v1/${table}${query}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: `${options.ignoreDuplicates ? "resolution=ignore-duplicates," : ""}return=representation`
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Dashboard ${table} insert failed (${response.status}): ${detail}`);
  }
  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

export async function dashboardUpdate<T>(
  table: string,
  filters: Record<string, RestValue>,
  payload: Record<string, unknown>
): Promise<T | null> {
  const config = serviceRoleConfig();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) query.set(key, String(value));
  const response = await fetch(`${config.url}/rest/v1/${table}?${query.toString()}`, {
    method: "PATCH",
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Dashboard ${table} update failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

export function inFilter(values: string[]): string | null {
  return values.length > 0 ? `in.(${values.join(",")})` : null;
}

export function pageParameters(options: { limit?: number; offset?: number } = {}): {
  limit: number;
  offset: number;
} {
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 50), 1), 100);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  return { limit, offset };
}
