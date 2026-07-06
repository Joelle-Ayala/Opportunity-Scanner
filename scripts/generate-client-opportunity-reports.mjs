import { promises as fs } from "fs";
import path from "path";

const outDir = path.join(process.cwd(), "docs", "client-reports");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function signalCard(signal, index) {
  return `
    <article class="card signal-card">
      <div class="signal-top">
        <span class="badge ${signal.actionability === "High Actionability" ? "green" : signal.actionability === "Medium Actionability" ? "blue" : "amber"}">${esc(signal.actionability)}</span>
        <span class="badge">${esc(signal.revenueMotion)}</span>
      </div>
      <h3>${index + 1}. ${esc(signal.title)}</h3>
      <p class="muted">${esc(signal.why)}</p>
      <div class="grid two">
        <div>
          <p class="label">Target</p>
          <p>${esc(signal.target)}</p>
        </div>
        <div>
          <p class="label">Source</p>
          <p><a href="${esc(signal.sourceUrl)}">${esc(signal.source)}</a></p>
        </div>
        <div>
          <p class="label">Contact path</p>
          <p>${esc(signal.contactPath)}</p>
        </div>
        <div>
          <p class="label">Next best action</p>
          <p>${esc(signal.nextAction)}</p>
        </div>
      </div>
      <div class="note"><strong>Outreach angle:</strong> ${esc(signal.outreach)}</div>
    </article>
  `;
}

function actionRows(signals) {
  return signals
    .map(
      (signal, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${esc(signal.title)}</strong><br><span>${esc(signal.whyShort ?? signal.why)}</span></td>
          <td>${esc(signal.target)}</td>
          <td>${esc(signal.source)}</td>
          <td>${esc(signal.revenueMotion)}</td>
          <td>${esc(signal.contactPath)}</td>
          <td>${esc(signal.nextAction)}</td>
        </tr>
      `
    )
    .join("");
}

function contactRows(contacts) {
  return contacts
    .map(
      (contact) => `
        <tr>
          <td>${esc(contact.organization)}</td>
          <td>${esc(contact.contact)}</td>
          <td>${esc(contact.type)}</td>
          <td>${esc(contact.recommendedUse)}</td>
          <td>${esc(contact.source)}</td>
        </tr>
      `
    )
    .join("");
}

function reportHtml(report) {
  const sourceCounts = report.sources.map((source) => `<span class="badge">${esc(source)}</span>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(report.company)} Opportunity Signal Report</title>
  <style>
    :root {
      --ink: #152033;
      --muted: #5c6678;
      --line: #d9e1ec;
      --field: #f6f8fb;
      --accent: #2563eb;
      --green: #0f7a4f;
      --green-bg: #eaf7f0;
      --blue-bg: #edf4ff;
      --amber: #9a5b00;
      --amber-bg: #fff7df;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f7f9fc;
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    a { color: var(--accent); text-decoration: none; }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
    .hero {
      background: white;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 28px;
    }
    .brand { font-size: 13px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
    h1 { margin: 12px 0 10px; font-size: 38px; line-height: 1.08; }
    h2 { margin: 0 0 14px; font-size: 22px; }
    h3 { margin: 12px 0 8px; font-size: 18px; }
    p { margin: 0; }
    .muted { color: var(--muted); }
    .summary { max-width: 820px; color: var(--muted); font-size: 16px; }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    .badge {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--field);
      padding: 5px 9px;
      font-size: 12px;
      font-weight: 700;
      color: var(--ink);
    }
    .badge.green { background: var(--green-bg); border-color: #bce8d0; color: var(--green); }
    .badge.blue { background: var(--blue-bg); border-color: #c7dcff; color: #1d4ed8; }
    .badge.amber { background: var(--amber-bg); border-color: #f4dda0; color: var(--amber); }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 22px; }
    .metric { border: 1px solid var(--line); background: var(--field); border-radius: 8px; padding: 14px; }
    .metric .label { margin-bottom: 4px; }
    .metric strong { font-size: 22px; }
    .section { margin-top: 22px; }
    .card {
      background: white;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 20px;
    }
    .grid { display: grid; gap: 14px; }
    .two { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 16px; }
    .label { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: white; }
    table { width: 100%; min-width: 980px; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 12px; border-bottom: 1px solid var(--line); vertical-align: top; text-align: left; }
    th { background: var(--field); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    td span { color: var(--muted); }
    .signal-card + .signal-card { margin-top: 14px; }
    .signal-top { display: flex; gap: 8px; flex-wrap: wrap; }
    .note { margin-top: 14px; background: var(--field); border: 1px solid var(--line); border-radius: 8px; padding: 12px; color: #334155; }
    .callout { border-left: 4px solid var(--accent); }
    .footer-note { color: var(--muted); font-size: 13px; }
    @media (max-width: 760px) {
      .wrap { padding: 18px 14px 40px; }
      h1 { font-size: 30px; }
      .metrics, .two { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: white; }
      .wrap { max-width: none; padding: 0; }
      .card, .hero, .table-wrap { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="brand">Opportunity Scanner | Paid Opportunity Signal Report</div>
      <h1>${esc(report.company)} Opportunity Signal Report</h1>
      <p class="summary">${esc(report.summary)}</p>
      <div class="badges">${sourceCounts}</div>
      <div class="metrics">
        <div class="metric"><p class="label">Report date</p><strong>${esc(report.date)}</strong></div>
        <div class="metric"><p class="label">Opportunity rows</p><strong>${report.signals.length}</strong></div>
        <div class="metric"><p class="label">Contact entries</p><strong>${report.contacts.length}</strong></div>
        <div class="metric"><p class="label">Primary motion</p><strong>${esc(report.primaryMotion)}</strong></div>
      </div>
    </section>

    <section class="section card callout">
      <h2>What To Do First</h2>
      <ol>
        ${report.firstMoves.map((move) => `<li>${esc(move)}</li>`).join("")}
      </ol>
    </section>

    <section class="section">
      <h2>Opportunity Action Table</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Signal</th><th>Target</th><th>Source</th><th>Revenue Motion</th><th>Contact Path</th><th>Next Best Action</th>
            </tr>
          </thead>
          <tbody>${actionRows(report.signals)}</tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>Connector Contact Layer</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Organization</th><th>Contact</th><th>Contact Type</th><th>Recommended Use</th><th>Connector / Source</th></tr>
          </thead>
          <tbody>${contactRows(report.contacts)}</tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>Signal Detail</h2>
      ${report.signals.map(signalCard).join("")}
    </section>

    <section class="section card">
      <h2>7-Day Action Plan</h2>
      <ol>
        ${report.actionPlan.map((step) => `<li>${esc(step)}</li>`).join("")}
      </ol>
    </section>

    <section class="section card">
      <h2>Source And Contact Notes</h2>
      <p class="footer-note">${esc(report.notes)}</p>
    </section>
  </main>
</body>
</html>`;
}

function writeContactCsv(filename, contacts) {
  const rows = [
    ["Organization", "Contact", "Contact Type", "Recommended Use", "Connector / Source"],
    ...contacts.map((contact) => [
      contact.organization,
      contact.contact,
      contact.type,
      contact.recommendedUse,
      contact.source
    ])
  ];
  return fs.writeFile(path.join(outDir, filename), rows.map((row) => row.map(csvCell).join(",")).join("\n"));
}

const reports = [
  {
    slug: "jammcard",
    company: "Jammcard",
    date: "July 5, 2026",
    primaryMotion: "Partner / Sell",
    sources: ["Grants.gov", "USAspending.gov", "Snov.io", "Source-native contacts"],
    summary:
      "Jammcard has a public-sector growth path through funded arts programming, city and parks event programming, cultural-exchange opportunities, public concerts, and creative workforce partnerships. The product-level next move is a focused target-and-contact campaign, not a generic grant search.",
    firstMoves: [
      "Prioritize the NEA July 9 funding window and approach likely arts applicants or recent grantees as a named talent/programming partner.",
      "Use the source-native Grants.gov contacts only for eligibility or program questions; sell through recipient, program, event, or partnership owners.",
      "Build a 30-account outreach list across funded arts organizations, city arts offices, parks/tourism programs, and event-production vendors.",
      "Start outreach with a concrete offer: vetted professional musicians, booking support, public event programming, or creative workforce talent infrastructure."
    ],
    contacts: [
      {
        organization: "National Endowment for the Arts",
        contact: "apply@arts.gov | 202-682-5504 | NEA Staff",
        type: "Source-native program contact",
        recommendedUse: "Use for Grants for Arts Projects eligibility/program questions, not as the sales buyer.",
        source: "Grants.gov connector"
      },
      {
        organization: "U.S. Embassy Ottawa Public Diplomacy Section",
        contact: "Jennifer Acuff / Ottawa Public Affairs | ottawa-pa@state.gov | 703-314-6820",
        type: "Source-native program contact",
        recommendedUse: "Use for U.S. Talent Program eligibility questions and partner routing.",
        source: "Grants.gov connector"
      },
      {
        organization: "Bureau of Educational and Cultural Affairs",
        contact: "Julia Gomez-Nelson | nelsonjg2@state.gov | 202-890-9795",
        type: "Source-native program contact",
        recommendedUse: "Use only if pursuing the Creative Tech Exchange or next-cycle monitoring.",
        source: "Grants.gov connector"
      },
      {
        organization: "ReImagine ATL",
        contact: "info@reimagineatl.com; julie@reimagineatl.com; terp@reimagineatl.com",
        type: "Snov-generated domain email candidates",
        recommendedUse: "Verify role before outreach; start with partnership/workforce-program angle.",
        source: "Snov.io v2 domain search"
      },
      {
        organization: "Jackson Symphony Association",
        contact: "info@jacksonsymphony.org; school.jso@jacksonsymphony.org; joan.cummings@jacksonsymphony.org",
        type: "Snov-generated domain email candidates",
        recommendedUse: "Verify role before outreach; start with guest artist, local musician, or public-concert programming angle.",
        source: "Snov.io v2 domain search"
      },
      {
        organization: "South Carolina parks/tourism amphitheater project",
        contact: "Parks and Recreation Director; Tourism Program Manager; Special Events Manager; Procurement Specialist",
        type: "Generated role contact path",
        recommendedUse: "Resolve Boyd Pond Park/Aiken County program owner, then ask who owns launch-season live programming.",
        source: "Opportunity Scanner contact logic"
      }
    ],
    signals: [
      {
        title: "NEA Grants for Arts Projects 2, FY 2027",
        why: "Active national arts funding can create funded buyers for Jammcard: arts agencies, venues, nonprofits, festivals, cultural organizations, and community programs that need credible music talent or programming partners.",
        whyShort: "Active arts funding cycle with near-term partner potential.",
        target: "Eligible arts organizations and future NEA award recipients",
        source: "Grants.gov",
        sourceUrl: "https://www.grants.gov/search-results-detail/362192",
        revenueMotion: "Partner with Recipient",
        actionability: "High Actionability",
        contactPath: "Arts Program Director, Executive Director, Grants Manager, Festival Director",
        nextAction: "Identify 10-15 likely applicants or recurring grantees and offer Jammcard as a named talent/programming partner.",
        outreach: "Jammcard can strengthen your arts project with vetted professional musicians, booking support, and a ready talent network."
      },
      {
        title: "South Carolina amphitheater funding at Boyd Pond Park",
        why: "A $300,000 public award supports an outdoor amphitheater intended for musical performances, community presentations, and cultural celebrations.",
        target: "South Carolina Department of Parks, Recreation & Tourism / Boyd Pond Park",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/P24AF01844",
        revenueMotion: "Sell to Funded Buyer",
        actionability: "High Actionability",
        contactPath: "Parks/Recreation, tourism, special events, cultural programming, procurement",
        nextAction: "Map the Boyd Pond Park project owner and pitch Jammcard as a launch-season live music programming partner.",
        outreach: "The amphitheater needs repeatable public programming; Jammcard can supply reliable professional live music talent."
      },
      {
        title: "City of Seattle live music performance funding",
        why: "Seattle received NEA funding tied directly to a visual arts exhibition and live music performances, validating a city arts-office buying lane.",
        target: "City of Seattle",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/1953663-62-26",
        revenueMotion: "Sell to Funded Buyer",
        actionability: "High Actionability",
        contactPath: "Cultural affairs, public art, events, arts program, procurement",
        nextAction: "Find the funded department or arts program owner and pitch a curated musician roster for public events.",
        outreach: "Jammcard can help city arts teams execute source-backed live music programming with less talent-sourcing burden."
      },
      {
        title: "U.S. Talent Program for Embassy and Consulates in Canada",
        why: "This active Department of State opportunity connects U.S. citizen talent, artists, and cultural professionals with Canadian audiences.",
        target: "U.S. Embassy and Consulates in Canada",
        source: "Grants.gov",
        sourceUrl: "https://www.grants.gov/search-results-detail/362763",
        revenueMotion: "Direct Apply / Partner",
        actionability: "Medium Actionability",
        contactPath: "Public diplomacy program manager, cultural affairs officer, international programs director",
        nextAction: "Review eligibility and decide whether Jammcard should apply directly, partner with an eligible nonprofit, or supply named talent.",
        outreach: "Jammcard can provide a vetted U.S. artist network and booking infrastructure for cultural exchange programming."
      },
      {
        title: "Creative workforce funding: ReImagine ATL",
        why: "ReImagine ATL received funding for creative workforce development and apprenticeship programs, supporting a workforce-development angle for Jammcard.",
        target: "ReImagine ATL",
        source: "USAspending.gov + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/1945309-34-26",
        revenueMotion: "Partner with Recipient",
        actionability: "Medium Actionability",
        contactPath: "Executive Director, Workforce Program Manager, Youth Programs Director, Creative Program Director",
        nextAction: "Pitch Jammcard as a professional mentor, talent-network, or music-industry career partner.",
        outreach: "Jammcard can connect creative workforce programs to working music professionals, mentorship, and career exposure."
      },
      {
        title: "Jackson Symphony public concert funding",
        why: "NEA-supported public concert funding points to budgets where Jammcard can support guest artists, musician sourcing, and adjacent community programming.",
        target: "Jackson Symphony Association",
        source: "USAspending.gov + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/1945748-31-26",
        revenueMotion: "Partner with Recipient",
        actionability: "Medium Actionability",
        contactPath: "Executive Director, Artistic Director, Community Engagement Director, Production Manager",
        nextAction: "Approach the symphony with a guest-artist or local-musician sourcing offer.",
        outreach: "Jammcard can expand the concert series with guest artists and professional talent infrastructure."
      }
    ],
    actionPlan: [
      "Day 1: Pick three lanes: NEA applicant partnerships, funded city/parks programming, and event-production vendor channels.",
      "Day 2: Build a 30-account target list using the report table and contact layer.",
      "Day 3: Send outreach to NEA applicants and grantees before the July 9 window closes.",
      "Day 4: Start funded-buyer outreach to South Carolina parks/tourism and Seattle arts programming contacts.",
      "Day 5: Contact ReImagine ATL and Jackson Symphony with specific partner offers.",
      "Day 6: Build a procurement watchlist for public concerts, event entertainment, and summer concert series.",
      "Day 7: Review replies and choose the next two-week pursuit lane."
    ],
    notes:
      "Grants.gov contacts are source-native program contacts. Snov.io contacts are domain-email candidates and should be verified before outreach. USAspending.gov records show public money flow and buyer/partner evidence; they are not automatically open solicitations."
  },
  {
    slug: "reparel",
    company: "Reparel",
    date: "July 5, 2026",
    primaryMotion: "Channel / Buyer",
    sources: ["USAspending.gov", "Snov.io", "Opportunity Scanner contact logic"],
    summary:
      "Reparel has a clear public-sector money-flow pattern around rehabilitation supplies, physical therapy supplies, orthotic supplies, VA/healthcare purchasing, and DME-adjacent routes. The immediate opportunity is channel and procurement mapping, not a generic grant strategy.",
    firstMoves: [
      "Start with First Nations Distribution, Performance Health Supply, and National Environmental because they are tied to current or recent HHS rehab/medical supply buying.",
      "Use Snov-generated contacts only where the domain is clear; verify role fit before outreach.",
      "Lead with product-category fit: recovery sleeve, post-op support, brace/boot undersleeve, pain/swelling support, PT/rehab supply, and reimbursable DME-adjacent positioning.",
      "Use VA and DOD records as market evidence, then identify the current buying office or distributor channel."
    ],
    contacts: [
      {
        organization: "Performance Health Supply / Performance Health",
        contact: "info@performancehealth.com; customersupport@performancehealth.com; blands@performancehealth.com",
        type: "Snov-generated domain email candidates",
        recommendedUse: "Verify role and route to rehab supply category, government sales, DME/orthotics product, or supplier onboarding.",
        source: "Snov.io v2 domain search"
      },
      {
        organization: "Footmaxx",
        contact: "michael.kinney@footmaxx.com; charlie.doll@footmaxx.com; rob.martin@footmaxx.com",
        type: "Snov-generated domain email candidates",
        recommendedUse: "Verify role before outreach; use as orthotics-channel intelligence, not the first Reparel sales target.",
        source: "Snov.io v2 domain search"
      },
      {
        organization: "First Nations Distribution LLC",
        contact: "Government Contracts Manager; Medical Supply Category Manager; Clinical Supply Manager",
        type: "Generated role contact path",
        recommendedUse: "Resolve company domain or SAM/UEI profile, then ask how rehab supply products are added to public-sector BPA ordering paths.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "National Environmental Inc.",
        contact: "Government Contracts Manager; Physical Therapy Supply Buyer; Clinical Supply Manager",
        type: "Generated role contact path",
        recommendedUse: "Validate whether the recipient is a relevant distributor; if not, pivot to the HHS/IHS buying office.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "Department of Veterans Affairs physical therapy/prosthetics route",
        contact: "VA Prosthetics Representative; VA Physical Therapy Supply Buyer; Procurement Specialist",
        type: "Generated office contact path",
        recommendedUse: "Use VA award evidence to identify current prosthetics, orthotics, and PT supply buying offices.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      }
    ],
    signals: [
      {
        title: "HHS BPA for medical and rehabilitation supplies: First Nations Distribution",
        why: "HHS awarded First Nations Distribution $46,400 for a BPA covering miscellaneous medical and rehabilitation supplies through March 2027.",
        target: "First Nations Distribution LLC / HHS buying office",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P00458",
        revenueMotion: "Sell to Award Recipient / Channel Motion",
        actionability: "High Actionability",
        contactPath: "Government contracts, medical supply category, clinical supply, procurement",
        nextAction: "Resolve the company domain/SAM entity and ask how products are added to public-sector BPA ordering catalogs.",
        outreach: "Reparel may fit rehab supply ordering paths as a recovery sleeve and orthotic-adjacent SKU."
      },
      {
        title: "HHS BPA for rehab supplies: Performance Health Supply",
        why: "HHS awarded Performance Health Supply $21,600 for miscellaneous medical and rehabilitation supplies through April 2027.",
        target: "Performance Health Supply / Performance Health",
        source: "USAspending.gov + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P00547",
        revenueMotion: "Sell to Award Recipient / Channel Motion",
        actionability: "High Actionability",
        contactPath: "Rehab supply category, DME/orthotics product, government sales, clinical supply buyer",
        nextAction: "Use Snov candidates to route toward supplier onboarding and rehab product-category fit.",
        outreach: "Reparel supports post-op, arthritis, brace undersleeve, and PT recovery use cases that may fit public-sector supply channels."
      },
      {
        title: "HHS physical rehabilitation BPA: National Environmental",
        why: "HHS awarded National Environmental $20,000 for physical therapy supplies for direct patient care on an as-needed basis through September 2026.",
        target: "National Environmental Inc. / HHS buying office",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P01050",
        revenueMotion: "Sell to Award Recipient / Sell to Agency",
        actionability: "High Actionability",
        contactPath: "Government contracts, PT supply buyer, rehab services, clinical supply",
        nextAction: "Verify whether the recipient is a relevant distributor; if not, use the record to identify the buying office.",
        outreach: "Reparel may fit an as-needed physical rehabilitation supply category for patient recovery support."
      },
      {
        title: "VA physical therapy supplies: Apex Integrated Distribution",
        why: "VA purchase activity for physical therapy supplies validates a VA market lane for PT, prosthetics, orthotics, and recovery support supplies.",
        target: "Department of Veterans Affairs / Apex Integrated Distribution",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/36C24W25P0146",
        revenueMotion: "Sell to Agency / Channel Motion",
        actionability: "Medium Actionability",
        contactPath: "VA prosthetics, PT supply buyer, procurement specialist",
        nextAction: "Map similar active VA supply routes and determine whether Reparel should pursue VA procurement or distributor onboarding.",
        outreach: "Reparel is positioned around recovery, inflammation, post-op use, and clinical support in PT supply routes."
      },
      {
        title: "DOD orthotic supplies: Footmaxx",
        why: "DOD awarded Footmaxx for orthotic supplies, showing military medical purchasing includes orthotic supply lanes adjacent to Reparel.",
        target: "Footmaxx / DOD medical supply channel",
        source: "USAspending.gov + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/HT009024FG0310039",
        revenueMotion: "Channel / Distributor Motion",
        actionability: "Medium Actionability",
        contactPath: "Orthotics product manager, government contracts, DOD medical supply buyer",
        nextAction: "Use Footmaxx as channel intelligence while researching active DOD or military treatment facility supply vehicles.",
        outreach: "Reparel can complement orthotic and bracing categories as a recovery sleeve and brace/boot undersleeve."
      }
    ],
    actionPlan: [
      "Day 1: Finalize a one-page public-sector product positioning note for Reparel.",
      "Day 2: Build a target sheet for First Nations Distribution, Performance Health, National Environmental, Apex, and Footmaxx.",
      "Day 3: Validate which targets are distributors, resellers, catalog suppliers, or direct service providers.",
      "Day 4: Identify the HHS, VA, and DOD buying offices attached to the top records.",
      "Day 5: Send supplier-onboarding/product-fit outreach to the highest-confidence channel targets.",
      "Day 6: Log responses and requests for product sheets, reimbursement notes, or clinical evidence.",
      "Day 7: Choose the next pursuit path: channel onboarding, agency procurement mapping, or evidence packet."
    ],
    notes:
      "USAspending.gov records show money flow and buyer/channel evidence. They are not open solicitations unless separately verified. Snov.io contacts are domain-email candidates and should be verified before outreach. Where a domain could not be safely resolved, this report preserves a role or office contact path rather than inventing a personal contact."
  }
];

await fs.mkdir(outDir, { recursive: true });

for (const report of reports) {
  await fs.writeFile(path.join(outDir, `${report.slug}-opportunity-signal-report.html`), reportHtml(report));
  await writeContactCsv(`${report.slug}-contacts.csv`, report.contacts);
}

console.log(`Generated ${reports.length} client opportunity report(s) in ${outDir}`);
