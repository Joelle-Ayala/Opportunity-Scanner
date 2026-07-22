import { ensureCustomerAccount } from "./repository";
import { dashboardInsert, dashboardSelect, dashboardSelectOne, dashboardUpdate } from "./rest";
import type { CustomerAccountRecord } from "./types";
import { hasCustomerServerReportAccess } from "../payments/access";
import {
  pursuitDefaults,
  type CustomerOpportunityPursuit,
  type PursuitEditableFields
} from "../pursuits";
import type { CompanyProfile, ScanRecord, StoredOpportunitySignal } from "../types";
import { getScan } from "../storage";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PursuitErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "REPORT_ACCESS_REQUIRED"
  | "PURSUIT_NOT_FOUND"
  | "PURSUIT_CONFLICT"
  | "PURSUIT_UNAVAILABLE";

const PURSUIT_MESSAGES: Record<PursuitErrorCode, string> = {
  AUTHENTICATION_REQUIRED: "Sign in to manage this pursuit.",
  REPORT_ACCESS_REQUIRED: "A full report owned by this account is required to start a pursuit.",
  PURSUIT_NOT_FOUND: "That pursuit is not available to this account.",
  PURSUIT_CONFLICT: "This pursuit changed in another tab. Reload it before saving again.",
  PURSUIT_UNAVAILABLE: "The pursuit workspace is temporarily unavailable."
};

export class PursuitError extends Error {
  readonly code: PursuitErrorCode;
  readonly cause?: unknown;

  constructor(code: PursuitErrorCode, cause?: unknown) {
    super(PURSUIT_MESSAGES[code]);
    this.name = "PursuitError";
    this.code = code;
    this.cause = cause;
  }
}

async function accountFor(authUserId: string): Promise<CustomerAccountRecord | null> {
  if (!UUID_PATTERN.test(authUserId)) return null;
  return dashboardSelectOne<CustomerAccountRecord>("customer_accounts", {
    select: "id,auth_user_id,stripe_customer_id,email,created_at,updated_at",
    auth_user_id: `eq.${authUserId}`
  });
}

async function requireOwnedReport(
  authUserId: string,
  accountId: string,
  scan: Pick<ScanRecord, "id" | "report_access">
): Promise<void> {
  const ownership = await dashboardSelectOne<{ scan_id: string }>("customer_scan_ownership", {
    select: "scan_id",
    customer_account_id: `eq.${accountId}`,
    scan_id: `eq.${scan.id}`
  });
  if (!ownership || !(await hasCustomerServerReportAccess(undefined, scan, authUserId))) {
    throw new PursuitError("REPORT_ACCESS_REQUIRED");
  }
}

export async function canManageCustomerPursuit(
  authUserId: string,
  scan: Pick<ScanRecord, "id" | "report_access">
): Promise<boolean> {
  const account = await accountFor(authUserId);
  if (!account) return false;
  try {
    await requireOwnedReport(authUserId, account.id, scan);
    return true;
  } catch {
    return false;
  }
}

export async function loadCustomerPursuit(
  authUserId: string,
  scanId: string,
  opportunityId: string
): Promise<CustomerOpportunityPursuit | null> {
  if (!UUID_PATTERN.test(scanId) || !UUID_PATTERN.test(opportunityId)) return null;
  const account = await accountFor(authUserId);
  if (!account) return null;
  const pursuit = await dashboardSelectOne<CustomerOpportunityPursuit>("customer_opportunity_pursuits", {
    select: "*",
    customer_account_id: `eq.${account.id}`,
    scan_id: `eq.${scanId}`,
    opportunity_id: `eq.${opportunityId}`
  });
  if (!pursuit) return null;
  const scan = await getScan(pursuit.scan_id);
  if (!scan) return null;
  try {
    await requireOwnedReport(authUserId, account.id, scan);
    return pursuit;
  } catch {
    return null;
  }
}

export async function loadCustomerPursuitForOpportunity(input: {
  authUserId: string;
  scan: ScanRecord;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile | null;
}): Promise<CustomerOpportunityPursuit | null> {
  const direct = await loadCustomerPursuit(input.authUserId, input.scan.id, input.signal.id);
  if (direct) return direct;
  const account = await accountFor(input.authUserId);
  if (!account) return null;
  try {
    await requireOwnedReport(input.authUserId, account.id, input.scan);
  } catch {
    return null;
  }
  const defaults = pursuitDefaults({ scan: input.scan, signal: input.signal, profile: input.profile });
  const canonical = await dashboardSelectOne<CustomerOpportunityPursuit>("customer_opportunity_pursuits", {
    select: "*",
    customer_account_id: `eq.${account.id}`,
    company_context_key: `eq.${defaults.company_context_key}`,
    canonical_opportunity_key: `eq.${defaults.canonical_opportunity_key}`
  });
  if (!canonical || (canonical.scan_id === input.scan.id && canonical.opportunity_id === input.signal.id)) {
    return canonical;
  }

  const canonicalScan = await getScan(canonical.scan_id);
  let canonicalHasAccess = false;
  if (canonicalScan) {
    try {
      await requireOwnedReport(input.authUserId, account.id, canonicalScan);
      canonicalHasAccess = true;
    } catch {
      canonicalHasAccess = false;
    }
  }
  if (canonicalHasAccess) {
    const routeChanged = canonical.application_method !== defaults.application_method ||
      canonical.revenue_motion !== defaults.revenue_motion ||
      canonical.target_organization !== defaults.target_organization;
    if (!routeChanged) return canonical;

    const corrected = await dashboardUpdate<CustomerOpportunityPursuit>(
      "customer_opportunity_pursuits",
      {
        id: `eq.${canonical.id}`,
        customer_account_id: `eq.${account.id}`,
        version: `eq.${canonical.version}`
      },
      {
        application_method: defaults.application_method,
        revenue_motion: defaults.revenue_motion,
        target_organization: defaults.target_organization,
        route_verified: false,
        version: canonical.version + 1,
        updated_at: new Date().toISOString()
      }
    );
    if (corrected) return corrected;

    const concurrent = await loadCustomerPursuit(
      input.authUserId,
      canonical.scan_id,
      canonical.opportunity_id
    );
    if (concurrent) return concurrent;
    throw new PursuitError("PURSUIT_CONFLICT");
  }

  // Move a canonical pursuit only when its prior report entitlement is no longer active.
  const rebound = await dashboardUpdate<CustomerOpportunityPursuit>(
    "customer_opportunity_pursuits",
    {
      id: `eq.${canonical.id}`,
      customer_account_id: `eq.${account.id}`,
      version: `eq.${canonical.version}`
    },
    {
      scan_id: input.scan.id,
      opportunity_id: input.signal.id,
      opportunity_title: defaults.opportunity_title,
      source_name: defaults.source_name,
      source_url: defaults.source_url,
      target_organization: defaults.target_organization,
      revenue_motion: defaults.revenue_motion,
      application_method: defaults.application_method,
      route_verified: false,
      deadline: canonical.deadline || defaults.deadline,
      version: canonical.version + 1,
      updated_at: new Date().toISOString()
    }
  );
  if (rebound) return rebound;

  const concurrent = await loadCustomerPursuit(input.authUserId, input.scan.id, input.signal.id);
  if (concurrent) return concurrent;
  throw new PursuitError("PURSUIT_CONFLICT");
}

export async function loadCustomerPursuits(
  authUserId: string,
  limit = 100
): Promise<CustomerOpportunityPursuit[]> {
  const account = await accountFor(authUserId);
  if (!account) return [];
  const pursuits = await dashboardSelect<CustomerOpportunityPursuit>("customer_opportunity_pursuits", {
    select: "*",
    customer_account_id: `eq.${account.id}`,
    order: "updated_at.desc,id.desc",
    limit: Math.min(Math.max(Math.trunc(limit), 1), 100)
  });
  const accessByScan = new Map<string, boolean>();
  await Promise.all([...new Set(pursuits.map((pursuit) => pursuit.scan_id))].map(async (scanId) => {
    const scan = await getScan(scanId);
    if (!scan) return accessByScan.set(scanId, false);
    try {
      await requireOwnedReport(authUserId, account.id, scan);
      accessByScan.set(scanId, true);
    } catch {
      accessByScan.set(scanId, false);
    }
  }));
  return pursuits.filter((pursuit) => accessByScan.get(pursuit.scan_id) === true);
}

export async function startCustomerPursuit(input: {
  authUserId: string;
  email: string;
  scan: ScanRecord;
  signal: StoredOpportunitySignal;
  profile?: CompanyProfile | null;
}): Promise<CustomerOpportunityPursuit> {
  if (!UUID_PATTERN.test(input.authUserId)) throw new PursuitError("AUTHENTICATION_REQUIRED");
  const account = await ensureCustomerAccount(input.authUserId, input.email);
  await requireOwnedReport(input.authUserId, account.id, input.scan);

  const defaults = pursuitDefaults({ scan: input.scan, signal: input.signal, profile: input.profile });
  const existing = await loadCustomerPursuitForOpportunity({
    authUserId: input.authUserId,
    scan: input.scan,
    signal: input.signal,
    profile: input.profile
  });
  if (existing) return existing;

  const created = await dashboardInsert<CustomerOpportunityPursuit>("customer_opportunity_pursuits", {
    ...defaults,
    customer_account_id: account.id
  }, { onConflict: "customer_account_id,company_context_key,canonical_opportunity_key", ignoreDuplicates: true });
  if (created) return created;

  const concurrent = await loadCustomerPursuitForOpportunity({
    authUserId: input.authUserId,
    scan: input.scan,
    signal: input.signal,
    profile: input.profile
  });
  if (concurrent) return concurrent;
  throw new PursuitError("PURSUIT_UNAVAILABLE");
}

export async function updateCustomerPursuit(input: {
  authUserId: string;
  pursuitId: string;
  expectedVersion: number;
  fields: PursuitEditableFields;
}): Promise<CustomerOpportunityPursuit> {
  if (!UUID_PATTERN.test(input.authUserId)) throw new PursuitError("AUTHENTICATION_REQUIRED");
  if (!UUID_PATTERN.test(input.pursuitId)) throw new PursuitError("PURSUIT_NOT_FOUND");
  const account = await accountFor(input.authUserId);
  if (!account) throw new PursuitError("PURSUIT_NOT_FOUND");

  const current = await dashboardSelectOne<CustomerOpportunityPursuit>("customer_opportunity_pursuits", {
    select: "*",
    id: `eq.${input.pursuitId}`,
    customer_account_id: `eq.${account.id}`
  });
  if (!current) throw new PursuitError("PURSUIT_NOT_FOUND");
  const scan = await getScan(current.scan_id);
  if (!scan) throw new PursuitError("PURSUIT_NOT_FOUND");
  await requireOwnedReport(input.authUserId, account.id, scan);
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion !== current.version) {
    throw new PursuitError("PURSUIT_CONFLICT");
  }
  if (!input.fields.next_step && !["won", "lost"].includes(input.fields.stage)) {
    throw new Error("Add the next step before saving an active pursuit.");
  }
  if (["preparing", "submitted", "won"].includes(input.fields.stage) && !input.fields.owner_name) {
    throw new Error("Add an owner before moving this pursuit forward.");
  }
  if (
    ["preparing", "submitted", "won"].includes(input.fields.stage) &&
    (!input.fields.source_verified || input.fields.fit_decision !== "pursue")
  ) {
    throw new Error("Confirm the source and choose Pursue before moving this pursuit forward.");
  }
  if (input.fields.stage === "lost" && !input.fields.notes) {
    throw new Error("Add a short close reason before marking this pursuit lost.");
  }
  if (
    input.fields.stage === "submitted" &&
    ["direct_application", "procurement_response"].includes(current.application_method) &&
    (!input.fields.deadline || !input.fields.route_verified)
  ) {
    throw new Error("Confirm the deadline and action route before marking an application or response submitted.");
  }

  const updated = await dashboardUpdate<CustomerOpportunityPursuit>(
    "customer_opportunity_pursuits",
    {
      id: `eq.${input.pursuitId}`,
      customer_account_id: `eq.${account.id}`,
      version: `eq.${input.expectedVersion}`
    },
    { ...input.fields, version: current.version + 1, updated_at: new Date().toISOString() }
  );
  if (!updated) throw new PursuitError("PURSUIT_CONFLICT");
  return updated;
}
