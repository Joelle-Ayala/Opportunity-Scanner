import type { MetadataRoute } from "next";
import { leadMagnets } from "@/lib/leadMagnets";
import { industryPages, resourceArticles, siteUrl, solutionPages } from "@/lib/marketingContent";
import { sampleReports } from "@/lib/sampleReports";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/about",
    "/docs/webhooks",
    "/how-it-works",
    "/industries",
    "/pricing",
    "/privacy",
    "/resources",
    "/guides",
    "/examples",
    "/public-sector-revenue",
    "/solutions",
    "/source-coverage",
    "/terms"
  ];

  return [
    ...routes.map((route) => ({
      url: `${siteUrl}${route}`,
      ...(route === "/privacy" ? { lastModified: "2026-07-10" } : {}),
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8
    })),
    ...resourceArticles.map((article) => ({
      url: `${siteUrl}/resources/${article.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7
    })),
    ...leadMagnets.map((guide) => ({
      url: `${siteUrl}/guides/${guide.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8
    })),
    ...industryPages.map((industry) => ({
      url: `${siteUrl}/industries/${industry.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75
    })),
    ...sampleReports.map((report) => ({
      url: `${siteUrl}/examples/${report.exampleSlug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75
    })),
    ...solutionPages.map((solution) => ({
      url: `${siteUrl}/solutions/${solution.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.75
    }))
  ];
}
