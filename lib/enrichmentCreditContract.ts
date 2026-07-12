export type EnrichmentCreditBalance = {
  entitled: boolean;
  limit: number;
  used: number;
  remaining: number;
  periodStart?: string;
  periodEnd?: string;
};

export type EnrichmentCreditReservation = Omit<EnrichmentCreditBalance, "entitled"> & {
  status: "reserved" | "already_reserved" | "limit_reached" | "not_entitled" | "not_owned";
  ledgerId?: string;
};

export class EnrichmentCreditError extends Error {
  readonly reservation: EnrichmentCreditReservation;

  constructor(reservation: EnrichmentCreditReservation) {
    super(
      reservation.status === "limit_reached"
        ? "No contact-enrichment credits remain in the current billing month."
        : "An active Growth plan is required for person-level contact enrichment."
    );
    this.name = "EnrichmentCreditError";
    this.reservation = reservation;
  }
}

export function growthEnrichmentCreditLimit(): number {
  const configured = Number(process.env.ENRICHMENT_CREDITS_GROWTH_MONTHLY ?? 30);
  if (!Number.isFinite(configured)) return 30;
  return Math.max(1, Math.min(10000, Math.floor(configured)));
}

export function contactEnrichmentIdempotencyKey(scanId: string, opportunityId: string): string {
  return `contact-enrichment:v1:${scanId}:${opportunityId}`;
}

export function requireReservedEnrichmentCredit(reservation: EnrichmentCreditReservation): void {
  if (reservation.status !== "reserved" && reservation.status !== "already_reserved") {
    throw new EnrichmentCreditError(reservation);
  }
}
