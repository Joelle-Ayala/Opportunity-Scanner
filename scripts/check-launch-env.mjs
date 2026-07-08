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
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPPORTUNITY_SCANNER_REPORT_ACCESS_CODE",
  "OPPORTUNITY_SCANNER_ADMIN_CODE"
];

const recommended = [
  "SAM_API_KEY",
  "SNOV_CLIENT_ID",
  "SNOV_CLIENT_SECRET"
];

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

if (process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === "true") {
  console.log("Warning: ALLOW_LOCAL_STORAGE_IN_PRODUCTION=true is only acceptable for temporary internal testing.");
}

if (missingRequired.length > 0) {
  process.exitCode = 1;
}
