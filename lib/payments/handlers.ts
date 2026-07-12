import { getStripeServerConfig, priceFor } from "./config";
import { validateCheckoutInput, validatePortalInput } from "./contract";
import { persistStripeWebhookEvent, reportScanExists } from "./persistence";
import { verifyStripeSignature } from "./signature";
import { createBillingPortalSession, createCheckoutSession, retrieveCheckoutSession } from "./stripeApi";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_REQUEST_BYTES = 8_192;
const MAX_WEBHOOK_BYTES = 1_000_000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function error(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}

async function boundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_REQUEST_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(text);
}

export async function handleCheckout(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await boundedJson(request);
  } catch (cause) {
    return cause instanceof Error && cause.message === "PAYLOAD_TOO_LARGE"
      ? error(413, "PAYLOAD_TOO_LARGE", "The checkout request is too large.")
      : error(400, "INVALID_JSON", "Send a valid checkout request.");
  }
  const validation = validateCheckoutInput(body);
  if (!validation.ok) return error(400, validation.code, validation.message);

  try {
    const config = getStripeServerConfig();
    const input = validation.value;
    if (input.scanId && !(await reportScanExists(input.scanId))) {
      return error(404, "SCAN_NOT_FOUND", "The report scan was not found.");
    }
    const session = await createCheckoutSession({
      secretKey: config.secretKey,
      priceId: priceFor(config, input.plan, input.billingInterval),
      mode: input.plan === "report" ? "payment" : "subscription",
      plan: input.plan,
      interval: input.billingInterval,
      email: input.customerEmail,
      scanId: input.scanId,
      requestId: input.requestId,
      successUrl:
        input.plan === "report"
          ? `${config.appUrl}/reports/${input.scanId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
          : `${config.appUrl}/dashboard/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${config.appUrl}/pricing?checkout=cancelled`
    });
    if (!session.url || !session.url.startsWith("https://checkout.stripe.com/")) {
      throw new Error("Stripe did not return a secure Checkout URL.");
    }
    return json({ ok: true, checkoutUrl: session.url }, 201);
  } catch {
    return error(503, "CHECKOUT_UNAVAILABLE", "Checkout is temporarily unavailable.");
  }
}

export async function handleBillingPortal(
  request: Request,
  options: { ownedCustomerId: string | null } | null = null
): Promise<Response> {
  if (options) {
    const customerId = options.ownedCustomerId;
    if (!customerId || !/^cus_[A-Za-z0-9]+$/.test(customerId) || customerId.length > 255) {
      return error(403, "BILLING_PORTAL_FORBIDDEN", "No billing account is connected to this customer.");
    }

    try {
      const config = getStripeServerConfig();
      const portal = await createBillingPortalSession(config.secretKey, customerId, `${config.appUrl}/dashboard`);
      if (!portal.url || !portal.url.startsWith("https://billing.stripe.com/")) {
        throw new Error("Stripe did not return a secure portal URL.");
      }
      return json({ ok: true, portalUrl: portal.url }, 201);
    } catch {
      return error(503, "BILLING_PORTAL_UNAVAILABLE", "The billing portal is temporarily unavailable.");
    }
  }

  let body: unknown;
  try {
    body = await boundedJson(request);
  } catch (cause) {
    return cause instanceof Error && cause.message === "PAYLOAD_TOO_LARGE"
      ? error(413, "PAYLOAD_TOO_LARGE", "The billing portal request is too large.")
      : error(400, "INVALID_JSON", "Send a valid billing portal request.");
  }
  const validation = validatePortalInput(body);
  if (!validation.ok) return error(400, validation.code, validation.message);

  try {
    const config = getStripeServerConfig();
    const checkout = await retrieveCheckoutSession(config.secretKey, validation.value.checkoutSessionId);
    const customerId = typeof checkout.customer === "string" ? checkout.customer : checkout.customer?.id;
    if (checkout.status !== "complete" || !customerId?.startsWith("cus_")) {
      return error(403, "BILLING_PORTAL_FORBIDDEN", "A completed checkout session is required.");
    }
    const portal = await createBillingPortalSession(config.secretKey, customerId, `${config.appUrl}/pricing`);
    if (!portal.url || !portal.url.startsWith("https://billing.stripe.com/")) {
      throw new Error("Stripe did not return a secure portal URL.");
    }
    return json({ ok: true, portalUrl: portal.url }, 201);
  } catch {
    return error(503, "BILLING_PORTAL_UNAVAILABLE", "The billing portal is temporarily unavailable.");
  }
}

export async function handleStripeWebhook(request: Request): Promise<Response> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_WEBHOOK_BYTES) return error(413, "PAYLOAD_TOO_LARGE", "The webhook payload is too large.");
  const payload = await request.text();
  if (Buffer.byteLength(payload, "utf8") > MAX_WEBHOOK_BYTES) {
    return error(413, "PAYLOAD_TOO_LARGE", "The webhook payload is too large.");
  }

  let config: ReturnType<typeof getStripeServerConfig>;
  try {
    config = getStripeServerConfig();
  } catch {
    return error(503, "WEBHOOK_UNAVAILABLE", "Webhook processing is unavailable.");
  }
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), config.webhookSecret)) {
    return error(400, "INVALID_SIGNATURE", "The webhook signature is invalid.");
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    return error(400, "INVALID_EVENT", "The webhook event is invalid.");
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    return error(400, "INVALID_EVENT", "The webhook event is invalid.");
  }

  try {
    const processed = await persistStripeWebhookEvent(event as Record<string, unknown>, config.prices);
    return json({ ok: true, received: true, duplicate: !processed });
  } catch {
    return error(503, "WEBHOOK_PERSISTENCE_FAILED", "Webhook processing could not be completed.");
  }
}
