import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT);
const MANIFEST_FILE = "db/migration-manifest.json";

function compactSql(sql) {
  return sql
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function splitSqlStatements(sql) {
  const statements = [];
  let buffer = "";
  let state = "normal";
  let dollarTag = "";

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];

    if (state === "line-comment") {
      if (character === "\n") {
        buffer += " ";
        state = "normal";
      }
      continue;
    }

    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        buffer += " ";
        state = "normal";
        index += 1;
      }
      continue;
    }

    if (state === "single-quote") {
      buffer += character;
      if (character === "'" && next === "'") {
        buffer += next;
        index += 1;
      } else if (character === "'") {
        state = "normal";
      }
      continue;
    }

    if (state === "double-quote") {
      buffer += character;
      if (character === '"' && next === '"') {
        buffer += next;
        index += 1;
      } else if (character === '"') {
        state = "normal";
      }
      continue;
    }

    if (state === "dollar-quote") {
      if (sql.startsWith(dollarTag, index)) {
        buffer += dollarTag;
        index += dollarTag.length - 1;
        state = "normal";
      } else {
        buffer += character;
      }
      continue;
    }

    if (character === "-" && next === "-") {
      state = "line-comment";
      index += 1;
    } else if (character === "/" && next === "*") {
      state = "block-comment";
      index += 1;
    } else if (character === "'") {
      buffer += character;
      state = "single-quote";
    } else if (character === '"') {
      buffer += character;
      state = "double-quote";
    } else if (character === "$") {
      const match = sql.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        dollarTag = match[0];
        buffer += dollarTag;
        index += dollarTag.length - 1;
        state = "dollar-quote";
      } else {
        buffer += character;
      }
    } else if (character === ";") {
      if (buffer.trim()) statements.push(buffer.trim());
      buffer = "";
    } else {
      buffer += character;
    }
  }

  assert.ok(
    state === "normal" || state === "line-comment",
    `ledger SQL ended inside ${state}`
  );
  if (buffer.trim()) statements.push(buffer.trim());
  return statements;
}

function assertInOrder(source, fragments, message) {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    assert.ok(next > cursor, `${message}: missing or out of order: ${fragment}`);
    cursor = next;
  }
}

function git(args, context) {
  const result = spawnSync("git", args, {
    cwd: ROOT_PATH,
    encoding: "utf8"
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${context}: ${result.stderr.trim() || "git command failed"}`);
  return result.stdout;
}

function gitObjectExists(object) {
  const result = spawnSync("git", ["cat-file", "-e", object], {
    cwd: ROOT_PATH,
    encoding: "utf8"
  });
  assert.ifError(result.error);
  return result.status === 0;
}

function gitFile(commit, file) {
  const object = `${commit}:${file}`;
  if (!gitObjectExists(object)) return null;
  return git(["show", object], `could not read historical ${file}`);
}

function requestedBaseRef() {
  const equalsArg = process.argv.find((argument) => argument.startsWith("--base-ref="));
  if (equalsArg) return equalsArg.slice("--base-ref=".length).trim();

  const index = process.argv.indexOf("--base-ref");
  if (index >= 0) {
    assert.ok(process.argv[index + 1], "--base-ref requires a Git revision");
    return process.argv[index + 1].trim();
  }

  return process.env.MIGRATION_BASE_REF?.trim() || "";
}

async function verifyHistoricalImmutability(manifest, baseRef) {
  if (!baseRef) return { checked: false, historicalSqlCount: 0, protectedEntryCount: 0 };

  const mergeBase = git(["merge-base", "HEAD", baseRef], `could not resolve merge base for ${baseRef}`).trim();
  assert.match(mergeBase, /^[0-9a-f]{40}$/, "merge base must resolve to a full commit SHA");

  const baseManifestSource = gitFile(mergeBase, MANIFEST_FILE);
  let protectedEntryCount = 0;
  if (baseManifestSource !== null) {
    const baseManifest = JSON.parse(baseManifestSource);
    assert.equal(
      manifest.ledgerFile,
      baseManifest.ledgerFile,
      "ledger file cannot be renamed after the manifest is established"
    );
    assert.ok(
      manifest.migrations.length >= baseManifest.migrations.length,
      "existing manifest entries cannot be removed"
    );
    assert.deepEqual(
      manifest.migrations.slice(0, baseManifest.migrations.length),
      baseManifest.migrations,
      "existing manifest entries are immutable; append a new version instead"
    );
    protectedEntryCount = baseManifest.migrations.length;
  }

  const historicalSqlFiles = git(
    ["ls-tree", "-r", "--name-only", mergeBase, "--", "db"],
    "could not inventory historical database SQL"
  )
    .split(/\r?\n/)
    .filter((file) => file.endsWith(".sql") && file !== manifest.ledgerFile);

  for (const file of historicalSqlFiles) {
    const historicalSql = gitFile(mergeBase, file);
    assert.notEqual(historicalSql, null, `historical migration disappeared at ${file}`);
    const currentSql = await readFile(new URL(file, ROOT), "utf8").catch(() => null);
    assert.notEqual(currentSql, null, `historical migration was removed: ${file}`);
    assert.equal(currentSql, historicalSql, `historical migration is immutable: ${file}`);
  }

  return {
    checked: true,
    historicalSqlCount: historicalSqlFiles.length,
    protectedEntryCount
  };
}

const expectedOrder = [
  "db/schema.sql",
  "db/scan-attribution.sql",
  "db/lead-magnet-industry-expansion.sql",
  "db/scan-nurture.sql",
  "db/scan-rate-limits.sql",
  "db/stripe-billing-expansion.sql",
  "db/monitoring.sql",
  "db/monitoring-alert-delivery.sql",
  "db/customer-dashboard.sql",
  "db/stripe-report-access-handoff.sql",
  "db/enrichment-credits.sql",
  "db/monitoring-report-ownership.sql",
  "db/customer-owned-report-access.sql",
  "db/deadline-alerts.sql",
  "db/customer-report-checkout-ownership.sql",
  "db/lead-magnet-marketing-expansion.sql",
  "db/monitoring-setup-transaction.sql",
  "db/stripe-live-mode-enforcement.sql",
  "db/scan-nurture-enrollment-ambiguity-fix.sql",
  "db/stripe-report-access-revocation.sql"
];

const requiredDependencies = {
  "db/scan-attribution.sql": ["db/schema.sql"],
  "db/lead-magnet-industry-expansion.sql": ["db/schema.sql"],
  "db/scan-nurture.sql": ["db/schema.sql"],
  "db/scan-rate-limits.sql": ["db/schema.sql"],
  "db/stripe-billing-expansion.sql": ["db/schema.sql"],
  "db/monitoring.sql": ["db/schema.sql", "db/stripe-billing-expansion.sql"],
  "db/monitoring-alert-delivery.sql": ["db/monitoring.sql"],
  "db/customer-dashboard.sql": [
    "db/schema.sql",
    "db/stripe-billing-expansion.sql",
    "db/monitoring.sql"
  ],
  "db/stripe-report-access-handoff.sql": [
    "db/stripe-billing-expansion.sql",
    "db/customer-dashboard.sql"
  ],
  "db/enrichment-credits.sql": [
    "db/schema.sql",
    "db/stripe-billing-expansion.sql",
    "db/customer-dashboard.sql"
  ],
  "db/monitoring-report-ownership.sql": [
    "db/monitoring.sql",
    "db/customer-dashboard.sql"
  ],
  "db/customer-owned-report-access.sql": ["db/customer-dashboard.sql"],
  "db/deadline-alerts.sql": [
    "db/schema.sql",
    "db/stripe-billing-expansion.sql",
    "db/monitoring.sql",
    "db/monitoring-alert-delivery.sql",
    "db/customer-dashboard.sql"
  ],
  "db/customer-report-checkout-ownership.sql": [
    "db/stripe-report-access-handoff.sql",
    "db/customer-owned-report-access.sql"
  ],
  "db/lead-magnet-marketing-expansion.sql": ["db/lead-magnet-industry-expansion.sql"],
  "db/monitoring-setup-transaction.sql": [
    "db/monitoring.sql",
    "db/customer-dashboard.sql",
    "db/customer-owned-report-access.sql"
  ],
  "db/stripe-live-mode-enforcement.sql": ["db/stripe-billing-expansion.sql"],
  "db/scan-nurture-enrollment-ambiguity-fix.sql": ["db/scan-nurture.sql"],
  "db/stripe-report-access-revocation.sql": ["db/customer-report-checkout-ownership.sql"]
};

const [manifestSource, readme, workflow] = await Promise.all([
  readFile(new URL(MANIFEST_FILE, ROOT), "utf8"),
  readFile(new URL("README.md", ROOT), "utf8"),
  readFile(new URL(".github/workflows/launch-gate.yml", ROOT), "utf8")
]);
const manifest = JSON.parse(manifestSource);

assert.equal(manifest.manifestVersion, 1, "manifest format changes must be explicit");
assert.equal(manifest.ledgerFile, "db/schema-migrations.sql");
assert.deepEqual(manifest.historyPolicy, {
  mode: "merge-base-append-only",
  baseRefEnvironmentVariable: "MIGRATION_BASE_REF",
  historicalSql: "immutable",
  existingManifestEntries: "immutable-prefix"
});
assert.ok(Array.isArray(manifest.migrations) && manifest.migrations.length > 0);

const versions = new Set();
const files = new Set();
const migrationByFile = new Map();
const positionByVersion = new Map();

for (const [index, migration] of manifest.migrations.entries()) {
  const expectedVersion = `v${String(index + 1).padStart(4, "0")}`;
  assert.equal(migration.version, expectedVersion, `${migration.file} must keep append-only version order`);
  assert.ok(!versions.has(migration.version), `duplicate migration version ${migration.version}`);
  assert.ok(!files.has(migration.file), `duplicate migration file ${migration.file}`);
  assert.equal(migration.requiredInProduction, true, `${migration.file} must be production-required`);
  assert.match(migration.sha256, /^[0-9a-f]{64}$/, `${migration.file} needs a SHA-256 checksum`);
  assert.ok(Array.isArray(migration.prerequisites), `${migration.file} prerequisites must be an array`);

  versions.add(migration.version);
  files.add(migration.file);
  migrationByFile.set(migration.file, migration);
  positionByVersion.set(migration.version, index);
}

assert.deepEqual(
  manifest.migrations.map((migration) => migration.file),
  expectedOrder,
  "production migration order changed; append new migrations and preserve historical order"
);

for (const [index, migration] of manifest.migrations.entries()) {
  assert.equal(
    new Set(migration.prerequisites).size,
    migration.prerequisites.length,
    `${migration.file} has duplicate prerequisites`
  );

  for (const prerequisite of migration.prerequisites) {
    assert.ok(positionByVersion.has(prerequisite), `${migration.file} has unknown prerequisite ${prerequisite}`);
    assert.ok(
      positionByVersion.get(prerequisite) < index,
      `${migration.file} must follow prerequisite ${prerequisite}`
    );
  }
}

for (const [file, dependencyFiles] of Object.entries(requiredDependencies)) {
  const migration = migrationByFile.get(file);
  assert.ok(migration, `required production migration omitted: ${file}`);

  for (const dependencyFile of dependencyFiles) {
    const dependency = migrationByFile.get(dependencyFile);
    assert.ok(dependency, `required dependency omitted: ${dependencyFile}`);
    assert.ok(
      migration.prerequisites.includes(dependency.version),
      `${file} must declare prerequisite ${dependencyFile}`
    );
  }
}

const sqlFiles = (await readdir(new URL("db/", ROOT)))
  .filter((file) => file.endsWith(".sql"))
  .map((file) => `db/${file}`)
  .filter((file) => file !== manifest.ledgerFile)
  .sort();

assert.deepEqual(
  [...files].sort(),
  sqlFiles,
  "every db SQL file except the ledger must appear exactly once in the production manifest"
);

for (const migration of manifest.migrations) {
  const sql = await readFile(new URL(migration.file, ROOT), "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex");
  assert.equal(checksum, migration.sha256, `${migration.file} changed; add a new version instead of rewriting history`);
}

const ledger = await readFile(new URL(manifest.ledgerFile, ROOT), "utf8");
const normalizedLedger = compactSql(ledger);
const ledgerStatements = splitSqlStatements(ledger).map(compactSql);
assert.equal(ledgerStatements.length, 12, "ledger contains unexpected top-level SQL statements");

const [
  createLedgerTable,
  commentLedgerTable,
  enableLedgerRls,
  revokeLedgerTable,
  rejectMutationFunction,
  dropUpdateDeleteTrigger,
  createUpdateDeleteTrigger,
  dropTruncateTrigger,
  createTruncateTrigger,
  recordMigrationFunction,
  revokeMutationFunction,
  revokeRecordFunction
] = ledgerStatements;

assert.ok(createLedgerTable.startsWith("create table if not exists public.schema_migrations"));
assert.ok(commentLedgerTable.startsWith("comment on table public.schema_migrations is"));
assert.equal(enableLedgerRls, "alter table public.schema_migrations enable row level security");
assert.equal(
  revokeLedgerTable,
  "revoke all on table public.schema_migrations from public, anon, authenticated, service_role"
);
assert.ok(
  rejectMutationFunction.startsWith(
    "create or replace function public.reject_schema_migration_mutation() returns trigger"
  )
);
assert.equal(
  dropUpdateDeleteTrigger,
  "drop trigger if exists schema_migrations_reject_update_delete on public.schema_migrations"
);
assert.ok(
  createUpdateDeleteTrigger.startsWith(
    "create trigger schema_migrations_reject_update_delete before update or delete on public.schema_migrations"
  )
);
assert.equal(
  dropTruncateTrigger,
  "drop trigger if exists schema_migrations_reject_truncate on public.schema_migrations"
);
assert.ok(
  createTruncateTrigger.startsWith(
    "create trigger schema_migrations_reject_truncate before truncate on public.schema_migrations"
  )
);
assert.ok(
  recordMigrationFunction.startsWith(
    "create or replace function public.record_schema_migration( p_version text,"
  )
);
assert.ok(revokeMutationFunction.startsWith("revoke all on function public.reject_schema_migration_mutation()"));
assert.ok(
  revokeRecordFunction.startsWith(
    "revoke all on function public.record_schema_migration(text, text, text, integer)"
  )
);

assert.match(createLedgerTable, /version text primary key check \(version ~ '\^v\[0-9\]\{4\}\$'\)/);
assert.match(createLedgerTable, /migration_file text not null unique/);
assert.match(createLedgerTable, /checksum_sha256 text not null check/);
assert.match(createLedgerTable, /manifest_version integer not null check/);
assert.match(createLedgerTable, /applied_at timestamptz not null default now\(\)/);
assert.match(createLedgerTable, /applied_by text not null default current_user/);

assert.doesNotMatch(normalizedLedger, /\bgrant\b/, "ledger must not grant application roles direct access");
assert.doesNotMatch(normalizedLedger, /security definer/, "ledger functions must use caller privileges");
assert.equal((normalizedLedger.match(/security invoker/g) ?? []).length, 2);
assert.equal((normalizedLedger.match(/set search_path = public, pg_temp/g) ?? []).length, 2);

assertInOrder(
  normalizedLedger,
  [
    "drop trigger if exists schema_migrations_reject_update_delete on public.schema_migrations",
    "create trigger schema_migrations_reject_update_delete before update or delete on public.schema_migrations"
  ],
  "update/delete trigger must be idempotently replaced"
);
assertInOrder(
  normalizedLedger,
  [
    "drop trigger if exists schema_migrations_reject_truncate on public.schema_migrations",
    "create trigger schema_migrations_reject_truncate before truncate on public.schema_migrations"
  ],
  "truncate trigger must be idempotently replaced"
);
assert.match(rejectMutationFunction, /raise exception 'schema_migrations is append-only'/);
assert.match(
  revokeMutationFunction,
  /revoke all on function public\.reject_schema_migration_mutation\(\) from public, anon, authenticated, service_role/
);

assertInOrder(
  recordMigrationFunction,
  [
    "perform pg_advisory_xact_lock(hashtextextended('public.schema_migrations', 0))",
    "select * into existing from public.schema_migrations where version = p_version",
    "if found then",
    "existing.migration_file is distinct from p_migration_file",
    "existing.checksum_sha256 is distinct from p_checksum_sha256",
    "existing.manifest_version is distinct from p_manifest_version",
    "return",
    "if p_version !~ '^v[0-9]{4}$' then",
    "previous_version := 'v' || lpad((version_number - 1)::text, 4, '0')",
    "where version = previous_version",
    "insert into public.schema_migrations"
  ],
  "record function must serialize, validate idempotency, enforce order, then insert"
);
assert.match(recordMigrationFunction, /migration versions start at v0001/);
assert.match(recordMigrationFunction, /requires % to be recorded first/);
assert.match(recordMigrationFunction, /already recorded with different metadata/);
assert.match(
  revokeRecordFunction,
  /revoke all on function public\.record_schema_migration\(text, text, text, integer\) from public, anon, authenticated, service_role/
);

const credentialFreeSources = `${manifestSource}\n${ledger}\n${workflow}`;
assert.doesNotMatch(
  credentialFreeSources,
  /(?:postgres(?:ql)?:\/\/|password\s*=|service_role_key|supabase_service_role_key|database_url)/i
);

assert.match(workflow, /fetch-depth:\s*0/);
assert.match(
  workflow,
  /MIGRATION_BASE_REF:\s*\$\{\{\s*github\.event\.pull_request\.base\.sha\s*\|\|\s*github\.event\.before\s*\}\}/
);
assert.match(workflow, /run:\s*node scripts\/test-migration-manifest\.mjs/);
assert.doesNotMatch(workflow, /secrets\./, "migration validation must not require production secrets");

assert.match(readme, /## Database Setup And Upgrades/);
assert.match(readme, /db\/migration-manifest\.json/);
assert.match(readme, /public\.schema_migrations/);
assert.match(readme, /### Clean Install/);
assert.match(readme, /### Upgrade/);
assert.match(readme, /MIGRATION_BASE_REF=origin\/main node scripts\/test-migration-manifest\.mjs/);
assert.match(readme, /byte-for-byte unchanged/);

const historyResult = await verifyHistoricalImmutability(manifest, requestedBaseRef());
const historySummary = historyResult.checked
  ? `; ${historyResult.historicalSqlCount} historical SQL files and ${historyResult.protectedEntryCount} base entries protected`
  : "; current-tree checks only (set MIGRATION_BASE_REF for history immutability)";

console.log(`Migration manifest checks passed: ${manifest.migrations.length} production migrations in order${historySummary}.`);
