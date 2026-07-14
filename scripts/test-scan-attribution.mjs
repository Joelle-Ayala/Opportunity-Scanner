import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [homepage, route, storage, types, sql] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/scans/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/storage.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/types.ts", import.meta.url), "utf8"),
  readFile(new URL("../db/scan-attribution.sql", import.meta.url), "utf8")
]);

for (const name of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]) {
  assert.match(homepage, new RegExp(`"${name}"`), `${name} is preserved from the landing page`);
  assert.match(route, new RegExp(`formData\\.get\\("${name}"\\)`), `${name} is accepted by the scan route`);
  assert.match(storage, new RegExp(`${name}: input\\.`), `${name} is persisted with the scan`);
  assert.match(sql, new RegExp(`add column if not exists ${name} text`), `${name} has a production migration`);
}

assert.match(route, /slice\(0, 160\)/);
assert.match(types, /utmCampaign\?: string/);
assert.match(sql, /scans_utm_campaign_created_at_idx/);
console.log("Scan attribution checks passed.");
