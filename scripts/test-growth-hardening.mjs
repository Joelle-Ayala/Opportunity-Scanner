import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const privateSegments = ["reports", "profiles", "opportunities", "dashboard", "admin", "alerts"];

for (const segment of privateSegments) {
  const layoutPath = path.join(root, "app", segment, "layout.tsx");
  const source = fs.readFileSync(layoutPath, "utf8");

  assert.match(source, /export const metadata:\s*Metadata\s*=\s*{/, `${segment}: exports metadata`);
  assert.match(source, /robots:\s*{[\s\S]*?index:\s*false,[\s\S]*?follow:\s*false/, `${segment}: blocks indexing and following`);
}

const rootLayout = fs.readFileSync(path.join(root, "app", "layout.tsx"), "utf8");
assert.doesNotMatch(rootLayout, /robots:\s*{[\s\S]*?index:\s*false/, "Public routes must not inherit noindex");

const required = [
  "OPENAI_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_URL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_REPORT",
  "CRON_SECRET",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "OPPORTUNITY_SCANNER_CONTACT_EMAIL",
  "ALERT_UNSUBSCRIBE_SECRET",
  "NURTURE_UNSUBSCRIBE_SECRET",
  "SCAN_RATE_LIMIT_HASH_SECRET",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST"
];
const recommended = [
  "SAM_API_KEY",
  "SNOV_CLIENT_ID",
  "SNOV_CLIENT_SECRET"
];
const subscriptionPrices = [
  "STRIPE_PRICE_MONITOR_MONTHLY",
  "STRIPE_PRICE_MONITOR_ANNUAL",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_ANNUAL"
];
const preflightPath = path.join(root, "scripts", "check-launch-env.mjs");
const emptyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "opportunity-scanner-launch-env-"));

function runPreflight(env) {
  return spawnSync(process.execPath, [preflightPath], {
    cwd: emptyDirectory,
    env,
    encoding: "utf8"
  });
}

try {
  const missing = runPreflight({});
  assert.equal(missing.status, 1, "Preflight must fail when required production variables are absent");
  for (const name of [...required, ...recommended]) {
    assert.match(missing.stdout, new RegExp(`\\b${name}\\b`), `Preflight reports missing ${name}`);
  }
  for (const name of subscriptionPrices) {
    assert.doesNotMatch(
      missing.stdout,
      new RegExp(`Missing required:[^\\n]*\\b${name}\\b`),
      `${name} must not block Report-only launch`
    );
  }

  const configuredValues = Object.fromEntries(
    [...required, ...recommended].map((name, index) => [name, `private-value-${index}`])
  );
  configuredValues.STRIPE_SECRET_KEY = "sk_live_growth_hardening";
  const configured = runPreflight(configuredValues);
  assert.equal(configured.status, 0, `Preflight should pass with required variables configured: ${configured.stderr}`);

  const output = `${configured.stdout}\n${configured.stderr}`;
  for (const value of Object.values(configuredValues)) {
    assert.doesNotMatch(output, new RegExp(value), "Preflight must never print secret values");
  }

  const subscriptionEnabled = runPreflight({
    ...configuredValues,
    ENABLE_SUBSCRIPTION_CHECKOUT: "true"
  });
  assert.equal(subscriptionEnabled.status, 1);
  for (const name of subscriptionPrices) {
    assert.match(subscriptionEnabled.stdout, new RegExp(`\\b${name}\\b`));
  }
} finally {
  fs.rmSync(emptyDirectory, { recursive: true, force: true });
}

console.log(`Growth hardening checks passed: ${privateSegments.length} private route groups and ${required.length} Report-launch environment variables`);
