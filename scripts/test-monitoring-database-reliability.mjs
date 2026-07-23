import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, storage, rest] = await Promise.all([
  readFile(new URL("../db/monitoring-deadline-rpc-reliability.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/monitoring/storage.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabaseRest.ts", import.meta.url), "utf8")
]);

test("deadline enqueue preserves SHA-256 keys with an extension-safe search path", () => {
  assert.match(migration, /create extension if not exists pgcrypto/);
  assert.match(
    migration,
    /create or replace function public\.enqueue_due_deadline_alerts[\s\S]*?set search_path = public, extensions, pg_temp/
  );
  assert.match(migration, /digest\([\s\S]*?'sha256'::text[\s\S]*?\)/);
  assert.doesNotMatch(migration, /md5\(/);
});

test("deadline claim qualifies the output-name collision", () => {
  assert.match(
    migration,
    /update public\.deadline_alerts as alert[\s\S]*?and alert\.deadline_date < current_date/
  );
  assert.doesNotMatch(migration, /and deadline_date < current_date/);
});

test("repaired deadline RPCs remain service-role only", () => {
  for (const functionName of [
    "enqueue_due_deadline_alerts",
    "claim_pending_deadline_alerts"
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${functionName}\\(integer\\)[\\s\\S]*?from public, anon, authenticated, service_role`
      )
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${functionName}\\(integer\\) to service_role`)
    );
  }
});

test("aggregate heartbeat uses an explicit no-content RPC adapter", () => {
  assert.match(storage, /supabaseRpcVoid\("record_monitoring_scheduler_run"/);
  assert.match(rest, /responseMode: "json" \| "void" = "json"/);
  assert.match(rest, /if \(responseMode === "void"\)[\s\S]*?return undefined as T/);
  assert.match(
    rest,
    /export async function supabaseRpcVoid\([\s\S]*?"Supabase RPC failed",[\s\S]*?"void"/
  );
});
