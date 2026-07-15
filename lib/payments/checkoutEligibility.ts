import { dashboardSelectOne } from "../dashboard/rest.ts";
import { reportCheckoutIsEnabled, subscriptionCheckoutIsEnabled } from "./config.ts";
import { validateCheckoutInput, type PaymentPlan } from "./contract.ts";
import { handleBillingPortal, handleCheckout, type CheckoutIdentity } from "./handlers.ts";

const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9]+$/;

export type ActiveCheckoutSubscription = {
  stripeSubscriptionId: string;
  product: "monitor" | "growth";
  status: "active" | "trialing";
};

type SubscriptionRow = {
  stripe_subscription_id: string;
  product: "monitor" | "growth";
  status: "active" | "trialing";
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_REQUEST_BYTES = 8_192;

type EligibilityDependencies = {
  checkout: typeof handleCheckout;
  billingPortal: typeof handleBillingPortal;
};

const eligibilityDependencies: EligibilityDependencies = {
  checkout: handleCheckout,
  billingPortal: handleBillingPortal
};

export async function inspectedCheckoutPlan(request: Request): Promise<PaymentPlan | null> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) return null;
  try {
    const text = await request.clone().text();
    if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) return null;
    const validation = validateCheckoutInput(JSON.parse(text));
    return validation.ok ? validation.value.plan : null;
  } catch {
    return null;
  }
}

export function dispatchCheckoutWithEligibility(
  request: Request,
  plan: PaymentPlan | null,
  identity: CheckoutIdentity | null,
  activeSubscription: ActiveCheckoutSubscription | null,
  dependencies: EligibilityDependencies = eligibilityDependencies
): Promise<Response> {
  const isSubscription = plan === "monitor" || plan === "growth";
  if (plan === "report" && !reportCheckoutIsEnabled()) {
    return Promise.resolve(Response.json(
      {
        ok: false,
        error: {
          code: "PLAN_UNAVAILABLE",
          message: "Paid Report checkout is not available yet."
        }
      },
      { status: 403, headers: NO_STORE_HEADERS }
    ));
  }
  if (isSubscription && !subscriptionCheckoutIsEnabled()) {
    return Promise.resolve(Response.json(
      {
        ok: false,
        error: {
          code: "PLAN_UNAVAILABLE",
          message: "Monitor and Growth checkout are not available yet."
        }
      },
      { status: 403, headers: NO_STORE_HEADERS }
    ));
  }
  if (isSubscription && !identity) {
    return Promise.resolve(Response.json(
      {
        ok: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Sign in with a verified account to start a subscription."
        }
      },
      { status: 401, headers: NO_STORE_HEADERS }
    ));
  }
  if (isSubscription && activeSubscription) {
    return dependencies.billingPortal({ ownedCustomerId: identity?.ownedCustomerId ?? null });
  }
  return dependencies.checkout(request, identity);
}

export async function findActiveCheckoutSubscription(
  stripeCustomerId: string | null
): Promise<ActiveCheckoutSubscription | null> {
  if (!stripeCustomerId) return null;
  if (!STRIPE_CUSTOMER_PATTERN.test(stripeCustomerId) || stripeCustomerId.length > 255) {
    throw new Error("The account billing customer ID is invalid.");
  }

  const subscription = await dashboardSelectOne<SubscriptionRow>("stripe_subscriptions", {
    select: "stripe_subscription_id,product,status",
    stripe_customer_id: `eq.${stripeCustomerId}`,
    status: "in.(active,trialing)",
    product: "in.(monitor,growth)",
    order: "created_at.desc"
  });
  if (!subscription) return null;

  return {
    stripeSubscriptionId: subscription.stripe_subscription_id,
    product: subscription.product,
    status: subscription.status
  };
}
