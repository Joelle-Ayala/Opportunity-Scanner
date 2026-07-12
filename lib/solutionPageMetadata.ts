import type { Metadata } from "next";

type SolutionMetadataInput = {
  slug: string;
  name: string;
  description: string;
};

export function buildSolutionPageMetadata(solution: SolutionMetadataInput, siteUrl: string): Metadata {
  const title = `${solution.name} | Opportunity Scanner`;
  const canonicalUrl = `${siteUrl}/solutions/${solution.slug}`;
  const socialImage = `${siteUrl}/opportunity-scanner-social-banner.png`;

  return {
    title: solution.name,
    description: solution.description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title,
      description: solution.description,
      url: canonicalUrl,
      siteName: "Opportunity Scanner",
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1200,
          height: 630,
          alt: `${solution.name} from Opportunity Scanner`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: solution.description,
      images: [socialImage]
    }
  };
}
