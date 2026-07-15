import { spawnSync } from "node:child_process";

const checks = [
  ["TypeScript", ["./node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"]],
  ["Security headers", ["scripts/test-security-headers.mjs"]],
  ["Launch health", ["scripts/test-launch-health.mjs"]],
  ["Safe outbound URLs", ["--experimental-strip-types", "scripts/test-safe-outbound-urls.mts"]],
  ["Report scan states", ["scripts/test-report-scan-states.mjs"]],
  ["Payment contract", ["--experimental-strip-types", "scripts/test-payments-contract.mjs"]],
  ["Stripe catalog preflight", ["--experimental-strip-types", "scripts/test-stripe-catalog-preflight.mjs"]],
  ["Payment access", ["--experimental-strip-types", "scripts/test-payment-access.mjs"]],
  ["Subscription handoff", ["--experimental-strip-types", "scripts/test-subscription-checkout-handoff.mjs"]],
  ["Anonymous subscription recovery", ["scripts/test-anonymous-subscription-checkout-recovery.mjs"]],
  ["Anonymous Report recovery", ["scripts/test-anonymous-report-checkout-recovery.mjs"]],
  ["Repeat Report purchase recovery", ["--experimental-strip-types", "scripts/test-repeat-report-purchase-recovery.mjs"]],
  ["Billing management", ["--experimental-strip-types", "scripts/test-billing-management.mjs"]],
  ["Customer entitlement", ["--experimental-strip-types", "scripts/test-customer-entitlement-contract.mjs"]],
  ["Paid customer journey", ["--experimental-strip-types", "scripts/test-paid-customer-journey.mjs"]],
  ["Demo provisioning", ["scripts/test-demo-provisioning.mjs"]],
  ["Workflow contract", ["--experimental-strip-types", "scripts/test-workflow-contract.mjs"]],
  ["Monitoring contract", ["--experimental-strip-types", "scripts/test-monitoring-contract.mjs"]],
  ["Monitoring throughput", ["--experimental-strip-types", "scripts/test-monitoring-throughput.mjs"]],
  ["Dashboard monitoring capacity", ["scripts/test-dashboard-monitor-capacity.mjs"]],
  ["Deadline alerts", ["--experimental-strip-types", "scripts/test-deadline-alerts.mjs"]],
  ["Nurture contract", ["--experimental-strip-types", "scripts/test-scan-nurture.mjs"]],
  ["Nurture pricing handoff", ["--experimental-strip-types", "scripts/test-nurture-pricing.mjs"]],
  ["Scan rate limit", ["--experimental-strip-types", "scripts/test-scan-rate-limit.mjs"]],
  ["Scan attribution", ["scripts/test-scan-attribution.mjs"]],
  ["Scan lifecycle email", ["--experimental-strip-types", "scripts/test-scan-lifecycle-email.mjs"]],
  ["Support identity", ["--experimental-strip-types", "scripts/test-support-identity.mjs"]],
  ["Paid Report fulfillment", ["--experimental-strip-types", "scripts/test-paid-report-fulfillment.mjs"]],
  ["Report payment lifecycle", ["scripts/test-report-payment-lifecycle-migration.mjs"]],
  ["Paid operations health", ["--experimental-strip-types", "scripts/test-paid-ops-health.mjs"]],
  ["Launch funnel", ["--experimental-strip-types", "scripts/test-launch-funnel.mjs"]],
  ["Product analytics", ["--experimental-strip-types", "scripts/test-product-analytics.mjs"]],
  ["Report outcome analytics", ["scripts/test-report-outcome-analytics.mjs"]],
  ["Migration manifest", ["scripts/test-migration-manifest.mjs"]],
  ["Scan execution budget", ["--experimental-strip-types", "scripts/test-scan-execution-budget.mjs"]],
  ["Connector runtime", ["--experimental-strip-types", "scripts/test-connector-runtime.mjs"]],
  ["Supabase request budget", ["--experimental-strip-types", "scripts/test-supabase-request-budget.mjs"]],
  ["Report quality regressions", ["scripts/evaluate-local-reports.mjs"]],
  ["Pricing checkout notice", ["scripts/test-pricing-checkout-notice.mjs"]],
  ["Report monitoring upsell", ["scripts/test-report-monitor-upsell.mjs"]],
  ["Responsive UI", ["scripts/test-responsive-ui.mjs"]],
  ["Customer experience", ["scripts/test-customer-experience-audit.mjs"]],
  ["Public content and sitemap", ["scripts/test-public-content-sitemap.mjs"]],
  ["Growth hardening", ["scripts/test-growth-hardening.mjs"]],
  ["Truthful enrichment", ["scripts/test-truthful-enrichment-ux.mjs"]],
  ["Production build", ["./node_modules/next/dist/bin/next", "build"]]
];

let passed = 0;
for (const [label, args] of checks) {
  console.log(`\n==> ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, CI: "1" },
    stdio: "inherit"
  });
  if (result.error) {
    console.error(`${label} could not start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status ?? "unknown"}.`);
    process.exit(result.status ?? 1);
  }
  passed += 1;
}

console.log(`\nLaunch verification passed: ${passed}/${checks.length} checks.`);
