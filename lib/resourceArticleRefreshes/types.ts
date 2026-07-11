import type { ResourceArticle } from "../marketingContent";

export type ResourceArticleRefresh = Pick<
  ResourceArticle,
  | "description"
  | "readTime"
  | "intro"
  | "keyTakeaways"
  | "sections"
  | "practicalList"
  | "proofPoints"
  | "chartAssets"
  | "cta"
> &
  Partial<Pick<ResourceArticle, "sourceNote">>;
