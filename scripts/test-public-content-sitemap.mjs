import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [industryPage, resourcesPage, sitemap] = await Promise.all([
  source("app/industries/[slug]/page.tsx"),
  source("app/resources/page.tsx"),
  source("app/sitemap.ts")
]);

assert.doesNotMatch(industryPage, /Search intent|industry\.searchIntent/);
assert.match(industryPage, /Signals this scan can look for/);

for (const internalPhrase of [
  "Publishing next",
  "Content backlog",
  "upcomingResourceIdeas",
  "content sprint",
  "SEO intent",
  "Content pillars",
  "route the reader"
]) {
  assert.doesNotMatch(resourcesPage, new RegExp(internalPhrase, "i"));
}
assert.match(resourcesPage, /Free field guides/);
assert.match(resourcesPage, /Featured guides/);
assert.match(resourcesPage, /Browse by theme/);

assert.match(sitemap, /article\.lastReviewedAt \?\? article\.publishedAt/);
assert.match(sitemap, /"\/privacy": "2026-07-14"/);
assert.match(sitemap, /"\/terms": "2026-07-11"/);
assert.match(sitemap, /"\/resources": latestResourceDate/);
assert.doesNotMatch(sitemap, /new Date\(\)/);

console.log("Public content and sitemap checks passed.");
