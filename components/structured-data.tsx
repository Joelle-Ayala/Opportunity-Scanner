import { siteUrl } from "@/lib/marketingContent";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Opportunity Scanner",
  alternateName: "Opportunity Systems Opportunity Scanner",
  url: siteUrl,
  logo: `${siteUrl}/opportunity-scanner-logo.svg`,
  description:
    "Opportunity Scanner turns a company website into sourced public-sector opportunity intelligence, including funding, procurement, funded buyer, policy, workforce, reimbursement, and money-flow signals."
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Opportunity Scanner",
  url: siteUrl,
  description:
    "Find public-sector revenue opportunities from your company website and translate them into targets, contact paths, revenue motions, and next actions.",
  publisher: {
    "@type": "Organization",
    name: "Opportunity Scanner"
  }
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Opportunity Scanner",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free scan preview with paid report unlock available."
  },
  description:
    "A B2B SaaS product that scans a company website and finds sourced public-sector opportunity signals with revenue motions, contact paths, and workflow-ready next actions."
};

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify([organizationSchema, websiteSchema, softwareSchema])
      }}
    />
  );
}
