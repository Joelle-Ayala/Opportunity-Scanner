#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SELECTED_SCANS = 100;

class OperatorError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "OperatorError";
    this.status = status;
  }
}

function requiredValue(value, name) {
  const normalized = value?.trim();
  if (!normalized) throw new OperatorError(`${name} is required.`);
  return normalized;
}

export function normalizeEmail(value, name = "Email") {
  const email = requiredValue(value, name).toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new OperatorError(`${name} must be a valid email address.`);
  }
  return email;
}

export function normalizeUuid(value, name = "Scan ID") {
  const uuid = requiredValue(value, name).toLowerCase();
  if (!UUID_PATTERN.test(uuid)) throw new OperatorError(`${name} must be a valid UUID.`);
  return uuid;
}

export function normalizeOrigin(value, name) {
  let url;
  try {
    url = new URL(requiredValue(value, name));
  } catch {
    throw new OperatorError(`${name} must be a valid URL origin.`);
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(localHost && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new OperatorError(`${name} must be an HTTPS origin without credentials, path, query, or fragment.`);
  }
  return url.origin;
}

function splitValues(values) {
  return values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function optionValue(argv, index, inlineValue, name) {
  if (inlineValue !== undefined) {
    if (!inlineValue) throw new OperatorError(`${name} requires a value.`);
    return { value: inlineValue, nextIndex: index };
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new OperatorError(`${name} requires a value.`);
  return { value, nextIndex: index + 1 };
}

export function parseOptions(argv, env = process.env) {
  const cli = { scanIds: [], scanEmails: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [name, inlineValue] = argument.split(/=(.*)/s, 2);
    if (name === "--apply" && inlineValue === undefined) cli.apply = true;
    else if ((name === "--help" || name === "-h") && inlineValue === undefined) cli.help = true;
    else if (["--email", "--scan-id", "--scan-email", "--app-url"].includes(name)) {
      const parsed = optionValue(argv, index, inlineValue, name);
      index = parsed.nextIndex;
      if (name === "--email") cli.email = parsed.value;
      if (name === "--scan-id") cli.scanIds.push(parsed.value);
      if (name === "--scan-email") cli.scanEmails.push(parsed.value);
      if (name === "--app-url") cli.appUrl = parsed.value;
    } else {
      throw new OperatorError("An unsupported command-line argument was provided.");
    }
  }

  if (cli.help) return { help: true };

  const rawScanIds = cli.scanIds.length > 0 ? cli.scanIds : [env.DEMO_SCAN_IDS || ""];
  const rawScanEmails = cli.scanEmails.length > 0
    ? cli.scanEmails
    : [env.DEMO_SCAN_EMAILS || env.DEMO_SCAN_EMAIL || ""];
  const scanIds = unique(splitValues(rawScanIds).map((value) => normalizeUuid(value)));
  const scanEmails = unique(splitValues(rawScanEmails).map((value) => normalizeEmail(value, "Scan email")));
  if (scanIds.length === 0 && scanEmails.length === 0) {
    throw new OperatorError("At least one --scan-id or --scan-email selector is required.");
  }

  return {
    help: false,
    apply: cli.apply === true,
    customerEmail: normalizeEmail(cli.email || env.DEMO_CUSTOMER_EMAIL, "Customer email"),
    scanIds,
    scanEmails,
    appOrigin: normalizeOrigin(cli.appUrl || env.APP_URL, "APP_URL"),
    supabaseOrigin: normalizeOrigin(env.SUPABASE_URL, "SUPABASE_URL"),
    serviceRoleKey: requiredValue(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY")
  };
}

function createSupabaseClient(options, fetchImpl) {
  const baseUrl = new URL(options.supabaseOrigin);
  const headers = {
    apikey: options.serviceRoleKey,
    Authorization: `Bearer ${options.serviceRoleKey}`
  };

  async function request(path, { method = "GET", query, body, prefer } = {}) {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
    }
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers: {
          ...headers,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(prefer ? { Prefer: prefer } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store"
      });
    } catch {
      throw new OperatorError("Supabase request failed before receiving a response.");
    }
    if (!response.ok) {
      throw new OperatorError(`Supabase request failed with status ${response.status}.`, response.status);
    }
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch {
      throw new OperatorError("Supabase returned an invalid response.");
    }
  }

  return {
    request,
    select(table, query) {
      return request(`/rest/v1/${table}`, { query });
    },
    insert(table, body, { onConflict, resolution = "merge-duplicates" } = {}) {
      return request(`/rest/v1/${table}`, {
        method: "POST",
        query: onConflict ? { on_conflict: onConflict } : undefined,
        body,
        prefer: `resolution=${resolution},return=representation`
      });
    },
    update(table, query, body) {
      return request(`/rest/v1/${table}`, {
        method: "PATCH",
        query,
        body,
        prefer: "return=representation"
      });
    }
  };
}

function validateAuthUser(candidate, expectedEmail) {
  const user = candidate?.user || candidate;
  if (!user || !UUID_PATTERN.test(user.id || "") || normalizeEmail(user.email, "Auth user email") !== expectedEmail) {
    throw new OperatorError("Supabase returned an invalid Auth user record.");
  }
  return { id: user.id.toLowerCase() };
}

async function findAuthUser(client, email) {
  const matches = [];
  const perPage = 1000;
  for (let page = 1; page <= 100; page += 1) {
    const body = await client.request("/auth/v1/admin/users", {
      query: { page, per_page: perPage }
    });
    const users = Array.isArray(body) ? body : body?.users;
    if (!Array.isArray(users)) throw new OperatorError("Supabase returned an invalid Auth user list.");
    for (const user of users) {
      if (typeof user?.email === "string" && user.email.trim().toLowerCase() === email) matches.push(user);
    }
    if (users.length < perPage) break;
    if (page === 100) throw new OperatorError("Auth user lookup exceeded the safe pagination limit.");
  }
  if (matches.length > 1) throw new OperatorError("Multiple Auth users matched the customer email.");
  return matches.length === 1 ? validateAuthUser(matches[0], email) : null;
}

async function createAuthUser(client, email) {
  try {
    const body = await client.request("/auth/v1/admin/users", {
      method: "POST",
      body: { email, email_confirm: false }
    });
    return validateAuthUser(body, email);
  } catch (error) {
    if (!(error instanceof OperatorError) || ![409, 422].includes(error.status)) throw error;
    const racedUser = await findAuthUser(client, email);
    if (!racedUser) throw new OperatorError("Auth user creation conflicted with another record.");
    return racedUser;
  }
}

function oneRow(rows, description) {
  if (!Array.isArray(rows)) throw new OperatorError(`Supabase returned invalid ${description} data.`);
  if (rows.length > 1) throw new OperatorError(`Multiple ${description} records were found.`);
  return rows[0] || null;
}

async function loadAccountState(client, authUserId, email) {
  const byEmail = oneRow(await client.select("customer_accounts", {
    select: "id,auth_user_id,email",
    email: `eq.${email}`,
    limit: 2
  }), "customer account");
  const byAuth = authUserId
    ? oneRow(await client.select("customer_accounts", {
        select: "id,auth_user_id,email",
        auth_user_id: `eq.${authUserId}`,
        limit: 2
      }), "customer account")
    : null;

  if (byEmail && byAuth && byEmail.id !== byAuth.id) {
    throw new OperatorError("Customer email and Auth user resolve to different accounts.");
  }
  const account = byEmail || byAuth;
  if (!account) return null;
  if (
    !UUID_PATTERN.test(account.id || "") ||
    !UUID_PATTERN.test(account.auth_user_id || "") ||
    normalizeEmail(account.email, "Customer account email") !== email ||
    (authUserId && account.auth_user_id.toLowerCase() !== authUserId)
  ) {
    throw new OperatorError("The existing customer account does not match the requested identity.");
  }
  return { id: account.id.toLowerCase(), authUserId: account.auth_user_id.toLowerCase() };
}

async function upsertAccount(client, authUserId, email) {
  try {
    const rows = await client.insert("customer_accounts", {
      auth_user_id: authUserId,
      email
    }, { onConflict: "auth_user_id" });
    const account = oneRow(rows, "customer account");
    if (!account || !UUID_PATTERN.test(account.id || "")) {
      throw new OperatorError("Customer account upsert returned an invalid record.");
    }
    return { id: account.id.toLowerCase(), authUserId };
  } catch (error) {
    if (!(error instanceof OperatorError) || ![409, 422].includes(error.status)) throw error;
    const racedAccount = await loadAccountState(client, authUserId, email);
    if (!racedAccount) throw new OperatorError("Customer account upsert conflicted with another record.");
    return racedAccount;
  }
}

function validateScan(row) {
  if (
    !row ||
    !UUID_PATTERN.test(row.id || "") ||
    !["free", "unlocked", "admin"].includes(row.report_access) ||
    row.status !== "completed"
  ) {
    throw new OperatorError("A selected scan is not a completed report with a supported access state.");
  }
  return {
    id: row.id.toLowerCase()
  };
}

async function resolveScans(client, scanIds, scanEmails) {
  const selected = new Map();
  for (const scanId of scanIds) {
    const rows = await client.select("scans", {
      select: "id,report_access,status",
      id: `eq.${scanId}`,
      limit: 2
    });
    const row = oneRow(rows, "scan");
    if (!row) throw new OperatorError("A requested scan ID was not found.");
    const scan = validateScan(row);
    selected.set(scan.id, scan);
  }
  for (const scanEmail of scanEmails) {
    const rows = await client.select("scans", {
      select: "id,report_access,status",
      email: `eq.${scanEmail}`,
      status: "eq.completed",
      order: "created_at.asc"
    });
    if (!Array.isArray(rows)) throw new OperatorError("Supabase returned invalid scan data.");
    if (rows.length === 0) throw new OperatorError("A requested scan email did not match any scans.");
    for (const row of rows) {
      const scan = validateScan(row);
      selected.set(scan.id, scan);
    }
  }
  if (selected.size === 0) throw new OperatorError("No scans were selected.");
  if (selected.size > MAX_SELECTED_SCANS) {
    throw new OperatorError(`The selection exceeds the ${MAX_SELECTED_SCANS}-scan safety limit.`);
  }
  return [...selected.values()].sort((left, right) => left.id.localeCompare(right.id));
}

async function loadOwnership(client, scans) {
  const rows = await client.select("customer_scan_ownership", {
    select: "customer_account_id,scan_id,access_level",
    scan_id: `in.(${scans.map((scan) => scan.id).join(",")})`
  });
  if (!Array.isArray(rows)) throw new OperatorError("Supabase returned invalid scan ownership data.");
  const ownership = new Map();
  for (const row of rows) {
    if (!UUID_PATTERN.test(row?.scan_id || "") || !UUID_PATTERN.test(row?.customer_account_id || "")) {
      throw new OperatorError("Supabase returned invalid scan ownership data.");
    }
    ownership.set(row.scan_id.toLowerCase(), {
      accountId: row.customer_account_id.toLowerCase(),
      accessLevel: row.access_level || "free"
    });
  }
  return ownership;
}

function assertOwnershipAvailable(ownership, accountId) {
  for (const owner of ownership.values()) {
    if (!accountId || owner.accountId !== accountId) {
      throw new OperatorError("A selected scan is already owned by another customer account.");
    }
  }
}

async function attachScan(client, accountId, scanId) {
  await client.insert("customer_scan_ownership", {
    customer_account_id: accountId,
    scan_id: scanId,
    ownership_kind: "claimed"
  }, { onConflict: "scan_id", resolution: "ignore-duplicates" });
  const row = oneRow(await client.select("customer_scan_ownership", {
    select: "customer_account_id,scan_id,access_level",
    scan_id: `eq.${scanId}`,
    limit: 2
  }), "scan ownership");
  if (!row || row.customer_account_id?.toLowerCase() !== accountId) {
    throw new OperatorError("Scan ownership could not be safely attached to the customer account.");
  }
}

async function grantAccountReportAccess(client, accountId, scanId) {
  const updated = await client.update("customer_scan_ownership", {
    customer_account_id: `eq.${accountId}`,
    scan_id: `eq.${scanId}`
  }, { access_level: "full" });
  if (Array.isArray(updated) && updated.some((row) => row.scan_id?.toLowerCase() === scanId)) return;
  const row = oneRow(await client.select("customer_scan_ownership", {
    select: "customer_account_id,scan_id,access_level",
    customer_account_id: `eq.${accountId}`,
    scan_id: `eq.${scanId}`,
    limit: 2
  }), "scan ownership");
  if (!row || row.access_level !== "full") {
    throw new OperatorError("Account-scoped report access could not be safely granted.");
  }
}

function loginUrl(appOrigin) {
  const url = new URL("/auth/sign-in", appOrigin);
  url.searchParams.set("next", "/dashboard");
  return url.toString();
}

export async function runProvisioning({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = fetch
} = {}) {
  const options = parseOptions(argv, env);
  if (options.help) return { help: true };
  const client = createSupabaseClient(options, fetchImpl);
  const scans = await resolveScans(client, options.scanIds, options.scanEmails);
  let authUser = await findAuthUser(client, options.customerEmail);
  let account = await loadAccountState(client, authUser?.id || null, options.customerEmail);
  if (account && !authUser) {
    throw new OperatorError("A customer account exists without a matching Auth user.");
  }
  const ownership = await loadOwnership(client, scans);
  assertOwnershipAvailable(ownership, account?.id || null);

  const plannedAttachments = scans.filter((scan) => !ownership.has(scan.id)).map((scan) => scan.id);
  const plannedGrants = scans.filter((scan) => ownership.get(scan.id)?.accessLevel !== "full").map((scan) => scan.id);
  const authState = authUser ? "existing" : options.apply ? "created" : "would_create";
  const accountState = account ? "existing" : options.apply ? "created" : "would_create";

  if (options.apply) {
    if (!authUser) authUser = await createAuthUser(client, options.customerEmail);
    if (!account) account = await upsertAccount(client, authUser.id, options.customerEmail);
    assertOwnershipAvailable(ownership, account.id);
    for (const scanId of plannedAttachments) await attachScan(client, account.id, scanId);
    for (const scanId of plannedGrants) await grantAccountReportAccess(client, account.id, scanId);
  }

  return {
    mode: options.apply ? "applied" : "dry-run",
    authUser: { state: authState, id: authUser?.id || null },
    customerAccount: { state: accountState, id: account?.id || null },
    scans: {
      selectedIds: scans.map((scan) => scan.id),
      alreadyAttachedIds: scans.filter((scan) => ownership.has(scan.id)).map((scan) => scan.id),
      [options.apply ? "attachedIds" : "wouldAttachIds"]: plannedAttachments,
      alreadyFullAccessIds: scans.filter((scan) => ownership.get(scan.id)?.accessLevel === "full").map((scan) => scan.id),
      [options.apply ? "grantedFullAccessIds" : "wouldGrantFullAccessIds"]: plannedGrants
    },
    accessScope: "account-scoped full access for selected reports only",
    billingState: "unchanged; no Stripe customer, charge, grant, subscription, or credit was created",
    monitoringSubscription: "not provisioned; monitoring requires truthful active billing",
    nextLoginUrl: loginUrl(options.appOrigin)
  };
}

export function helpText() {
  return `Provision a demo customer with report-level access only.

Dry-run (default):
  node scripts/provision-demo-customer.mjs --email CUSTOMER_EMAIL --scan-id SCAN_UUID

Apply explicitly:
  node scripts/provision-demo-customer.mjs --apply --email CUSTOMER_EMAIL --scan-id SCAN_UUID

Selectors may be repeated or comma-separated:
  --scan-id UUID             Attach one completed scan by ID
  --scan-email EMAIL         Attach all completed scans with that scan email

Configuration:
  --email EMAIL              Demo customer's sign-in email (or DEMO_CUSTOMER_EMAIL)
  --app-url HTTPS_ORIGIN     Login origin (or APP_URL)
  DEMO_SCAN_IDS              Comma-separated scan IDs
  DEMO_SCAN_EMAILS           Comma-separated scan emails
  SUPABASE_URL               Supabase project origin
  SUPABASE_SERVICE_ROLE_KEY  Service role credential (never printed)
`;
}

async function main() {
  try {
    const result = await runProvisioning();
    console.log(result.help ? helpText() : JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof OperatorError
      ? error.message
      : "Demo customer provisioning failed unexpectedly.";
    console.error(`ERROR: ${message}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) await main();
