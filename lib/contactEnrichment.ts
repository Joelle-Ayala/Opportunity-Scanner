import { contactDiscoverySummary } from "./contactTargeting";
import { enrichContactsWithClay } from "./connectors/clay";
import { ContactEnrichmentResult, enrichContactsWithSnov } from "./connectors/snov";
import {
  listOpportunityEnrichmentRequests,
  saveOpportunityEnrichmentRequest
} from "./storage";
import { OpportunityEnrichmentRequestRecord, StoredOpportunitySignal } from "./types";

function hasReusableContactEnrichment(requests: OpportunityEnrichmentRequestRecord[]): boolean {
  return requests.some((request) => {
    if (request.enrichment_type !== "find_contacts") {
      return false;
    }
    const providerStatus = request.result_json?.status;
    const provider = request.result_json?.provider;
    if (provider === "source-native") {
      return request.status === "completed";
    }
    if (providerStatus === "failed" || providerStatus === "not_configured" || providerStatus === "needs_domain" || providerStatus === "needs_target") {
      return false;
    }
    return request.status === "completed";
  });
}

function hasSourceNativeContact(signal: StoredOpportunitySignal): boolean {
  return contactDiscoverySummary(signal).verifiedContacts > 0;
}

function contactLimit(): number {
  const configured = Number(process.env.OPPORTUNITY_SCANNER_CONTACTS_PER_OPPORTUNITY ?? 5);
  if (!Number.isFinite(configured)) {
    return 5;
  }
  return Math.max(1, Math.min(10, Math.floor(configured)));
}

type GenericContact = {
  name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  source_url?: string;
  confidence?: string;
  rationale?: string;
};

type GenericEnrichmentResult = {
  provider: string;
  status: string;
  organization: string;
  domain?: string;
  target_roles: string[];
  contacts: GenericContact[];
  message: string;
};

function contactKey(contact: GenericContact): string {
  return [
    contact.email?.toLowerCase(),
    contact.linkedin_url?.toLowerCase(),
    contact.name?.toLowerCase(),
    contact.title?.toLowerCase()
  ]
    .filter(Boolean)
    .join("|");
}

function combineContactResults(
  clayResult: GenericEnrichmentResult,
  snovResult: ContactEnrichmentResult
): GenericEnrichmentResult {
  const cap = contactLimit();
  const seen = new Set<string>();
  const contacts = [...clayResult.contacts, ...snovResult.contacts]
    .filter((contact) => {
      const key = contactKey(contact);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, cap);

  return {
    provider: clayResult.provider === "clay" ? "clay+snov" : clayResult.provider,
    status: contacts.length || clayResult.status === "completed" || snovResult.status === "completed" ? "completed" : snovResult.status,
    organization: clayResult.organization || snovResult.organization,
    domain: clayResult.domain || snovResult.domain,
    target_roles: clayResult.target_roles.length ? clayResult.target_roles : snovResult.target_roles,
    contacts,
    message: [clayResult.message, snovResult.message].filter(Boolean).join(" ")
  };
}

export async function ensureContactEnrichment(input: {
  scanId: string;
  signal: StoredOpportunitySignal;
}): Promise<OpportunityEnrichmentRequestRecord | null> {
  const existing = await listOpportunityEnrichmentRequests(input.scanId, input.signal.id);
  if (hasReusableContactEnrichment(existing)) {
    return null;
  }

  if (hasSourceNativeContact(input.signal)) {
    return saveOpportunityEnrichmentRequest({
      scanId: input.scanId,
      opportunityId: input.signal.id,
      enrichmentType: "find_contacts",
      status: "completed",
      resultJson: {
        provider: "source-native",
        status: "completed",
        contacts: [],
        message: "Source-native contact is already available. Prefer the source-listed contact before third-party enrichment."
      }
    });
  }

  const clayResult = await enrichContactsWithClay(input.signal);
  const shouldUseSnov =
    clayResult.contacts.length < contactLimit() &&
    (clayResult.status === "not_configured" ||
      clayResult.status === "failed" ||
      clayResult.status === "needs_target" ||
      clayResult.contacts.some((contact) => !contact.email) ||
      clayResult.contacts.length === 0);
  const result = shouldUseSnov
    ? combineContactResults(clayResult, await enrichContactsWithSnov(input.signal))
    : clayResult;

  return saveOpportunityEnrichmentRequest({
    scanId: input.scanId,
    opportunityId: input.signal.id,
    enrichmentType: "find_contacts",
    status: result.status === "failed" ? "failed" : "completed",
    resultJson: result as unknown as Record<string, unknown>
  });
}

export async function ensureContactEnrichmentForSignals(input: {
  scanId: string;
  signals: StoredOpportunitySignal[];
  limit?: number;
}): Promise<void> {
  const limit = input.limit ?? 5;
  const selected = input.signals.slice(0, Math.max(0, limit));

  for (const signal of selected) {
    await ensureContactEnrichment({ scanId: input.scanId, signal });
  }
}
