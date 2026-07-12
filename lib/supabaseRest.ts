type SupabaseConfig = {
  url: string;
  key: string;
};

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), key };
}

export async function supabaseInsert<T>(
  table: string,
  payload: Record<string, unknown>
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Supabase insert failed: ${await response.text()}`);
  }

  const rows = (await response.json()) as T[];
  return rows[0];
}

export async function supabaseUpdate<T>(
  table: string,
  id: string,
  payload: Record<string, unknown>
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Supabase update failed: ${await response.text()}`);
  }

  const rows = (await response.json()) as T[];
  return rows[0];
}

export async function supabaseSelectOne<T>(
  table: string,
  query: string
): Promise<T | null> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${table}?${query}&limit=1`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase select failed: ${await response.text()}`);
  }

  const rows = (await response.json()) as T[];
  return rows[0] ?? null;
}

export async function supabaseSelectMany<T>(table: string, query: string): Promise<T[]> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase select failed: ${await response.text()}`);
  }

  return (await response.json()) as T[];
}

export async function supabaseRpc<T>(
  functionName: string,
  payload: Record<string, unknown>
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase RPC failed: ${await response.text()}`);
  }

  return (await response.json()) as T;
}
