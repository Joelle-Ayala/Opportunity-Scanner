import { pricingCheckoutNoticeFor } from "@/components/pricing-checkout-notice-state";

export function PricingCheckoutNotice({ checkout }: { checkout: unknown }) {
  const notice = pricingCheckoutNoticeFor(checkout);
  if (!notice) return null;

  const tone = notice.tone === "success"
    ? "border-emerald-200 bg-emerald-50"
    : "border-cyan-100 bg-mist";
  const titleTone = notice.tone === "success" ? "text-emerald-800" : "text-accent";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`mb-5 rounded-md border px-4 py-3 sm:px-5 ${tone}`}
    >
      <p className={`text-sm font-semibold ${titleTone}`}>{notice.title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{notice.message}</p>
    </div>
  );
}
