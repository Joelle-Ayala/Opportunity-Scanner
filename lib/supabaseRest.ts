import { AsyncLocalStorage } from "node:async_hooks";

type SupabaseConfig = {
  url: string;
  key: string;
};

export type SupabaseRequestBudget = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type SupabaseInsertOptions = {
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

export const DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

const requestBudgetStorage = new AsyncLocalStorage<SupabaseRequestBudget>();

export function withSupabaseRequestBudget<T>(
  budget: SupabaseRequestBudget,
  operation: () => Promise<T>
): Promise<T> {
  return requestBudgetStorage.run(budget, operation);
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return { url: url.replace(/\/$/, ""), key };
}

function requestTimeoutMs(inheritedBudget: SupabaseRequestBudget | undefined): number {
  if (inheritedBudget?.timeoutMs === undefined) {
    return DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS;
  }

  const inheritedTimeoutMs = Number.isFinite(inheritedBudget.timeoutMs)
    ? Math.max(1, Math.floor(inheritedBudget.timeoutMs))
    : 1;
  return Math.min(DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS, inheritedTimeoutMs);
}

async function supabaseRequest<T>(
  url: string,
  init: RequestInit,
  failureLabel: string
): Promise<T> {
  const inheritedBudget = requestBudgetStorage.getStore();
  const timeoutMs = requestTimeoutMs(inheritedBudget);
  const controller = new AbortController();
  const parentSignals = Array.from(
    new Set(
      [inheritedBudget?.signal, init.signal].filter(
        (signal): signal is AbortSignal => Boolean(signal)
      )
    )
  );
  const parentAbortListeners = new Map<AbortSignal, () => void>();
  let timedOut = false;

  for (const signal of parentSignals) {
    const abortRequest = () => controller.abort(signal.reason);
    if (signal.aborted) {
      abortRequest();
      break;
    }
    parentAbortListeners.set(signal, abortRequest);
    signal.addEventListener("abort", abortRequest, { once: true });
  }

  const timeout = setTimeout(() => {
    if (!controller.signal.aborted) {
      timedOut = true;
      controller.abort(new DOMException("Supabase request timed out.", "TimeoutError"));
    }
  }, timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${failureLabel}: ${await response.text()}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (timedOut) {
      throw new Error(`${failureLabel} timed out after ${timeoutMs}ms.`);
    }
    if (controller.signal.aborted) {
      throw controller.signal.reason ?? error;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    for (const [signal, abortRequest] of parentAbortListeners) {
      signal.removeEventListener("abort", abortRequest);
    }
  }
}

export async function supabaseInsert<T>(
  table: string,
  payload: Record<string, unknown>,
  options: SupabaseInsertOptions = {}
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  const query = options.onConflict
    ? `?on_conflict=${encodeURIComponent(options.onConflict)}`
    : "";
  const rows = await supabaseRequest<T[]>(
    `${config.url}/rest/v1/${table}${query}`,
    {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: `${options.ignoreDuplicates ? "resolution=ignore-duplicates," : ""}return=representation`
      },
      body: JSON.stringify(payload)
    },
    "Supabase insert failed"
  );

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

  const rows = await supabaseRequest<T[]>(
    `${config.url}/rest/v1/${table}?id=eq.${id}`,
    {
      method: "PATCH",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    },
    "Supabase update failed"
  );

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

  const rows = await supabaseRequest<T[]>(
    `${config.url}/rest/v1/${table}?${query}&limit=1`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`
      },
      cache: "no-store"
    },
    "Supabase select failed"
  );

  return rows[0] ?? null;
}

export async function supabaseSelectMany<T>(table: string, query: string): Promise<T[]> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  return supabaseRequest<T[]>(
    `${config.url}/rest/v1/${table}?${query}`,
    {
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`
      },
      cache: "no-store"
    },
    "Supabase select failed"
  );
}

export async function supabaseRpc<T>(
  functionName: string,
  payload: Record<string, unknown>
): Promise<T> {
  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase is not configured.");
  }

  return supabaseRequest<T>(
    `${config.url}/rest/v1/rpc/${functionName}`,
    {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    },
    "Supabase RPC failed"
  );
}
