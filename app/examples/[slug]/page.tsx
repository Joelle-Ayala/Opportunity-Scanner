import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/brand";
import { CTASection } from "@/components/marketing";
import { FullSampleReport } from "@/components/sample-report";
import { getSampleReportByExampleSlug, sampleReports } from "@/lib/sampleReports";
import { siteUrl } from "@/lib/marketingContent";

export function generateStaticParams() {
  return sampleReports.map((report) => ({ slug: report.exampleSlug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const report = getSampleReportByExampleSlug(params.slug);
  if (!report) {
    return {};
  }

  return {
    title: report.title,
    description: report.summary,
    alternates: {
      canonical: `${siteUrl}/examples/${report.exampleSlug}`
    },
    openGraph: {
      title: report.title,
      description: report.summary,
      url: `${siteUrl}/examples/${report.exampleSlug}`,
      type: "website",
      images: [{
        url: `${siteUrl}/opportunity-scanner-social-banner.png`,
        width: 1200,
        height: 630,
        alt: "Opportunity Scanner public-sector revenue intelligence"
      }]
    },
    twitter: {
      card: "summary_large_image",
      title: report.title,
      description: report.summary,
      images: [`${siteUrl}/opportunity-scanner-social-banner.png`]
    }
  };
}

export default function SampleReportPage({ params }: { params: { slug: string } }) {
  const report = getSampleReportByExampleSlug(params.slug);
  if (!report) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-field">
      <SiteHeader
        rightSlot={
          <a href="/#scan" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871]">
            Run Free Scan
          </a>
        }
      />

      <FullSampleReport report={report} />

      <CTASection title="Want one of these for a real company?">
        <p>
          Run a free scan from the company website. The full version turns sourced signals into
          opportunity-specific action paths, pursuits, outreach drafts, CRM-ready notes, and
          workflow-ready rows. Current paid-plan availability is shown on pricing.
        </p>
      </CTASection>

      <SiteFooter />
    </main>
  );
}
