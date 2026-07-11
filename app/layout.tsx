import type { Metadata } from "next";
import { StructuredData } from "@/components/structured-data";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.opportunityscanner.ai"),
  title: {
    default: "Opportunity Scanner | Public-Sector Opportunity Intelligence",
    template: "%s | Opportunity Scanner"
  },
  description:
    "Find public-sector revenue opportunities hiding in plain sight. Scan your company website for sourced public-sector signals, buyer targets, contact paths, and next actions.",
  keywords: [
    "public-sector revenue",
    "government contracts",
    "funded buyers",
    "grant opportunities",
    "procurement intelligence",
    "opportunity intelligence",
    "public spending data",
    "business development"
  ],
  applicationName: "Opportunity Scanner",
  alternates: {
    canonical: "https://www.opportunityscanner.ai"
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/opportunity-scanner-logo.svg"
  },
  openGraph: {
    title: "Opportunity Scanner",
    description:
      "Turn your company website into sourced public-sector opportunity signals, buyer targets, contact paths, and next actions.",
    url: "https://www.opportunityscanner.ai",
    siteName: "Opportunity Scanner",
    type: "website",
    images: [
      {
        url: "/opportunity-scanner-social-banner.svg",
        width: 1500,
        height: 500,
        alt: "Opportunity Scanner public-sector revenue intelligence"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Opportunity Scanner",
    description:
      "Public-sector revenue intelligence from your company website.",
    images: ["/opportunity-scanner-social-banner.svg"]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
