import type { ResourceArticle } from "@/lib/marketingContent";

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function ArticleStructuredData({ article, siteUrl }: { article: ResourceArticle; siteUrl: string }) {
  const articleUrl = `${siteUrl}/resources/${article.slug}`;
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl
    },
    publisher: {
      "@type": "Organization",
      name: "Opportunity Scanner",
      url: siteUrl
    },
    ...(article.featuredImage ? { image: article.featuredImage } : {}),
    ...(article.author
      ? {
          author: {
            "@type": "Person",
            name: article.author.name,
            ...(article.author.url ? { url: article.author.url } : {})
          }
        }
      : {}),
    ...(article.publishedAt ? { datePublished: article.publishedAt } : {}),
    ...(article.lastReviewedAt ? { dateModified: article.lastReviewedAt } : {})
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Resources", item: `${siteUrl}/resources` },
      { "@type": "ListItem", position: 3, name: article.title, item: articleUrl }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema) }} />
    </>
  );
}
