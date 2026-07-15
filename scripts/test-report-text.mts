import assert from "node:assert/strict";
import test from "node:test";
import { plainSourceText, sourceEvidenceText } from "../lib/reportText.ts";

test("removes source HTML, embedded styles, and common entities", () => {
  const input = '<style>.x { color: red; }</style><p>Funding &amp; procurement&nbsp;<strong>notice</strong>.</p>';
  assert.equal(plainSourceText(input), "Funding & procurement notice.");
});

test("removes encoded markup and decodes punctuation", () => {
  const input = "&lt;p&gt;A school district&#39;s teaching artist program &ndash; now open.&lt;/p&gt;";
  assert.equal(plainSourceText(input), "A school district's teaching artist program - now open.");
});

test("caps long evidence at a readable boundary", () => {
  const input = `${"Relevant source sentence. ".repeat(30)}Final detail.`;
  const result = sourceEvidenceText(input, "Fallback", 180);
  assert.ok(result.length <= 180);
  assert.match(result, /\.\.\.$/);
  assert.doesNotMatch(result, /<[^>]+>/);
});

test("uses a clean opportunity title when source evidence is empty", () => {
  assert.equal(sourceEvidenceText("<p>&nbsp;</p>", "District teacher recruitment services"), "District teacher recruitment services");
});
