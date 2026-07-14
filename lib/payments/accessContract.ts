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
  customer_details?: { email?: string | null } | null;
  payment_intent?:
    | string
    | {
        id?: string;
        latest_charge?: string | { id?: string; refunded?: boolean; amount_refunded?: number } | null;
      }
    | null;
  metadata?: Record<string, string> | null;
};

export type SubscriptionCheckoutSessionContract = ReportCheckoutSessionContract & {
  line_items?: {
    has_more?: boolean;
    data?: Array<{ quantity?: number | null; price?: string | { id?: string } | null }>;
  } | null;
  subscription?:
    | string
    | {
        id?: string;
        customer?: string | { id?: string } | null;
        status?: string;
        current_period_start?: number;
        current_period_end?: number;
        cancel_at_period_end?: boolean;
        items?: {
          data?: Array<{
            current_period_start?: number;
            current_period_end?: number;
            price?: string | { id?: string } | null;
          }>;
        };
      }
    | null;
};

export type SubscriptionPriceCatalog = Record<
  "monitorMonthly" | "monitorAnnual" | "growthMonthly" | "growthAnnual",
  string
>;

export type VerifiedSubscriptionCheckout = {
  customerId: string;
  customerEmail: string;
  subscriptionId: string;
  priceId: string;
  product: "monitor" | "growth";
  billingInterval: "monthly" | "annual";
  status: "active" | "trialing";
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
  sessionCreated: number;
  livemode: boolean;
};

function stripeId(value: string | { id?: string } | null | undefined): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function subscriptionPlanForPrice(
  priceId: string,
  prices: SubscriptionPriceCatalog
): Pick<VerifiedSubscriptionCheckout, "product" | "billingInterval"> | null {
  if (priceId === prices.monitorMonthly) return { product: "monitor", billingInterval: "monthly" };
  if (priceId === prices.monitorAnnual) return { product: "monitor", billingInterval: "annual" };
  if (priceId === prices.growthMonthly) return { product: "growth", billingInterval: "monthly" };
  if (priceId === prices.growthAnnual) return { product: "growth", billingInterval: "annual" };
  return null;
}

export function verifiedPaidSubscriptionCheckout(
  session: SubscriptionCheckoutSessionContract,
  verifiedEmailValue: string,
  prices: SubscriptionPriceCatalog
): VerifiedSubscriptionCheckout | null {
  const verifiedEmail = verifiedEmailValue.trim().toLowerCase();
  const customerEmail = session.customer_details?.email?.trim().toLowerCase();
  const customerId = stripeId(session.customer);
  const subscription = typeof session.subscription === "object" ? session.subscription : null;
  if (!subscription) return null;
  const subscriptionId = subscription.id;
  const subscriptionCustomerId = stripeId(subscription.customer);
  const lineItems = session.line_items?.data ?? [];
  const subscriptionItems = subscription.items?.data ?? [];
  const checkoutPriceId = stripeId(lineItems[0]?.price);
  const subscriptionPriceId = stripeId(subscriptionItems[0]?.price);
  if (!checkoutPriceId || checkoutPriceId !== subscriptionPriceId) return null;
  const plan = subscriptionPlanForPrice(checkoutPriceId, prices);
  if (!plan) return null;
  const status = subscription.status;
  if (status !== "active" && status !== "trialing") return null;
  if (
    !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(session.id) ||
    !Number.isInteger(session.created) ||
    (session.created ?? 0) <= 0 ||
    session.status !== "complete" ||
    session.mode !== "subscription" ||
    session.payment_status !== "paid" ||
    !customerId?.startsWith("cus_") ||
    subscriptionCustomerId !== customerId ||
    !subscriptionId?.startsWith("sub_") ||
    !customerEmail ||
    customerEmail !== verifiedEmail ||
    customerEmail.length > 254 ||
    lineItems.length !== 1 ||
    session.line_items?.has_more === true ||
    lineItems[0]?.quantity !== 1 ||
    subscriptionItems.length !== 1 ||
    session.metadata?.price_id !== checkoutPriceId ||
    session.metadata?.product !== plan.product ||
    session.metadata?.billing_interval !== plan.billingInterval
  ) {
    return null;
  }
  const subscriptionItem = subscriptionItems[0];
  const currentPeriodStart = subscriptionItem?.current_period_start ?? subscription.current_period_start;
  const currentPeriodEnd = subscriptionItem?.current_period_end ?? subscription.current_period_end;
  return {
    customerId,
    customerEmail,
    subscriptionId,
    priceId: checkoutPriceId,
    ...plan,
    status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    currentPeriodStart: Number.isInteger(currentPeriodStart) && (currentPeriodStart ?? 0) > 0
      ? currentPeriodStart!
      : null,
    currentPeriodEnd: Number.isInteger(currentPeriodEnd) && (currentPeriodEnd ?? 0) > 0
      ? currentPeriodEnd!
      : null,
    sessionCreated: session.created!,
    livemode: session.livemode === true
  };
}

export async function resolveStoredReportAccess(
  hasLegacyAccess: boolean,
  authUserId: string | null | undefined,
  scanId: string,
  hasActiveGrant: (authUserId: string, scanId: string) => Promise<boolean>
): Promise<boolean> {
  if (hasLegacyAccess) return true;
  if (!authUserId) return false;
  try {
    return await hasActiveGrant(authUserId, scanId);
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
  const customerEmail = session.customer_details?.email?.trim().toLowerCase();
  return Boolean(
    session.id.startsWith("cs_") &&
      Number.isInteger(session.created) &&
      (session.created ?? 0) > 0 &&
      session.status === "complete" &&
      session.mode === "payment" &&
      session.payment_status === "paid" &&
      session.metadata?.product === "report" &&
      session.metadata?.scan_id === scanId &&
      session.metadata?.price_id === reportPriceId &&
      customerId?.startsWith("cus_") &&
      customerEmail &&
      customerEmail.length <= 254 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) &&
      paymentIntent?.id?.startsWith("pi_") &&
      latestCharge?.id?.startsWith("ch_") &&
      latestCharge.refunded === false &&
      latestCharge.amount_refunded === 0
  );
}
