import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [founderStory, founderNote, homepage, about, brand, siteSchema, articleSchema, marketingContent, launchDraft] = await Promise.all([
  source("lib/founderStory.ts"),
  source("components/founder-note.tsx"),
  source("app/page.tsx"),
  source("app/about/page.tsx"),
  source("components/brand.tsx"),
  source("components/structured-data.tsx"),
  source("components/resources/article-structured-data.tsx"),
  source("lib/marketingContent.ts"),
  source("content/founder-launch-article.md")
]);

assert.match(homepage, /<FounderNote\s*\/>/);
assert.ok(homepage.indexOf("<FounderNote />") > homepage.indexOf("What teams get"));
assert.ok(homepage.indexOf("<FounderNote />") < homepage.indexOf("Industry paths"));
assert.match(about, /founderStory/);
assert.match(about, /<FounderNote showLink=\{false\}/);
assert.match(about, /See Sample Reports/);
assert.match(brand, /\["Why We Built It", "\/about"\]/);

assert.match(siteSchema, /"@type": "Person"/);
assert.match(siteSchema, /founderStory\.identity\.schemaId/);
assert.match(articleSchema, /article\.author\.type \|\| "Person"/);
assert.match(marketingContent, /type: "Organization"/);
assert.match(marketingContent, /Opportunity Scanner Research Team/);

for (const unpublishedName of ["Reparel", "SchoolGig", "Jammcard", "Gerstel", "Meaningful Use"]) {
  assert.doesNotMatch(founderStory, new RegExp(unpublishedName, "i"));
  assert.doesNotMatch(about, new RegExp(unpublishedName, "i"));
}
assert.doesNotMatch(founderStory, /\b(?:she|her|he|him|his)\b/i);
assert.doesNotMatch(about, /\b(?:she|her|he|him|his)\b/i);

assert.match(launchDraft, /status: "draft-needs-founder-verification"/);
assert.match(launchDraft, /TODO founder verification/g);
assert.doesNotMatch(marketingContent, /why-i-built-opportunity-scanner/);

console.log("Founder story integration checks passed.");
