export type FounderStorySection = {
  id: string;
  heading: string;
  paragraphs: readonly string[];
};

export type FounderStoryPrinciple = {
  title: string;
  description: string;
};

export type FounderStory = {
  identity: {
    id: string;
    schemaId: string;
    name: string;
    title: string;
    initials: string;
    aboutPath: string;
  };
  bios: {
    oneLine: string;
    short: string;
    medium: string;
    author: string;
  };
  homepage: {
    eyebrow: string;
    heading: string;
    body: string;
    attribution: string;
    ctaLabel: string;
    ctaPath: string;
  };
  about: {
    metadata: {
      title: string;
      description: string;
      canonicalPath: string;
      openGraphTitle: string;
      openGraphDescription: string;
    };
    hero: {
      eyebrow: string;
      heading: string;
      introduction: string;
    };
    sections: readonly FounderStorySection[];
    principles: readonly FounderStoryPrinciple[];
    closing: string;
    ctaLabel: string;
    ctaPath: string;
  };
  launchArticle: {
    status: "draft";
    slug: string;
    title: string;
    description: string;
    category: string;
    authorId: string;
    canonicalPath: string;
  };
};

export const founderStory = {
  identity: {
    id: "joelle-ayala",
    schemaId: "https://www.opportunityscanner.ai/#joelle-ayala",
    name: "Joelle Ayala",
    title: "Founder",
    initials: "JA",
    aboutPath: "/about"
  },
  bios: {
    oneLine:
      "Joelle Ayala is the founder of Opportunity Scanner, a product designed to turn fragmented public-sector signals into clearer business-development paths.",
    short:
      "Joelle Ayala founded Opportunity Scanner around a recurring research problem: public funding, procurement, policy, workforce, and reimbursement signals can matter to business growth, but the records are fragmented and the next step is often unclear.",
    medium:
      "Joelle Ayala is the founder of Opportunity Scanner. The product grew from a recurring business-development challenge: public systems can create or reveal demand, while the relevant records remain spread across specialized sources and disconnected from the language companies use. Opportunity Scanner is designed to translate that evidence into possible targets, revenue motions, contact paths, and practical next actions.",
    author:
      "Joelle Ayala is the founder of Opportunity Scanner, a product designed to connect sourced public-sector signals with practical business-development actions. Founder perspectives focus on public money flow, procurement, funding, policy-created demand, workforce signals, and the decisions that can turn external market evidence into a qualified opportunity path."
  },
  homepage: {
    eyebrow: "Why Opportunity Scanner exists",
    heading: "The signals were public. The path forward was not.",
    body:
      "Across healthcare, education, workforce, technology, and the creative economy, I kept seeing the same pattern: public funding, reimbursement, procurement, and policy shifts could create or reveal business demand, but the companies positioned to benefit often could not see the signals clearly or translate them into action. I built Opportunity Scanner to close that gap: understand a company, find the external signals that matter, and turn them into targets, revenue motions, contact paths, and next steps.",
    attribution: "Joelle Ayala, Founder",
    ctaLabel: "Read why Opportunity Scanner was built",
    ctaPath: "/about"
  },
  about: {
    metadata: {
      title: "Why Opportunity Scanner Exists | Opportunity Scanner",
      description:
        "Learn why Opportunity Scanner was built to translate fragmented public funding, procurement, policy, reimbursement, and workforce signals into clearer business opportunities.",
      canonicalPath: "/about",
      openGraphTitle: "The Signals Were Public. The Path Forward Was Not.",
      openGraphDescription:
        "The product story behind Opportunity Scanner and the effort to turn system-created demand into clearer business actions."
    },
    hero: {
      eyebrow: "Why Opportunity Scanner exists",
      heading: "Public opportunity research should lead to a practical next move.",
      introduction:
        "Opportunity Scanner starts with a company, looks for relevant public-sector signals, and organizes the strongest evidence around possible targets, revenue motions, contact paths, and next actions."
    },
    sections: [
      {
        id: "recurring-pattern",
        heading: "A recurring pattern across complicated markets",
        paragraphs: [
          "Public funding, procurement, reimbursement, workforce programs, institutional budgets, and policy changes can shape demand before that demand appears in a familiar sales channel. The useful signal may be an active notice, a funded organization, a spending pattern, a program expansion, or an early policy indicator.",
          "The same research challenge can appear across healthcare, education, workforce, technology, and the creative economy: evidence exists, but the commercial meaning is not always obvious."
        ]
      },
      {
        id: "translation-gap",
        heading: "Why another database or generic AI summary was not enough",
        paragraphs: [
          "Public records are organized for agencies, programs, analysts, and specialized processes. Companies usually begin with a different question: where could the current offer fit, and which path deserves attention?",
          "Finding a record is only part of the work. A useful interpretation may still need to distinguish an application from agency sales, funded-buyer outreach, recipient partnership, vendor registration, channel research, or monitoring. A generic summary can describe the record without resolving that operating decision."
        ]
      },
      {
        id: "product-response",
        heading: "A company-first translation and action layer",
        paragraphs: [
          "Opportunity Scanner is designed to begin with the company website and available business context. The product translates that context into relevant public-sector language, checks applicable sources, and connects qualified evidence to possible business-development actions.",
          "The intended result is not simply a longer research report. The result should help a team decide which signals merit diligence, which organizations may matter, which route fits the evidence, and what action could come next."
        ]
      },
      {
        id: "clear-boundaries",
        heading: "Useful guidance needs clear boundaries",
        paragraphs: [
          "Public data can be incomplete, delayed, or changed at the source. Historical spending can demonstrate funded-buyer evidence without representing a current solicitation. A relevant organization can be a research target without proving present buying intent.",
          "Opportunity Scanner is a research and workflow aid. Source review, eligibility checks, procurement instructions, and independent diligence remain part of any real pursuit."
        ]
      }
    ],
    principles: [
      {
        title: "Evidence before interpretation",
        description:
          "Material findings should remain connected to a public source so the underlying record can be reviewed."
      },
      {
        title: "Current opportunities and historical evidence stay distinct",
        description:
          "A live notice can support deadline language; a historical award can support market and funded-buyer research."
      },
      {
        title: "Actionability with honest limits",
        description:
          "A strong signal should suggest a useful decision or next step without implying access, eligibility, response, or revenue."
      }
    ],
    closing:
      "Opportunity Scanner is being built for companies that suspect public systems may be creating relevant demand but lack a clear way to connect fragmented evidence with a practical business-development path.",
    ctaLabel: "Run a Free Opportunity Scan",
    ctaPath: "/#scan"
  },
  launchArticle: {
    status: "draft",
    slug: "why-i-built-opportunity-scanner",
    title: "Why Opportunity Scanner Was Built: The Opportunities Were Public, but the Path Forward Was Not",
    description:
      "The product thesis behind Opportunity Scanner: translating fragmented public-sector evidence into clearer targets, revenue motions, contact paths, and next actions.",
    category: "Company",
    authorId: "joelle-ayala",
    canonicalPath: "/resources/why-i-built-opportunity-scanner"
  }
} as const satisfies FounderStory;
