import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/brand";

const title = "Terms of Service | Opportunity Scanner";
const description = "Terms for using Opportunity Scanner beta and self-serve research software.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  alternates: { canonical: "/terms" },
  openGraph: {
    title,
    description,
    url: "/terms",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [{ url: "https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png", width: 1200, height: 630, alt: "Opportunity Scanner public-sector revenue intelligence" }]
  },
  twitter: { card: "summary_large_image", title, description, images: ["https://www.opportunityscanner.ai/opportunity-scanner-social-banner.png"] }
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-field">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Last updated July 11, 2026</p>
        <h1 className="mt-4 text-4xl font-semibold text-ink">Terms of Service</h1>
        <p className="mt-5 text-base leading-8 text-slate-700">
          These terms govern your use of Opportunity Scanner, a beta and self-serve research
          product operated by Opportunity Systems. By using the service, you agree to these terms.
          If you use it for an organization, you confirm that you may accept these terms for that organization.
        </p>

        <div className="mt-10 grid gap-10 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-xl font-semibold text-ink">What the service provides</h2>
            <p className="mt-3">
              Opportunity Scanner analyzes information you submit and public sources to surface
              possible public-sector opportunities, buyer or partner targets, contact paths, and
              suggested next actions. Beta features, sources, limits, and outputs may change as the product develops.
            </p>
          </section>

          <section className="border-l-4 border-review bg-amber-50 px-5 py-4">
            <h2 className="text-xl font-semibold text-ink">Research only, not professional advice</h2>
            <p className="mt-3">
              Outputs are informational research, not legal, procurement, grant, financial, tax,
              compliance, or other professional advice. They do not determine eligibility,
              guarantee funding or an award, replace solicitation documents, or create a
              recommendation by any government entity. You are responsible for reviewing original
              sources, current requirements, deadlines, and terms, and for obtaining qualified advice when needed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Your account and submissions</h2>
            <p className="mt-3">
              You must provide accurate information, keep any account access secure, and promptly
              notify us of suspected unauthorized use. You retain ownership of information you
              submit. You give us permission to host, process, and analyze it only as needed to
              provide, secure, support, and improve the service, consistent with our Privacy Notice.
              Do not submit confidential, sensitive, classified, export-controlled, or unlawfully obtained information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Acceptable use</h2>
            <p className="mt-3">You may not use the service to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>break the law, violate another person&apos;s rights, or misrepresent your identity or affiliation;</li>
              <li>interfere with, probe, overload, reverse engineer, or bypass safeguards or usage limits;</li>
              <li>use automated means to extract the service or its outputs at unreasonable scale without permission;</li>
              <li>send unlawful, deceptive, or unsolicited outreach based on the service; or</li>
              <li>treat an output as an official agency statement or falsely imply government endorsement.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Public sources and third parties</h2>
            <p className="mt-3">
              The service links to public records and third-party sites we do not control. Those
              sources may be incomplete, delayed, changed, removed, or inaccurate. Third-party
              terms may apply when you follow a link or use an external workflow. We do not endorse
              or guarantee third-party content, availability, organizations, contacts, or opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Fees, cancellation, and beta access</h2>
            <p className="mt-3">
              Prices, included usage, and billing frequency are shown before purchase. Unless a
              checkout states otherwise, paid access is billed in advance and you may cancel future
              renewal before the next billing date. Fees already charged are non-refundable except
              where required by law. We may modify, suspend, limit, or discontinue beta features,
              and may suspend access when reasonably needed for security, maintenance, misuse, or legal compliance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Ownership</h2>
            <p className="mt-3">
              Opportunity Systems and its licensors retain rights in the service, software, design,
              and product materials. Subject to these terms, you may use your reports and outputs
              for your internal business purposes. Public-source material remains subject to its
              original ownership, license, and attribution requirements. Feedback may be used to improve the service without obligation to you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Disclaimers and responsibility</h2>
            <p className="mt-3">
              The service is provided &quot;as is&quot; and &quot;as available&quot; to the extent permitted by law,
              without warranties of accuracy, completeness, fitness for a particular purpose,
              non-infringement, or uninterrupted availability. You remain responsible for decisions,
              applications, bids, outreach, compliance, and results arising from your use of the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Limitation of liability</h2>
            <p className="mt-3">
              To the fullest extent permitted by law, Opportunity Systems will not be liable for
              indirect, incidental, special, consequential, exemplary, or lost-profit damages, or
              for lost data, business, funding, or opportunities. Our total liability relating to
              the service will not exceed the amount you paid for the service during the three
              months before the event giving rise to the claim. These limits do not apply where the law does not allow them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Changes and termination</h2>
            <p className="mt-3">
              You may stop using the service at any time. We may suspend or end access for a material
              breach, unlawful use, security risk, nonpayment, or discontinuation of the service.
              We may update these terms and will post the revised date here. Material changes apply
              prospectively; continued use after they take effect means you accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink">Contact</h2>
            <p className="mt-3">
              Questions about these terms or the service can be sent to{" "}
              <a className="font-semibold text-accent hover:underline" href="mailto:support@opportunityscanner.ai">
                support@opportunityscanner.ai
              </a>.
            </p>
          </section>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
