import assert from "node:assert/strict";

import nextConfig from "../next.config.mjs";

assert.equal(typeof nextConfig.headers, "function", "Next config must define headers()");

const rules = await nextConfig.headers();
assert.equal(rules.length, 1, "Expected one global security-header rule");
assert.equal(rules[0].source, "/(.*)", "Security headers must cover every route");

const headers = new Map();
for (const { key, value } of rules[0].headers) {
  const normalizedKey = key.toLowerCase();
  assert.ok(!headers.has(normalizedKey), `Duplicate security header: ${key}`);
  headers.set(normalizedKey, value);
}

assert.deepEqual(
  Object.fromEntries(headers),
  {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "SAMEORIGIN",
    "permissions-policy": "camera=(), microphone=(), geolocation=()"
  },
  "Security headers must match the reviewed compatibility policy"
);
assert.ok(
  !headers.has("content-security-policy"),
  "Do not add CSP until all analytics, Supabase, Stripe, and remote-logo origins are proven"
);

console.log("Security header contract tests passed.");
