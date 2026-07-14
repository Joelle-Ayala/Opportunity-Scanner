import { cookies } from "next/headers";
import { getCustomerAuthConfig, resolveCustomerSession } from "@/lib/customer-auth";
import { ensureCustomerAccount } from "@/lib/dashboard/repository";
import { handleCheckout } from "@/lib/payments/handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof resolveCustomerSession>>;
  try {
    session = await resolveCustomerSession(getCustomerAuthConfig(request.url), cookies());
  } catch {
    return Response.json(
      {
        ok: false,
        error: { code: "CHECKOUT_IDENTITY_UNAVAILABLE", message: "Checkout identity could not be verified. Please retry." }
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (!session) return handleCheckout(request);

  const verifiedEmail = session.user.email?.trim().toLowerCase();
  if (!verifiedEmail || !session.user.email_confirmed_at) {
    return Response.json(
      {
        ok: false,
        error: { code: "CHECKOUT_IDENTITY_UNVERIFIED", message: "Verify your account email before checkout." }
      },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const account = await ensureCustomerAccount(session.user.id, verifiedEmail);
    return handleCheckout(request, {
      verifiedEmail,
      ownedCustomerId: account.stripe_customer_id
    });
  } catch {
    return Response.json(
      {
        ok: false,
        error: { code: "CHECKOUT_ACCOUNT_UNAVAILABLE", message: "Your account could not be prepared for checkout." }
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
