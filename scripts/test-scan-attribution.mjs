import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS,
  FIRST_TOUCH_COOKIE_MAX_BYTES,
  firstTouchAttributionFromUrl,
  firstTouchCookieAssignment,
  parseFirstTouchCookie,
  resolveFirstTouchAttribution,
  scanAttributionStorageFields,
  serializeFirstTouchAttribution
} from "../lib/acquisitionAttribution.ts";

const nowMs = Date.parse("2026-07-14T16:00:00.000Z");
const firstTouch = firstTouchAttributionFromUrl({
  firstTouchId: "cda7c6b8-2d42-4c5d-9cd6-e405786f781f",
  firstTouchedAt: "2026-07-14T15:00:00.000Z",
  landingUrl:
    "https://www.opportunityscanner.ai/resources/public-sector?utm_source=linkedin&utm_medium=paid_social&utm_campaign=beta&utm_content=founder&utm_term=public%20sector&email=private%40example.com&companyUrl=https%3A%2F%2Fprivate.example&auth_token=secret&stripe_id=cus_secret",
  referrerUrl: "https://www.linkedin.com/feed/?full_referrer=private",
  nowMs
});

assert.deepEqual(firstTouch, {
  firstTouchId: "cda7c6b8-2d42-4c5d-9cd6-e405786f781f",
  firstTouchedAt: "2026-07-14T15:00:00.000Z",
  landingPath: "/resources/public-sector",
  utmSource: "linkedin",
  utmMedium: "paid_social",
  utmCampaign: "beta",
  utmContent: "founder",
  utmTerm: "public sector",
  referrerHost: "www.linkedin.com"
});

const serialized = serializeFirstTouchAttribution(firstTouch, nowMs);
assert.ok(serialized);
const decoded = decodeURIComponent(serialized);
for (const forbidden of ["email", "companyUrl", "auth_token", "stripe_id", "full_referrer", "private.example"]) {
  assert.doesNotMatch(decoded, new RegExp(forbidden, "i"), `${forbidden} must not enter attribution`);
}

const productionCookie = firstTouchCookieAssignment(serialized, true);
assert.match(productionCookie, /Path=\//);
assert.match(productionCookie, /SameSite=Lax/);
assert.match(productionCookie, /; Secure$/);
assert.doesNotMatch(productionCookie, /Domain=/i);
assert.ok(FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS <= 60 * 60 * 24 * 90);
assert.match(productionCookie, new RegExp(`Max-Age=${FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS}`));
assert.doesNotMatch(firstTouchCookieAssignment(serialized, false), /; Secure$/);

const laterDirectFallback = {
  firstTouchId: "5a289f50-87b9-468f-b2e3-3dc217c9b12e",
  firstTouchedAt: "2026-07-14T16:00:00.000Z",
  landingPath: "/pricing"
};
assert.deepEqual(
  resolveFirstTouchAttribution({ cookieValue: serialized, fallback: laterDirectFallback, nowMs }),
  firstTouch,
  "a valid cross-route first touch must survive a later direct visit"
);

assert.equal(parseFirstTouchCookie("%not-json", nowMs), null);
assert.equal(parseFirstTouchCookie("x".repeat(FIRST_TOUCH_COOKIE_MAX_BYTES + 1), nowMs), null);
assert.equal(
  parseFirstTouchCookie(
    encodeURIComponent(JSON.stringify({
      v: 1,
      i: firstTouch.firstTouchId,
      a: firstTouch.firstTouchedAt,
      p: firstTouch.landingPath,
      email: "private@example.com"
    })),
    nowMs
  ),
  null,
  "cookies with non-whitelisted privacy fields are rejected"
);
assert.equal(
  parseFirstTouchCookie(
    encodeURIComponent(JSON.stringify({ v: 1, i: "not-a-uuid", a: firstTouch.firstTouchedAt, p: "/" })),
    nowMs
  ),
  null
);
assert.equal(
  parseFirstTouchCookie(
    encodeURIComponent(JSON.stringify({
      v: 1,
      i: firstTouch.firstTouchId,
      a: firstTouch.firstTouchedAt,
      p: "/",
      us: "a".repeat(161)
    })),
    nowMs
  ),
  null,
  "a cookie with an oversized field is rejected instead of partially accepted"
);
assert.equal(
  parseFirstTouchCookie(
    encodeURIComponent(JSON.stringify({
      v: 1,
      i: firstTouch.firstTouchId,
      a: firstTouch.firstTouchedAt,
      p: "/pricing?email=private"
    })),
    nowMs
  ),
  null
);

const oversizedUtm = firstTouchAttributionFromUrl({
  firstTouchId: "e933f009-4797-4728-8ac8-50e10377fe05",
  firstTouchedAt: "2026-07-14T16:00:00.000Z",
  landingUrl: `https://www.opportunityscanner.ai/about?utm_source=${"a".repeat(161)}`,
  nowMs
});
assert.ok(oversizedUtm);
assert.equal(oversizedUtm.utmSource, undefined);

const fallbackAttribution = resolveFirstTouchAttribution({
  cookieValue: "invalid",
  fallback: {
    ...laterDirectFallback,
    utmSource: "newsletter",
    utmCampaign: "launch"
  },
  nowMs
});
assert.ok(fallbackAttribution);
assert.equal(fallbackAttribution.utmSource, "newsletter");

assert.deepEqual(scanAttributionStorageFields(firstTouch), {
  first_touch_id: firstTouch.firstTouchId,
  first_touch_at: firstTouch.firstTouchedAt,
  first_touch_landing_path: firstTouch.landingPath,
  first_touch_referrer_host: firstTouch.referrerHost,
  utm_source: "linkedin",
  utm_medium: "paid_social",
  utm_campaign: "beta",
  utm_content: "founder",
  utm_term: "public sector"
});

const [layout, component, route, storage, types, migration, manifestSource, privacy] = await Promise.all([
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../components/first-touch-attribution.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/storage.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/types.ts", import.meta.url), "utf8"),
  readFile(new URL("../db/first-touch-acquisition-attribution.sql", import.meta.url), "utf8"),
  readFile(new URL("../db/migration-manifest.json", import.meta.url), "utf8"),
  readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8")
]);

assert.match(layout, /<FirstTouchAttributionCapture \/>/);
assert.match(component, /if \(parseFirstTouchCookie\(existing, now\.getTime\(\)\)\) return/);
assert.match(route, /cookieValue: cookieStore\.get\(FIRST_TOUCH_COOKIE_NAME\)\?\.value/);
assert.match(route, /firstTouchAttribution: firstTouchAttribution \?\? undefined/);
assert.doesNotMatch(route, /companyUrl:[\s\S]{0,500}firstTouchId: companyUrl/);
assert.match(storage, /scanAttributionStorageFields\(input\.firstTouchAttribution/);
assert.match(types, /firstTouchAttribution\?: FirstTouchAttribution/);
for (const column of [
  "first_touch_id",
  "first_touch_at",
  "first_touch_landing_path",
  "first_touch_referrer_host"
]) {
  assert.match(migration, new RegExp(`add column if not exists ${column}`));
}
assert.match(migration, /interval '90 days'/);
assert.match(migration, /octet_length\(first_touch_landing_path\) between 1 and 512/);
assert.match(migration, /scans_first_touch_id_created_at_idx/);
assert.match(privacy, /First-touch campaign attribution/);
assert.match(privacy, /same-site first-party cookie for up[\s\S]{0,30}to 90 days/);
assert.match(privacy, /does not store an email address/);

const manifest = JSON.parse(manifestSource);
const manifestEntry = manifest.migrations.find((entry) => entry.version === "v0021");
assert.ok(manifestEntry);
assert.equal(manifestEntry.version, "v0021");
assert.equal(manifestEntry.file, "db/first-touch-acquisition-attribution.sql");
assert.deepEqual(manifestEntry.prerequisites, ["v0001", "v0002"]);
assert.equal(createHash("sha256").update(migration).digest("hex"), manifestEntry.sha256);

console.log("PASS first-touch attribution: persistence, precedence, privacy, storage, and migration wiring");
