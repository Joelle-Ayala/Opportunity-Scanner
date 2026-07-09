import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.opportunityscanner.ai"),
  title: {
    default: "Opportunity Scanner | Public-Sector Opportunity Intelligence",
    template: "%s | Opportunity Scanner"
  },
  description:
    "Find public-sector revenue opportunities hiding in plain sight. Scan your company website for sourced public-sector signals, buyer targets, contact paths, and next actions.",
  openGraph: {
    title: "Opportunity Scanner",
    description:
      "Turn your company website into sourced public-sector opportunity signals, buyer targets, contact paths, and next actions.",
    url: "https://www.opportunityscanner.ai",
    siteName: "Opportunity Scanner",
    type: "website"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
