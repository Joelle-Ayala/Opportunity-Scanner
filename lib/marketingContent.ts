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

export type IndustryPage = {
  slug: string;
  name: string;
  headline: string;
  description: string;
  outcome: string;
  signals: string[];
  revenueMotions: string[];
  exampleRows: Array<{
    target: string;
    signal: string;
    revenueMotion: string;
    nextAction: string;
  }>;
  searchIntent: string;
};

export const siteUrl = "https://www.opportunityscanner.ai";

export const industryPages: IndustryPage[] = [
  {
    slug: "healthcare-dme-medical-supply",
    name: "Healthcare / DME / Medical Supply",
    headline: "Find public-sector revenue paths for healthcare, rehab, DME, and medical supply companies.",
    description:
      "Public-sector healthcare demand can show up through VA purchasing, Medicaid-adjacent programs, community health funding, rehab services, grants, distributors, funded providers, and award recipients.",
    outcome:
      "Identify procurement, VA, Medicaid-adjacent, rehab, community health, and funded buyer opportunities for products or services already used in public care systems.",
    signals: [
      "VA and agency procurement patterns",
      "Community health and rehab program funding",
      "Medical supply and DME-adjacent awards",
      "Distributor or funded provider targets",
      "Reimbursement and policy demand signals"
    ],
    revenueMotions: [
      "Sell to Agency",
      "Sell to Funded Buyer",
      "Channel / Distributor Motion",
      "Partner with Recipient",
      "Monitor Policy"
    ],
    exampleRows: [
      {
        target: "VA or public care program office",
        signal: "Prior awards or active procurement language around rehab, prosthetics, orthotics, supplies, or patient support",
        revenueMotion: "Sell to Agency",
        nextAction: "Validate product category fit and route to procurement or program office."
      },
      {
        target: "Funded clinic, provider, or distributor",
        signal: "Public money moved to a buyer or recipient serving a relevant care population",
        revenueMotion: "Sell to Funded Buyer",
        nextAction: "Build a source-backed outreach note and identify purchasing or partnerships owner."
      }
    ],
    searchIntent: "healthcare government contracts, DME government contracts, medical supply public-sector opportunities"
  },
  {
    slug: "education-workforce-training",
    name: "Education / Workforce / Training",
    headline: "Turn education and workforce funding signals into district, agency, and program opportunities.",
    description:
      "Education and workforce opportunities often move through districts, state agencies, workforce boards, nonprofits, training providers, grant-funded programs, and employer partnerships.",
    outcome:
      "Find district, workforce board, state agency, grant-funded, and training program opportunities where education or talent solutions can become funded revenue channels.",
    signals: [
      "School district and education procurement",
      "Workforce board and state agency funding",
      "Apprenticeship and training grants",
      "Arts education and enrichment programs",
      "Funded nonprofit or provider partners"
    ],
    revenueMotions: [
      "Sell to Agency",
      "Sell to Funded Buyer",
      "Partner with Recipient",
      "Direct Apply",
      "Monitor Policy"
    ],
    exampleRows: [
      {
        target: "District or workforce program",
        signal: "Funding or procurement language around staffing, credentialing, training, enrichment, or workforce pathways",
        revenueMotion: "Sell to Funded Buyer",
        nextAction: "Identify program owner, HR/workforce lead, or procurement route."
      },
      {
        target: "Grant-funded provider or nonprofit",
        signal: "Award recipient serving students, workers, or educator pipelines",
        revenueMotion: "Partner with Recipient",
        nextAction: "Create a partnership/outreach task tied to the funded program objective."
      }
    ],
    searchIntent: "education workforce grants, school staffing government contracts, training public funding opportunities"
  },
  {
    slug: "arts-creative-economy-live-events",
    name: "Arts / Creative Economy / Live Events",
    headline: "Find public funding, procurement, and buyer signals for creative economy and live event revenue.",
    description:
      "Creative economy demand can appear through city events, tourism, parks, arts councils, schools, placemaking, public performances, creative workforce programs, and cultural grants.",
    outcome:
      "Find city, county, tourism, parks, arts council, school, and placemaking opportunities that fund performances, programming, creative workforce, and cultural activation.",
    signals: [
      "City and county event procurement",
      "Arts council and cultural grant programs",
      "Tourism and placemaking budgets",
      "Parks and recreation programming",
      "School arts enrichment and creative workforce funding"
    ],
    revenueMotions: [
      "Sell to Agency",
      "Sell to Funded Buyer",
      "Partner with Recipient",
      "Channel / Distributor Motion",
      "Direct Apply"
    ],
    exampleRows: [
      {
        target: "City events, parks, or tourism office",
        signal: "Public spending or grant language around performances, cultural activation, festivals, or placemaking",
        revenueMotion: "Sell to Agency",
        nextAction: "Route to events, cultural affairs, parks, tourism, or procurement contact path."
      },
      {
        target: "Funded arts organization or event vendor",
        signal: "Award recipient or vendor with public event-entertainment spend",
        revenueMotion: "Partner with Recipient",
        nextAction: "Build partner/channel outreach with source-backed social proof."
      }
    ],
    searchIntent: "arts grants for businesses, creative economy public funding, city event procurement"
  },
  {
    slug: "software-b2b-services-ai",
    name: "Software / B2B Services / AI",
    headline: "Find public-sector demand for software, AI, automation, consulting, and B2B services.",
    description:
      "Public-sector demand for software and services can emerge through operations modernization, data, cybersecurity, workflow automation, program delivery, compliance, citizen services, and funded implementation partners.",
    outcome:
      "Find public-sector demand for platforms, consulting, automation, data, operations, cybersecurity, workflow, and service delivery improvements across agencies and funded organizations.",
    signals: [
      "Agency modernization and operations priorities",
      "Software, data, and cybersecurity procurement",
      "Funded implementation partners and primes",
      "Policy or compliance demand signals",
      "Workforce and service delivery programs"
    ],
    revenueMotions: [
      "Sell to Agency",
      "Sell to Funded Buyer",
      "Sell to Award Recipient",
      "Partner with Recipient",
      "Research Only"
    ],
    exampleRows: [
      {
        target: "Agency program or operations office",
        signal: "Procurement, policy, or award language around modernization, workflow, data, or service delivery",
        revenueMotion: "Sell to Agency",
        nextAction: "Research vendor registration and route to program/procurement contact path."
      },
      {
        target: "Prime contractor or funded implementation partner",
        signal: "Award recipient delivering services adjacent to your platform or consulting offer",
        revenueMotion: "Sell to Award Recipient",
        nextAction: "Identify partner/channel owner and prepare source-backed outreach."
      }
    ],
    searchIntent: "software government contracts, AI public sector opportunities, B2B services government sales"
  }
];

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
  },
  {
    slug: "grants-contracts-funded-buyers",
    title: "Grants vs Contracts vs Funded Buyers: What Businesses Should Actually Track",
    description:
      "The best public-sector opportunity is not always a grant or bid. Learn how to separate direct apply, procurement, and funded buyer paths.",
    category: "Opportunity Intelligence",
    readTime: "7 min read",
    primaryKeyword: "government contracts vs grants",
    funnelStage: "Awareness",
    intro:
      "Public-sector opportunity gets confusing because different records point to different actions. A grant might be something you apply for, but it might also identify future grantees to sell to. A contract might be active, expired, or simply evidence that an agency buys a category. A funded buyer may be a better target than the agency itself.",
    sections: [
      {
        heading: "Grants are not always direct revenue",
        body: [
          "Some grants are a fit for direct application. Others are better treated as market intelligence: they show which organizations may soon have money to spend, what outcomes are being funded, and which program offices control the agenda.",
          "A business should ask whether it is eligible to apply, whether eligible recipients need vendors or partners, and whether the funder or program office signals future demand."
        ]
      },
      {
        heading: "Contracts show both active work and buying patterns",
        body: [
          "An active solicitation may create a direct bid path. A historical award may not be open now, but it can reveal agencies, primes, recipients, or purchasing categories worth monitoring.",
          "Opportunity Scanner separates money already moved from money available now so teams do not confuse market evidence with an active opportunity."
        ]
      },
      {
        heading: "Funded buyers can be the fastest path",
        body: [
          "A funded buyer is an organization with public money, a public mandate, or a funded program that may need products, services, partners, or implementation support.",
          "For many companies, the first public-sector revenue motion is not a bid. It is selling to or partnering with the organization that already received the money."
        ]
      }
    ],
    cta: "Run a scan to see whether your company maps to grants, contracts, funded buyers, or partner targets."
  },
  {
    slug: "find-funded-buyers-before-cold-outreach",
    title: "How to Find Funded Buyers Before You Start Cold Outreach",
    description:
      "Source-backed public spending signals can help sales teams identify better target accounts and write more relevant outreach.",
    category: "Funded Buyers",
    readTime: "6 min read",
    primaryKeyword: "funded buyers",
    funnelStage: "Consideration",
    intro:
      "Most cold outreach starts with a list and a guess. Public-sector money flow can make that outreach sharper by showing who received funding, who won awards, what agencies are buying, and which organizations are operating inside a funded program.",
    sections: [
      {
        heading: "A funded buyer is more than a lead",
        body: [
          "A funded buyer has some combination of money, mandate, timing, and public evidence. That does not guarantee a sale, but it gives your team a better reason to research, prioritize, and reach out.",
          "The best rows include a source link, relevant context, a revenue motion, and a practical next action."
        ]
      },
      {
        heading: "Use source evidence in outreach",
        body: [
          "A source-backed note can reference the program, award, funding category, or public objective that makes the outreach relevant. That is more useful than a generic pitch.",
          "The outreach should still be careful: ask who owns the program, vendor path, partnership route, or procurement process instead of assuming one person controls the whole opportunity."
        ]
      },
      {
        heading: "Contact path beats random email hunting",
        body: [
          "Sometimes the best route is a named contact. Sometimes it is a program office, procurement office, vendor registration portal, partner organization, or manual research task.",
          "Paid reports include source-native contact paths and capped contact enrichment where appropriate, but the product should never invent certainty where the source does not support it."
        ]
      }
    ],
    cta: "Generate a scan to find funded buyers and contact paths that match your company."
  },
  {
    slug: "sam-gov-is-not-enough",
    title: "SAM.gov Is Not Enough: How to Spot Earlier Public-Sector Signals",
    description:
      "SAM.gov is important, but public-sector demand can show up before an active solicitation appears.",
    category: "Government Contracts",
    readTime: "6 min read",
    primaryKeyword: "SAM.gov alternative",
    funnelStage: "Consideration",
    intro:
      "SAM.gov is an essential source for federal contract opportunities. But if a company only watches active solicitations, it may miss earlier demand signals: spending history, funded recipients, policy priorities, workforce programs, grants, and agency initiatives.",
    sections: [
      {
        heading: "Active bids are only one signal",
        body: [
          "An active bid can be valuable, but it often arrives late in the buying process. Many companies need context before then: who buys this category, which primes or recipients are active, and which agencies fund related programs.",
          "That context helps companies decide whether to bid, partner, monitor, register, or research."
        ]
      },
      {
        heading: "Earlier signals can shape pipeline",
        body: [
          "Award history can reveal repeat buyers. Grants can reveal upcoming recipients. Policy notices can indicate future demand. Workforce and reimbursement signals can show where budgets and mandates are shifting.",
          "Opportunity Scanner combines these signal types so the report can recommend a revenue motion instead of only listing records."
        ]
      },
      {
        heading: "The output should still be practical",
        body: [
          "More sources do not automatically mean a better report. The useful output is a prioritized table that explains the opportunity, source evidence, target organization, contact path, and next action.",
          "If a source does not support action, it should be marked as monitor or research only."
        ]
      }
    ],
    cta: "Scan your website to see active opportunities and earlier public-sector demand signals."
  },
  {
    slug: "government-buyer-contact-paths",
    title: "Government Buyer Contact Paths: Who Do You Actually Reach Out To?",
    description:
      "Public-sector outreach is not always about finding one email. Learn how to think about procurement, program offices, funded recipients, partners, and manual research paths.",
    category: "Contact Paths",
    readTime: "7 min read",
    primaryKeyword: "government buyer contacts",
    funnelStage: "Consideration",
    intro:
      "One of the biggest mistakes in public-sector sales is assuming every opportunity should end with a personal email. Sometimes that is useful. Other times the right path is a procurement office, program office, source-native contact, vendor portal, funded recipient, prime contractor, partner, or manual research task.",
    sections: [
      {
        heading: "Different signals require different contact paths",
        body: [
          "A SAM.gov procurement record may point to a contracting office. A grant may point to a program officer or future grantee. A USAspending award may point to an agency, prime, or award recipient. A policy signal may point to monitoring instead of outreach.",
          "The contact path should match the revenue motion."
        ]
      },
      {
        heading: "Source-native contacts come first",
        body: [
          "When a source record includes a useful contact, the report should preserve it. That contact may be best for program questions, eligibility, procurement routing, or official process guidance.",
          "Third-party enrichment is useful when the target is a company, vendor, recipient, distributor, nonprofit, or partner organization."
        ]
      },
      {
        heading: "Good reports explain what to do when no contact is found",
        body: [
          "A missing email should not mean a dead end. The next step might be vendor registration, procurement office research, program office routing, LinkedIn research, partner mapping, or a CRM task for manual follow-up.",
          "That is why Opportunity Scanner emphasizes contact paths, not just contact enrichment."
        ]
      }
    ],
    cta: "Run a scan to get contact paths and next actions for your public-sector opportunity signals."
  },
  {
    slug: "public-sector-sales-pipeline-without-govcon-team",
    title: "How to Build a Public-Sector Sales Pipeline Without a GovCon Team",
    description:
      "A practical path for companies that want to explore public-sector revenue before hiring a capture team.",
    category: "Public-Sector Sales",
    readTime: "7 min read",
    primaryKeyword: "public sector sales pipeline",
    funnelStage: "Decision",
    intro:
      "A company does not need to hire a full government contracting team before learning whether public-sector demand exists. A lightweight public-sector pipeline can start with signals, target accounts, contact paths, and disciplined next actions.",
    sections: [
      {
        heading: "Start with fit, not bureaucracy",
        body: [
          "The first question is whether public-sector buyers, recipients, programs, or partners show demand related to what your company already sells.",
          "A scan can reveal whether the channel deserves more time before the team invests in registrations, certifications, capture tools, or dedicated staff."
        ]
      },
      {
        heading: "Build rows your sales team can use",
        body: [
          "Each row should include the source, target organization, opportunity type, revenue motion, contact path, next action, and CRM-ready note.",
          "This turns public-sector research into a pipeline object instead of a long memo."
        ]
      },
      {
        heading: "Use workflows before native integrations",
        body: [
          "Early teams do not need a complex integration stack. A CSV, webhook, Zapier, Make, n8n, Airtable, Notion, Slack, or CRM-ready payload is enough to validate whether the workflow creates action.",
          "Native CRM integrations can come later once the opportunity-to-action loop is proven."
        ]
      }
    ],
    cta: "Start with a free scan and turn the best rows into a public-sector sales workflow."
  }
];

export const upcomingResourceIdeas = [
  "Healthcare Public-Sector Opportunities: VA, Medicaid, Rehab, DME, and Community Health Signals",
  "Creative Economy Funding: Arts Grants, City Events, Tourism, and Parks Opportunities",
  "Education and Workforce Opportunity Signals for EdTech, Training, and Staffing Companies",
  "Software and AI Public-Sector Demand: How to Spot Agency and Funded Buyer Signals"
];

export function getResourceArticle(slug: string): ResourceArticle | undefined {
  return resourceArticles.find((article) => article.slug === slug);
}

export function getIndustryPage(slug: string): IndustryPage | undefined {
  return industryPages.find((industry) => industry.slug === slug);
}
