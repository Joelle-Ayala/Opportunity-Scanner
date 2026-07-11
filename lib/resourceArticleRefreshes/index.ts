import { commercialIndustryArticleRefreshes } from "./commercialIndustries";
import { foundationArticleRefreshes } from "./foundations";
import { peopleIndustryArticleRefreshes } from "./peopleIndustries";
import { workflowArticleRefreshes } from "./workflows";
import type { ResourceArticleRefresh } from "./types";

export const resourceArticleRefreshes: Record<string, ResourceArticleRefresh> = {
  ...foundationArticleRefreshes,
  ...workflowArticleRefreshes,
  ...peopleIndustryArticleRefreshes,
  ...commercialIndustryArticleRefreshes
};
