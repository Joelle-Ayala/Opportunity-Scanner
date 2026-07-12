import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  claimScanRateLimit,
  clientIpFromRequest,
  hashRateLimitIdentity,
  normalizeRateLimitEmail
} from "../lib/scanRateLimit.ts";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const secret = "a-production-grade-test-secret-that-is-long-enough";

function setEnvironment(nodeEnv) {
  process.env.NODE_ENV = nodeEnv;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  process.env.SCAN_RATE_LIMIT_HASH_SECRET = secret;
  process.env.SCAN_RATE_LIMIT_IP_MAX = "7";
  process.env.SCAN_RATE_LIMIT_IP_WINDOW_SECONDS = "120";
  process.env.SCAN_RATE_LIMIT_EMAIL_MAX = "4";
  process.env.SCAN_RATE_LIMIT_EMAIL_WINDOW_SECONDS = "300";
}

try {
  assert.equal(normalizeRateLimitEmail("  Ada@Example.COM  "), "ada@example.com");
  assert.equal(
    hashRateLimitIdentity("email", "ada@example.com", secret).length,
    64,
    "identifiers must be fixed-length HMAC digests"
  );
  assert.notEqual(
    hashRateLimitIdentity("email", "203.0.113.9", secret),
    hashRateLimitIdentity("ip", "203.0.113.9", secret),
    "identity types must be domain-separated"
  );

  const request = new Request("https://www.opportunityscanner.ai/api/scans", {
    headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }
  });
  assert.equal(clientIpFromRequest(request), "203.0.113.9");

  setEnvironment("production");
  let rpcBody;
  globalThis.fetch = async (_url, init) => {
    rpcBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ allowed: true, retry_after_seconds: 0 }), { status: 200 });
  };
  assert.equal((await claimScanRateLimit(request, " Ada@Example.COM ")).allowed, true);
  assert.equal(rpcBody.p_ip_limit, 7);
  assert.equal(rpcBody.p_email_window_seconds, 300);
  assert.match(rpcBody.p_ip_hash, /^[0-9a-f]{64}$/);
  assert.match(rpcBody.p_email_hash, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(rpcBody), /ada@example\.com|203\.0\.113\.9/i);

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ allowed: false, retry_after_seconds: 42 }), { status: 200 });
  assert.deepEqual(await claimScanRateLimit(request, "ada@example.com"), {
    allowed: false,
    reason: "limited",
    retryAfterSeconds: 42
  });

  globalThis.fetch = async () => {
    throw new Error("persistence unavailable");
  };
  assert.deepEqual(await claimScanRateLimit(request, "ada@example.com"), {
    allowed: false,
    reason: "unavailable",
    retryAfterSeconds: 60
  });

  setEnvironment("development");
  assert.deepEqual(await claimScanRateLimit(request, "ada@example.com"), {
    allowed: true,
    reason: "development_bypass",
    retryAfterSeconds: 0
  });

  const [sql, route] = await Promise.all([
    readFile(new URL("../db/scan-rate-limits.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8")
  ]);
  assert.match(sql, /on conflict[\s\S]*do update set[\s\S]*request_count/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /cleanup_scan_rate_limits/i);
  assert.match(sql, /grant execute[\s\S]*service_role/i);
  assert.doesNotMatch(sql, /raw_(ip|email)|\bip_address\b|\bemail_address\b/i);
  assert.match(route, /if \(!rateLimit\.allowed\) return scanRejectedResponse\(rateLimit\)/);
  assert.match(route, /status: limited \? 429 : 503/);

  console.log("PASS scan rate limit: privacy, persistence policy, RPC contract, and response behavior");
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
