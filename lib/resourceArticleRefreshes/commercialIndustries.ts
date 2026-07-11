import type { ResourceArticleRefresh } from "./types";

export const commercialIndustryArticleRefreshes = {
  "software-ai-public-sector-demand": {
    description:
      "A practical guide for turning official technology, acquisition, spending, and program records into qualified software and AI sales paths.",
    readTime: "8 min read",
    intro:
      "Public-sector software demand rarely arrives labeled with a commercial product category. An agency may describe a case backlog, cybersecurity requirement, data-sharing problem, acquisition forecast, or service-modernization goal instead. Software and AI companies need to translate those official signals into a specific buyer problem, then decide whether the realistic route is an agency sale, a prime partnership, a funded-recipient sale, an early market-research response, or monitoring. This guide shows how to build that evidence without treating every technology mention as an active opportunity.",
    keyTakeaways: [
      "Translate the product into mission workflows and operating problems before searching public records.",
      "Separate active procurement, acquisition planning, historical spending, policy, and funded-recipient evidence.",
      "For AI, evaluate data rights, security, testing, interoperability, and ongoing monitoring before calling a record a fit.",
      "Every qualified signal needs a target, revenue motion, contact path, and owned next action."
    ],
    sections: [
      {
        heading: "Start with the public-sector job, not the software label",
        body: [
          "A commercial category such as workflow automation, vertical SaaS, analytics, or generative AI may never appear in the record. Public buyers more often describe the job: reduce claims-processing time, secure endpoints, manage inspections, improve constituent access, detect improper payments, share data across programs, or replace a legacy system. Build search language from those jobs, the users doing them, and the records they handle.",
          "The federal acquisition system reinforces this problem-first approach. FAR Part 10 requires market research appropriate to the circumstances, including the availability of commercial products and services. A Sources Sought notice or request for information can therefore be evidence that an agency is learning what the market can provide. It is not automatically a solicitation, and a response is not an offer or an implied future award.",
          "Create a translation sheet before collecting records: capability, mission problem, likely office, data, integration boundary, security condition, and disqualifier. Reject requirements that depend on certifications, hosting, performance history, or integrations the company cannot support."
        ]
      },
      {
        heading: "Use five evidence lanes without mixing their meaning",
        body: [
          "SAM.gov contract opportunities are the active and pre-award lane. Preserve the notice type, status, response date, office, set-aside, NAICS code, attachments, place of performance, and official contact. A solicitation may support Sell to Agency. Sources Sought may support an early capability response. An award notice is historical evidence and may reveal an incumbent or partner, but it should not remain in an active-bid lane.",
          "USAspending.gov is the historical money-flow lane. Its contract and assistance records can identify agencies, recipients, award types, incumbents, and places of performance. Use that evidence to test whether a buyer has purchased adjacent technology or whether a funded organization may need implementation help. Do not claim that an old obligation is an available budget, an open requirement, or proof that the same buyer will purchase again.",
          "Agency procurement forecasts and business-opportunity pages are the planning lane. Acquisition.gov links to agency forecasts and vendor-communication resources. A forecast can justify Research Only, Monitor Policy, or early small-business-office research, but dates and acquisition strategies can change. Grants.gov and agency award announcements form a separate funded-program lane: first validate eligibility and status, then distinguish Direct Apply from selling to a future recipient."
        ]
      },
      {
        heading: "Treat AI acquisition as a lifecycle commitment",
        body: [
          "OMB Memorandum M-25-22 directs federal agencies to address requirements across the AI acquisition lifecycle, including performance and effectiveness, data ownership and portability, privacy, security, interoperability, vendor lock-in, ongoing testing, and monitoring. Those requirements turn broad AI enthusiasm into concrete qualification questions for a vendor.",
          "A strong fit statement should therefore name the workflow, authoritative source, user group, decision boundary, and control environment. It should explain what the system assists with, what remains under human authority, how performance can be evaluated, and how data can be exported or transferred. A generic claim that a model makes government more efficient does not establish acquisition fit.",
          "Security creates another route test. CISA's Secure by Design guidance places responsibility on technology manufacturers to make products secure by default and reduce avoidable customer burden. For a sales team, this means the action row should surface the relevant deployment model, identity controls, logging, vulnerability process, data handling, and known compliance gaps before outreach advances."
        ]
      },
      {
        heading: "Choose the revenue motion from the record",
        body: [
          "Use Sell to Agency when an agency or public entity has a credible buying route and the company can perform. Use Channel / Distributor Motion when a contract vehicle holder, reseller, systems integrator, or prime is the practical route. Use Sell to Funded Buyer when an official award identifies a recipient with a plausible implementation need. Use Monitor Policy when guidance or regulation may change demand but no buyer or funded target is yet supported.",
          "Direct Apply is comparatively narrow for commercial software companies. A grant search result is not enough; the notice's eligibility section and application instructions control. When a company is ineligible, preserve the program as context only if there is a credible downstream route to a named recipient after awards are announced. Never label a prospective applicant as funded.",
          "The contact path follows the motion. Active procurements route through the notice contact and contracting office. Forecasts may route to the listed acquisition office, vendor-engagement event, or small-business office after research. Prime and recipient paths may justify role-based account research and selective enrichment. Policy records usually create a monitoring owner and review date, not a cold-email task."
        ]
      },
      {
        heading: "Build a software opportunity action row",
        body: [
          "A useful row records the official source and retrieval date; notice or award status; target organization and office; mission problem; product-to-workflow fit; revenue motion; security, data, integration, and eligibility conditions; contact route; owner; next action; and disqualifier. Keep evidence in the row so a seller does not have to reconstruct the research before acting.",
          "An illustrative example: a Sources Sought notice asks about commercial tools for reviewing a defined document type. The row is not 'AI contract.' It is an early Sell to Agency research signal. The target is the issuing office, the contact path is the official response route, and the next action is to review attachments against supported formats, accuracy evaluation, hosting, security, and timeline. No response, meeting, solicitation, or award is assumed.",
          "Another illustrative example: USAspending shows repeated modernization awards to a systems integrator at a relevant agency. The row may become Channel / Distributor Motion or Research Only. The next action is to verify current vehicles, active forecasts, incumbent scope, and a specific complementary capability before partner outreach. Historical awards support market mapping; they do not prove that the prime is seeking a vendor."
        ]
      },
      {
        heading: "Run a focused 30-day software market test",
        body: [
          "In week one, select two existing offers and translate them into mission workflows, user roles, agency language, likely NAICS and product-service codes, security boundaries, and exclusions. Define what evidence would justify continuing. In week two, collect a small set across SAM.gov, USAspending, forecasts, and relevant program or policy sources while keeping each lane labeled.",
          "In week three, reject expired timing, generic AI mentions, unsupported deployment requirements, failed eligibility, and records without a credible target or acquisition route. Give each retained row one motion and one action.",
          "In week four, invest further when a workflow problem repeats across official records, the company can meet likely controls, and owners can execute the routes. Narrow or pause when evidence depends on weak keywords, inaccessible data, unrealistic integration, or an unsupported procurement path."
        ]
      },
      {
        heading: "Avoid the signals that create false pipeline",
        body: [
          "Do not count a technology strategy as a purchase, an RFI as a solicitation, an award as available budget, a grant applicant as a recipient, or a policy announcement as a buyer. Do not infer a personal contact when an official contracting route controls communication."
        ]
      }
    ],
    practicalList: {
      title: "Software and AI signal qualification checklist",
      items: [
        "Name the mission workflow and user problem, not only the software category.",
        "Label the record as active procurement, planning, historical spending, funded program, or policy evidence.",
        "Preserve notice type, status, dates, office, attachments, and official contact.",
        "Check data rights, portability, privacy, security, testing, interoperability, and lock-in conditions.",
        "Verify eligibility before using Direct Apply.",
        "Choose one allowed revenue motion and one credible target.",
        "Route agency communication through official source and procurement paths.",
        "Reject generic AI mentions and requirements outside the company's operating capacity.",
        "Assign an owner, next action, review date, and explicit disqualifier.",
        "Keep historical awards and forecasts out of the active-opportunity count."
      ]
    },
    proofPoints: [
      {
        stat: "FAR Part 10 requires acquisition teams to conduct market research appropriate to the circumstances and consider commercial products and services.",
        source: "Acquisition.gov - FAR Part 10",
        url: "https://www.acquisition.gov/far/part-10"
      },
      {
        stat: "OMB's federal AI acquisition memorandum addresses performance, data rights, privacy, security, interoperability, lock-in, testing, and monitoring across the acquisition lifecycle.",
        source: "Office of Management and Budget - Memorandum M-25-22",
        url: "https://www.whitehouse.gov/wp-content/uploads/2025/02/M-25-22-Driving-Efficient-Acquisition-of-Artificial-Intelligence-in-Government.pdf"
      },
      {
        stat: "CISA's Secure by Design guidance asks technology manufacturers to make products secure by default and take greater ownership of customer security outcomes.",
        source: "Cybersecurity and Infrastructure Security Agency - Secure by Design",
        url: "https://www.cisa.gov/securebydesign"
      },
      {
        stat: "SAM.gov distinguishes multiple contract-opportunity notice types, so the notice itself determines whether the record is pre-solicitation, market research, solicitation, award, or another action.",
        source: "GSA Open Technology - Contract Opportunities API",
        url: "https://open.gsa.gov/api/opportunities-api/"
      },
      {
        stat: "USAspending is the official source for federal spending data and includes contracts, grants, loans, and other financial assistance.",
        source: "USAspending.gov - About the data",
        url: "https://www.usaspending.gov/about"
      },
      {
        stat: "Acquisition.gov maintains links to agency procurement forecasts, business-opportunity pages, small-business offices, and vendor communication plans.",
        source: "Acquisition.gov - Procurement forecasts",
        url: "https://www.acquisition.gov/procurement-forecasts"
      }
    ],
    chartAssets: [
      {
        title: "Software and AI evidence-to-action map",
        chartType: "flow",
        takeaway: "The same technology capability can create different actions depending on whether the evidence is a notice, award, forecast, funded program, or policy record.",
        source: "Illustrative Opportunity Scanner framework based on FAR Part 10, SAM.gov, USAspending.gov, Grants.gov, and OMB M-25-22",
        altText: "Illustrative flow showing software and AI public records moving through fit and risk checks into agency, partner, funded-buyer, or monitoring actions",
        status: "published",
        image: {
          src: "/resources/commercial-industries/software-ai-public-sector-demand/evidence-to-action.svg",
          width: 1200,
          height: 675,
          caption: "Illustrative framework; it does not show measured demand or conversion results."
        }
      }
    ],
    sourceNote: {
      text: "Official technology and acquisition records support qualification; they do not guarantee buyer intent, eligibility, compliance approval, access, or an award.",
      source: "Acquisition.gov - FAR Part 10",
      url: "https://www.acquisition.gov/far/part-10"
    },
    cta: "Run a free scan to turn your software or AI capabilities and official public records into qualified targets, revenue motions, contact paths, and next actions."
  },

  "infrastructure-opportunities-for-construction-companies": {
    description:
      "A source-backed workflow for finding infrastructure projects, public owners, funded recipients, primes, subcontracting routes, and supplier demand.",
    readTime: "7 min read",
    intro:
      "Infrastructure opportunity intelligence is a timing problem as much as a search problem. A project can move from authorization to grant selection, obligation, design, environmental review, procurement, construction, and closeout, with different buyers and partners at each stage. Construction, engineering, specialty-trade, materials, inspection, and equipment companies need to identify the current stage, the organization that controls the next purchase, and the route they can realistically pursue. A capital plan or historical award is useful evidence, but it is not automatically an open bid.",
    keyTakeaways: [
      "Track project stage, funding status, public owner, delivery model, and procurement route separately.",
      "A grant recipient can become a buyer target only after the recipient and implementation need are verified.",
      "Large projects may create prime, subcontractor, supplier, professional-service, and monitoring motions at different times.",
      "Preserve official project and procurement links so every row can be revalidated before action."
    ],
    sections: [
      {
        heading: "Read the funding stage before calling it pipeline",
        body: [
          "Infrastructure announcements use terms that sound interchangeable but are not. Enacted authority, available funding, announced selections, obligations, and outlays describe different stages. DOT's IIJA funding-status page explains that grant agreements can obligate funds in phases such as design, pre-construction, and construction. A selection can reveal a future public owner or recipient, while an obligation can strengthen the evidence that implementation is moving. Neither replaces the recipient's procurement process.",
          "Build each row around stage and date. Record the program, project, recipient, location, announced amount when official, obligation status when available, project phase, delivery context, and source date. Then find the local capital page, board record, project website, vendor portal, or solicitation that controls the next commercial action.",
          "Do not turn every infrastructure dollar into contractor revenue. Funds can support planning, right-of-way, administration, vehicles, equipment, professional services, or construction, and project scopes change. The source must support the need your company can fulfill."
        ]
      },
      {
        heading: "Search across owner, procurement, and award evidence",
        body: [
          "SAM.gov captures federal contract opportunities and some federally managed work. State departments of transportation, cities, counties, transit agencies, utilities, airports, ports, school districts, and public authorities often procure through their own portals. The practical search set therefore combines federal notices with official owner procurement pages and capital plans.",
          "USAspending can show prior federal contracts and financial-assistance recipients. Use it to map agencies, primes, recipients, award descriptions, and places of performance. Keep historical awards in a market-evidence lane until a current forecast, project page, recipient procurement, or active notice supports a live action.",
          "DOT's Build America project and funding resources can reveal programs, eligible public entities, selected recipients, and project-development activity. An award to a city or authority may create future professional-service or construction demand, but the next action is to locate the official recipient implementation record, not to contact the grant program as though it were the construction buyer."
        ]
      },
      {
        heading: "Choose the route: prime, subcontractor, supplier, or adviser",
        body: [
          "Sell to Agency fits a company capable of pursuing the public owner's procurement. Channel / Distributor Motion fits material suppliers, equipment vendors, specialty trades, and service firms whose practical customer is a prime, construction manager, concessionaire, or contract-vehicle holder. Partner with Recipient can fit design, planning, community-engagement, or technical partners when the recipient controls a documented partner process.",
          "Small-business subcontracting plans can create a formal route on qualifying federal contracts. SBA explains that certain large prime contracts require plans describing how small businesses will be used, and its SUBNet resource can list subcontracting opportunities. Treat this as a research path, not evidence that any prime must select a particular supplier.",
          "Match the contact path to the stage: contracting office for a solicitation; public works, capital delivery, facilities, or procurement for owner research; prime supplier-diversity or subcontracting office for a validated prime route; and the recipient's project or procurement office after a grant selection. Avoid generic outreach to elected officials when an official process governs the purchase."
        ]
      },
      {
        heading: "Qualify capacity and compliance before pursuit",
        body: [
          "A relevant project can still be a poor fit. Check geography, bonding, insurance, licensing, safety record, labor requirements, schedule, equipment, workforce, past performance, delivery method, and capacity. Federal financial assistance may also carry domestic-preference requirements. The Build America, Buy America framework applies to covered infrastructure projects and can affect iron, steel, manufactured products, and construction materials.",
          "The action table should state which conditions are confirmed, unknown, or disqualifying. Do not imply certification, small-business status, bonding capacity, or domestic-content compliance that has not been verified. If a company can perform only a defined package, describe that package precisely rather than claiming general project fit.",
          "Timing is equally important. A project in planning may justify monitoring or relationship research. A bid due in days may be unrealistic for a new entrant. A recent award to a prime may justify supplier research if scope and onboarding routes are public. Qualification should produce an honest next step, including 'do not pursue.'"
        ]
      },
      {
        heading: "Build the infrastructure action row",
        body: [
          "Record source, retrieval date, project and program, public owner or recipient, location, funding and project stage, scope evidence, likely package, delivery model when known, procurement portal, revenue motion, contact route, next action, owner, due date, and disqualifier. Link the money-flow source and the source that controls procurement when they are different.",
          "Illustrative example: DOT announces a planning grant to a transit authority. That is not a construction bid. The row is Research Only or Monitor Policy, the target is the authority, and the next action is to follow its board, capital-program, consultant-procurement, and project pages for a supported planning or design requirement. No procurement or award outcome is assumed.",
          "Illustrative example: an official owner portal posts a solicitation for a bridge rehabilitation package. A qualified contractor may use Sell to Agency; a specialty coatings supplier may use Channel / Distributor Motion and research plan holders or the eventual prime. The same project produces different targets and contact paths because the companies occupy different delivery roles."
        ]
      },
      {
        heading: "Run a weekly infrastructure signal review",
        body: [
          "Start with a narrow geography, asset class, and service package. Review official capital plans and project pages for demand forming, funding selections and obligations for recipient evidence, owner portals for active procurement, and award records for primes and incumbents. Keep those lanes separate in the table.",
          "At each review, recheck status and dates, attach new procurement evidence, and advance only rows with a credible commercial route. Assign monitoring dates to early projects instead of leaving them in active pipeline. Remove stale records when the project, funding, geography, package, or capacity no longer fits.",
          "Opportunity Scanner can organize sources into an action table, but it does not establish contractor responsibility, licensing, funding availability, bid responsiveness, or award probability. Those decisions remain with the official owner and procurement documents."
        ]
      }
    ],
    practicalList: {
      title: "Infrastructure opportunity qualification checklist",
      items: [
        "Identify the official owner, recipient, project, location, and asset class.",
        "Label funding as announced, obligated, outlaid, or unknown using the source's terminology.",
        "Confirm the current project phase and the scope your company could perform.",
        "Find the owner or recipient procurement page that controls commercial action.",
        "Choose Sell to Agency, Channel / Distributor Motion, Partner with Recipient, Monitor Policy, or Research Only.",
        "Check licensing, bonding, insurance, labor, domestic-preference, schedule, and capacity conditions.",
        "Use official contracting, project, procurement, or prime-subcontracting routes.",
        "Assign one owner, next action, due date or monitoring date, and disqualifier.",
        "Keep capital plans, awards, and funding selections out of the active-bid count until procurement evidence exists."
      ]
    },
    proofPoints: [
      {
        stat: "DOT distinguishes enacted funding, available funding, announced grants, obligations, and outlays, and notes that grant agreements may obligate work in phases.",
        source: "U.S. Department of Transportation - IIJA Funding Status",
        url: "https://www.transportation.gov/mission/budget/infrastructure-investment-and-jobs-act-iija-funding-status"
      },
      {
        stat: "USAspending provides official award and recipient evidence, but award records must be interpreted using the platform's spending definitions and disclosures.",
        source: "USAspending.gov - Federal Spending Guide",
        url: "https://www.usaspending.gov/federal-spending-guide"
      },
      {
        stat: "Build America Bureau programs identify eligible public entities, selected recipients, and project-development or financing activity that can precede downstream procurement.",
        source: "U.S. DOT Build America Bureau - Programs",
        url: "https://www.transportation.gov/buildamerica/financing/programs"
      },
      {
        stat: "SBA explains that certain large prime contracts require subcontracting plans and provides resources for researching subcontracting opportunities.",
        source: "U.S. Small Business Administration - Subcontracting",
        url: "https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting"
      },
      {
        stat: "Build America, Buy America establishes domestic-preference requirements for covered infrastructure projects receiving federal financial assistance.",
        source: "Made in America - Build America, Buy America",
        url: "https://www.madeinamerica.gov/resources/financial-assistance/"
      },
      {
        stat: "SAM.gov contract opportunities include notices with official dates, offices, attachments, and response instructions that control federal bid actions.",
        source: "SAM.gov - Contract opportunities",
        url: "https://sam.gov/opportunities"
      }
    ],
    chartAssets: [
      {
        title: "Infrastructure stage-to-revenue-motion map",
        chartType: "flow",
        takeaway: "Project planning, funding, procurement, and award stages create different targets; only procurement evidence belongs in an active bid lane.",
        source: "Illustrative Opportunity Scanner framework based on DOT funding-stage definitions, SAM.gov, USAspending.gov, and recipient procurement paths",
        altText: "Illustrative flow showing infrastructure planning, funding, procurement, and award evidence leading to owner, prime, supplier, or monitoring actions",
        status: "published",
        image: {
          src: "/resources/commercial-industries/infrastructure-opportunities-for-construction-companies/stage-to-motion.svg",
          width: 1200,
          height: 675,
          caption: "Illustrative framework; stages and procurement routes vary by project and owner."
        }
      }
    ],
    sourceNote: {
      text: "Funding, capital-plan, and award records are context until an official owner or recipient procurement route supports action.",
      source: "U.S. Department of Transportation - IIJA Funding Status",
      url: "https://www.transportation.gov/mission/budget/infrastructure-investment-and-jobs-act-iija-funding-status"
    },
    cta: "Run a free scan to map your construction, engineering, trade, material, or equipment capabilities to source-backed infrastructure action rows."
  },

  "clean-energy-public-sector-opportunities": {
    description:
      "How clean-energy and facilities companies can distinguish grants, rebates, procurement, policy, funded buyers, and implementation routes.",
    readTime: "7 min read",
    intro:
      "Clean-energy demand is distributed across agencies, states, Tribes, utilities, schools, housing organizations, public facilities, manufacturers, and community programs. The source may be a procurement, grant, rebate, tax-credit mechanism, loan, rule, award, or facilities plan. Those records do not create the same commercial action. A credible pipeline identifies who controls implementation, whether the company can apply or must sell or partner, and what official step can move the opportunity forward.",
    keyTakeaways: [
      "Label the mechanism and status before assigning a revenue motion.",
      "State, Tribal, utility, and recipient implementation pages often matter more than the original federal announcement.",
      "Policy and program context should create monitoring tasks until a buyer, recipient, or procurement route is verified.",
      "Qualification must include installation, workforce, consumer-protection, domestic-content, and program-specific conditions."
    ],
    sections: [
      {
        heading: "Separate the mechanisms that move clean-energy money",
        body: [
          "DOE's infrastructure funding resources distinguish grants, cooperative agreements, rebates, tax credits, loans, prizes, notices of intent, requests for information, and selections. Start every row with the mechanism and status. An open funding opportunity may support Direct Apply for an eligible entity. A state rebate program may create contractor or equipment demand. A selection may identify a recipient. A closed notice remains context, not current pipeline.",
          "Elective pay is another distinct mechanism. DOE explains that certain tax-exempt and governmental entities can receive payments for qualifying clean-energy tax credits when they meet the underlying requirements. That can make public entities, public utilities, schools, universities, hospitals, and Tribes useful project-research targets, but eligibility for a tax mechanism is not evidence that a specific project or procurement exists.",
          "Keep the original federal source and the implementation source together. A federal program page explains authority and broad conditions; a state energy office, utility, public owner, recipient, or procurement portal may control current availability, contractor participation, project timing, and purchasing."
        ]
      },
      {
        heading: "Turn program evidence into the correct target",
        body: [
          "Direct Apply fits only when the company is an eligible applicant and the official notice supports its project. Sell to Agency fits a public facilities or procurement route. Sell to Funded Buyer fits a verified recipient that plausibly needs equipment, software, engineering, installation, measurement, workforce, or compliance support. Partner with Recipient fits a complementary role supported by the program and recipient process.",
          "Channel / Distributor Motion can fit manufacturers, distributors, installers, energy-service companies, and engineering partners when another entity holds the customer relationship or contract. Monitor Policy fits building rules, program guidance, rate cases, rebate design, or standards that may shape demand but do not yet identify a purchase.",
          "An illustrative example: a state is officially funded to administer rebates. The source identifies a future implementation ecosystem, not a sale to every household or agency in the state. A software vendor might monitor program administration procurements; a contractor might follow the state's approved-contractor process; an equipment supplier might research eligible-product and distributor rules. No enrollment, sale, or award is assumed."
        ]
      },
      {
        heading: "Find demand at facilities and funded organizations",
        body: [
          "Public buildings, schools, housing authorities, water systems, transit facilities, and community organizations can become buyers when capital plans, awards, audits, resilience plans, or procurements identify a supported need. Search official facilities plans and procurement pages alongside DOE, EPA, Grants.gov, and USAspending records.",
          "EPA's current Greenhouse Gas Reduction Fund page says the program's statutory authority was repealed, remaining funds were rescinded, and previously announced implementation was terminated. That makes older program and award records historical context, not an active source of buyer demand. This is exactly why policy and program status must be rechecked before outreach.",
          "USAspending can add historical award and recipient evidence. Use it to understand which agencies and organizations have received relevant assistance or contracts, while keeping obligations separate from current budgets and active opportunities. The implementation source must still support the next action."
        ]
      },
      {
        heading: "Qualify implementation, not just technology fit",
        body: [
          "A clean-energy solution can match a program theme and still fail operationally. Check geography, eligible buildings or customers, approved measures, licensing, contractor enrollment, wage and labor conditions, domestic-content rules, measurement requirements, consumer protections, data access, interconnection, and project schedule.",
          "DOE's Home Energy Rebates resources make implementation responsibility visible: states, territories, and Tribes manage programs, and program requirements address consumer protection and quality installation. The useful commercial question is not simply whether rebates exist. It is which jurisdiction is operating, what participation rules apply, and which buyer or channel controls the work.",
          "Policy status must also be current. Rules can be stayed, revised, litigated, or superseded. Preserve the publication and effective dates, official status page, and next review date. Use Monitor Policy when the commercial impact depends on future implementation rather than presenting the rule as guaranteed demand."
        ]
      },
      {
        heading: "Build the clean-energy action row",
        body: [
          "Record the official source, retrieval date, mechanism, status, program administrator, applicant or recipient, geography, technology or facility scope, implementation conditions, target, revenue motion, contact path, next action, owner, timing, and disqualifier. Include both the program source and the local implementation or procurement source when available.",
          "Illustrative example: a housing authority publishes an energy-upgrade procurement tied to a supported capital program. An engineering firm may use Sell to Agency; an equipment maker may use Channel / Distributor Motion through bidders or the selected implementer. The contact route is the authority's official procurement process, and the next action is to review scope, schedule, standards, and submission instructions.",
          "Illustrative example: a DOE page lists a closed funding opportunity and later selections. The closed notice is not active. The selected-recipient record may create Sell to Funded Buyer research only after the recipient's project, role, geography, and vendor need are verified through current official material."
        ]
      },
      {
        heading: "Operate a clean-energy monitoring cadence",
        body: [
          "Choose a narrow offer and geography. Monitor federal program and award pages for context, state and Tribal implementation pages for current rules, public-owner and utility portals for procurement or enrollment, USAspending for recipient evidence, and Federal Register pages for policy status. Label every source lane.",
          "Promote a row only when the mechanism is current, the target is verified, the company can meet conditions, and one official next action exists. Set review dates for announced or policy-stage signals. Remove closed, superseded, out-of-geography, or operationally impossible records instead of leaving them in active pipeline.",
          "Opportunity Scanner can connect the evidence to a revenue motion and contact path. It does not guarantee program continuity, eligibility, rebate availability, approved-contractor status, procurement, project economics, or an award."
        ]
      }
    ],
    practicalList: {
      title: "Clean-energy signal qualification checklist",
      items: [
        "Name the mechanism: procurement, grant, cooperative agreement, rebate, credit, loan, award, policy, or planning record.",
        "Confirm current status, dates, administrator, geography, and eligible entities.",
        "Find the state, Tribal, utility, recipient, or public-owner implementation source.",
        "Choose Direct Apply, Sell to Agency, Sell to Funded Buyer, Partner with Recipient, Channel / Distributor Motion, Monitor Policy, or Research Only.",
        "Check approved measures, installation rules, licensing, labor, domestic-content, data, and consumer-protection conditions.",
        "Preserve official program and procurement or enrollment links.",
        "Assign one target, contact route, owner, next action, and review date.",
        "Reject closed, superseded, unsupported, or geographically irrelevant records.",
        "Keep policy, awards, and program context out of the active-opportunity count until implementation evidence exists."
      ]
    },
    proofPoints: [
      {
        stat: "DOE's funding resources distinguish grants, cooperative agreements, tax credits, rebates, due dates, selections, and program status.",
        source: "U.S. Department of Energy - Funding",
        url: "https://www.energy.gov/mesc/funding"
      },
      {
        stat: "DOE explains that eligible tax-exempt and governmental entities may use elective pay for qualifying clean-energy tax credits when underlying requirements are met.",
        source: "U.S. Department of Energy - Elective Pay",
        url: "https://www.energy.gov/elective-pay"
      },
      {
        stat: "Home Energy Rebates are administered through states, territories, and Tribes, making jurisdiction-specific implementation pages essential to current qualification.",
        source: "U.S. Department of Energy - Home Energy Rebates",
        url: "https://www.energy.gov/save/rebates"
      },
      {
        stat: "EPA's current Greenhouse Gas Reduction Fund page says the program's authority was repealed and remaining funds rescinded, so older program and award records should be treated as historical context rather than active demand.",
        source: "U.S. Environmental Protection Agency - Greenhouse Gas Reduction Fund",
        url: "https://www.epa.gov/greenhouse-gas-reduction-fund"
      },
      {
        stat: "Federal clean-energy requirements and implementation dates can change, so official rule and status pages must be checked before assigning a policy-driven action.",
        source: "U.S. Department of Energy - Federal Building Energy Efficiency Rules",
        url: "https://www.energy.gov/cmei/femp/federal-building-energy-efficiency-rules-and-requirements"
      },
      {
        stat: "Grants.gov distinguishes forecasted, posted, closed, and archived opportunities, and the official notice controls eligibility.",
        source: "Grants.gov - Search Grants",
        url: "https://www.grants.gov/help/search-grants/search-grants-tab"
      }
    ],
    chartAssets: [
      {
        title: "Clean-energy mechanism-to-action map",
        chartType: "flow",
        takeaway: "A grant, rebate, procurement, award, and policy record require different targets and cannot share one generic sales action.",
        source: "Illustrative Opportunity Scanner framework based on DOE, EPA, Grants.gov, USAspending.gov, and public-owner implementation sources",
        altText: "Illustrative flow showing clean-energy procurements, programs, rebates, awards, and policies leading to direct, funded-buyer, channel, or monitoring actions",
        status: "published",
        image: {
          src: "/resources/commercial-industries/clean-energy-public-sector-opportunities/mechanism-to-action.svg",
          width: 1200,
          height: 675,
          caption: "Illustrative framework; program availability and implementation rules vary by jurisdiction and date."
        }
      }
    ],
    sourceNote: {
      text: "Program pages provide context; current administrator, recipient, procurement, enrollment, and policy sources control the actionable route.",
      source: "U.S. Department of Energy - Funding",
      url: "https://www.energy.gov/mesc/funding"
    },
    cta: "Run a free scan to turn your clean-energy, facilities, or sustainability offer into qualified program, buyer, channel, and monitoring actions."
  },

  "manufacturing-supply-chain-public-sector-demand": {
    description:
      "A practical source-to-action guide for manufacturers, suppliers, logistics providers, and industrial service companies pursuing public-sector demand.",
    readTime: "7 min read",
    intro:
      "Public-sector manufacturing demand extends beyond an agency buying a finished product. It can flow through prime contractors, domestic supply-chain initiatives, Manufacturing Extension Partnership centers, economic-development recipients, workforce intermediaries, transportation and emergency programs, and facilities operators. The challenge is deciding whether a record supports a current agency sale, a supplier route, a funded-buyer target, a technical-assistance relationship, or only market context.",
    keyTakeaways: [
      "Map the product, process, capacity, certifications, geography, and industrial codes before searching.",
      "Use active notices for procurement, award data for market evidence, and program records for recipient or partner research.",
      "Prime and supplier routes require scope, onboarding, quality, cybersecurity, and domestic-source qualification.",
      "Workforce and economic-development funding should identify verified intermediaries and recipients, not be counted as manufacturing purchase orders."
    ],
    sections: [
      {
        heading: "Define the industrial capability precisely",
        body: [
          "Manufacturing searches become noisy when the company is described only as a manufacturer. Record the finished products, components, materials, processes, tolerances, equipment, certifications, production capacity, minimum runs, lead times, logistics radius, quality systems, and restricted markets. Map likely NAICS and product-service codes, but verify them against actual work rather than choosing broad labels for visibility.",
          "The same capability can fit several targets. An agency may buy the item directly. A prime may need a qualified supplier. A grant recipient may need production equipment or technical services. An MEP Center may provide assistance or convene manufacturers rather than purchase the company's output. Each target requires a separate evidence and contact path.",
          "Build disqualifiers early: prohibited materials, unsupported tolerances, insufficient capacity, unavailable certifications, cybersecurity requirements, domestic-source conditions, unrealistic delivery, or geography. A smaller, technically accurate search produces more usable pipeline than a large set of adjacent keywords."
        ]
      },
      {
        heading: "Combine procurement and historical buyer evidence",
        body: [
          "SAM.gov is the primary federal notice lane. Preserve notice type, product or service code, NAICS code, set-aside, quantity, delivery location, response date, attachments, office, and official contact. A Sources Sought notice may support a capability response; a solicitation may support Sell to Agency; an award notice belongs in historical evidence.",
          "USAspending can reveal agencies, award descriptions, recipients, primes, and places of performance. Use repeated purchases to map likely buyers and incumbents, not to assert that a requirement is currently open. Review the underlying award and current agency forecast or procurement source before creating a seller task.",
          "SBA's prime and subcontracting guidance provides another route. Some manufacturers will reach federal demand through a large prime, contract vehicle holder, or distributor. The row should name the supported prime or channel evidence, the relevant scope, supplier onboarding route, and the next action. A general list of major contractors is not enough."
        ]
      },
      {
        heading: "Use manufacturing programs as ecosystem evidence",
        body: [
          "NIST's Manufacturing Extension Partnership is a public-private network focused on small and medium-sized manufacturers, with centers across the states and Puerto Rico. MEP Centers can support technology adoption, supply-chain resilience, workforce, quality, and operational improvement. That makes a center a possible assistance or ecosystem route, not automatically a customer.",
          "NIST also describes manufacturing measurement, quality, production monitoring, cybersecurity, and supply-chain work that helps manufacturers meet demanding customer requirements. Use this context to identify qualification gaps and partner resources. Do not convert a national program description into an active local opportunity without a current center, notice, event, project, or buyer record.",
          "EDA and workforce programs can identify regions, intermediaries, and recipients investing in industrial capacity, innovation, or training. A commercial company must check the notice's eligibility before using Direct Apply. When it is ineligible, an official award may later support Sell to Funded Buyer or Partner with Recipient after the recipient and vendor need are verified."
        ]
      },
      {
        heading: "Qualify supplier readiness and compliance",
        body: [
          "A supplier path is not only a contact search. Check quality systems, traceability, cybersecurity, export controls where relevant, domestic-content rules, production and surge capacity, insurance, delivery, financial stability, and prime-specific onboarding. Do not claim that a certification is universally required; tie each condition to the notice, customer, program, or supplier portal.",
          "NIST's Cybersecurity Framework 2.0 provides voluntary guidance for managing cybersecurity risk, while specific contracts and defense supply chains may impose separate requirements. The action row should say which requirement is sourced, which evidence the company has, and which gap needs expert review before pursuit.",
          "Workforce is another capacity condition. DOL apprenticeship and workforce resources can identify training systems and intermediaries, but a labor-market program is not proof that a particular plant is hiring a vendor. Use current awards, local board plans, employer partnerships, or procurements to validate the commercial route."
        ]
      },
      {
        heading: "Build the manufacturing action row",
        body: [
          "Record the source, retrieval date, target and facility, item or service, industrial codes, quantity or scope when official, buyer or recipient role, notice or award status, incumbent or prime evidence, qualification conditions, revenue motion, contact route, next action, owner, timing, and disqualifier. Preserve attachments and technical references.",
          "Illustrative example: a SAM.gov Sources Sought notice seeks domestic production capacity for a defined component. The row is an early Sell to Agency signal, not a contract. The next action is to compare specifications, capacity, quality, cybersecurity, domestic-source, and response instructions, then decide whether a truthful capability response is possible. No solicitation or award is assumed.",
          "Illustrative example: an EDA award names a regional organization supporting an industrial cluster. The row begins as Research Only. After the recipient publishes an implementation plan or procurement, an equipment, logistics, software, or training company may have a Sell to Funded Buyer or Partner with Recipient route. The award alone does not prove a purchase."
        ]
      },
      {
        heading: "Operate a buyer and supplier map",
        body: [
          "Review active federal and state notices for current demand, USAspending for historical buyers and primes, agency forecasts for planning, NIST MEP and Manufacturing USA resources for ecosystem and capability context, and official EDA or workforce awards for recipient research. Keep each lane labeled and dated.",
          "Promote rows when technical fit, target, timing, compliance, and route are credible. Assign supplier onboarding, attachment review, capability response, forecast research, recipient validation, or monitoring as the next action. Reject records where the company cannot make or deliver the requirement, the recipient is unverified, or no official commercial route exists.",
          "Opportunity Scanner can structure the evidence and route. It does not establish technical acceptability, responsibility, certification, small-business status, supplier approval, purchase intent, or award probability."
        ]
      }
    ],
    practicalList: {
      title: "Manufacturing and supply-chain qualification checklist",
      items: [
        "Define products, processes, materials, tolerances, certifications, capacity, lead times, and geography.",
        "Map accurate NAICS and product-service codes to the supported capability.",
        "Label records as active notice, forecast, historical award, ecosystem program, funded recipient, or workforce context.",
        "Verify the agency, prime, recipient, MEP Center, or intermediary role.",
        "Check specifications, quality, traceability, cybersecurity, domestic-source, delivery, and onboarding conditions.",
        "Choose one target and one allowed revenue motion.",
        "Use the official notice, supplier portal, recipient, or program route.",
        "Assign one owner, next action, timing, and disqualifier.",
        "Keep awards and program context out of active pipeline until a current buying or partner action is supported."
      ]
    },
    proofPoints: [
      {
        stat: "NIST's Manufacturing Extension Partnership is a public-private network serving small and medium-sized manufacturers through state-designated centers and service locations.",
        source: "National Institute of Standards and Technology - Manufacturing Extension Partnership",
        url: "https://www.nist.gov/mep"
      },
      {
        stat: "NIST describes measurement, quality, production-monitoring, cybersecurity, and supply-chain resources that help manufacturers meet customer and national-security requirements.",
        source: "National Institute of Standards and Technology - Manufacturing",
        url: "https://www.nist.gov/manufacturing"
      },
      {
        stat: "NIST Cybersecurity Framework 2.0 provides voluntary guidance for organizations to manage cybersecurity risk; specific contracts may add separate requirements.",
        source: "National Institute of Standards and Technology - Cybersecurity Framework",
        url: "https://www.nist.gov/cyberframework"
      },
      {
        stat: "EDA funding opportunities identify eligibility, program purpose, and application requirements; later award records can identify recipients for separate implementation research.",
        source: "U.S. Economic Development Administration - Funding Opportunities",
        url: "https://www.eda.gov/funding/funding-opportunities"
      },
      {
        stat: "SBA distinguishes prime contracting from subcontracting and provides official resources for researching subcontracting routes.",
        source: "U.S. Small Business Administration - Prime and subcontracting",
        url: "https://www.sba.gov/federal-contracting/contracting-guide/prime-subcontracting"
      },
      {
        stat: "Apprenticeship.gov provides official information about registered apprenticeship programs and partners, which can support workforce ecosystem research but is not itself a purchase signal.",
        source: "U.S. Department of Labor - Apprenticeship.gov",
        url: "https://www.apprenticeship.gov/"
      }
    ],
    chartAssets: [
      {
        title: "Manufacturing source-to-buyer map",
        chartType: "flow",
        takeaway: "Active notices, prime awards, industrial programs, and workforce records identify different targets and require separate qualification.",
        source: "Illustrative Opportunity Scanner framework based on SAM.gov, USAspending.gov, NIST MEP, EDA, SBA, and DOL sources",
        altText: "Illustrative flow showing manufacturing procurement, prime, ecosystem, recipient, and workforce evidence leading to agency, supplier, funded-buyer, partner, or research actions",
        status: "published",
        image: {
          src: "/resources/commercial-industries/manufacturing-supply-chain-public-sector-demand/source-to-buyer.svg",
          width: 1200,
          height: 675,
          caption: "Illustrative framework; it does not represent measured purchases, supplier demand, or conversion results."
        }
      }
    ],
    sourceNote: {
      text: "Program and workforce records describe an ecosystem; current procurement, award, recipient, and supplier evidence is required before creating an active sales action.",
      source: "National Institute of Standards and Technology - Manufacturing Extension Partnership",
      url: "https://www.nist.gov/mep"
    },
    cta: "Run a free scan to turn your manufacturing, supplier, logistics, or industrial-service capabilities into qualified agency, prime, recipient, and partner actions."
  },

  "nonprofit-community-services-funding-opportunities": {
    description:
      "A practical guide to separating direct grants, government contracts, funded providers, recipient partnerships, and community-service market evidence.",
    readTime: "7 min read",
    intro:
      "Community-services funding can create several very different opportunities. A nonprofit may be eligible to apply directly. A government agency may procure a provider. An awarded organization may need vendors or partners. A commercial company may be ineligible for the grant but well suited to support a recipient. The useful work is to verify status and eligibility, identify the organization responsible for delivery, and assign the revenue motion and contact path the official record supports.",
    keyTakeaways: [
      "The notice and application instructions control eligibility; a search category does not.",
      "Forecasted, posted, closed, awarded, and historical records belong in different workflow lanes.",
      "Verify recipients and nonprofit status through official award, agency, and IRS sources before outreach.",
      "Direct Apply, Sell to Agency, Sell to Funded Buyer, and Partner with Recipient require different evidence and contacts."
    ],
    sections: [
      {
        heading: "Start with eligibility and status",
        body: [
          "Grants.gov explains that legal eligibility comes from the funding opportunity's instructions. Search filters can narrow organization types, categories, agencies, dates, and status, but they do not override the notice. A nonprofit, local government, school, Tribe, university, public housing authority, or commercial organization may be eligible for one program and excluded from another.",
          "Status matters just as much. Forecasted opportunities describe planned funding and may change. Posted opportunities are open under their official dates. Closed and archived records are historical. A forecast can create a preparation task; a posted notice can support Direct Apply after eligibility and capacity checks; a closed record can support program research but should not remain in active application pipeline.",
          "Registration has lead time. Federal applicants generally need SAM.gov registration and the required Grants.gov roles and profiles. Do not wait until the deadline to discover that an authorized organization representative, UEI, or account step is incomplete. Registration does not establish eligibility or competitiveness."
        ]
      },
      {
        heading: "Separate four community-services revenue motions",
        body: [
          "Use Direct Apply when the organization is eligible, the program fits its mission and capacity, the timing is realistic, and it can meet reporting, match, partnership, and performance requirements. Use Sell to Agency when a government department is procuring service delivery, technology, outreach, staffing, facilities, evaluation, or other support through a contract or vendor process.",
          "Use Sell to Funded Buyer when an official award identifies a recipient with a plausible implementation need. Use Partner with Recipient when the company's role is complementary and the recipient has a credible partnership route. Neither motion should be assigned to a prospective applicant or a list of likely grantees before an award is official.",
          "Research Only and Monitor Policy protect early evidence from becoming inflated pipeline. A program history can reveal recurring priorities. A policy notice can indicate future service requirements. An agency plan can identify a target office. Keep those rows dated and scheduled for review until a current funding, procurement, or recipient action appears."
        ]
      },
      {
        heading: "Follow the funding to the delivery organization",
        body: [
          "USAspending can identify federal assistance awards, recipients, agencies, award descriptions, and places of performance. HHS's Tracking Accountability in Government Grants System, or TAGGS, provides grant-award information for HHS. Agency award pages from HRSA, ACF, HUD, and DOJ can add program-specific context. Use the official record to confirm who received what and for which purpose.",
          "Then verify the organization itself. The IRS Tax Exempt Organization Search can show tax-exempt status and filings, including Form 990 information where available. IRS cautions that legal names and database coverage have limitations, so use EINs and determination information carefully. Tax-exempt status does not prove that an organization holds a particular award or needs a vendor.",
          "The recipient's own program, procurement, partnership, and leadership pages determine the practical route. A grant manager may answer program questions but may not buy software or services. Procurement, program operations, partnerships, finance, or executive leadership may be more appropriate depending on the action. Preserve source-native contacts before using enrichment."
        ]
      },
      {
        heading: "Qualify delivery and compliance capacity",
        body: [
          "A mission fit is not enough for Direct Apply. Check eligible activities, geography and population, period of performance, budget rules, match or cost sharing, evidence requirements, subaward permissions, data collection, reporting, audit, and organizational capacity. Read the current notice and attachments rather than relying on a summary.",
          "For agency contracts, check procurement status, scope, licensing, staffing, insurance, background checks, data privacy, service standards, and vendor registration. For funded-buyer and partner paths, confirm that the proposed service is allowable and that the recipient has a procurement or partnership route. Do not suggest bypassing competition or grant conditions.",
          "HUD's funding page, for example, distinguishes forecasted and published NOFOs and points applicants to Grants.gov and registration requirements. HRSA likewise separates funding opportunities, awards, and grants management. Those official distinctions should remain visible in the action table."
        ]
      },
      {
        heading: "Build the community-services action row",
        body: [
          "Record source and retrieval date, program, agency, status, eligibility, geography and population, applicant or recipient, award evidence, service-delivery need, target, revenue motion, contact path, next action, owner, deadline or review date, and disqualifier. Link the funding notice, award record, and recipient evidence separately.",
          "Illustrative example: a posted grant is limited to local governments and nonprofits. An eligible nonprofit may create a Direct Apply row with an authorized grants owner and a next action to review the complete notice. An ineligible software company should not. It may create Research Only and monitor official awards for recipients whose implementation plans support a vendor need. No award or sale is assumed.",
          "Illustrative example: a county posts a human-services procurement. A qualified provider may use Sell to Agency with the county procurement office as the contact path. A training or technology vendor might instead research subcontracting or the eventual award recipient, but only when official scope and route evidence support that motion."
        ]
      },
      {
        heading: "Run a disciplined funding and recipient review",
        body: [
          "Review Grants.gov and agency pages for current notices, official award systems for recipients, USAspending for federal assistance context, IRS TEOS for organization validation, and state or local procurement portals for service contracts. Keep application, procurement, recipient, partner, and monitor lanes separate.",
          "Promote only rows with verified status, eligibility or recipient evidence, organizational capacity, a plausible delivery need, and an official next action. Assign one owner. Remove expired notices, speculative recipients, failed eligibility, unsupported vendor needs, and records with no credible route.",
          "Opportunity Scanner can make the funding pathway and next action clearer. It does not determine legal eligibility, allowability, tax status, application quality, procurement responsibility, recipient demand, access, or award outcomes."
        ]
      }
    ],
    practicalList: {
      title: "Community-services opportunity qualification checklist",
      items: [
        "Confirm the official notice, program, agency, status, dates, geography, and eligible entities.",
        "Read application instructions before assigning Direct Apply.",
        "Separate forecasted, posted, closed, awarded, and historical records.",
        "Verify recipients through official agency, TAGGS, or USAspending records.",
        "Validate nonprofit identity and status through IRS TEOS where relevant.",
        "Choose Direct Apply, Sell to Agency, Sell to Funded Buyer, Partner with Recipient, Monitor Policy, or Research Only.",
        "Check allowable activities, reporting, match, staffing, procurement, privacy, licensing, and delivery capacity.",
        "Preserve source-native contacts and official procurement or program routes.",
        "Assign one owner, next action, deadline or review date, and disqualifier.",
        "Do not describe applicants as recipients or funding context as an active buyer need."
      ]
    },
    proofPoints: [
      {
        stat: "Grants.gov states that applicant eligibility is determined by the funding opportunity's instructions, not merely by broad organization categories.",
        source: "Grants.gov - Applicant Eligibility",
        url: "https://www.grants.gov/applicants/applicant-eligibility"
      },
      {
        stat: "Grants.gov distinguishes forecasted, posted, closed, and archived opportunities, which require different workflow actions.",
        source: "Grants.gov - Search Grants",
        url: "https://www.grants.gov/help/search-grants/search-grants-tab"
      },
      {
        stat: "HHS TAGGS publishes federal grant-award information that can be used to verify HHS recipients and award context.",
        source: "U.S. Department of Health and Human Services - TAGGS",
        url: "https://taggs.hhs.gov/"
      },
      {
        stat: "HUD's funding page distinguishes forecasted and published NOFOs, award information, and federal registration requirements.",
        source: "U.S. Department of Housing and Urban Development - Funding Opportunities",
        url: "https://www.hud.gov/grants"
      },
      {
        stat: "HRSA separates current funding opportunities, awarded grants, and post-award grant-management resources.",
        source: "Health Resources and Services Administration - Grants",
        url: "https://www.hrsa.gov/grants"
      },
      {
        stat: "IRS Tax Exempt Organization Search provides official tax-exempt status and filing information, subject to its stated database and naming limitations.",
        source: "Internal Revenue Service - Tax Exempt Organization Search",
        url: "https://www.irs.gov/charities-non-profits/tax-exempt-organization-search"
      }
    ],
    chartAssets: [
      {
        title: "Community-services funding-to-action map",
        chartType: "flow",
        takeaway: "Eligibility, procurement, recipient, and policy records create separate motions; a grant search result is not one generic opportunity.",
        source: "Illustrative Opportunity Scanner framework based on Grants.gov, USAspending.gov, HHS TAGGS, HUD, HRSA, IRS TEOS, and official procurement sources",
        altText: "Illustrative flow showing community-services grants, procurements, awards, recipient records, and policy evidence leading to apply, agency sale, funded-buyer, partner, or monitoring actions",
        status: "published",
        image: {
          src: "/resources/commercial-industries/nonprofit-community-services-funding-opportunities/funding-to-action.svg",
          width: 1200,
          height: 675,
          caption: "Illustrative framework; it does not show measured funding, eligibility, recipient demand, or results."
        }
      }
    ],
    sourceNote: {
      text: "The current notice controls eligibility; official award evidence controls recipient claims; recipient and procurement sources control the commercial route.",
      source: "Grants.gov - Applicant Eligibility",
      url: "https://www.grants.gov/applicants/applicant-eligibility"
    },
    cta: "Run a free scan to separate direct funding, agency sales, funded-recipient, partner, and monitoring paths for your organization."
  }
} satisfies Record<string, ResourceArticleRefresh>;
