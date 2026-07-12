export type PricingCheckoutNoticeContent = {
  title: string;
  message: string;
  tone: "success" | "neutral";
};

export function pricingCheckoutNoticeFor(checkout: unknown): PricingCheckoutNoticeContent | null {
  if (checkout === "success") {
    return {
      title: "Checkout complete",
      message: "Thanks, your plan is set. Stripe will email your receipt and billing details to the address used at checkout.",
      tone: "success"
    };
  }

  if (checkout === "cancelled") {
    return {
      title: "Checkout canceled",
      message: "No payment was taken. You can review the options below or continue with a free scan.",
      tone: "neutral"
    };
  }

  return null;
}
