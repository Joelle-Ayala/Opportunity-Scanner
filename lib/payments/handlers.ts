import { getStripeServerConfig, priceFor } from "./config.ts";
import { validateCheckoutInput } from "./contract.ts";
import { inspectReportCheckoutEligibility, persistStripeWebhookEvent } from "./persistence.ts";
import { verifyReportCatalogCached } from "./reportCatalogPreflight.ts";
import { verifyStripeSignature } from "./signature.ts";
import { createBillingPortalSession, createCheckoutSession } from "./stripeApi.ts";
import { deliverPaidReportFulfillment } from "../transactionalEmail/paidReport.ts";

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

export type CheckoutIdentity = {
  verifiedEmail: string;
  ownedCustomerId: string | null;
  accountId: string;
};

type CheckoutDependencies = {
  getConfig: typeof getStripeServerConfig;
  inspectReport: typeof inspectReportCheckoutEligibility;
  createSession: typeof createCheckoutSession;
  verifyReportCatalog: typeof verifyReportCatalogCached;
};

const checkoutDependencies: CheckoutDependencies = {
  getConfig: getStripeServerConfig,
  inspectReport: inspectReportCheckoutEligibility,
  createSession: createCheckoutSession,
  verifyReportCatalog: verifyReportCatalogCached
};

function reportSuccessUrl(appUrl: string, scanId: string, signedIn: boolean): string {
  const reportPath = `/reports/${scanId}?checkout=success&session_id=`;
  if (signedIn) return `${appUrl}${reportPath}{CHECKOUT_SESSION_ID}`;
  return `${appUrl}/auth/sign-in?next=${encodeURIComponent(reportPath)}{CHECKOUT_SESSION_ID}`;
}

function reportCancelUrl(appUrl: string, scanId: string): string {
  return `${appUrl}/reports/${scanId}?checkout=cancelled#checkout-return`;
}

export async function handleCheckout(
  request: Request,
  identity: CheckoutIdentity | null = null,
  dependencies: CheckoutDependencies = checkoutDependencies
): Promise<Response> {
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
    const config = dependencies.getConfig();
    const input = validation.value;
    if (input.scanId) {
      const reportEligibility = await dependencies.inspectReport(input.scanId, identity?.accountId ?? null);
      if (!reportEligibility.ok) {
        return error(reportEligibility.status, reportEligibility.code, reportEligibility.message);
      }
    }
    if (input.plan === "report") {
      const catalog = await dependencies.verifyReportCatalog(config);
      if (!catalog.ok) {
        console.error("Stripe Report catalog preflight failed", { code: catalog.code });
        return error(503, "REPORT_CATALOG_INVALID", catalog.reason);
      }
    }
    const session = await dependencies.createSession({
      secretKey: config.secretKey,
      priceId: priceFor(config, input.plan, input.billingInterval),
      mode: input.plan === "report" ? "payment" : "subscription",
      plan: input.plan,
      interval: input.billingInterval,
      email: identity?.verifiedEmail ?? input.customerEmail,
      customerId: identity?.ownedCustomerId ?? null,
      scanId: input.scanId,
      requestId: input.requestId,
      successUrl:
        input.plan === "report"
          ? reportSuccessUrl(config.appUrl, input.scanId!, Boolean(identity))
          : `${config.appUrl}/dashboard/onboarding?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:
        input.plan === "report"
          ? reportCancelUrl(config.appUrl, input.scanId!)
          : `${config.appUrl}/pricing?checkout=cancelled`
    });
    if (!session.url || !session.url.startsWith("https://checkout.stripe.com/")) {
      throw new Error("Stripe did not return a secure Checkout URL.");
    }
    return json({ ok: true, checkoutUrl: session.url }, 201);
  } catch (cause) {
    console.error("Stripe checkout creation failed", {
      plan: validation.value.plan,
      requestId: validation.value.requestId,
      error: cause instanceof Error ? cause.message : "Unknown checkout error"
    });
    return error(503, "CHECKOUT_UNAVAILABLE", "Checkout is temporarily unavailable.");
  }
}

export async function handleBillingPortal(
  options: { ownedCustomerId: string | null },
  dependencies: Pick<CheckoutDependencies, "getConfig"> & {
    createPortal: typeof createBillingPortalSession;
  } = { getConfig: getStripeServerConfig, createPortal: createBillingPortalSession }
): Promise<Response> {
  const customerId = options.ownedCustomerId;
  if (!customerId || !/^cus_[A-Za-z0-9]+$/.test(customerId) || customerId.length > 255) {
    return error(403, "BILLING_PORTAL_FORBIDDEN", "No billing account is connected to this customer.");
  }

  try {
    const config = dependencies.getConfig();
    const portal = await dependencies.createPortal(config.secretKey, customerId, `${config.appUrl}/dashboard`);
    if (!portal.url || !portal.url.startsWith("https://billing.stripe.com/")) {
      throw new Error("Stripe did not return a secure portal URL.");
    }
    return json({ ok: true, portalUrl: portal.url }, 201);
  } catch (cause) {
    console.error("Stripe billing portal creation failed", {
      error: cause instanceof Error ? cause.message : "Unknown billing portal error"
    });
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
    const delivery = await deliverPaidReportFulfillment(event as Record<string, unknown>, config);
    if (delivery.status === "failed") {
      console.error("Paid Report fulfillment requires webhook retry", {
        failureCode: delivery.failureCode
      });
      return error(
        503,
        "REPORT_DELIVERY_RETRY_REQUIRED",
        "Paid Report fulfillment could not be completed yet."
      );
    }
    return json({ ok: true, received: true, duplicate: !processed });
  } catch (cause) {
    const record = event as Record<string, unknown>;
    console.error("Stripe webhook persistence failed", {
      eventId: typeof record.id === "string" ? record.id : "invalid",
      eventType: typeof record.type === "string" ? record.type : "invalid",
      error: cause instanceof Error ? cause.message : "Unknown webhook persistence error"
    });
    return error(503, "WEBHOOK_PERSISTENCE_FAILED", "Webhook processing could not be completed.");
  }
}
