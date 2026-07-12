import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [payloadSource, routeSource, pageSource] = await Promise.all([
  readFile(new URL("../lib/workflowPayload.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/api/workflow/send/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/docs/webhooks/page.tsx", import.meta.url), "utf8")
]);

const typeBlock = payloadSource.match(/export type WorkflowPayload = \{([\s\S]*?)\n\};/)?.[1];
assert.ok(typeBlock, "WorkflowPayload type was not found");

const payloadTypeByField = new Map(
  [...typeBlock.matchAll(/^\s{2}(\w+)\??:\s*([^;]+);/gm)].map((match) => [match[1], match[2]])
);
const documentedTypeByField = new Map(
  [...pageSource.matchAll(/\{ name: "(\w+)", type: "([^"]+)"/g)].map((match) => [match[1], match[2]])
);
const payloadFields = [...payloadTypeByField.keys()].sort();
const documentedFields = [...documentedTypeByField.keys()].sort();
assert.deepEqual(documentedFields, payloadFields, "Webhook docs must list every WorkflowPayload field exactly once");
for (const [field, payloadType] of payloadTypeByField) {
  assert.equal(documentedTypeByField.get(field), payloadType, `${field} must use its current WorkflowPayload type`);
}

for (const envelopeField of ["product", "sent_at", "opportunity"]) {
  assert.match(pageSource, new RegExp(`\\b${envelopeField}\\b`), `Docs must describe ${envelopeField}`);
  assert.match(routeSource, new RegExp(`\\b${envelopeField}\\b`), `Route must deliver ${envelopeField}`);
}

const requiredBlock = routeSource.match(/const requiredTextFields = \[([\s\S]*?)\n  \];/)?.[1];
assert.ok(requiredBlock, "Route required field list was not found");
const requiredFields = [...requiredBlock.matchAll(/"(\w+)"/g)].map((match) => match[1]);
for (const field of requiredFields) {
  assert.match(
    pageSource,
    new RegExp(`name: "${field}"[^\\n]+delivery: "Required"`),
    `${field} must be documented as required`
  );
}

for (const platform of ["Zapier", "Make", "n8n"]) {
  assert.match(pageSource, new RegExp(`name: "${platform}"`), `Docs must include a ${platform} recipe`);
}

console.log(`Webhook documentation checks passed: ${documentedFields.length} payload fields and 3 recipes.`);
