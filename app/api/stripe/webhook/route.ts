import { handleStripeWebhook } from "@/lib/payments/handlers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
