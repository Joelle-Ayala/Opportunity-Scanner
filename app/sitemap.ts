import type { MetadataRoute } from "next";
import { resourceArticles, siteUrl } from "@/lib/marketingContent";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    "",
    "/how-it-works",
    "/pricing",
    "/resources",
    "/public-sector-revenue"
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
    }))
  ];
}
