import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

const [homepage, pricing, howItWorks, examples, exampleDetail, sampleReport] = await Promise.all([
  source("app/page.tsx"),
  source("app/pricing/page.tsx"),
  source("app/how-it-works/page.tsx"),
  source("app/examples/page.tsx"),
  source("app/examples/[slug]/page.tsx"),
  source("components/sample-report.tsx")
]);

for (const productClaim of [
  "Discover",
  "Qualify",
  "Pursue",
  "Turn a finding into a tracked pursuit"
]) {
  assert.match(homepage, new RegExp(productClaim));
}
assert.match(homepage, /current checkout availability/i);
for (const action of ["Review source", "Start pursuit", "Review contact path", "Send to workflow"]) {
  assert.match(homepage, new RegExp(action));
}
assert.match(homepage, /Tracked pursuit workspace/);

assert.match(pricing, /evaluateLaunchHealth\(process\.env\)/);
assert.match(pricing, /health\.ready\.reportCheckout/);
assert.match(pricing, /health\.ready\.subscriptionCheckout/);
assert.match(pricing, /Reports and monitoring are available/);
assert.match(pricing, /Paid checkout is paused/);
assert.match(pricing, /Plan details are visible for evaluation/);

for (const route of [
  "Open official application",
  "Register as vendor",
  "Contact buyer or partner",
  "Monitor the signal"
]) {
  assert.match(howItWorks, new RegExp(route));
}
assert.match(howItWorks, /Monitor and Growth plan availability is shown in real time/);

assert.match(examples, /Featured product walkthrough/);
assert.match(examples, /Open CivicStage walkthrough/);
assert.doesNotMatch(examples, /report\.estimatedPipeline/);
assert.match(exampleDetail, /opportunity-scanner-social-banner\.png/);

for (const workflowProof of [
  "Company enrichment",
  "Customer workflow",
  "Pursuit workspace preview",
  "Start a pursuit"
]) {
  assert.match(sampleReport, new RegExp(workflowProof));
}
assert.match(sampleReport, /Fictional company, public-source examples/);
assert.match(sampleReport, /Product actions/);
assert.match(sampleReport, /Start pursuit preview/);
assert.match(sampleReport, /Live opportunities/);
assert.match(sampleReport, /Funded-buyer evidence/);
assert.doesNotMatch(sampleReport, /Estimated pipeline/);

console.log("Public product story verification passed.");
