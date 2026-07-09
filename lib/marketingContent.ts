export type ResourceArticle = {
  slug: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  primaryKeyword: string;
  funnelStage: string;
  intro: string;
  sections: Array<{
    heading: string;
    body: string[];
  }>;
  cta: string;
};

export const siteUrl = "https://www.opportunityscanner.ai";

export const resourceArticles: ResourceArticle[] = [
  {
    slug: "government-spending-growth-channel",
    title: "Why Government Spending Is the Most Overlooked Growth Channel for Businesses",
    description:
      "Public-sector money is not only contracts and grants. It can reveal funded buyers, partner targets, policy demand, and new sales channels.",
    category: "Public-Sector Sales",
    readTime: "6 min read",
    primaryKeyword: "government spending growth channel",
    funnelStage: "Awareness",
    intro:
      "Most companies do not ignore public-sector money because it is irrelevant. They ignore it because it feels slow, scattered, and hard to translate into pipeline. The opportunity is bigger than bidding on contracts: public money can show which agencies are buying, which organizations were funded, which programs are expanding, and where demand is forming.",
    sections: [
      {
        heading: "Public money is demand evidence",
        body: [
          "Government contracts, grants, funded programs, workforce dollars, policy priorities, reimbursement rules, and award history all point to demand. Even when a company is not ready to bid directly, these signals can identify funded buyers, award recipients, prime vendors, grantees, distributors, agencies, and program offices worth understanding.",
          "That is why the best question is not always, 'Can we apply for this?' A better first question is, 'What does this public money tell us about who needs what we sell?'"
        ]
      },
      {
        heading: "The data is public, but the action is hidden",
        body: [
          "The hard part is not that public-sector records are unavailable. The hard part is that they are spread across portals, notices, award records, grant listings, regulations, and agency pages.",
          "A sales team needs a target, a reason to reach out, a contact path, and a next step. Raw search results rarely provide that. Opportunity Scanner exists to turn those scattered records into an action-ready opportunity table."
        ]
      },
      {
        heading: "The channel is not only for government contractors",
        body: [
          "Some companies should sell directly to agencies. Others should partner with recipients, sell to funded buyers, monitor policy, register as vendors, contact program offices, or create research tasks for a sales or partnerships team.",
          "That broader map is where many commercial companies can start. They do not need a full government capture team to learn whether public-sector demand exists around their product or service."
        ]
      }
    ],
    cta: "Scan your company website to see where public-sector money may connect to what you sell."
  },
  {
    slug: "can-my-business-sell-to-government",
    title: "Can My Business Sell to the Government? A Practical First Check",
    description:
      "A practical way to think about public-sector fit before you build a government sales motion.",
    category: "Government Contracts",
    readTime: "5 min read",
    primaryKeyword: "can my business sell to government",
    funnelStage: "Awareness",
    intro:
      "Many companies assume government sales are only for defense contractors, large incumbents, or teams that already know procurement. Sometimes that is true. Often, the better first step is to check whether public-sector demand exists around what your company already sells.",
    sections: [
      {
        heading: "Direct agency sales are only one path",
        body: [
          "A company might pursue a direct contract, but it might also sell to a funded buyer, partner with a grantee, work through a prime contractor, support a workforce program, route through a distributor, or monitor a policy signal until a clearer opportunity opens.",
          "That matters because a business can learn from public money flows before it commits to a full government sales strategy."
        ]
      },
      {
        heading: "Good fit starts with evidence",
        body: [
          "Useful evidence includes agencies buying similar products, grants funding adjacent programs, award recipients serving the same market, workforce dollars flowing to relevant outcomes, or policy activity pointing to future demand.",
          "If those signals exist, the next question becomes practical: who is the target organization, what is the revenue motion, and what should the team do next?"
        ]
      },
      {
        heading: "Use a scan as a lightweight market test",
        body: [
          "Opportunity Scanner reads your website, translates your commercial language into public-sector search terms, and looks for sourced signals that map back to your business.",
          "The goal is not to promise instant contracts. The goal is to give you a credible first look at whether this channel deserves attention."
        ]
      }
    ],
    cta: "Run a free scan to test public-sector fit for your business."
  },
  {
    slug: "public-sector-opportunity-signal",
    title: "What Is a Public-Sector Opportunity Signal?",
    description:
      "A simple definition of the signals Opportunity Scanner looks for across spending, grants, procurement, policy, workforce, and reimbursement data.",
    category: "Opportunity Intelligence",
    readTime: "6 min read",
    primaryKeyword: "public sector opportunity signal",
    funnelStage: "Awareness",
    intro:
      "A public-sector opportunity signal is sourced evidence that public money, public demand, or public policy attention may create a revenue, funding, procurement, partnership, workforce, reimbursement, or business-development opportunity.",
    sections: [
      {
        heading: "Signals are not the same as opportunities",
        body: [
          "A grant listing, award record, policy notice, or procurement record is only useful when it points to a plausible next step. The record needs context: who is funded, who might buy, what changed, and what action makes sense.",
          "Opportunity Scanner treats the source record as the beginning, not the final product."
        ]
      },
      {
        heading: "The main signal types",
        body: [
          "Money already moved: award history and spending records that reveal funded buyers, prime vendors, agencies, or market patterns.",
          "Money available now: active grants, procurement notices, solicitations, and funding programs.",
          "Demand forming: policy, regulatory, workforce, reimbursement, and program signals that suggest future need."
        ]
      },
      {
        heading: "Useful signals become action rows",
        body: [
          "A good opportunity row includes the target organization, source, revenue motion, actionability, contact path, next best action, and workflow-ready notes.",
          "Paid reports may include source-native contact paths and capped contact enrichment where appropriate. When a direct contact is not available, the report recommends the best next step, such as a procurement office, program office, funded recipient, vendor registration path, partner target, or manual research task."
        ]
      }
    ],
    cta: "See which public-sector opportunity signals match your company."
  }
];

export const upcomingResourceIdeas = [
  "Grants vs Contracts vs Funded Buyers: What Businesses Should Actually Track",
  "How to Find Funded Buyers Before You Start Cold Outreach",
  "SAM.gov Is Not Enough: How to Spot Earlier Public-Sector Signals",
  "Government Buyer Contact Paths: Who Do You Actually Reach Out To?",
  "Healthcare Public-Sector Opportunities: VA, Medicaid, Rehab, DME, and Community Health Signals",
  "Creative Economy Funding: Arts Grants, City Events, Tourism, and Parks Opportunities"
];

export function getResourceArticle(slug: string): ResourceArticle | undefined {
  return resourceArticles.find((article) => article.slug === slug);
}
