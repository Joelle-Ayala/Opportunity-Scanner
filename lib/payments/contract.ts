export const PAYMENT_PLANS = ["report", "monitor", "growth"] as const;
export const BILLING_INTERVALS = ["monthly", "annual"] as const;

export type PaymentPlan = (typeof PAYMENT_PLANS)[number];
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type CheckoutInput = {
  plan: PaymentPlan;
  billingInterval: BillingInterval | null;
  customerEmail: string;
  requestId: string;
  scanId: string | null;
};

type ValidationResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_FIELDS = new Set(["plan", "billingInterval", "customerEmail", "requestId", "scanId"]);
const PORTAL_FIELDS = new Set(["checkoutSessionId"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasOnlyFields(value: Record<string, unknown>, fields: Set<string>): boolean {
  return Object.keys(value).every((key) => fields.has(key));
}

export function validateCheckoutInput(body: unknown): ValidationResult<CheckoutInput> {
  if (!isObject(body)) {
    return { ok: false, code: "INVALID_JSON", message: "Send a valid checkout request." };
  }
  if (!hasOnlyFields(body, CHECKOUT_FIELDS)) {
    return { ok: false, code: "UNSUPPORTED_FIELD", message: "The checkout request contains an unsupported field." };
  }

  const plan = typeof body.plan === "string" ? body.plan.trim() : "";
  if (!PAYMENT_PLANS.includes(plan as PaymentPlan)) {
    return { ok: false, code: "INVALID_PLAN", message: "Choose a supported plan." };
  }

  const rawInterval = typeof body.billingInterval === "string" ? body.billingInterval.trim() : "";
  if (plan === "report" && rawInterval) {
    return { ok: false, code: "INVALID_BILLING_INTERVAL", message: "The report is a one-time purchase." };
  }
  if (plan !== "report" && !BILLING_INTERVALS.includes(rawInterval as BillingInterval)) {
    return { ok: false, code: "INVALID_BILLING_INTERVAL", message: "Choose monthly or annual billing." };
  }

  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim().toLowerCase() : "";
  if (customerEmail.length > 254 || !EMAIL_PATTERN.test(customerEmail)) {
    return { ok: false, code: "INVALID_EMAIL", message: "Enter a valid email address." };
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!UUID_PATTERN.test(requestId)) {
    return { ok: false, code: "INVALID_REQUEST_ID", message: "A valid checkout request ID is required." };
  }

  const scanId = typeof body.scanId === "string" ? body.scanId.trim() : "";
  if (plan === "report" && !UUID_PATTERN.test(scanId)) {
    return { ok: false, code: "INVALID_SCAN_ID", message: "A valid scan ID is required for report access." };
  }
  if (plan !== "report" && scanId) {
    return { ok: false, code: "UNSUPPORTED_FIELD", message: "Scan ID is only supported for report purchases." };
  }

  return {
    ok: true,
    value: {
      plan: plan as PaymentPlan,
      billingInterval: plan === "report" ? null : (rawInterval as BillingInterval),
      customerEmail,
      requestId: requestId.toLowerCase(),
      scanId: plan === "report" ? scanId.toLowerCase() : null
    }
  };
}

export function validatePortalInput(body: unknown): ValidationResult<{ checkoutSessionId: string }> {
  if (!isObject(body)) {
    return { ok: false, code: "INVALID_JSON", message: "Send a valid billing portal request." };
  }
  if (!hasOnlyFields(body, PORTAL_FIELDS)) {
    return { ok: false, code: "UNSUPPORTED_FIELD", message: "The billing portal request contains an unsupported field." };
  }

  const checkoutSessionId = typeof body.checkoutSessionId === "string" ? body.checkoutSessionId.trim() : "";
  if (!/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(checkoutSessionId) || checkoutSessionId.length > 255) {
    return { ok: false, code: "INVALID_CHECKOUT_SESSION", message: "A valid completed checkout session is required." };
  }

  return { ok: true, value: { checkoutSessionId } };
}
