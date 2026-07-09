import type { MetadataRoute } from "next";
import { industryPages, resourceArticles, siteUrl, solutionPages } from "@/lib/marketingContent";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/how-it-works",
    "/industries",
    "/pricing",
    "/resources",
    "/public-sector-revenue",
    "/solutions"
  ];

  return [
    ...routes.map((route) => ({
      url: `${siteUrl}${route}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "" ? 1 : 0.8
    })),
    ...resourceArticles.map((article) => ({
      url: `${siteUrl}/resources/${article.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7
    })),
    ...industryPages.map((industry) => ({
      url: `${siteUrl}/industries/${industry.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.75
    })),
    ...solutionPages.map((solution) => ({
      url: `${siteUrl}/solutions/${solution.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.75
    }))
  ];
}
