import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  customerAuthErrorFromResponse,
  parseRetryAfterSeconds
} from "../lib/customer-auth/supabase-auth-rest.ts";

const ROOT = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, ROOT), "utf8");

const timedError = await customerAuthErrorFromResponse(new Response(
  JSON.stringify({ error_code: "over_email_send_rate_limit", message: "Too many requests" }),
  { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "42" } }
));
assert.equal(timedError.status, 429);
assert.equal(timedError.code, "over_email_send_rate_limit");
assert.equal(timedError.retryAfterSeconds, 42);

const untimedError = await customerAuthErrorFromResponse(new Response(
  JSON.stringify({ error_code: "over_email_send_rate_limit", message: "Too many requests" }),
  { status: 429, headers: { "Content-Type": "application/json" } }
));
assert.equal(untimedError.status, 429);
assert.equal(untimedError.retryAfterSeconds, undefined);

const now = Date.parse("2026-08-05T12:00:00Z");
assert.equal(parseRetryAfterSeconds("Wed, 05 Aug 2026 12:00:30 GMT", now), 30);
assert.equal(parseRetryAfterSeconds("invalid", now), undefined);
assert.equal(parseRetryAfterSeconds("0", now), undefined);

const [route, page] = await Promise.all([
  source("app/api/auth/sign-in/route.ts"),
  source("app/auth/sign-in/page.tsx")
]);

assert.match(route, /error\.retryAfterSeconds/);
assert.match(route, /errorParams\.set\("retry_after", String\(retryAfterSeconds\)\)/);
assert.match(route, /Math\.min\(Math\.max\(Math\.ceil\(error\.retryAfterSeconds\), 1\), 3600\)/);
assert.match(route, /outcome: rateLimited \? "rate_limited" : "upstream_error"/);
const logBlock = route.match(/console\.error\("Customer magic-link request failed", \{[\s\S]*?\}\);/)?.[0];
assert.ok(logBlock, "the route must emit a structured auth failure log");
assert.doesNotMatch(logBlock, /\bemail\b|\.message\b/);

assert.match(page, /A sign-in link may already be in your inbox\. Wait \$\{retryAfter\} seconds before requesting another\./);
assert.match(page, /A sign-in link may already be in your inbox\. Wait a minute before requesting another\./);
assert.match(page, /Requesting another link too soon can delay access\./);
assert.doesNotMatch(page, /searchParams\?\.email|params\.email/);

console.log("PASS customer auth rate limits: retry timing, clear UI copy, and privacy-safe logs");
