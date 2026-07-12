import { supabaseRpc } from "./supabaseRest";
import {
  contactEnrichmentIdempotencyKey,
  growthEnrichmentCreditLimit,
  type EnrichmentCreditBalance,
  type EnrichmentCreditReservation
} from "./enrichmentCreditContract";

export {
  EnrichmentCreditError,
  contactEnrichmentIdempotencyKey,
  growthEnrichmentCreditLimit,
  requireReservedEnrichmentCredit
} from "./enrichmentCreditContract";
export type { EnrichmentCreditBalance, EnrichmentCreditReservation } from "./enrichmentCreditContract";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function loadEnrichmentCreditBalance(authUserId: string): Promise<EnrichmentCreditBalance> {
  if (!UUID_PATTERN.test(authUserId)) return { entitled: false, limit: 0, used: 0, remaining: 0 };
  return supabaseRpc<EnrichmentCreditBalance>("get_enrichment_credit_balance", {
    p_auth_user_id: authUserId,
    p_credit_limit: growthEnrichmentCreditLimit()
  });
}

export async function reserveContactEnrichmentCredit(input: {
  authUserId: string;
  scanId: string;
  opportunityId: string;
}): Promise<EnrichmentCreditReservation> {
  if (![input.authUserId, input.scanId, input.opportunityId].every((value) => UUID_PATTERN.test(value))) {
    return { status: "not_owned", limit: 0, used: 0, remaining: 0 };
  }
  return supabaseRpc<EnrichmentCreditReservation>("reserve_enrichment_credit", {
    p_auth_user_id: input.authUserId,
    p_scan_id: input.scanId,
    p_opportunity_id: input.opportunityId,
    p_idempotency_key: contactEnrichmentIdempotencyKey(input.scanId, input.opportunityId),
    p_credit_limit: growthEnrichmentCreditLimit()
  });
}
