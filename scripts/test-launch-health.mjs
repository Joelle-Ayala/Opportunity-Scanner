import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/health/route.ts", import.meta.url), "utf8");

assert.match(route, /stripeMode\(\)/);
assert.match(route, /startsWith\("sk_live_"\)/);
assert.match(route, /startsWith\("sk_test_"\)/);
assert.match(route, /ready:\s*\{[\s\S]*demo:[\s\S]*paidSignup:/);
assert.match(route, /services:\s*\{[\s\S]*database,[\s\S]*auth,[\s\S]*scans,[\s\S]*payments,[\s\S]*stripeMode: mode,[\s\S]*email,[\s\S]*monitoring,[\s\S]*analytics/);
assert.match(route, /VERCEL_GIT_COMMIT_SHA\?\.slice\(0, 12\)/);
assert.match(route, /"Cache-Control": "no-store"/);
assert.doesNotMatch(route, /STRIPE_SECRET_KEY[^\n]*(?:return|json)/i);
assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY[^\n]*(?:return|json)/i);

console.log("Launch health contract passed without exposing configuration values.");
