const CHECKOUT_SESSION_PATTERN = /^cs_(test_|live_)?[A-Za-z0-9]+$/;

export function completedSubscriptionCheckoutSession(
  checkout: unknown,
  checkoutSessionId: unknown
): string | null {
  if (checkout !== "success" || typeof checkoutSessionId !== "string") return null;

  const sessionId = checkoutSessionId.trim();
  if (!CHECKOUT_SESSION_PATTERN.test(sessionId) || sessionId.length > 255) return null;

  return sessionId;
}

export function secureStripeBillingPortalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.origin === "https://billing.stripe.com" ? url.toString() : null;
  } catch {
    return null;
  }
}
