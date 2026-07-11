export type ReportCheckoutSessionContract = {
  id: string;
  status?: string;
  mode?: string;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  created?: number;
  livemode?: boolean;
  customer?: string | { id?: string } | null;
  payment_intent?:
    | string
    | {
        id?: string;
        latest_charge?: string | { id?: string; refunded?: boolean; amount_refunded?: number } | null;
      }
    | null;
  metadata?: Record<string, string> | null;
};

export async function resolveStoredReportAccess(
  hasLegacyAccess: boolean,
  scanId: string,
  hasActiveGrant: (scanId: string) => Promise<boolean>
): Promise<boolean> {
  if (hasLegacyAccess) return true;
  try {
    return await hasActiveGrant(scanId);
  } catch {
    return false;
  }
}

export function isMatchingPaidReportSession(
  session: ReportCheckoutSessionContract,
  scanId: string,
  reportPriceId: string
): boolean {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const latestCharge =
    paymentIntent && typeof paymentIntent.latest_charge === "object" ? paymentIntent.latest_charge : null;
  return Boolean(
    session.id.startsWith("cs_") &&
      Number.isInteger(session.created) &&
      (session.created ?? 0) > 0 &&
      session.status === "complete" &&
      session.mode === "payment" &&
      session.payment_status === "paid" &&
      session.amount_total === 4900 &&
      session.currency?.toLowerCase() === "usd" &&
      session.metadata?.product === "report" &&
      session.metadata?.scan_id === scanId &&
      session.metadata?.price_id === reportPriceId &&
      customerId?.startsWith("cus_") &&
      paymentIntent?.id?.startsWith("pi_") &&
      latestCharge?.id?.startsWith("ch_") &&
      latestCharge.refunded === false &&
      latestCharge.amount_refunded === 0
  );
}
