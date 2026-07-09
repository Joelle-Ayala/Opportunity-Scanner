export type SampleReportRow = {
  priority: number;
  title: string;
  target: string;
  signalType: string;
  sourceName: string;
  sourceUrl: string;
  evidence: string;
  revenueMotion: string;
  revenuePotential: string;
  actionability: "High Actionability" | "Medium Actionability" | "Low Actionability";
  contactPath: string;
  nextAction: string;
  outreachAngle: string;
};

export type IndustrySampleReport = {
  industrySlug: string;
  exampleSlug: string;
  title: string;
  fictionalClient: string;
  clientDescription: string;
  summary: string;
  estimatedPipeline: string;
  totalSignals: number;
  paidUnlock: string;
  sourceMix: string[];
  rows: SampleReportRow[];
  outboundUse: string;
};

export const sampleReports: IndustrySampleReport[] = [
  {
    industrySlug: "healthcare-dme-medical-supply",
    exampleSlug: "healthcare-dme-opportunity-scan",
    title: "Sample Opportunity Scan: Healthcare, Rehab, DME, and Medical Supply",
    fictionalClient: "Northstar Rehab Supply",
    clientDescription:
      "Fictional supplier of rehab equipment, DME-adjacent products, patient support supplies, and distributor-ready clinical inventory.",
    summary:
      "The scan finds buyer and partner paths around VA purchasing, public care programs, community health funding, and funded provider networks. The best motion is not only applying for grants; it is selling into agencies, funded buyers, and source-backed care delivery organizations.",
    estimatedPipeline: "$750K-$2.8M in plausible sourced pipeline lanes",
    totalSignals: 18,
    paidUnlock: "Unlock source records, buyer/partner targets, procurement paths, source-native contacts, enrichment targets, and outreach drafts.",
    sourceMix: ["VA/NAC Federal Supply Schedule", "SAM.gov", "CMS Innovation Center", "USAspending"],
    rows: [
      {
        priority: 1,
        title: "VA purchasing path for rehab and clinical supply categories",
        target: "VA contracting and supply offices",
        signalType: "Procurement / recurring buyer signal",
        sourceName: "VA National Acquisition Center Federal Supply Schedule",
        sourceUrl: "https://www.va.gov/opal/nac/fss/",
        evidence:
          "VA maintains Federal Supply Schedule pathways for medical, pharmaceutical, and service categories, creating a vendor registration and category-fit route for suppliers.",
        revenueMotion: "Sell to Agency",
        revenuePotential: "$250K-$1.5M category pursuit",
        actionability: "High Actionability",
        contactPath: "Start with VA/NAC schedule category fit, then route to contracting office or vendor schedule path.",
        nextAction: "Map product categories to VA schedule language and prepare a vendor-path checklist.",
        outreachAngle:
          "Position the company as a rehab/DME supply partner that can support public care settings with reliable inventory and category-specific fulfillment."
      },
      {
        priority: 2,
        title: "CMS care model activity points to funded provider demand",
        target: "Provider networks and care delivery organizations",
        signalType: "Policy / reimbursement demand signal",
        sourceName: "CMS Innovation Center",
        sourceUrl: "https://www.cms.gov/priorities/innovation",
        evidence:
          "CMS model activity creates demand around care coordination, patient outcomes, home/community care, and provider implementation support.",
        revenueMotion: "Sell to Funded Buyer",
        revenuePotential: "$100K-$500K provider-network motion",
        actionability: "Medium Actionability",
        contactPath: "Identify participating providers or program operators, then enrich operations, procurement, or partnerships roles.",
        nextAction: "Build a target list of care organizations aligned to rehab, patient mobility, or home-care support.",
        outreachAngle:
          "Use public care model context as social proof that patient support and rehab operations remain funded priorities."
      },
      {
        priority: 3,
        title: "Active procurement watch for medical supply and DME language",
        target: "Federal, state, and local procurement offices",
        signalType: "Active opportunity / monitor",
        sourceName: "SAM.gov Contract Opportunities",
        sourceUrl: "https://sam.gov/content/opportunities",
        evidence:
          "SAM.gov is the official federal opportunity source for solicitations and notices; medical supply language can identify active or upcoming procurement routes.",
        revenueMotion: "Monitor Policy",
        revenuePotential: "$50K-$750K depending on solicitation",
        actionability: "Medium Actionability",
        contactPath: "Use source-native contracting office contacts when a matching solicitation appears.",
        nextAction: "Create a saved-search workflow for rehab, orthotic, prosthetic, mobility, and clinical supply terms.",
        outreachAngle:
          "Frame the company as a responsive supplier for smaller, practical procurement needs rather than a generic medical vendor."
      }
    ],
    outboundUse:
      "Use this example when prospecting healthcare suppliers, rehab vendors, DME companies, and clinical distributors that have never tested public-sector buyer paths."
  },
  {
    industrySlug: "education-workforce-training",
    exampleSlug: "education-workforce-opportunity-scan",
    title: "Sample Opportunity Scan: Education, Workforce, and Training",
    fictionalClient: "SkillBridge Learning Co.",
    clientDescription:
      "Fictional platform offering training programs, educator staffing support, credential pathways, and workforce partner operations.",
    summary:
      "The scan finds district, workforce board, state agency, and funded-recipient paths. The strongest actions are selling to funded program operators, partnering with grantees, and routing district opportunities to the right program or procurement owner.",
    estimatedPipeline: "$500K-$2.2M in education and workforce opportunity lanes",
    totalSignals: 21,
    paidUnlock: "Unlock district targets, workforce-board paths, source links, contact strategy, CRM notes, and first-touch drafts.",
    sourceMix: ["U.S. Department of Education", "DOL ETA Grants", "Grants.gov", "USAspending"],
    rows: [
      {
        priority: 1,
        title: "Education Innovation and Research creates partner and district paths",
        target: "Districts, education nonprofits, and grant-funded program operators",
        signalType: "Grant / funded buyer signal",
        sourceName: "U.S. Department of Education - Education Innovation and Research",
        sourceUrl:
          "https://oese.ed.gov/offices/office-of-discretionary-grants-support-services/innovation-early-learning/education-innovation-and-research-eir/",
        evidence:
          "Education innovation funding can create funded buyers and partners that need implementation, staffing, curriculum, training, or program operations support.",
        revenueMotion: "Sell to Funded Buyer",
        revenuePotential: "$100K-$750K program-support motion",
        actionability: "High Actionability",
        contactPath: "Identify funded recipient leadership, district program owner, or implementation partner path.",
        nextAction: "Build a target list of recent recipients and map them to training or staffing needs.",
        outreachAngle:
          "Reference the funded education outcome and offer a practical implementation layer rather than a generic edtech pitch."
      },
      {
        priority: 2,
        title: "Workforce grant programs create employer and provider targets",
        target: "Workforce boards, training providers, and employer coalitions",
        signalType: "Workforce funding signal",
        sourceName: "U.S. Department of Labor Employment and Training Administration Grants",
        sourceUrl: "https://www.dol.gov/agencies/eta/grants",
        evidence:
          "DOL grant programs fund workforce development, training, sector partnerships, and employment pathways that may need platforms, staffing, or implementation support.",
        revenueMotion: "Partner with Recipient",
        revenuePotential: "$75K-$500K partner motion",
        actionability: "High Actionability",
        contactPath: "Route to grant recipient, workforce board program director, employer partnership lead, or training provider.",
        nextAction: "Prioritize recipients whose funded objective matches the company's training or staffing offer.",
        outreachAngle:
          "Lead with the funded workforce goal and offer to help improve placement, training delivery, or program capacity."
      },
      {
        priority: 3,
        title: "District procurement watch for staffing and enrichment needs",
        target: "School districts and local education agencies",
        signalType: "Procurement / local buyer signal",
        sourceName: "SAM.gov Contract Opportunities",
        sourceUrl: "https://sam.gov/content/opportunities",
        evidence:
          "District and education-adjacent procurement language can surface staffing, enrichment, tutoring, professional development, and program support needs.",
        revenueMotion: "Sell to Agency",
        revenuePotential: "$50K-$400K district opportunity",
        actionability: "Medium Actionability",
        contactPath: "Route to procurement office, district program owner, HR/workforce owner, or source-native contact.",
        nextAction: "Create a monitor for school staffing, enrichment, training, and professional development terms.",
        outreachAngle:
          "Position around easing district capacity constraints with a sourced reason for why the district may need support now."
      }
    ],
    outboundUse:
      "Use this example for edtech, staffing, training, and workforce companies that need to see how public funding becomes account targeting."
  },
  {
    industrySlug: "arts-creative-economy-live-events",
    exampleSlug: "creative-economy-live-events-opportunity-scan",
    title: "Sample Opportunity Scan: Arts, Creative Economy, and Live Events",
    fictionalClient: "CivicStage Talent Network",
    clientDescription:
      "Fictional creative marketplace helping cities, schools, venues, and brands book artists, performers, teaching artists, and cultural programming.",
    summary:
      "The scan finds city programming, arts grants, tourism, parks, school arts, and funded cultural organizations. The strongest paths are selling to agencies, partnering with recipients, and building source-backed outreach to program owners.",
    estimatedPipeline: "$300K-$1.6M in public programming and partner lanes",
    totalSignals: 24,
    paidUnlock: "Unlock city/event targets, arts recipients, source links, contact roles, custom first-touch emails, and workflow export.",
    sourceMix: ["National Endowment for the Arts", "Grants.gov", "SAM.gov", "USAspending"],
    rows: [
      {
        priority: 1,
        title: "NEA grants indicate funded arts organizations and local programming demand",
        target: "Arts nonprofits, cultural organizations, and city arts partners",
        signalType: "Grant / funded recipient signal",
        sourceName: "National Endowment for the Arts - Grants for Arts Projects",
        sourceUrl: "https://www.arts.gov/grants/grants-for-arts-projects",
        evidence:
          "NEA funding supports arts projects and can identify organizations with public funding for performances, programming, education, and cultural access.",
        revenueMotion: "Partner with Recipient",
        revenuePotential: "$25K-$250K programming/partner motion",
        actionability: "High Actionability",
        contactPath: "Identify funded recipient leadership, programming director, education lead, or partnerships contact.",
        nextAction: "Build a recipient target list by discipline, geography, and likely need for performers or teaching artists.",
        outreachAngle:
          "Reference the public arts objective and offer a curated talent/programming layer to help execute the funded work."
      },
      {
        priority: 2,
        title: "City and parks programming creates direct buyer routes",
        target: "City cultural affairs, parks, recreation, and tourism offices",
        signalType: "Procurement / agency buyer signal",
        sourceName: "SAM.gov Contract Opportunities",
        sourceUrl: "https://sam.gov/content/opportunities",
        evidence:
          "Public agencies post opportunities for events, programming, performances, entertainment, community activation, and cultural services.",
        revenueMotion: "Sell to Agency",
        revenuePotential: "$10K-$150K per programming opportunity",
        actionability: "Medium Actionability",
        contactPath: "Route to events, cultural affairs, parks, tourism, procurement, or source-native contact.",
        nextAction: "Monitor city event, performance, cultural programming, parks, and tourism terms.",
        outreachAngle:
          "Pitch as a lower-friction way to source vetted performers and cultural programming for public events."
      },
      {
        priority: 3,
        title: "Arts education funding creates school and nonprofit partner paths",
        target: "Schools, arts education providers, and enrichment recipients",
        signalType: "Education / workforce signal",
        sourceName: "Grants.gov",
        sourceUrl: "https://www.grants.gov/search-grants",
        evidence:
          "Arts education and enrichment grants can create funded program operators that need teaching artists, curriculum support, and performance partners.",
        revenueMotion: "Sell to Funded Buyer",
        revenuePotential: "$25K-$300K enrichment lane",
        actionability: "Medium Actionability",
        contactPath: "Identify VAPA, enrichment, education, or program director; use enrichment status for private organizations.",
        nextAction: "Separate school direct-buyer paths from nonprofit partner paths before outreach.",
        outreachAngle:
          "Use the funded arts education goal as social proof and offer talent/programming capacity."
      }
    ],
    outboundUse:
      "Use this example for artist marketplaces, booking platforms, production companies, venues, and creative-economy organizations."
  },
  {
    industrySlug: "software-b2b-services-ai",
    exampleSlug: "software-ai-b2b-services-opportunity-scan",
    title: "Sample Opportunity Scan: Software, AI, and B2B Services",
    fictionalClient: "CivicOps AI",
    clientDescription:
      "Fictional B2B software company offering workflow automation, AI intake, document routing, analytics, and implementation support.",
    summary:
      "The scan finds agency modernization demand, prime/recipient partner paths, procurement language, and policy signals. The best early motion is often to sell to funded implementation partners or agencies with a specific operational problem.",
    estimatedPipeline: "$800K-$3.5M in modernization and partner lanes",
    totalSignals: 20,
    paidUnlock: "Unlock agency targets, partner targets, source links, procurement/contact paths, CRM notes, and custom outreach angles.",
    sourceMix: ["GSA Multiple Award Schedule", "SAM.gov", "NIST AI Risk Management Framework", "USAspending"],
    rows: [
      {
        priority: 1,
        title: "GSA schedule path for software and professional services buying",
        target: "Federal agency buyers and schedule-aligned partners",
        signalType: "Procurement channel signal",
        sourceName: "GSA Multiple Award Schedule",
        sourceUrl: "https://www.gsa.gov/buy-through-us/purchasing-programs/multiple-award-schedule",
        evidence:
          "The GSA Multiple Award Schedule is a major federal purchasing vehicle and can create a channel strategy for software, IT, consulting, and service vendors.",
        revenueMotion: "Channel / Distributor Motion",
        revenuePotential: "$250K-$2M channel pursuit",
        actionability: "High Actionability",
        contactPath: "Evaluate direct schedule path, reseller route, prime partner, or agency buyer path.",
        nextAction: "Map product categories to schedule language and identify likely schedule partners.",
        outreachAngle:
          "Frame the platform as a practical modernization layer that can be bought through existing public-sector channels."
      },
      {
        priority: 2,
        title: "Active software, data, and automation procurement watch",
        target: "Agency program, IT, and operations offices",
        signalType: "Active opportunity / monitor",
        sourceName: "SAM.gov Contract Opportunities",
        sourceUrl: "https://sam.gov/content/opportunities",
        evidence:
          "SAM.gov opportunities can reveal software, IT services, analytics, automation, intake, and digital modernization needs.",
        revenueMotion: "Sell to Agency",
        revenuePotential: "$100K-$1M+ depending on scope",
        actionability: "Medium Actionability",
        contactPath: "Use source-native contracting office, program office, or incumbent/prime research path.",
        nextAction: "Set monitors for workflow automation, case management, analytics, AI, document processing, and customer service terms.",
        outreachAngle:
          "Lead with operational burden, speed, and measurable process improvement instead of broad AI claims."
      },
      {
        priority: 3,
        title: "AI governance signals create consulting and implementation demand",
        target: "Agencies, primes, and regulated public-sector operators",
        signalType: "Policy / compliance signal",
        sourceName: "NIST AI Risk Management Framework",
        sourceUrl: "https://www.nist.gov/itl/ai-risk-management-framework",
        evidence:
          "AI governance and risk-management guidance creates demand for assessment, implementation, documentation, and operational controls.",
        revenueMotion: "Sell to Award Recipient",
        revenuePotential: "$75K-$500K services/implementation lane",
        actionability: "Medium Actionability",
        contactPath: "Target compliance, data, innovation, risk, or implementation leaders at agencies and contractors.",
        nextAction: "Create a partner list of primes and public-sector operators managing AI or automation programs.",
        outreachAngle:
          "Offer a concrete AI operations/risk package that helps teams move from policy intent to governed implementation."
      }
    ],
    outboundUse:
      "Use this example for SaaS, AI, automation, data, consulting, compliance, and B2B service companies exploring public-sector demand."
  },
  {
    industrySlug: "construction-infrastructure-engineering",
    exampleSlug: "construction-infrastructure-opportunity-scan",
    title: "Sample Opportunity Scan: Construction, Infrastructure, and Engineering",
    fictionalClient: "BridgeLine Civil Group",
    clientDescription:
      "Fictional civil engineering and specialty construction firm supporting roads, bridges, facilities, utilities, resilience, and project delivery.",
    summary:
      "The scan finds agency capital projects, BUILD/RAISE-style grant activity, prime contractor paths, and local public works demand. The highest-value motion is often a mix of direct agency pursuit and subcontractor/supplier targeting.",
    estimatedPipeline: "$1.2M-$6M in infrastructure pursuit lanes",
    totalSignals: 22,
    paidUnlock: "Unlock project targets, funded recipients, prime paths, contact strategy, procurement notes, and outreach drafts.",
    sourceMix: ["U.S. DOT BUILD Grants", "SAM.gov", "USAspending", "FHWA"],
    rows: [
      {
        priority: 1,
        title: "BUILD grants reveal surface transportation project sponsors",
        target: "Cities, counties, transit agencies, ports, and project sponsors",
        signalType: "Grant / project sponsor signal",
        sourceName: "U.S. DOT BUILD Grant Program",
        sourceUrl: "https://www.transportation.gov/BUILDgrants",
        evidence:
          "DOT states that BUILD provides grants for surface transportation infrastructure projects with significant local or regional impact.",
        revenueMotion: "Sell to Funded Buyer",
        revenuePotential: "$500K-$3M project support lane",
        actionability: "High Actionability",
        contactPath: "Route to project sponsor, public works, capital projects, procurement office, or prime contractor.",
        nextAction: "Identify recent awarded projects by geography and map likely engineering, inspection, specialty trade, or supplier needs.",
        outreachAngle:
          "Reference the funded project and offer specific execution capacity rather than general construction services."
      },
      {
        priority: 2,
        title: "Active public works and facilities procurement watch",
        target: "Local agency procurement and public works offices",
        signalType: "Active opportunity / procurement",
        sourceName: "SAM.gov Contract Opportunities",
        sourceUrl: "https://sam.gov/content/opportunities",
        evidence:
          "Public works, facilities, utilities, and infrastructure solicitations can create direct bid or subcontracting paths.",
        revenueMotion: "Sell to Agency",
        revenuePotential: "$250K-$2M depending on scope",
        actionability: "Medium Actionability",
        contactPath: "Use source-native contact, procurement office, plan-holder list, or prime/subcontractor route.",
        nextAction: "Monitor geography-specific terms for bridges, streets, facilities, utilities, resilience, and engineering services.",
        outreachAngle:
          "Lead with relevant project capability and availability to support constrained public works teams."
      },
      {
        priority: 3,
        title: "Awarded infrastructure projects create prime and supplier targets",
        target: "Prime contractors and award recipients",
        signalType: "Money already moved",
        sourceName: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/",
        evidence:
          "Federal spending records can identify agencies, recipients, and award patterns tied to infrastructure and construction categories.",
        revenueMotion: "Sell to Award Recipient",
        revenuePotential: "$100K-$1M subcontractor/supplier lane",
        actionability: "High Actionability",
        contactPath: "Enrich recipient company domain for estimating, supplier, project executive, or partnerships roles.",
        nextAction: "Build a list of awarded primes in target regions and create source-backed subcontracting outreach.",
        outreachAngle:
          "Use the award record as proof of project activity and position the firm as a delivery partner."
      }
    ],
    outboundUse:
      "Use this example for construction, engineering, specialty trades, infrastructure suppliers, and project-service firms."
  },
  {
    industrySlug: "clean-energy-facilities-sustainability",
    exampleSlug: "clean-energy-facilities-opportunity-scan",
    title: "Sample Opportunity Scan: Clean Energy, Facilities, and Sustainability",
    fictionalClient: "Gridwise Facilities",
    clientDescription:
      "Fictional company providing energy audits, facility upgrades, electrification planning, EV charging, and implementation support.",
    summary:
      "The scan finds funded buyers around school buses, facility modernization, energy-efficiency programs, and sustainability offices. The practical route is to sell to agencies and funded organizations that already have an upgrade mandate or funding signal.",
    estimatedPipeline: "$600K-$3M in facilities and energy lanes",
    totalSignals: 19,
    paidUnlock: "Unlock funded buyer lists, facility office routes, source links, contact paths, and first-touch emails.",
    sourceMix: ["EPA Clean School Bus", "DOE EECBG", "USDA REAP", "SAM.gov"],
    rows: [
      {
        priority: 1,
        title: "Clean School Bus funding creates district facility and fleet targets",
        target: "School districts, fleet operators, and implementation partners",
        signalType: "Program funding / funded buyer signal",
        sourceName: "EPA Clean School Bus Program",
        sourceUrl: "https://www.epa.gov/cleanschoolbus",
        evidence:
          "EPA states that the Infrastructure Investment and Jobs Act directed $5 billion over FY 2022-2026 for vehicle replacement projects.",
        revenueMotion: "Sell to Funded Buyer",
        revenuePotential: "$100K-$750K implementation support lane",
        actionability: "High Actionability",
        contactPath: "Route to transportation, facilities, sustainability, procurement, or funded awardee contact path.",
        nextAction: "Identify districts or operators with awards and map needs around charging, facilities, planning, or implementation.",
        outreachAngle:
          "Reference the public funding and offer practical support to turn fleet funding into facility-ready execution."
      },
      {
        priority: 2,
        title: "Energy block grants create municipal upgrade targets",
        target: "Cities, counties, tribes, and local governments",
        signalType: "Grant / agency buyer signal",
        sourceName: "DOE Energy Efficiency and Conservation Block Grant Program",
        sourceUrl: "https://www.energy.gov/scep/energy-efficiency-and-conservation-block-grant-program",
        evidence:
          "EECBG-style funding supports energy efficiency, conservation, and local government projects that can require audits, upgrades, planning, and vendor support.",
        revenueMotion: "Sell to Agency",
        revenuePotential: "$75K-$600K facilities upgrade lane",
        actionability: "Medium Actionability",
        contactPath: "Route to sustainability office, facilities department, energy manager, procurement office, or program lead.",
        nextAction: "Build a target list of local governments with energy or facilities initiatives.",
        outreachAngle:
          "Offer a scoped first step: audit, planning, grant implementation support, or facility upgrade roadmap."
      },
      {
        priority: 3,
        title: "Rural energy programs create small-business and agricultural targets",
        target: "Rural businesses, agricultural producers, and local installers",
        signalType: "Funding / partner signal",
        sourceName: "USDA Rural Energy for America Program",
        sourceUrl:
          "https://www.rd.usda.gov/programs-services/energy-programs/rural-energy-america-program-renewable-energy-systems-energy-efficiency-improvement-guaranteed-loans",
        evidence:
          "USDA REAP supports renewable energy systems and energy-efficiency improvements for rural small businesses and agricultural producers.",
        revenueMotion: "Partner with Recipient",
        revenuePotential: "$25K-$300K project support lane",
        actionability: "Medium Actionability",
        contactPath: "Identify funded recipients, rural development offices, local installers, or financing partners.",
        nextAction: "Create a rural target segment for audit, implementation, or project development support.",
        outreachAngle:
          "Position the company as a practical partner for funded energy upgrades, not just a vendor selling equipment."
      }
    ],
    outboundUse:
      "Use this example for energy services, facilities, sustainability consultants, EV charging, electrification, and climate-tech operators."
  },
  {
    industrySlug: "manufacturing-supply-chain-logistics",
    exampleSlug: "manufacturing-supply-chain-opportunity-scan",
    title: "Sample Opportunity Scan: Manufacturing, Supply Chain, and Logistics",
    fictionalClient: "ForgePath Industrial",
    clientDescription:
      "Fictional manufacturer and logistics partner offering industrial components, fulfillment support, training equipment, and supply-chain services.",
    summary:
      "The scan finds direct procurement, funded manufacturers, regional economic development programs, workforce funding, and prime/supplier routes. The product helps separate a direct bid from a funded-buyer or channel motion.",
    estimatedPipeline: "$700K-$3.2M in supplier and funded-buyer lanes",
    totalSignals: 17,
    paidUnlock: "Unlock agency buyers, award recipients, supplier targets, contact paths, CRM notes, and outreach drafts.",
    sourceMix: ["NIST MEP", "SAM.gov", "EDA", "USAspending"],
    rows: [
      {
        priority: 1,
        title: "Manufacturing assistance ecosystem points to funded company targets",
        target: "Manufacturers, MEP centers, and regional partners",
        signalType: "Economic development / partner signal",
        sourceName: "NIST Manufacturing Extension Partnership",
        sourceUrl: "https://www.nist.gov/mep",
        evidence:
          "NIST MEP is a national network focused on helping U.S. manufacturers improve productivity, technology, and competitiveness.",
        revenueMotion: "Partner with Recipient",
        revenuePotential: "$50K-$400K partner/supplier lane",
        actionability: "Medium Actionability",
        contactPath: "Route to MEP center, manufacturer operations leader, supplier development contact, or regional partner.",
        nextAction: "Identify MEP centers and manufacturing initiatives aligned to the company's capabilities.",
        outreachAngle:
          "Offer a source-backed way to support manufacturers with capacity, logistics, equipment, or operational improvements."
      },
      {
        priority: 2,
        title: "Federal procurement watch for goods, logistics, and industrial services",
        target: "Agency procurement offices and prime contractors",
        signalType: "Active opportunity / procurement",
        sourceName: "SAM.gov Contract Opportunities",
        sourceUrl: "https://sam.gov/content/opportunities",
        evidence:
          "SAM.gov can surface goods, equipment, materials, logistics, warehousing, repair, and industrial service opportunities.",
        revenueMotion: "Sell to Agency",
        revenuePotential: "$100K-$1.2M procurement lane",
        actionability: "High Actionability",
        contactPath: "Use source-native contracting contacts or prime/supplier route depending on solicitation shape.",
        nextAction: "Create saved searches for product category, NAICS terms, logistics keywords, and target geography.",
        outreachAngle:
          "Lead with supply reliability, response speed, and ability to support public-sector procurement requirements."
      },
      {
        priority: 3,
        title: "Regional development grants create funded buyer and workforce paths",
        target: "Economic development organizations, workforce partners, and funded manufacturers",
        signalType: "Grant / funded buyer signal",
        sourceName: "U.S. Economic Development Administration",
        sourceUrl: "https://www.eda.gov/funding/programs",
        evidence:
          "EDA funding programs support regional economic development, workforce, infrastructure, and industry capacity initiatives.",
        revenueMotion: "Sell to Funded Buyer",
        revenuePotential: "$75K-$600K funded recipient lane",
        actionability: "Medium Actionability",
        contactPath: "Identify funded recipient, operations lead, program director, or employer partnership owner.",
        nextAction: "Prioritize awards tied to manufacturing capacity, workforce, supply chain, logistics, or regional resilience.",
        outreachAngle:
          "Use the public award context to show why the recipient may need vendors or partners now."
      }
    ],
    outboundUse:
      "Use this example for manufacturers, suppliers, logistics companies, industrial services, and regional operators."
  },
  {
    industrySlug: "nonprofits-community-services-human-services",
    exampleSlug: "nonprofit-community-services-opportunity-scan",
    title: "Sample Opportunity Scan: Nonprofits, Community Services, and Human Services",
    fictionalClient: "CommunityBridge Services",
    clientDescription:
      "Fictional service provider supporting outreach, case management, workforce navigation, community programs, and partner operations.",
    summary:
      "The scan finds grant programs, funded nonprofits, agency program offices, and partner targets. The key is deciding whether to apply, partner with a recipient, sell services to a funded buyer, or monitor emerging policy and funding signals.",
    estimatedPipeline: "$350K-$1.8M in grant, partner, and service-delivery lanes",
    totalSignals: 23,
    paidUnlock: "Unlock funder paths, recipient targets, source-native contacts, partner notes, first-touch drafts, and CRM-ready exports.",
    sourceMix: ["HHS ACF CSBG", "HUD Continuum of Care", "Grants.gov", "SAM.gov"],
    rows: [
      {
        priority: 1,
        title: "Community services funding creates agency and provider targets",
        target: "Community action agencies and funded service providers",
        signalType: "Grant / funded recipient signal",
        sourceName: "HHS ACF Community Services Block Grant",
        sourceUrl: "https://www.acf.hhs.gov/ocs/programs/community-services-block-grant-csbg",
        evidence:
          "CSBG supports services that address poverty and community needs, which can create funded provider and partner paths.",
        revenueMotion: "Partner with Recipient",
        revenuePotential: "$50K-$350K program support lane",
        actionability: "High Actionability",
        contactPath: "Route to agency program director, nonprofit executive, grant manager, or community services lead.",
        nextAction: "Identify recipient organizations and map services, staffing, outreach, technology, or operations fit.",
        outreachAngle:
          "Reference the funded community-services mission and offer capacity that helps deliver measurable program outcomes."
      },
      {
        priority: 2,
        title: "Housing and homelessness funding creates service-delivery partner paths",
        target: "Continuums of Care, housing nonprofits, and local providers",
        signalType: "Grant / funded buyer signal",
        sourceName: "HUD Continuum of Care Program",
        sourceUrl: "https://www.hud.gov/program_offices/comm_planning/coc",
        evidence:
          "HUD's Continuum of Care program supports communitywide work to address homelessness and housing stability.",
        revenueMotion: "Sell to Funded Buyer",
        revenuePotential: "$75K-$500K service-delivery lane",
        actionability: "High Actionability",
        contactPath: "Identify CoC lead, funded provider, program director, data/HMIS contact, or partnerships lead.",
        nextAction: "Build a target list of CoC recipients where the company's service model fills an implementation gap.",
        outreachAngle:
          "Lead with the public funding objective and the operational pain of delivering services across partners."
      },
      {
        priority: 3,
        title: "Grant search reveals direct-apply and partner opportunities",
        target: "Eligible applicants, grantees, and program offices",
        signalType: "Active funding / direct apply",
        sourceName: "Grants.gov",
        sourceUrl: "https://www.grants.gov/search-grants",
        evidence:
          "Grants.gov publishes federal grant opportunities that may create direct application paths or future funded-recipient target lists.",
        revenueMotion: "Direct Apply",
        revenuePotential: "$50K-$1M depending on program",
        actionability: "Medium Actionability",
        contactPath: "Use source-native grant contact first; then identify partners or funded recipients as awards are made.",
        nextAction: "Screen eligibility before outreach; separate direct-apply grants from recipient/partner motions.",
        outreachAngle:
          "Treat grants as both funding opportunities and market signals that show which outcomes are being funded."
      }
    ],
    outboundUse:
      "Use this example for nonprofits, human services providers, case-management tools, workforce services, and community operators."
  }
];

export function getSampleReportByIndustry(industrySlug: string): IndustrySampleReport | undefined {
  return sampleReports.find((report) => report.industrySlug === industrySlug);
}

export function getSampleReportByExampleSlug(exampleSlug: string): IndustrySampleReport | undefined {
  return sampleReports.find((report) => report.exampleSlug === exampleSlug);
}
