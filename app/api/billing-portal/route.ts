import { cookies } from "next/headers";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { ensureCustomerAccount } from "@/lib/dashboard/repository";
import { handleBillingPortal } from "@/lib/payments/handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await resolveCustomerSession(getCustomerAuthConfig(request.url), cookies()).catch(() => null);
  if (session?.user.email) {
    try {
      const account = await ensureCustomerAccount(session.user.id, session.user.email);
      return handleBillingPortal(request, { ownedCustomerId: account.stripe_customer_id });
    } catch {
      return Response.json(
        {
          ok: false,
          error: {
            code: "BILLING_ACCOUNT_UNAVAILABLE",
            message: "Your billing account could not be opened. Please try again."
          }
        },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  // Keep the completed-checkout path available to the pricing success screen.
  const legacyBody = await request.clone().json().catch(() => null);
  if (
    legacyBody &&
    typeof legacyBody === "object" &&
    !Array.isArray(legacyBody) &&
    typeof (legacyBody as Record<string, unknown>).checkoutSessionId === "string"
  ) {
    return handleBillingPortal(request);
  }

  return Response.json(
    { ok: false, error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in to manage billing." } },
    { status: 401, headers: { "Cache-Control": "no-store" } }
  );
}
