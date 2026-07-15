import { existsSync, readFileSync } from "fs";

function loadLocalEnv() {
  if (!existsSync(".env.local")) return;

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const name = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (name && process.env[name] === undefined) {
      process.env[name] = value;
    }
  }
}

loadLocalEnv();

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

const subscriptionPriceNames = [
  "STRIPE_PRICE_MONITOR_MONTHLY",
  "STRIPE_PRICE_MONITOR_ANNUAL",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_ANNUAL"
];

const reportCheckoutFlagName = "ENABLE_PAID_REPORT_CHECKOUT";
const reportCheckoutFlagValue = process.env[reportCheckoutFlagName]?.trim();

function configured(name) {
  return Boolean(process.env[name]?.trim());
}

function reportGroup(label, names) {
  const missing = names.filter((name) => !configured(name));
  const present = names.filter((name) => configured(name));

  console.log(`${label}: ${present.length}/${names.length} configured`);
  if (missing.length > 0) {
    console.log(`Missing ${label.toLowerCase()}: ${missing.join(", ")}`);
  }
  return missing;
}

const missingRequired = reportGroup("Required", required);
reportGroup("Recommended", recommended);

const safetyErrors = [];
if (!process.env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_")) {
  safetyErrors.push("STRIPE_SECRET_KEY must use an sk_live_* key for production launch.");
}

if (reportCheckoutFlagValue && reportCheckoutFlagValue !== "true" && reportCheckoutFlagValue !== "false") {
  safetyErrors.push(`${reportCheckoutFlagName} must be exactly true or false.`);
} else if (reportCheckoutFlagValue === "true") {
  console.log("Notice: paid Report checkout is explicitly enabled.");
} else {
  console.log("Notice: paid Report checkout is disabled until the controlled launch gate is approved.");
}

const subscriptionFlagName = "ENABLE_SUBSCRIPTION_CHECKOUT";
const subscriptionFlagValue = process.env[subscriptionFlagName]?.trim();
if (subscriptionFlagValue && subscriptionFlagValue !== "true" && subscriptionFlagValue !== "false") {
  safetyErrors.push(`${subscriptionFlagName} must be exactly true or false.`);
} else if (subscriptionFlagValue === "true") {
  const missingSubscriptionPrices = reportGroup("Subscription prices", subscriptionPriceNames);
  if (missingSubscriptionPrices.length > 0) {
    safetyErrors.push(
      `${subscriptionFlagName}=true requires all Monitor and Growth Stripe Price IDs.`
    );
  }
} else {
  console.log("Notice: subscription checkout is disabled; only one-time Report checkout may launch.");
}

const legacyOverrideName =
  "OPPORTUNITY_SCANNER_EMERGENCY_ENABLE_LEGACY_URL_ACCESS_CODES_IN_PRODUCTION";
const legacyOverrideValue = process.env[legacyOverrideName]?.trim();
const legacyCodeFamilies = [
  ["OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE", "REPORT_ACCESS_CODE"],
  ["OPPORTUNITY_SCANNER_ADMIN_CODE", "ADMIN_REPORT_ACCESS_CODE"]
];
const effectiveLegacyCodes = legacyCodeFamilies
  .map((names) => names.map((name) => process.env[name]?.trim()).find(Boolean))
  .filter(Boolean);

if (legacyOverrideValue && legacyOverrideValue !== "true" && legacyOverrideValue !== "false") {
  safetyErrors.push(`${legacyOverrideName} must be exactly true or false.`);
} else if (legacyOverrideValue === "true") {
  if (effectiveLegacyCodes.length === 0) {
    safetyErrors.push(`${legacyOverrideName}=true requires at least one legacy URL access code.`);
  }
  if (effectiveLegacyCodes.some((code) => code.length < 32)) {
    safetyErrors.push("Emergency production legacy URL access codes must be at least 32 characters.");
  }
  console.log("Warning: emergency production legacy URL access-code bypass is enabled.");
} else if (effectiveLegacyCodes.length > 0) {
  console.log("Notice: configured legacy report/admin URL access codes are disabled in production.");
}

for (const message of safetyErrors) {
  console.log(`Production safety error: ${message}`);
}

if (process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === "true") {
  console.log("Warning: ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true is only acceptable for temporary internal testing.");
}

if (missingRequired.length > 0 || safetyErrors.length > 0) {
  process.exitCode = 1;
}
