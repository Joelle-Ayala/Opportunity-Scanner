import { contactDiscoverySummary } from "./contactTargeting";
import { enrichContactsWithSnov } from "./connectors/snov";
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
    return request.status === "completed" && providerStatus !== "failed";
  });
}

function hasSourceNativeContact(signal: StoredOpportunitySignal): boolean {
  return contactDiscoverySummary(signal).verifiedContacts > 0;
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

  const result = await enrichContactsWithSnov(input.signal);
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
