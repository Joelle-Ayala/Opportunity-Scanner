import { existsSync, readFileSync } from "node:fs";
import { buildLaunchFunnelSnapshot } from "../lib/launchFunnel.ts";

const QUERY_LIMIT = 5_000;

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const name = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (name && process.env[name] === undefined) process.env[name] = value;
  }
}

function requestedDays() {
  const index = process.argv.indexOf("--days");
  const value = index >= 0 ? Number(process.argv[index + 1]) : 7;
  if (!Number.isInteger(value) || value < 1 || value > 90) {
    throw new Error("Use --days with a whole number from 1 to 90.");
  }
  return value;
}

async function selectRows(baseUrl, serviceRoleKey, table, params) {
  const query = new URLSearchParams({ ...params, limit: String(QUERY_LIMIT) });
  const response = await fetch(`${baseUrl}/rest/v1/${table}?${query.toString()}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`${table} query failed with status ${response.status}.`);
  return response.json();
}

loadLocalEnv();

const baseUrl = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!baseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const days = requestedDays();
const now = new Date();
const startedAt = new Date(now.getTime() - days * 86_400_000).toISOString();
const [scans, grants, subscriptions, profiles] = await Promise.all([
  selectRows(baseUrl, serviceRoleKey, "scans", {
    select: "id,status,created_at,completed_at,utm_source,utm_medium,utm_campaign",
    created_at: `gte.${startedAt}`,
    order: "created_at.desc"
  }),
  selectRows(baseUrl, serviceRoleKey, "stripe_report_access_grants", {
    select: "scan_id,status",
    granted_at: `gte.${startedAt}`
  }),
  selectRows(baseUrl, serviceRoleKey, "stripe_subscriptions", {
    select: "stripe_customer_id,product,billing_interval,status,livemode,created_at,canceled_at",
    livemode: "eq.true"
  }),
  selectRows(baseUrl, serviceRoleKey, "monitored_profiles", {
    select: "stripe_customer_id,status,created_at"
  })
]);

const snapshot = buildLaunchFunnelSnapshot({
  scans,
  grants,
  subscriptions,
  profiles,
  days,
  now,
  capped:
    scans.length === QUERY_LIMIT ||
    grants.length === QUERY_LIMIT ||
    subscriptions.length === QUERY_LIMIT ||
    profiles.length === QUERY_LIMIT
});

console.log(JSON.stringify(snapshot, null, 2));
