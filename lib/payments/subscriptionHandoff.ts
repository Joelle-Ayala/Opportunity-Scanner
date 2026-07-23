import { verifiedPaidSubscriptionCheckout } from "./accessContract.ts";
import { getStripeServerConfig } from "./config.ts";
import { fulfillVerifiedSubscriptionCheckout } from "./persistence.ts";
import {
  registerSubscriptionActivationRecovery,
  type SubscriptionActivationCapture
} from "./subscriptionActivationRecovery.ts";
import { retrieveCheckoutSession, type StripeCheckoutSession } from "./stripeApi.ts";

export type SubscriptionHandoffResult = {
  status: "fulfilled" | "invalid" | "unavailable";
  sourceScanId: string | null;
};

type SubscriptionHandoffDependencies = {
  getConfig: typeof getStripeServerConfig;
  retrieveSession: (secretKey: string, sessionId: string) => Promise<StripeCheckoutSession>;
  fulfillCheckout: typeof fulfillVerifiedSubscriptionCheckout;
  registerActivation: (capture: SubscriptionActivationCapture) => Promise<boolean>;
};

const defaultDependencies: SubscriptionHandoffDependencies = {
  getConfig: getStripeServerConfig,
  retrieveSession: retrieveCheckoutSession,
  fulfillCheckout: fulfillVerifiedSubscriptionCheckout,
  registerActivation: registerSubscriptionActivationRecovery
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function verifiedSourceScanId(session: StripeCheckoutSession): string | null | undefined {
  const subscription = typeof session.subscription === "object" ? session.subscription : null;
  const values = [
    session.client_reference_id,
    session.metadata?.scan_id,
    subscription?.metadata?.scan_id
  ];
  const supplied = values.filter((value): value is string => typeof value === "string" && value.length > 0);
  if (supplied.length === 0) return null;
  if (
    supplied.length !== values.length ||
    supplied.some((value) => !UUID_PATTERN.test(value)) ||
    new Set(supplied.map((value) => value.toLowerCase())).size !== 1
  ) {
    return undefined;
  }
  return supplied[0].toLowerCase();
}

export async function verifySubscriptionCheckoutHandoff(
  input: {
    authUserId: string;
    customerAccountId: string;
    verifiedEmail: string;
    sessionId: string | undefined;
  },
  dependencies: SubscriptionHandoffDependencies = defaultDependencies
): Promise<SubscriptionHandoffResult> {
  if (!input.sessionId || !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(input.sessionId) || input.sessionId.length > 255) {
    return { status: "invalid", sourceScanId: null };
  }
  try {
    const config = dependencies.getConfig();
    const session = await dependencies.retrieveSession(config.secretKey, input.sessionId);
    const checkout = verifiedPaidSubscriptionCheckout(session, input.verifiedEmail, config.prices);
    if (!checkout) return { status: "invalid", sourceScanId: null };
    const sourceScanId = verifiedSourceScanId(session);
    if (!sourceScanId) return { status: "invalid", sourceScanId: null };
    const fulfilled = await dependencies.fulfillCheckout(
      { authUserId: input.authUserId, accountId: input.customerAccountId },
      checkout
    );
    if (!fulfilled) return { status: "invalid", sourceScanId: null };
    const registered = await dependencies.registerActivation({
      customerId: checkout.customerId,
      customerEmail: checkout.customerEmail,
      subscriptionId: checkout.subscriptionId,
      sourceScanId
    });
    return registered
      ? { status: "fulfilled", sourceScanId }
      : { status: "unavailable", sourceScanId: null };
  } catch (cause) {
    console.error("Subscription checkout activation failed", {
      error: cause instanceof Error ? cause.message : "Unknown subscription activation error"
    });
    return { status: "unavailable", sourceScanId: null };
  }
}
