import { verifiedPaidSubscriptionCheckout } from "./accessContract.ts";
import { getStripeServerConfig } from "./config.ts";
import { fulfillVerifiedSubscriptionCheckout } from "./persistence.ts";
import { retrieveCheckoutSession, type StripeCheckoutSession } from "./stripeApi.ts";

export type SubscriptionHandoffResult = "fulfilled" | "invalid" | "unavailable";

type SubscriptionHandoffDependencies = {
  getConfig: typeof getStripeServerConfig;
  retrieveSession: (secretKey: string, sessionId: string) => Promise<StripeCheckoutSession>;
  fulfillCheckout: typeof fulfillVerifiedSubscriptionCheckout;
};

const defaultDependencies: SubscriptionHandoffDependencies = {
  getConfig: getStripeServerConfig,
  retrieveSession: retrieveCheckoutSession,
  fulfillCheckout: fulfillVerifiedSubscriptionCheckout
};

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
    return "invalid";
  }
  try {
    const config = dependencies.getConfig();
    const session = await dependencies.retrieveSession(config.secretKey, input.sessionId);
    const checkout = verifiedPaidSubscriptionCheckout(session, input.verifiedEmail, config.prices);
    if (!checkout) return "invalid";
    const fulfilled = await dependencies.fulfillCheckout(
      { authUserId: input.authUserId, accountId: input.customerAccountId },
      checkout
    );
    return fulfilled ? "fulfilled" : "invalid";
  } catch (cause) {
    console.error("Subscription checkout activation failed", {
      error: cause instanceof Error ? cause.message : "Unknown subscription activation error"
    });
    return "unavailable";
  }
}
