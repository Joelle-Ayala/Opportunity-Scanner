import type { ResourceArticleRefresh } from "./types";

const sources = {
  spendingGuide: {
    stat: "USAspending distinguishes account spending from award spending and explains that contract and financial-assistance records use different fields, identifiers, and recipient categories.",
    source: "USAspending.gov - Federal Spending Guide",
    url: "https://www.usaspending.gov/federal-spending-guide"
  },
  recipients: {
    stat: "USAspending recipient profiles identify entities that received federal contracts, grants, loans, or other assistance and show award trends and category rankings.",
    source: "USAspending.gov - Recipient Profiles",
    url: "https://www.usaspending.gov/recipient"
  },
  sam: {
    stat: "SAM.gov publishes federal contract opportunities, while the notice type, status, attachments, response instructions, and listed contacts determine what a vendor should do next.",
    source: "SAM.gov - Contract Opportunities",
    url: "https://sam.gov/opportunities"
  },
  far: {
    stat: "FAR 15.201 encourages early exchanges with industry but makes the contracting officer the focal point for exchanges with potential offerors after a solicitation is released.",
    source: "Acquisition.gov - FAR 15.201",
    url: "https://www.acquisition.gov/far/15.201"
  },
  forecasts: {
    stat: "Acquisition.gov maintains links to agency procurement forecasts, small-business offices, business-opportunity pages, industry liaisons, and vendor communication plans.",
    source: "Acquisition.gov - Agency Procurement Forecasts",
    url: "https://www.acquisition.gov/procurement-forecast"
  },
  sbaAssess: {
    stat: "SBA recommends using federal market research to determine whether government buyers purchase what a company sells, how large the market is, and which agencies buy it.",
    source: "U.S. Small Business Administration - Assess Your Business",
    url: "https://www.sba.gov/federal-contracting/contracting-guide/assess-your-business"
  },
  sbaPrimes: {
    stat: "SBA's prime-contractor directory is designed to help small businesses investigate subcontracting possibilities and includes agency, PSC, NAICS, place of performance, period, and contract-value fields.",
    source: "U.S. Small Business Administration - Prime Contractor Directory",
    url: "https://www.sba.gov/document/support-directory-federal-government-prime-contractors-subcontracting-plans"
  },
  grants: {
    stat: "Grants.gov says legal eligibility comes from each opportunity's application instructions; checking only a broad search category can waste time and money.",
    source: "Grants.gov - Applicant Eligibility",
    url: "https://www.grants.gov/applicants/applicant-eligibility"
  },
  grantForecast: {
    stat: "A Grants.gov forecast describes a planned funding opportunity, but Grants.gov cautions that a forecast is not guaranteed to become an official announcement.",
    source: "Grants.gov - Forecast Tab",
    url: "https://grants.gov/help/search-grants/forecast-tab"
  },
  agencies: {
    stat: "USAGov's agency directory provides official websites and contact routes for federal departments and agencies.",
    source: "USAGov - Agency Directory",
    url: "https://www.usa.gov/agency-index"
  },
  truth: {
    stat: "FTC guidance requires advertising claims to be truthful, non-deceptive, and supported by evidence.",
    source: "Federal Trade Commission - Advertising and Marketing Basics",
    url: "https://www.ftc.gov/business-guidance/advertising-marketing"
  },
  endorsements: {
    stat: "FTC endorsement guidance says marketers should not present experiences or claims they cannot substantiate and should disclose material relationships.",
    source: "Federal Trade Commission - Endorsements and Testimonials",
    url: "https://www.ftc.gov/news-events/topics/truth-advertising/advertisement-endorsements"
  },
  email: {
    stat: "The CAN-SPAM Act applies to business-to-business commercial email and requires accurate headers, non-deceptive subjects, a postal address, and a working opt-out path.",
    source: "Federal Trade Commission - CAN-SPAM Compliance Guide",
    url: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business"
  }
} as const;

export const workflowArticleRefreshes = {
  "public-sector-deal-flow-for-commercial-companies": {
    description: "A practical system for turning official public-sector records into qualified commercial deal flow, owned actions, and honest stop decisions.",
    readTime: "8 min read",
    intro: "Commercial companies rarely need a second generic lead list. They need evidence that a public agency, funded organization, prime contractor, or program operator has a relevant need and a credible route to buy. Public-sector deal flow starts when official records are separated by meaning, qualified against the company's offer, and assigned to an owner. This guide shows how to build that system without pretending every award is open budget or every notice is a bid.",
    keyTakeaways: [
      "Keep active opportunities, historical spending, funded recipients, forecasts, and policy signals in separate lanes.",
      "Every retained signal needs a target, revenue motion, contact path, owner, next action, and disqualifier.",
      "A smaller pipeline of source-backed rows is more useful than a large list of weak keyword matches."
    ],
    sections: [
      { heading: "Deal flow begins with market evidence, not portal volume", body: [
        "A commercial sales team usually knows its offer, buyer problems, delivery limits, and strongest proof. What it often lacks is a reliable view of public demand. SBA recommends researching whether government buyers purchase what the company sells, how large the market is, and which agencies buy it. That is the right starting point because it tests a commercial hypothesis before the team invests in registrations, capture processes, or specialist software.",
        "Define two or three offers and the public problems they solve. Translate each into agency mission language, likely NAICS or product/service categories, recipient types, geographies, and clear exclusions. A rehabilitation supplier, for example, should distinguish medical equipment from clinical services and facility construction. A training platform should separate direct agency procurement from grant-funded delivery through workforce boards or schools.",
        "The output is not a search result. It is a decision row. Preserve the official source, identify what the record proves, name the likely target, select one revenue motion, and state what must happen next. If the evidence cannot support that sequence, it belongs in research or rejection rather than active pipeline."
      ]},
      { heading: "Build five lanes that do not blur together", body: [
        "The active procurement lane contains current notices and source instructions. SAM.gov may show solicitations, presolicitations, Sources Sought notices, awards, and special notices. Those record types do not create the same action. A current solicitation may justify a bid/no-bid review; a Sources Sought notice may justify a capability response; an award notice may identify an incumbent or future subcontracting route.",
        "The historical money-flow lane comes from USAspending and related official award systems. USAspending explains that award spending covers money paid or promised to non-federal recipients through contracts or financial assistance, and that contract and assistance records use different fields. Historical awards reveal purchasing patterns, recipients, places of performance, and incumbents. They do not prove that a new purchase is open.",
        "The funding lane contains posted grants, forecasts, and recipient evidence. Grants.gov makes legal eligibility specific to the application instructions, so a commercial firm should not assign Direct Apply merely because a topic fits. An ineligible grant can become Partner with Recipient research only when a plausible role exists. Forecasts, agency acquisition plans, and policy records belong in early-demand lanes until a later event creates an actionable buying path."
      ]},
      { heading: "Choose the revenue motion before choosing the contact", body: [
        "Sell to Agency fits a public entity with a credible procurement path. Sell to Funded Buyer or Sell to Award Recipient fits an organization that has received relevant money and may need implementation support. Partner with Recipient fits a complementary delivery role. Channel or Distributor Motion fits a prime, reseller, or established contract vehicle. Direct Apply requires verified eligibility. Monitor Policy and Research Only keep early evidence visible without overstating readiness.",
        "The motion determines the route. An active solicitation points to the contracting officer and response instructions. A forecast may point to an industry liaison or small-business office after the team has researched the requirement. A funded nonprofit may point to a program or procurement lead. A large prime may point to its supplier portal or small-business liaison. Paid email enrichment should follow target validation, not substitute for it.",
        "FAR 15.201 encourages appropriate early exchanges, but after solicitation release the contracting officer is the focal point for potential offerors. That boundary protects both the seller and the procurement. A useful pipeline records the official route and keeps informal prospecting from conflicting with source instructions."
      ]},
      { heading: "Qualify each row with evidence and disqualifiers", body: [
        "A minimum action row includes source URL, source date, evidence summary, target organization, signal status, revenue motion, fit, eligibility, contact path, next action, owner, due date, and disqualifier. Add award identifier, notice number, assistance listing, NAICS, place of performance, or recipient UEI when the source provides it. Those identifiers make later verification and deduplication possible.",
        "Promote a row only when the offer maps to a real requirement or spending pattern, timing is workable, the company can perform, and a legitimate route exists. Reject expired notices with no market-learning value, awards presented as available budget, ineligible grants with no downstream role, impossible delivery locations, mismatched compliance requirements, and records connected only by broad keywords.",
        "Confidence and actionability should remain separate. A historical award may be highly credible but low actionability until a forecast appears. A newly posted solicitation may be actionable but still low fit. Keeping those dimensions distinct prevents sales teams from mistaking source certainty for commercial readiness."
      ]},
      { heading: "Move qualified rows into the existing sales rhythm", body: [
        "Do not wait for a specialized GovCon stack. Send qualified rows into the CRM, a shared action table, or a webhook-driven workflow. Map the target to the account, preserve the official link in a source field, put the evidence and caveat in the note, and create one task with an owner and due date. Keep the opportunity's public deadline separate from the team's internal review date.",
        "Use a weekly review to decide advance, monitor, redirect, or close. Advance means the route and next action remain credible. Monitor means the evidence is real but timing is early. Redirect means a direct pursuit should become a prime, recipient, or channel motion. Close means the fit, eligibility, capacity, or route failed. Closed rows still teach the search model what not to surface.",
        "An illustrative action row might connect a USAspending award to a named recipient, classify the motion as Sell to Award Recipient, route research to the recipient's official procurement page, and assign an owner to verify whether the funded program needs the company's service. The illustration claims no response, meeting, contract, or revenue result."
      ]},
      { heading: "Measure whether the channel deserves more investment", body: [
        "Review operational evidence rather than vanity volume: how many rows survived qualification, how many had a credible route, how quickly owners completed the first action, and which motions repeatedly appeared. Do not publish conversion or revenue benchmarks until the product has enough measured data and a defined denominator.",
        "Invest further when official records repeatedly show the same buyer problem, the company can meet likely requirements, and owners can execute the recommended route. Narrow when one segment works better than the rest. Partner or subcontract when direct pursuit is unrealistic. Stop when the source set repeatedly fails fit, eligibility, capacity, or timing. A disciplined stop decision is a successful market test, not a content failure."
      ]}
    ],
    practicalList: { title: "Deal-flow qualification checklist", items: [
      "Define the commercial offer, public buyer problem, search language, and exclusions.", "Identify whether the record is active procurement, historical spending, funding, forecast, policy, or recipient evidence.", "Preserve the official source URL, date, identifier, and status.", "Name the agency, recipient, prime, partner, or program that could become the target.", "Select one revenue motion and explain why it fits.", "Choose an official or verified contact path before enrichment.", "Assign one owner, next action, and internal due date.", "Record the condition that would disqualify or redirect the row.", "Review advance, monitor, redirect, and close decisions every week."
    ]},
    proofPoints: [sources.sbaAssess, sources.sam, sources.spendingGuide, sources.grants, sources.forecasts, sources.far],
    chartAssets: [{ title: "Illustrative public-sector deal-flow operating system", chartType: "flow", takeaway: "Five evidence lanes become pipeline only after qualification, routing, and ownership.", source: "Illustrative Opportunity Scanner framework informed by SBA, SAM.gov, USAspending, Grants.gov, and Acquisition.gov guidance; no measured performance claim.", altText: "Illustrative flow from five public-sector evidence lanes through qualification to revenue motion, contact path, and owned action", status: "published", image: { src: "/resources/workflows/deal-flow-operating-system.svg", width: 1200, height: 675, caption: "Illustrative framework. Source records require independent verification before pursuit." }}],
    cta: "Run an Opportunity Scan to turn relevant public records into qualified, source-backed action rows."
  },

  "find-funded-buyers-before-cold-outreach": {
    description: "Use verified public-money evidence to identify and qualify funded buyers before outreach, without confusing past awards with open budget.",
    readTime: "7 min read",
    intro: "Cold outreach usually begins with firmographics and a guessed pain point. Funded-buyer research starts with a stronger question: which organizations received public money for work adjacent to what your company sells, and what does that record actually justify doing? The answer may be outreach, partner research, subcontracting, monitoring, or no action. This guide shows how to follow the money while keeping the evidence, caveats, and contact route intact.",
    keyTakeaways: ["A recipient record is market evidence, not proof of available budget or buying intent.", "Validate the award, organization, funded purpose, timing, and downstream need before enrichment.", "Outreach should cite the public context accurately and offer relevant help without implying an inside relationship."],
    sections: [
      { heading: "Start with the award, not the email address", body: [
        "USAspending defines a recipient as a company, organization, individual, or government entity that receives federal funding. Recipient profiles can show award trends, agencies, award types, and category rankings. That makes them useful for account discovery, but the recipient label alone says nothing about whether your offer fits or whether funds remain available.",
        "Begin with an official award or assistance record. Capture the recipient's legal name, parent and child relationships, UEI when available, awarding and funding agencies, award type, period of performance, place of performance, description, obligations or outlays, and the source retrieval date. USAspending cautions that spending concepts and reporting fields differ, so do not casually translate an obligation into cash in the bank.",
        "The first action is verification. Confirm that the recipient is the organization you think it is, the award supports a relevant program, the timing is meaningful, and the company could plausibly contribute. Only then should the row become a target account."
      ]},
      { heading: "Separate four funded-buyer situations", body: [
        "A contract recipient is often a prime or incumbent vendor. The practical motion may be subcontracting, channel partnership, competitive research, or future agency pursuit. SBA's directory of primes with subcontracting plans provides fields such as agency, PSC, NAICS, place of performance, contract period, and value specifically to support investigation of subcontracting possibilities.",
        "A grant or cooperative-agreement recipient may be a state, local government, nonprofit, university, health provider, workforce board, or other program operator. The commercial company may not have been eligible to apply directly, but it may be able to sell to or partner with the recipient. That motion becomes credible only after the recipient and program purpose are verified.",
        "A loan, direct-payment, or other assistance record can signal market activity without creating a straightforward vendor path. A subaward can identify a more local implementing entity, but subaward data has its own coverage and quality caveats. Keep award type and tier visible so sellers do not treat every money-flow record as the same commercial event."
      ]},
      { heading: "Qualify the downstream need", body: [
        "Read the award description and supporting program materials, then translate the funded purpose into likely operational needs. A workforce award may create demand for instruction, participant recruitment, software, evaluation, or employer partnerships. A healthcare award may create demand for equipment, outreach, data systems, or clinical support. These are hypotheses to validate, not claims that the recipient is shopping.",
        "Score fit across offer relevance, recipient type, program stage, geography, delivery capacity, procurement route, and evidence quality. Check the period of performance and recent transactions. A large historical award that ended years ago may still reveal a segment, but it should not trigger time-sensitive outreach. A recent award announcement may justify monitoring before vendor procurement begins.",
        "Disqualify duplicate legal entities, pass-through recipients with no operational role, vague descriptions with no adjacent need, incompatible geography, expired programs, and records where the company cannot deliver. Redirect a row when the agency, prime, subrecipient, or program office is a more credible target than the named recipient."
      ]},
      { heading: "Choose the route before enrichment", body: [
        "Look for source-native routes first: the recipient's official website, program page, procurement or supplier portal, award announcement, public staff directory, or published partnership process. For prime contractors, follow the company's official subcontractor instructions. For a government recipient, use the public procurement or program-office route rather than attempting to enrich an individual civil servant.",
        "Enrichment is appropriate after a private organization has been validated and the relevant function is clear. Search for roles such as program operations, partnerships, procurement, implementation, or business development based on the motion. Record the source, verification date, and confidence. Do not let a guessed personal email overwrite an official route.",
        "The contact path should survive even if enrichment returns nothing. A supplier registration page, program inbox, published phone number, prime-contractor form, or manual research task can be the correct next step. Missing personal data is not the same as missing actionability."
      ]},
      { heading: "Write outreach from evidence, not assumption", body: [
        "A useful message names the public record accurately, explains the narrow relevance of the company's offer, and asks a route-validating question. It should not say the recipient has budget available, needs a vendor, or was selected as a customer. It should not imply access to private information or an endorsement by the awarding agency.",
        "An illustrative message might say that the team reviewed a publicly listed award related to workforce training, works with organizations on a specific delivery problem, and wants to confirm whether vendor or partner inquiries are handled by the recipient's program or procurement team. This example assumes no response, meeting, buying process, or outcome.",
        "Commercial email still needs compliance. FTC guidance says CAN-SPAM applies to business-to-business messages and requires accurate headers, non-deceptive subjects, a postal address, and a working opt-out. Relevance does not remove those obligations. Keep suppression records and avoid repeated outreach when the source or recipient says not to solicit."
      ]},
      { heading: "Create a funded-buyer action row", body: [
        "The row should contain the award identifier and URL, recipient and parent, awarding agency, award type, funded purpose, period of performance, evidence summary, caveat, hypothesized downstream need, revenue motion, contact route, outreach angle, owner, next action, and disqualifier. Preserve the difference between verified source facts and commercial inference.",
        "A contract recipient could become Channel or Distributor Motion with a next step to review the prime's supplier requirements. A nonprofit assistance recipient could become Sell to Funded Buyer with a next step to validate procurement. A university award could become Partner with Recipient when the company's capability complements the research or delivery plan. If no downstream need can be supported, keep the row Research Only.",
        "Measure workflow quality first: verified recipients, qualified routes, completed actions, and reasons for rejection. Do not claim reply, meeting, or revenue rates without measured product data. The point of funded-buyer intelligence is to improve the reason for outreach and the path to the right organization, not to manufacture intent.",
        "Recheck the public record before every material follow-up. Awards can receive new transactions, recipient naming can change, and program pages can clarify implementation roles. Update the evidence date and outreach angle when the facts change. If the original premise no longer holds, close or redirect the row instead of preserving a stale narrative because contact research has already been completed."
      ]}
    ],
    practicalList: { title: "Funded-buyer validation checklist", items: ["Open the official award record and record its retrieval date.", "Confirm the recipient, parent relationship, UEI, award type, agency, and place of performance.", "Read the funded purpose and period of performance.", "Separate verified facts from hypothesized downstream needs.", "Select Sell to Funded Buyer, Sell to Award Recipient, Partner with Recipient, Channel Motion, or Research Only.", "Find the recipient's official program, procurement, supplier, or partnership route.", "Use enrichment only for a validated private organization and relevant role.", "Write outreach that cites the public context without claiming available budget or intent.", "Assign an owner, next action, follow-up rule, and disqualifier." ]},
    proofPoints: [sources.recipients, sources.spendingGuide, sources.sbaPrimes, sources.grants, sources.truth, sources.email],
    chartAssets: [{ title: "Illustrative funded-buyer validation chain", chartType: "flow", takeaway: "Award evidence becomes outreach only after recipient, purpose, need, motion, and route are validated.", source: "Illustrative Opportunity Scanner framework informed by USAspending, SBA, Grants.gov, and FTC guidance; no measured outcome claim.", altText: "Illustrative chain from public award record through recipient verification and need validation to a contact route", status: "published", image: { src: "/resources/workflows/funded-buyer-validation-chain.svg", width: 1200, height: 675, caption: "Illustrative validation framework. An award is not proof of current budget or buying intent." }}],
    cta: "Scan a company website to find funded-buyer evidence, appropriate revenue motions, and route-specific next actions."
  },

  "government-buyer-contact-paths": {
    description: "Choose the official contact route that fits each public-sector signal before using personal-email enrichment.",
    readTime: "7 min read",
    intro: "The question 'Who is the government buyer?' is often too narrow. The right next route may be a contracting officer, notice contact, program office, small-business office, vendor portal, funded recipient, prime contractor, grants contact, or monitoring task. Contact-path quality comes from matching the route to the source record and revenue motion, then respecting the procurement stage.",
    keyTakeaways: ["Start with the source-native contact and official response instructions.", "The right contact changes with the revenue motion and procurement stage.", "Enrichment can support validated private targets but should not replace official public routes."],
    sections: [
      { heading: "A contact path is a route, not just a person", body: [
        "A useful contact path answers three questions: which organization owns the decision, which official channel governs the interaction, and what should the seller ask or do next? A name and email without those answers can send a relevant opportunity to the wrong person or create outreach that conflicts with procurement instructions.",
        "Start from the evidence. Record the source, status, target, revenue motion, and stage. USAGov maintains official agency websites and contact routes, while Acquisition.gov links to agency forecasts, industry liaisons, small-business offices, and vendor communication plans. Those directories are stronger starting points than an unverified contact database.",
        "Treat the path as structured data: route type, organization, office or role, official URL, source-native contact, restrictions, fallback, confidence, and next action. This makes the row useful even when no individual email is available."
      ]},
      { heading: "Active notices: follow the record", body: [
        "For a SAM.gov opportunity, inspect the notice type, status, attachments, response method, deadline, and listed contacts. A solicitation may require submission through a portal or to a contracting officer. A Sources Sought notice may request a capability statement in a specific format. An award notice is usually market evidence, not an invitation to pitch the agency contact.",
        "FAR 15.201 encourages early exchanges that improve understanding of requirements and industry capabilities. After a solicitation is released, however, the contracting officer is the focal point for exchanges with potential offerors. Questions that could affect proposal preparation should travel through the stated process so relevant information can be shared fairly.",
        "Do not route sellers to program staff to work around the contracting officer, seek nonpublic evaluation information, or privately negotiate a live requirement. The action row should preserve every communication restriction visible in the source."
      ]},
      { heading: "Early demand: use offices and public engagement routes", body: [
        "A procurement forecast, draft requirement, industry day, or recurring buying pattern can justify earlier market engagement. The path may be an industry liaison, forecast owner, program office, Office of Small and Disadvantaged Business Utilization, Office of Small Business Programs, or APEX adviser. Research the agency and likely requirement before making contact.",
        "The purpose of early contact is not a generic introduction. Ask a focused question about acquisition timing, vendor engagement, relevant contract vehicles, industry events, or where a capability statement belongs. Share capabilities that map to a public mission need and avoid asking the office to endorse the company or disclose protected information.",
        "If the signal is only historical spending, the next action may be to inspect forecasts or recurring procurements before contacting anyone. A monitoring task can be a complete and correct contact strategy."
      ]},
      { heading: "Funded recipients and primes need different routes", body: [
        "A grant recipient may buy through its own procurement process, partner through a program team, or pass funds to subrecipients. The official grant record can establish the funding relationship, but it does not prove the recipient needs the seller. Validate the program, organization, and likely function before choosing procurement, partnerships, operations, or program leadership.",
        "A federal prime contractor may have a supplier portal, subcontracting manager, small-business liaison, or published teaming process. SBA's prime-contractor directory is intended for investigating subcontracting possibilities, and SBA recommends following the contractor's own instructions. That route is more useful than sending the same pitch to several executives.",
        "For state, local, school, health-system, or authority targets, start with the entity's official vendor registration, procurement page, bid portal, or department directory. Keep the exact jurisdiction and vendor requirements in the row; there is no single universal local-government route."
      ]},
      { heading: "Set boundaries for enrichment", body: [
        "Source-native contacts should remain primary when the record supplies them. Enrichment is most defensible for validated private recipients, primes, partners, distributors, and vendors when the team knows which function it needs. Record the provider, verification date, confidence, and suppression state. Do not enrich every row merely because the feature is available.",
        "Avoid replacing an agency office with a guessed personal email, enriching individuals unrelated to the motion, or collecting more personal data than the next action requires. If the official source prohibits solicitation or requires portal communication, that instruction controls the path.",
        "Every path needs a fallback: official inbox, supplier form, switchboard, agency directory, portal registration, event, APEX consultation, manual research task, or monitor date. A no-email result can still be actionable when the organizational route is clear."
      ]},
      { heading: "Write route-aware outreach and ownership", body: [
        "The CRM note should explain why this route was selected, what the source proves, what remains an inference, and what question the seller should ask. For a contracting contact, the action may be a process clarification. For a recipient, it may be confirming who handles vendor inquiries. For a prime, it may be completing supplier registration before requesting a conversation.",
        "An illustrative row might preserve a Sources Sought notice, assign Sell to Agency, route to the published notice contact, and task the owner with reviewing attachments before drafting a capability response. Another might preserve a verified grant award, assign Partner with Recipient, and route research to the recipient's public program page. Neither illustration assumes a response or outcome.",
        "Commercial outreach must remain truthful and compliant. FTC guidance says business-to-business commercial email is covered by CAN-SPAM. Use accurate identity and subject lines, include the required address and opt-out, honor suppression, and stop when the organization requests it.",
        "Review paths as living records. A notice amendment can change the contact or submission route, a forecast can become a solicitation, and a recipient can publish a supplier process after an award announcement. Store the last-verified date and trigger a new source check before a seller acts on an older row. This small control keeps a once-correct contact strategy from becoming misleading.",
        "Route quality can be reviewed without inventing sales benchmarks. Track whether the official path was verified, whether the owner completed the prescribed action, whether the organization redirected the inquiry, and why a route was closed. Those observations improve future routing while keeping replies, meetings, and revenue separate from the report's factual claims."
      ]}
    ],
    practicalList: { title: "Contact-path decision checklist", items: ["Identify the source, record type, status, and procurement stage.", "Select the revenue motion before searching for a person.", "Preserve the source-native contact and response instructions.", "Check the agency, recipient, prime, or local entity's official directory or portal.", "Use the contracting officer after solicitation release.", "Use early-market offices only with a researched, stage-appropriate question.", "Enrich validated private targets only when the relevant function is known.", "Record restrictions, confidence, fallback route, owner, and next action.", "Honor opt-outs, supplier instructions, and communication boundaries." ]},
    proofPoints: [sources.sam, sources.far, sources.forecasts, sources.agencies, sources.sbaPrimes, sources.email],
    chartAssets: [{ title: "Illustrative contact-path decision tree", chartType: "flow", takeaway: "The source type and revenue motion determine the official route before enrichment begins.", source: "Illustrative Opportunity Scanner framework informed by SAM.gov, FAR, Acquisition.gov, USAGov, SBA, and FTC guidance; no measured claim.", altText: "Illustrative decision tree matching active notices, early demand, funded recipients, and primes to official contact routes", status: "published", image: { src: "/resources/workflows/contact-path-decision-tree.svg", width: 1200, height: 675, caption: "Illustrative route framework. Always follow the current source record and procurement instructions." }}],
    cta: "Run a scan to get a source-backed contact strategy and next action for every qualified signal."
  },

  "what-a-public-sector-opportunity-report-should-include": {
    description: "The fields, evidence, qualification logic, and workflow controls that turn public-sector research into an Opportunity Action Table.",
    readTime: "7 min read",
    intro: "A public-sector opportunity report should do more than summarize agencies, grants, and contracts. It should let a busy operator decide what is real, what fits, who the target is, which revenue motion applies, how to approach the opportunity, and who owns the next step. That requires an auditable evidence layer and a practical action layer, with historical spending kept separate from active opportunities.",
    keyTakeaways: ["Every conclusion should trace to an official record and retrieval date.", "Evidence, commercial interpretation, and recommended action should be separate fields.", "A report becomes operational when rows have motions, routes, owners, due dates, and disqualifiers."],
    sections: [
      { heading: "Begin with an evidence contract", body: [
        "Every row should preserve source name, source URL, source date, retrieval date, record identifier, record type, status, and a concise evidence excerpt or summary. Those fields let a reviewer reopen the record and understand whether it changed. They also reduce duplicate rows when the same notice or award appears through multiple searches.",
        "The report must state what the source proves and what it does not. USAspending award data is historical money-flow evidence, not an open solicitation. A Grants.gov forecast is planned and not guaranteed to post. A SAM.gov Sources Sought notice can invite market research responses without being an offer request. These distinctions belong in the row, not in fine print elsewhere.",
        "Use current official sources as the factual layer. Third-party summaries can support discovery, but the public record should remain linked when available. Record caveats such as stale status, incomplete descriptions, data-quality limits, and inferred organization matches."
      ]},
      { heading: "Describe the opportunity in business terms", body: [
        "The interpretation layer should include an evidence summary, why it matters to this company, target organization, buyer or partner type, opportunity lane, and fit rationale. It should translate government terminology into a commercial decision without rewriting uncertainty as certainty.",
        "Separate target from source owner. The agency that issued a grant may not be the organization a commercial seller should pursue. The award recipient, prime contractor, subrecipient, school district, health provider, or program operator may be the practical target. Conversely, a historical recipient may be less useful than the agency's next forecast.",
        "Include fit, confidence, and actionability as separate judgments. Fit asks whether the offer maps to the need. Confidence asks how strongly the source supports the interpretation. Actionability asks whether timing, eligibility, capacity, and route support a next action now. Explain the scores in words so they do not become unexplained precision."
      ]},
      { heading: "Make the revenue motion explicit", body: [
        "Use a controlled set of motions: Direct Apply, Sell to Agency, Sell to Funded Buyer, Sell to Award Recipient, Partner with Recipient, Channel or Distributor Motion, Monitor Policy, and Research Only. One primary motion forces the report to say how value could move between the company and the target.",
        "Direct Apply requires eligibility and a live or planned application path. Sell to Agency requires a procurement or market-engagement route. Recipient motions require verified recipient evidence and a plausible downstream need. Channel Motion requires a prime, distributor, reseller, or vehicle relationship. Monitor and Research keep valid but premature signals from inflating active pipeline.",
        "Add a disqualifier and redirect rule. A grant may fail Direct Apply but redirect to Partner with Recipient. A federal procurement may fail capacity but redirect to a prime. A historical award may remain Research Only until a forecast or renewal signal appears."
      ]},
      { heading: "Specify the contact strategy, not merely contact data", body: [
        "Contact fields should include route type, source-native contact, recommended office or role, official URL, response instructions, enrichment status, manual-research instruction, and confidence. The route may be a contracting officer, vendor portal, small-business office, program office, grant contact, recipient team, prime supplier page, or monitoring task.",
        "FAR 15.201 makes the contracting officer the focal point after a solicitation release. That is a workflow rule the report should preserve. Before release, forecasts, industry liaisons, and small-business offices may support responsible engagement. For private recipients and primes, enrichment can help after the account and function are validated.",
        "Do not show guessed personal emails as equivalent to official contacts. Keep provider, verification date, and suppression status with enriched data. A report that says 'manual research required' is more credible than one that invents certainty."
      ]},
      { heading: "Add the action and workflow layer", body: [
        "Each row needs a next best action written as a concrete verb: review attachments, verify eligibility, respond to the notice, inspect the forecast, register as a vendor, map the prime, monitor awards, research the recipient, draft a capability statement, or close the row. Add an owner, internal due date, source deadline, status, and last-reviewed date.",
        "For CRM use, preserve account name, opportunity title, source link, motion, evidence summary, outreach angle, contact strategy, owner, task date, and a CRM-ready note. Keep source deadlines distinct from sales follow-up dates. Include stable IDs so updates modify the same record instead of creating duplicates.",
        "A free report can show a small number of real signals and the total found. The paid report should unlock the full action layer: all qualified rows, buyer and partner targets, source records, contact strategies, CRM notes, outreach angles, and workflow export. The paid value is not extra prose; it is reduced decision and execution work."
      ]},
      { heading: "Include rejection logic and report-level context", body: [
        "A credible report shows why rows were excluded or downgraded. Common disqualifiers include weak keyword fit, expired timing, legal ineligibility, unrealistic delivery, unsupported recipient identity, duplicate records, no credible route, or a requirement outside the company's offer. Rejection reasons improve future searches and prevent weak rows from returning.",
        "At report level, summarize the strongest demand lanes, common targets, motion mix, geographic limits, major caveats, and recommended first three actions. Explain whether the evidence supports immediate pursuit, recipient research, partner development, registration, monitoring, or a stop decision.",
        "An illustrative row may connect an official award to a verified recipient, explain a possible implementation need, assign Sell to Funded Buyer, route to the recipient's procurement page, and task an owner to validate demand. The example must say that no need, meeting, response, or revenue result is assumed.",
        "Add a source-coverage note so the reader knows which lanes were searched and which were not. A report based on federal sources should not imply complete state and local coverage. Acquisition.gov's forecast directory can document which agency planning pages were reviewed, while USAGov can anchor official agency identity and contact routes. Stating coverage limits is part of the product, not an apology.",
        "Finally, include a freshness policy. Active notices should be checked close to action because amendments can change deadlines and instructions. Historical awards can remain useful longer but still need a retrieval date. Forecasts and grant plans should retain their planned status until an official posting changes it. The report should make stale evidence obvious before it reaches outreach or CRM workflow."
      ]}
    ],
    practicalList: { title: "Opportunity report field checklist", items: ["Source name, URL, date, retrieval date, identifier, type, and status.", "Evidence summary plus explicit caveat.", "Target organization and buyer or partner type.", "Why the record matters to this company.", "Primary revenue motion and redirect option.", "Fit, confidence, eligibility, and actionability rationale.", "Source-native contact, official route, recommended role, and enrichment status.", "Next action, owner, internal due date, source deadline, and status.", "Disqualifier and duplicate key.", "CRM note, outreach angle, and workflow-ready payload." ]},
    proofPoints: [sources.spendingGuide, sources.recipients, sources.sam, sources.grantForecast, sources.grants, sources.far],
    chartAssets: [{ title: "Illustrative anatomy of an Opportunity Action Table", chartType: "table", takeaway: "Evidence, interpretation, route, and ownership remain distinct but connected.", source: "Illustrative Opportunity Scanner framework informed by official source-field and procurement guidance; no measured claim.", altText: "Illustrative four-layer opportunity report showing evidence, commercial interpretation, contact strategy, and workflow action fields", status: "published", image: { src: "/resources/workflows/opportunity-report-anatomy.svg", width: 1200, height: 675, caption: "Illustrative report architecture. Field values must remain traceable to current sources." }}],
    cta: "View a sample report or run a scan to see official records translated into an Opportunity Action Table."
  },

  "use-sample-opportunity-reports-in-outbound": {
    description: "Use truthful, source-backed sample reports to make public-sector opportunity intelligence concrete before asking a prospect to buy.",
    readTime: "6 min read",
    intro: "A sample report can make an unfamiliar product immediately understandable. It can also damage trust if fictional companies look real, old records appear active, or illustrative actions are presented as customer results. The right sample demonstrates the method: official source, evidence, target, revenue motion, contact path, caveat, and next action. It gives a prospect enough specificity to judge the product without pretending the sample predicts an outcome.",
    keyTakeaways: ["Label fictional context and illustrative actions clearly while keeping public sources real and current.", "Use the sample to demonstrate reasoning and workflow, not invented performance.", "Personalize outbound around the prospect's industry problem, then invite a scan of the prospect's own website."],
    sections: [
      { heading: "Build a sample that can survive scrutiny", body: [
        "Choose a plainly fictional company profile or a disclosed public example. Define its offer, geography, capacity, and exclusions so readers can understand why each signal fits. Use real official records only when the record can be linked and its status, date, and caveats are visible.",
        "Separate verified facts from illustrative interpretation. An award amount, recipient, agency, date, and description can come from USAspending. The suggested revenue motion, target route, and next action are the product's analysis. If a company is ineligible for a grant, the sample must not label it Direct Apply. If an award is historical, the sample must not call it open budget.",
        "FTC guidance says advertising claims must be truthful, non-deceptive, and evidence-based. That applies to claims implied by screenshots and samples, not only headline copy. Never invent customers, testimonials, contacts, replies, meetings, conversion rates, or revenue."
      ]},
      { heading: "Show the action layer, not a wall of research", body: [
        "A strong sample includes a compact company thesis, source-backed signal rows, target organizations, revenue motions, contact strategies, next actions, and report-level priorities. It should show one or two disqualified rows as well, because rejection logic demonstrates discipline.",
        "Use different source lanes. A SAM.gov notice can show active procurement and official response instructions. A USAspending award can show historical market evidence or a funded recipient. A Grants.gov record can demonstrate eligibility. A forecast can show emerging demand. Keep those meanings visible instead of presenting them as one undifferentiated list.",
        "The sample should answer what a prospect is buying: not more search results, but less work translating records into decisions and workflow. Show the source, target, motion, route, owner, and next action together."
      ]},
      { heading: "Match the sample to the outbound hypothesis", body: [
        "Choose the closest industry and business model, not the flashiest report. A DME supplier should see procurement, funded-provider, and channel motions. A creative-services company should see local events, arts funding, recipient, and tourism routes. A workforce platform should see agency procurement, school or workforce-board funding, and partner paths.",
        "Write the message around a recognizable problem: public demand is scattered, grant eligibility is easy to misread, historical awards are not active opportunities, or the right route is unclear. Link to the sample as evidence of the method. Then invite the recipient to run a scan based on their own website rather than claiming the sample proves a fit for them.",
        "An illustrative email might say: 'I put together an example of how a commercial training company could separate agency procurements, funded workforce organizations, and research-only records into owned next steps. The company and actions are illustrative; the public sources are linked. If the structure is relevant, a scan of your site can test your actual offers.' No response or result is assumed."
      ]},
      { heading: "Keep outreach ethical and operational", body: [
        "Use accurate subject lines and sender identity. Explain why the sample is relevant without implying the prospect requested it. FTC's CAN-SPAM guide applies to B2B commercial email and requires a valid postal address, opt-out mechanism, and prompt suppression handling. Do not hide the commercial purpose behind a misleading research pretext.",
        "Store the sample version, source review date, campaign segment, owner, message, and opt-out state in the CRM. If an official source changes or expires, update the sample or add a visible caveat before continuing promotion. Do not keep sending a report whose central opportunity is no longer represented accurately.",
        "Use a modest follow-up sequence. A useful second touch can share one framework or ask whether a different industry example would be more relevant. Stop after the agreed cadence or any opt-out. More messages do not make weak targeting better."
      ]},
      { heading: "Measure the sample without inventing benchmarks", body: [
        "Track delivery, clicks, sample views, scan starts, completed scans, qualified conversations, and paid conversions only when the product records them reliably. Define the denominator and time window. Segment by industry and sample version so the team can learn whether relevance improves progression.",
        "Do not publish a conversion claim from a tiny internal test or imply typical customer results without substantiation. FTC endorsement guidance also warns against unrepresentative experiences and unsupported claims. Until enough evidence exists, report observations internally and describe the sample as a demonstration, not proof of performance.",
        "Retire samples that attract curiosity but produce poor-fit scans. Improve samples when prospects repeatedly misunderstand a motion, source type, or paid field. The purpose is to reduce uncertainty before the sales call, not merely generate clicks."
      ]}
    ],
    practicalList: { title: "Truthful sample-report outbound checklist", items: ["Label fictional companies and illustrative actions clearly.", "Use linkable official records with dates, status, and caveats.", "Separate source facts from product interpretation.", "Show target, motion, route, next action, and at least one disqualifier.", "Match the industry and business model to the recipient.", "Invite a scan rather than claiming the sample proves their fit.", "Use accurate sender identity, subject line, postal address, and opt-out.", "Store source-review date, sample version, owner, and suppression state.", "Measure defined workflow events without publishing unsupported benchmarks." ]},
    proofPoints: [sources.truth, sources.endorsements, sources.email, sources.spendingGuide, sources.sam, sources.grants],
    chartAssets: [{ title: "Illustrative sample-report trust chain", chartType: "flow", takeaway: "A sample earns trust when real sources, explicit labels, useful actions, and compliant outreach remain connected.", source: "Illustrative Opportunity Scanner framework informed by FTC, USAspending, SAM.gov, and Grants.gov guidance; no measured conversion claim.", altText: "Illustrative flow from verified public evidence to labeled sample report, relevant outbound, and prospect-specific scan", status: "published", image: { src: "/resources/workflows/sample-report-trust-chain.svg", width: 1200, height: 675, caption: "Illustrative framework. Samples demonstrate method and do not promise outcomes." }}],
    cta: "View a source-backed sample, then run a scan using your company's actual website and offers."
  },

  "industry-pages-paid-report-conversion": {
    description: "Turn industry education into a transparent path from sourced market evidence to a free scan and paid action layer.",
    readTime: "6 min read",
    intro: "An industry page should not be a generic SEO doorway or a disguised checkout page. It should help a healthcare, education, creative, software, construction, energy, manufacturing, or community-services operator recognize how public money moves in that market. Then it should show what a free scan can validate and what the paid report adds: complete evidence, targets, revenue motions, contact paths, next actions, and workflow-ready rows.",
    keyTakeaways: ["Lead with the industry's public-money pattern and buyer decisions, not generic product features.", "Use related articles and a truthful sample to prove depth before asking for payment.", "The paid unlock should reveal execution work, while the free experience delivers genuine sourced value."],
    sections: [
      { heading: "Teach the market before presenting the product", body: [
        "Each industry has a different public-sector buying map. Healthcare may involve VA procurement, state programs, funded providers, reimbursement, and distributors. Education may involve districts, workforce boards, grants, staffing, and vendor portals. Creative companies may find city events, arts funding, tourism, and recipient partnerships. The page should name these lanes in the language operators use.",
        "Ground the explanation in official sources. SAM.gov supports federal procurement discovery. USAspending shows agencies, recipients, award types, and places of performance. Grants.gov clarifies posted funding and eligibility. Acquisition.gov links to agency forecasts and vendor communication routes. The page should explain what each source can and cannot prove.",
        "Avoid universal claims such as 'government is buying your service' before a scan. Explain the evidence pattern and invite the visitor to test their company. FTC guidance requires marketing claims to be truthful and evidence-based; qualifiers should be visible near the claim they limit."
      ]},
      { heading: "Build a complete industry decision path", body: [
        "The page should move from industry problem to signal types, likely targets, revenue motions, example action rows, related research, sample report, scan, and paid action layer. Every section answers a decision: where money moves, what qualifies, who could buy, how the company could participate, and what the next step looks like.",
        "Use at least three related resources for depth: an industry value guide, a source or workflow guide, and a revenue-motion or contact-path guide. The links should help the visitor resolve a real question, not merely create internal-link volume. A healthcare page might connect to DME procurement, funded-provider intelligence, and contact paths.",
        "Add a sample report matched to the industry. Clearly label fictional context and illustrative actions, preserve real source links, and show disqualifiers. The sample is the bridge between education and product belief because it demonstrates how evidence becomes work."
      ]},
      { heading: "Make the free scan genuinely useful", body: [
        "The free experience should return a small number of real, relevant signals, show the total qualified signal count, identify the strongest lanes, and preserve source credibility. It should not be a teaser containing only generic company description or blurred placeholders.",
        "Explain uncertainty. A scan can find public records and recommend motions, but it cannot guarantee eligibility, available budget, a response, or an award. A zero-match result can be useful when it explains that the current search did not produce credible rows and suggests a narrower offer, different geography, or later monitoring date.",
        "The handoff to paid should occur where the visitor feels the remaining work: additional rows, complete target mapping, evidence details, contact paths, source-native contacts, enrichment where appropriate, CRM notes, outreach angles, and workflow export."
      ]},
      { heading: "Sell the action layer, not more words", body: [
        "Paid value should be concrete. Show which fields unlock and how they reduce work: all qualified signals, target organizations, primary revenue motion, contact strategy, source links, next best action, owner-ready notes, and workflow payload. Avoid vague promises of 'deeper insights' when the product can name the deliverable.",
        "Keep contact-enrichment boundaries clear. Official agency routes and notice contacts remain primary. Enrichment can help validated private recipients, primes, partners, and vendors. It should not imply that every row includes a personal email or that personal contact data is the only path to action.",
        "Place the CTA after enough proof to evaluate the product, and repeat it at a natural end point on long pages. The CTA should say what happens next: scan the company website, review the free signals, then unlock the full action table if the evidence is useful."
      ]},
      { heading: "Connect acquisition, content, and sales operations", body: [
        "Tag the page, article, sample, scan start, scan completion, paid unlock, and assisted-pilot conversation as distinct events. Preserve industry, entry page, and sample version without collecting unnecessary personal detail. Use consistent definitions and time windows before interpreting performance.",
        "Route completed scans into an owner queue with company, industry, strongest signal lane, total qualified rows, and next action. Do not treat every content visitor as a sales-ready lead. A scan with credible rows is a stronger product-intent event than a page view.",
        "An illustrative journey might be industry page to source guide to sample report to free scan to full action table. It is a framework, not a measured funnel. Do not publish conversion rates until there is enough tracked product data to support them."
      ]},
      { heading: "Audit pages for trust and commercial clarity", body: [
        "Review each industry page quarterly or when source rules materially change. Verify links, dates, examples, eligibility language, report screenshots, and paid-field descriptions. Remove claims that no longer match the live product and update samples when their public records change status.",
        "Check whether the page serves the industry's actual motion mix. If scans repeatedly show recipients and partners rather than direct applications, the page should teach that distinction. If many results fail geography or capacity, add qualification guidance. Content should improve with product evidence rather than remain a fixed SEO template.",
        "The best page leaves the operator with a clearer market map even if they do not buy. That usefulness earns the right to ask for a scan. The paid report then earns its price by organizing credible opportunities into work the team can execute."
      ]}
    ],
    practicalList: { title: "Industry-page conversion checklist", items: ["Explain the industry's public-money and procurement lanes.", "Use current official sources and visible caveats.", "Show likely targets and all viable revenue motions.", "Link at least three substantial, decision-relevant resources.", "Include a truthful industry-matched sample report.", "Deliver real source-backed value in the free scan.", "Name the exact action fields unlocked in the paid report.", "Explain source-native contacts and enrichment boundaries.", "Track page, content, sample, scan, and unlock events separately.", "Audit claims, links, examples, and product capabilities regularly." ]},
    proofPoints: [sources.sam, sources.spendingGuide, sources.grants, sources.forecasts, sources.truth, sources.endorsements],
    chartAssets: [{ title: "Illustrative industry education-to-action path", chartType: "flow", takeaway: "Industry education earns a scan; verified signals and execution fields create the paid value.", source: "Illustrative Opportunity Scanner framework informed by official public-source and FTC marketing guidance; no measured conversion claim.", altText: "Illustrative path from industry education through related research and sample report to free scan and paid action table", status: "published", image: { src: "/resources/workflows/industry-page-conversion-path.svg", width: 1200, height: 675, caption: "Illustrative journey. No conversion rate or typical outcome is claimed." }}],
    cta: "Explore your industry, review a source-backed sample, and run a free scan before deciding whether to unlock the full action table."
  }
} satisfies Record<string, ResourceArticleRefresh>;
