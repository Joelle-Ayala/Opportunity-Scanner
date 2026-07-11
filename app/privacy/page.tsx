import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";

const title = "Privacy Notice | Opportunity Scanner";
const description = "How Opportunity Scanner handles scan and guide-request information.";

export const metadata: Metadata = {
  title: "Privacy Notice",
  description,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title,
    description,
    url: "/privacy",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

export default function PrivacyPage() {
  const contactEmail = process.env.OPPORTUNITY_SCANNER_CONTACT_EMAIL || "hello@opportunitysystems.ai";

  return (
    <main className="min-h-screen bg-field">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Last reviewed July 11, 2026</p>
        <h1 className="mt-4 text-4xl font-semibold text-ink">Privacy notice</h1>
        <p className="mt-5 text-base leading-8 text-slate-700">
          Opportunity Scanner collects only the information needed to run requested scans, provide requested guides, operate the beta, and understand which product and content experiences are useful.
        </p>

        <div className="mt-10 grid gap-9 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-ink">Information we collect</h2>
            <p className="mt-3">For scans, this may include a company website, work email, and optional company context. For guides, this may include name, work email, optional company and website, the requested guide, source and campaign fields, and whether optional marketing consent was selected.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink">How we use it</h2>
            <p className="mt-3">We use this information to provide the requested scan or guide, maintain product reliability, respond to requests, evaluate interest, and improve Opportunity Scanner. Downloading a guide does not automatically enroll someone in marketing. Marketing updates require the optional checkbox.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink">Optional product analytics</h2>
            <p className="mt-3">
              When configured, we may use Vercel Analytics and PostHog to understand page visits and
              basic product actions, such as starting or completing a scan or opening checkout.
              PostHog session replay and autocapture are disabled. Our custom analytics events do
              not include form entries such as email addresses, company URLs, or free-text responses.
              These analytics providers process usage and technical data to provide and operate
              their services for us.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink">Checkout and payments</h2>
            <p className="mt-3">
              Paid purchases use Stripe-hosted checkout. Payment card details are submitted directly
              to and handled by Stripe rather than Opportunity Scanner. We may receive and store
              related transaction details, such as payment status, the product purchased, and Stripe
              reference identifiers, so we can provide access and support the purchase. Stripe
              processes checkout and payment information to operate its payment services.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink">Storage and sharing</h2>
            <p className="mt-3">Production records are intended to be stored in the configured Supabase project and processed by providers needed to operate the product, including the analytics and payment providers described above when those features are enabled. We do not sell submitted personal information.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink">Retention and choices</h2>
            <p className="mt-3">Beta records are retained while needed for product operation, research follow-up, security, and business records. You may request access, correction, deletion, or withdrawal from optional marketing by contacting us. Some records may be retained when required for security, legal, or operational reasons.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-ink">Contact</h2>
            <p className="mt-3">Questions or requests can be sent to <a className="font-semibold text-accent hover:underline" href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>
          </section>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
