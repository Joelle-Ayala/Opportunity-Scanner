import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../db/report-quality-publication-fence.sql", import.meta.url), "utf8");

assert.match(sql, /stripe_report_access_requires_published_scan/);
assert.match(sql, /paid_report_delivery_requires_published_scan/);
assert.match(sql, /scan\.status = 'completed'/);
assert.match(sql, /new\.status = 'active'/);
assert.match(sql, /report_grant\.status = 'active'/);
assert.match(sql, /before insert or update of scan_id, status/);
assert.match(sql, /before insert or update of report_access_grant_id, status/);
assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/);

console.log("Report-quality publication fence migration tests passed.");
