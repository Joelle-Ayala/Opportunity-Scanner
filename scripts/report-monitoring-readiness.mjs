import { existsSync, readFileSync } from "node:fs";
import { getMonitoringSchedulerEvidence } from "../lib/monitoring/storage.ts";
import { evaluateMonitoringSoakReadiness } from "../lib/monitoring/soakReadiness.ts";

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

loadLocalEnv();

if (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const rows = await getMonitoringSchedulerEvidence(new Date(Date.now() - 48 * 60 * 60_000), 500);
const readiness = evaluateMonitoringSoakReadiness(rows);
console.log(JSON.stringify(readiness, null, 2));
if (!readiness.ready) process.exitCode = 1;
