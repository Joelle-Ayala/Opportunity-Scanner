import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const root = process.cwd();
const contentSource = fs.readFileSync(path.join(root, "lib", "marketingContent.ts"), "utf8");
const helperSource = fs.readFileSync(path.join(root, "lib", "solutionPageMetadata.ts"), "utf8");
const solutionSection = contentSource.slice(
  contentSource.indexOf("export const solutionPages"),
  contentSource.indexOf("export const industryPages")
);

const solutions = [...solutionSection.matchAll(
  /slug: "([^"]+)",\s+name: "([^"]+)",\s+headline: "[^"]+",\s+description:\s+"([^"]+)"/g
)].map(([, slug, name, description]) => ({ slug, name, description }));

assert.ok(solutions.length > 0, "Expected at least one solution page in marketingContent.ts");
assert.equal(
  solutions.length,
  [...solutionSection.matchAll(/\bslug:\s+"/g)].length,
  "Expected the metadata test to parse every declared solution slug"
);

const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function (exports, module) { ${compiled}\n})(module.exports, module);`, { module });
const { buildSolutionPageMetadata } = module.exports;

const siteUrl = "https://www.opportunityscanner.ai";
const socialImage = `${siteUrl}/opportunity-scanner-social-banner.png`;

for (const solution of solutions) {
  const metadata = buildSolutionPageMetadata(solution, siteUrl);
  const canonicalUrl = `${siteUrl}/solutions/${solution.slug}`;
  const socialTitle = `${solution.name} | Opportunity Scanner`;

  assert.equal(metadata.title, solution.name, `${solution.slug}: document title`);
  assert.equal(metadata.description, solution.description, `${solution.slug}: description`);
  assert.equal(metadata.alternates.canonical, canonicalUrl, `${solution.slug}: canonical`);
  assert.equal(metadata.openGraph.title, socialTitle, `${solution.slug}: Open Graph title`);
  assert.equal(metadata.openGraph.description, solution.description, `${solution.slug}: Open Graph description`);
  assert.equal(metadata.openGraph.url, canonicalUrl, `${solution.slug}: Open Graph URL`);
  assert.equal(metadata.openGraph.images[0].url, socialImage, `${solution.slug}: Open Graph image`);
  assert.equal(metadata.openGraph.images[0].width, 1200, `${solution.slug}: Open Graph image width`);
  assert.equal(metadata.openGraph.images[0].height, 630, `${solution.slug}: Open Graph image height`);
  assert.equal(metadata.twitter.card, "summary_large_image", `${solution.slug}: Twitter card`);
  assert.equal(metadata.twitter.title, socialTitle, `${solution.slug}: Twitter title`);
  assert.equal(metadata.twitter.description, solution.description, `${solution.slug}: Twitter description`);
  assert.equal(metadata.twitter.images[0], socialImage, `${solution.slug}: Twitter image`);
}

console.log(`Solution metadata checks passed: ${solutions.length}/${solutions.length} slugs`);
