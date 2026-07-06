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

function contactEntryCount(contacts = []) {
  return contacts.reduce((total, contact) => total + (contact.entries?.length ?? 1), 0);
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
      ${signal.socialProof ? `<div class="note"><strong>Proof:</strong> ${esc(signal.socialProof)}</div>` : ""}
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
          <td>${esc(signal.source)}${signal.socialProof ? `<br><span>${esc(signal.socialProof)}</span>` : ""}</td>
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

function bulletSection(title, items) {
  if (!items?.length) return "";
  return `
    <section class="section card">
      <h2>${esc(title)}</h2>
      <ul class="tight-list">
        ${items.map((item) => `<li>${esc(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function cardsSection(title, cards) {
  if (!cards?.length) return "";
  return `
    <section class="section">
      <h2>${esc(title)}</h2>
      <div class="card-grid">
        ${cards
          .map(
            (card) => `
              <article class="card mini-card">
                <p class="label">${esc(card.label)}</p>
                <h3>${esc(card.title)}</h3>
                <p class="muted">${esc(card.body)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function emailDraftsSection(drafts) {
  if (!drafts?.length) return "";
  return `
    <section class="section">
      <h2>First-Touch Email Drafts</h2>
      <p class="section-intro">These are short first touches Jammcard can adapt today. They are intentionally specific to the signal and ask for the right owner instead of assuming a personal contact is always available.</p>
      <div class="grid">
        ${drafts
          .map(
            (draft) => `
              <article class="card email-draft">
                <p class="label">${esc(draft.useCase)}</p>
                <h3>${esc(draft.subject)}</h3>
                <pre>${esc(draft.body)}</pre>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
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
    .section-intro { color: var(--muted); margin-bottom: 12px; max-width: 850px; }
    .card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .mini-card h3 { margin-top: 6px; }
    .tight-list { margin: 0; padding-left: 20px; }
    .tight-list li + li { margin-top: 8px; }
    .email-draft pre {
      margin: 12px 0 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: inherit;
      color: #334155;
      background: var(--field);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    @media (max-width: 760px) {
      .wrap { padding: 18px 14px 40px; }
      h1 { font-size: 30px; }
      .metrics, .two, .card-grid { grid-template-columns: 1fr; }
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
        <div class="metric"><p class="label">Contact entries</p><strong>${contactEntryCount(report.contacts)}</strong></div>
        <div class="metric"><p class="label">Primary motion</p><strong>${esc(report.primaryMotion)}</strong></div>
      </div>
    </section>

    ${cardsSection("CEO Digest", report.digest)}

    <section class="section card callout">
      <h2>What To Do First</h2>
      <ol>
        ${report.firstMoves.map((move) => `<li>${esc(move)}</li>`).join("")}
      </ol>
    </section>

    ${bulletSection("Coverage Check", report.coverage)}

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

    ${bulletSection("Contacts We Have", report.contactProof)}

    <section class="section">
      <h2>Signal Detail</h2>
      ${report.signals.map(signalCard).join("")}
    </section>

    ${emailDraftsSection(report.emailDrafts)}

    <section class="section card">
      <h2>7-Day Action Plan</h2>
      <ol>
        ${report.actionPlan.map((step) => `<li>${esc(step)}</li>`).join("")}
      </ol>
    </section>

    ${bulletSection("Live Refresh Notes", report.liveRefresh)}

    <section class="section card">
      <h2>Source And Contact Notes</h2>
      <p class="footer-note">${esc(report.notes)}</p>
    </section>
  </main>
</body>
</html>`;
}

function writeContactCsv(filename, contacts) {
  const contactRows = contacts.flatMap((contact) => {
    if (!contact.entries?.length) return [contact];
    return contact.entries.map((entry) => ({
      organization: contact.organization,
      contact: entry,
      type: contact.type,
      recommendedUse: contact.recommendedUse,
      source: contact.source
    }));
  });
  const rows = [
    ["Organization", "Contact", "Contact Type", "Recommended Use", "Connector / Source"],
    ...contactRows.map((contact) => [
      contact.organization,
      contact.contact,
      contact.type,
      contact.recommendedUse,
      contact.source
    ])
  ];
  return fs.writeFile(path.join(outDir, filename), rows.map((row) => row.map(csvCell).join(",")).join("\n"));
}

async function writeOutreachPackage(report) {
  if (!report.outreachTargets?.length) return;

  const rows = [
    [
      "Priority",
      "Target Organization",
      "Opportunity Context",
      "Contact Info",
      "Contact Type",
      "Sendability",
      "Recommended Owner",
      "Source URL",
      "First Email Subject",
      "First Email Body",
      "Follow Up 1",
      "Follow Up 2",
      "CRM Note"
    ],
    ...report.outreachTargets.map((target) => [
      target.priority,
      target.organization,
      target.context,
      target.contactInfo,
      target.contactType,
      target.sendability,
      target.owner,
      target.sourceUrl,
      target.email.subject,
      target.email.body,
      target.followUps[0] ?? "",
      target.followUps[1] ?? "",
      target.crmNote
    ])
  ];

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  await fs.writeFile(path.join(outDir, `${report.slug}-ai-outreach-package.csv`), csv);

  const json = {
    company: report.company,
    prepared_at: report.date,
    purpose:
      "AI-ready outreach package for Jammcard business development follow-up. Use source context, contacts, drafts, and follow-up logic to create tasks, draft sends, and manage replies.",
    operating_rules: report.outreachRules,
    targets: report.outreachTargets
  };
  await fs.writeFile(path.join(outDir, `${report.slug}-ai-outreach-package.json`), JSON.stringify(json, null, 2));

  const md = `# ${report.company} AI Outreach Package

Prepared: ${report.date}

## How To Use This

${report.outreachRules.map((rule) => `- ${rule}`).join("\n")}

## Targets

${report.outreachTargets
  .map(
    (target) => `### ${target.priority}. ${target.organization}

- Opportunity context: ${target.context}
- Contact info: ${target.contactInfo}
- Contact type: ${target.contactType}
- Sendability: ${target.sendability}
- Recommended owner: ${target.owner}
- Source: ${target.sourceUrl}
- CRM note: ${target.crmNote}

Subject: ${target.email.subject}

\`\`\`text
${target.email.body}
\`\`\`

Follow-up 1:

\`\`\`text
${target.followUps[0] ?? ""}
\`\`\`

Follow-up 2:

\`\`\`text
${target.followUps[1] ?? ""}
\`\`\`
`
  )
  .join("\n")}
`;

  await fs.writeFile(path.join(outDir, `${report.slug}-ai-outreach-package.md`), md);
}

const reports = [
  {
    slug: "jammcard",
    company: "Jammcard",
    date: "July 6, 2026",
    primaryMotion: "Channel / Vendor",
    sources: ["USAspending.gov", "Clay", "Snov.io", "Grants.gov", "Source-native contacts"],
    summary:
      "Jammcard's strongest public-sector path is through event-entertainment vendors, musician-services contractors, public event producers, and funded public-programming teams that already buy or manage live music. Grants remain useful context, but the most actionable lane is partner/channel outreach to organizations already touching public event and musician-services money.",
    digest: [
      {
        label: "Best first move",
        title: "Event vendor channel sprint",
        body: "Start with DEGY and LADGOV-style public-event vendors. Clay found named contacts and public award records show active musician/event spend."
      },
      {
        label: "Secondary lane",
        title: "Funded public programming",
        body: "Use parks, tourism, city arts, public concerts, and cultural organizations as direct buyer/partner targets where the source record mentions live music."
      },
      {
        label: "Contact status",
        title: "30+ contact entries",
        body: "Clay and Snov now provide a broader bench: sendable emails, backup candidates, named people, and role-routing targets. Source-native grant contacts are included only for program questions."
      }
    ],
    firstMoves: [
      "Today: upload the AI outreach package and start the event/vendor channel queue first: DEGY, LADGOV, and similar musician-services/event-entertainment contractors.",
      "Next: create research tasks for current contracting offices and rebid cycles tied to event entertainment, musician services, public concerts, and military/community events.",
      "Then: send funded-program outreach to Boyd Pond Park, City of Seattle, Jackson Symphony, and ReImagine ATL.",
      "Use Grants.gov contacts only for eligibility/program questions. Do not make grant contacts the main outreach path."
    ],
    coverage: [
      "Local scan coverage: 28 Jammcard source records from the June 30 Opportunity Scanner scan: 24 USAspending.gov records, 3 Grants.gov opportunities, and 1 Federal Register policy/procurement signal.",
      "Curated client-facing coverage: 8 priority opportunity rows focused on Jammcard's strongest public-sector motion.",
      "This report prioritizes event-entertainment and musician-services records because those are the opportunity types most aligned to Jammcard's outreach motion.",
      "Not every source record is shown as a top row. Older, duplicative, foreign-only, broad policy, or weak-fit records were downgraded to market-map context.",
      "Live refresh on July 6, 2026: USAspending surfaced additional musician-services records, and Clay enriched DEGY/LADGOV contacts for the vendor/channel lane."
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
        contact: "Clay names: Emily Kuester, Director of Workforce Development; Jessie Sparrow, Executive Director; Alio Issoufou, Job Placement Coordinator. Snov email candidates: info@reimagineatl.com; julie@reimagineatl.com; terp@reimagineatl.com",
        entries: [
          "Emily Kuester, Director of Workforce Development | LinkedIn: https://www.linkedin.com/in/emily-kuester-21ba27138/ | Email: not found by Clay",
          "Jessie Sparrow, Executive Director | LinkedIn: https://www.linkedin.com/in/jessie-sparrow-ba28b3147/ | Email: not found by Clay",
          "Alio Issoufou, Job Placement Coordinator | LinkedIn: https://www.linkedin.com/in/alio-issoufou-6883372b1/ | Email: not found by Clay",
          "info@reimagineatl.com | Snov-generated domain candidate",
          "julie@reimagineatl.com | Snov-generated domain candidate",
          "terp@reimagineatl.com | Snov-generated domain candidate"
        ],
        type: "Clay named contacts + Snov email candidates",
        recommendedUse: "Use named roles for personalization; verify best email before automated outreach. Start with partnership/workforce-program angle.",
        source: "Clay + Snov.io v2 domain search"
      },
      {
        organization: "Jackson Symphony Association",
        contact: "info@jacksonsymphony.org; school.jso@jacksonsymphony.org; joan.cummings@jacksonsymphony.org",
        entries: [
          "info@jacksonsymphony.org | Snov-generated domain candidate",
          "school.jso@jacksonsymphony.org | Snov-generated domain candidate",
          "joan.cummings@jacksonsymphony.org | Snov-generated domain candidate"
        ],
        type: "Snov-generated domain email candidates",
        recommendedUse: "Verify role before outreach; start with guest artist, local musician, or public-concert programming angle.",
        source: "Snov.io v2 domain search"
      },
      {
        organization: "DEGY Booking International",
        contact: "Clay contacts: Caite Kendrick, Director of Business Development, caite@degy.com; Nick DiRoma, Vice President, nick@degy.com; Sean Sullivan, Booking Agent, sean@degy.com. Backup candidates: Paige Moyer, Aislinn Jones, Isabella Silva, info@degy.com, ari@degy.com, jeff@degy.com",
        entries: [
          "Caite Kendrick, Director of Business Development | caite@degy.com | LinkedIn: https://www.linkedin.com/in/caite-kendrick-575696365/",
          "Nick DiRoma, Vice President | nick@degy.com | LinkedIn: https://www.linkedin.com/in/nick-diroma-150694b/",
          "Sean Sullivan, Booking Agent | sean@degy.com | LinkedIn: https://www.linkedin.com/in/sean-sulli/",
          "Paige Moyer, Booking Agent Assistant | paige@degy.com",
          "Aislinn Jones, Booking Agent Assistant | aislinn@degy.com",
          "Isabella Silva, Corporate, Private, & Special Events Intern | isabella.silva@degy.com",
          "info@degy.com | Snov backup candidate",
          "ari@degy.com | Snov backup candidate",
          "jeff@degy.com | Snov backup candidate"
        ],
        type: "Clay-enriched named contacts + Snov backup candidates",
        recommendedUse: "Primary event/vendor channel target tied to public event-entertainment spending. Start with Caite, Nick, or Sean; keep assistants/backups for routing.",
        source: "Clay + Snov.io + USAspending.gov"
      },
      {
        organization: "LADGOV Corp",
        contact: "Chris Bradley, Business Development Specialist, cbradley@ladgov.com; Ouidad Mandour, ouidad.mandour@ladgov.com",
        entries: [
          "Chris Bradley, Business Development Specialist | cbradley@ladgov.com | LinkedIn: https://www.linkedin.com/in/chris-bradley-5a71aa237/",
          "Ouidad Mandour | ouidad.mandour@ladgov.com | Snov backup candidate"
        ],
        type: "Clay-identified contact + Snov email candidates",
        recommendedUse: "Musician-services contractor target. Use channel/partner language and verify emails before send.",
        source: "Clay + Snov.io + USAspending.gov"
      },
      {
        organization: "City of Seattle arts/culture program",
        contact: "Clay named role candidates: Ashraf Hasham, Partnerships, Education, and Grants Manager; Robert Rutherford, Public Art Program Manager; Hernan Paganini, Seattle Office of Arts & Culture Public Art; Chris Swenson, Film Program Manager; Ed King, Seattle Arts Commission",
        entries: [
          "Ashraf Hasham, Partnerships, Education, and Grants Manager @ Seattle Office of Arts & Culture | LinkedIn: https://www.linkedin.com/in/ashraf-hasham-9043a735/ | Email: pending/not returned by Clay",
          "Robert Rutherford, Public Art Program Manager | LinkedIn: https://www.linkedin.com/in/robert-rutherford-833b89118/ | Email: pending/not returned by Clay",
          "Hernan Paganini, Seattle Office of Arts & Culture Public Art | LinkedIn: https://www.linkedin.com/in/hernan-paganini-44383323/ | Email: pending/not returned by Clay",
          "Chris Swenson, Film Program Manager, Seattle Office of Economic Development | LinkedIn: https://www.linkedin.com/in/chris-swenson-5943338/ | Email: pending/not returned by Clay",
          "Ed King, Seattle Arts Commission | LinkedIn: https://www.linkedin.com/in/ed-king-372b846/ | Email: pending/not returned by Clay"
        ],
        type: "Clay named role candidates",
        recommendedUse: "Use as named routing targets for Seattle arts/culture owner research; source record shows live music performance funding, not a general vendor inbox.",
        source: "Clay + USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "South Carolina parks/tourism amphitheater project",
        contact: "Clay named role candidates: Colby Parnell, Parks and Recreation Director; Tandra Cooks, Recreation Manager; Carolyn Rushton, Recreation Supervisor; Becky D., Procurement Director; Linda Hallman, Purchasing Spec; Debbie Pearson, Purchasing Manager",
        entries: [
          "Colby Parnell, Parks and Recreation Director | LinkedIn: https://www.linkedin.com/in/colby-parnell-cprp-cysa-a2704267/ | Email: pending/not returned by Clay",
          "Tandra Cooks, Recreation Manager | LinkedIn: https://www.linkedin.com/in/tandra-cooks-5aa81740/ | Email: pending/not returned by Clay",
          "Carolyn Rushton, Recreation Supervisor | LinkedIn: https://www.linkedin.com/in/carolyn-rushton-a6911731/ | Email: pending/not returned by Clay",
          "Becky D., Procurement Director | LinkedIn: https://www.linkedin.com/in/becky-d-507535a9/ | Email: pending/not returned by Clay",
          "Linda Hallman, Purchasing Spec | LinkedIn: https://www.linkedin.com/in/linda-hallman-942a204b/ | Email: pending/not returned by Clay",
          "Debbie Pearson, Purchasing Manager | LinkedIn: https://www.linkedin.com/in/debbie-pearson-02988535/ | Email: pending/not returned by Clay",
          "Diane Winbigler, Recreation Supervisor | LinkedIn: https://www.linkedin.com/in/diane-winbigler-b16b6a17/ | Email: pending/not returned by Clay"
        ],
        type: "Clay named role candidates",
        recommendedUse: "Use as named routing targets for Boyd Pond Park/Aiken County program owner research, then ask who owns launch-season live programming.",
        source: "Clay + Opportunity Scanner contact logic"
      }
    ],
    contactProof: [
      "Source-native contacts found: NEA apply@arts.gov / 202-682-5504; U.S. Embassy Ottawa Public Diplomacy ottawa-pa@state.gov / 703-314-6820; Bureau of Educational and Cultural Affairs nelsonjg2@state.gov / 202-890-9795.",
      "Clay-enriched named contacts found for the priority vendor/channel lane: Caite Kendrick, Nick DiRoma, Sean Sullivan, Paige Moyer, Aislinn Jones, and Isabella Silva at DEGY; Chris Bradley at LADGOV.",
      "Snov backup candidates remain available for DEGY, LADGOV, ReImagine ATL, and Jackson Symphony. Verify before automated sending.",
      "Clay found named public-sector role candidates for City of Seattle arts/culture and Aiken County parks/procurement; most public-sector emails were not returned, so use LinkedIn/source routing or official department contact paths.",
      "Clay found ReImagine ATL role candidates, while Snov provided domain email candidates for actual send routing.",
      "Recommended automation rule: do not send sales emails to Grants.gov program contacts. Use them for eligibility/program questions only; use partner/program/event contacts for business development."
    ],
    liveRefresh: [
      "Live USAspending refresh run July 6, 2026 found additional musician-services and event-entertainment spending records. These are now the primary watchlist/channel lane.",
      "Clay enrichment run July 6, 2026 found named contacts for DEGY, LADGOV, ReImagine ATL, City of Seattle, and Aiken County role paths relevant to business development, booking, workforce programming, parks, procurement, and arts/culture routing.",
      "Live Grants.gov refresh confirmed the original grant signals remain useful context, but they are not the main Jammcard outreach motion."
    ],
    emailDrafts: [
      {
        useCase: "NEA applicants / arts grantees",
        subject: "Potential Jammcard partner for your NEA arts project",
        body: `Hi [Name],

I saw the current NEA Grants for Arts Projects cycle and wanted to reach out because Jammcard may be a useful implementation partner for music, performance, or public-facing arts programming.

Jammcard works with a vetted network of professional musicians and music industry talent. If your team is preparing, submitting, or implementing an arts project that needs credible artist talent, booking support, or music-programming infrastructure, we may be able to strengthen the project as a named partner or post-award resource.

Would you be the right person to discuss programming partners, or is there someone else who owns artist/talent partnerships for this project?

Best,
[Sender]`
      },
      {
        useCase: "City / parks / tourism program owner",
        subject: "Live music programming support for funded public spaces",
        body: `Hi [Name],

I came across public funding tied to music, cultural programming, and public-space activation, and thought Jammcard could be relevant as you plan events or recurring programming.

Jammcard can help source vetted professional musicians and support live music programming for public events, amphitheaters, parks, tourism programs, and cultural activations.

Who on your team owns live performance programming or vendor/partner selection for upcoming public events?

Best,
[Sender]`
      },
      {
        useCase: "Funded arts organization / public concert partner",
        subject: "Guest artist and musician sourcing support",
        body: `Hi [Name],

I saw your public concert / arts programming work and wanted to ask whether Jammcard could support upcoming programming with vetted guest artists, local musician sourcing, or music-industry talent connections.

Jammcard is built around professional music talent and may be useful where a funded program needs reliable artist sourcing without adding extra lift to the internal programming team.

Would it make sense to connect with whoever manages artist booking, production, or community programming?

Best,
[Sender]`
      },
      {
        useCase: "Event-production vendor / incumbent public contractor",
        subject: "Talent sourcing layer for public-sector events",
        body: `Hi [Name],

I noticed your organization has touched public-sector event entertainment or musician-services work. Jammcard may be a useful partner when projects need reliable professional musicians, performers, or music-programming support.

The fit is pretty direct: public award records show repeat spend around event entertainment and musician services, and Jammcard's network is built around vetted music professionals.

Is there someone on your team who handles talent partnerships or event programming support?

Best,
[Sender]`
      }
    ],
    outreachRules: [
      "Use the CSV or JSON as the upload source for an outreach AI instance.",
      "Treat source-native Grants.gov contacts as program/eligibility contacts only, not as sales buyers.",
      "Prioritize Clay-enriched named contacts for DEGY and LADGOV before broader grant or arts-program outreach.",
      "Verify Snov-generated domain email candidates before sending personalized outreach.",
      "For generated role paths, first create a research task to identify the named person who owns that role.",
      "Prioritize sends in this order: event/vendor channel contacts, funded public programming owners, funded arts organizations, then grant/program contacts.",
      "Log source URL, revenue motion, contact type, email sent, reply, follow-up date, and next action in CRM."
    ],
    outreachTargets: [
      {
        priority: 1,
        organization: "DEGY Booking International / public-event vendor channel",
        context: "USAspending shows public event-entertainment spending with DEGY. Clay also describes DEGY as active in college and military booking, which overlaps with public-sector event buyer patterns.",
        contactInfo: "Clay priority contacts: Caite Kendrick, Director of Business Development, caite@degy.com; Nick DiRoma, Vice President, nick@degy.com; Sean Sullivan, Booking Agent, sean@degy.com. Backup/routing contacts: Paige Moyer, paige@degy.com; Aislinn Jones, aislinn@degy.com; Isabella Silva, isabella.silva@degy.com; Snov candidates info@degy.com, ari@degy.com, jeff@degy.com.",
        contactType: "Clay-enriched named contacts + Snov backup candidates",
        sendability: "Sendable after final human review; use partner/channel language.",
        owner: "Director of Business Development, VP, Booking Agent",
        sourceUrl: "https://www.usaspending.gov/award/19JA8026P1045",
        email: {
          subject: "Talent sourcing support for public-sector event work",
          body: `Hi [Name],

I saw DEGY's public-sector event entertainment work and thought Jammcard could be a useful talent-sourcing partner for projects that need reliable professional musicians or specialized music programming.

Jammcard works with vetted music professionals, and DEGY's college/military booking focus looks like a strong overlap with public-sector event needs.

Would it make sense to explore where Jammcard could support overflow talent sourcing, specialized musician needs, or public-event programming?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether Jammcard could support DEGY as a talent-sourcing layer for public-sector or military/community event work.",
          "Hi [Name] - if talent partnerships are handled by someone else, I would appreciate the right contact."
        ],
        crmNote: "Primary channel target. Clay-enriched contact. Public award evidence: DEGY event-entertainment award."
      },
      {
        priority: 2,
        organization: "LADGOV Corp / musician-services contractor channel",
        context: "Live USAspending refresh found LADGOV musician-services spending tied to USCG Cape May Chapel musician services through 2028.",
        contactInfo: "Clay identified Chris Bradley, Business Development Specialist; Snov candidate cbradley@ladgov.com. Backup Snov candidate: Ouidad Mandour, ouidad.mandour@ladgov.com.",
        contactType: "Clay-identified contact + Snov email candidates",
        sendability: "Verify email before send; strong fit for partner/channel outreach.",
        owner: "Business Development Specialist",
        sourceUrl: "https://www.usaspending.gov/award/70Z04323PTRCM0001",
        email: {
          subject: "Musician talent support for government service contracts",
          body: `Hi Chris,

I saw LADGOV's musician-services work with government buyers and wanted to ask whether Jammcard could be a useful talent partner for similar contracts.

Jammcard works with vetted professional musicians and could potentially support sourcing, backup coverage, or specialized music talent for government, military, chapel, or community-event needs.

Would it make sense to compare notes on where LADGOV needs musician talent support?

Best,
[Sender]`
        },
        followUps: [
          "Hi Chris - quick follow-up on whether Jammcard could support musician sourcing for government service contracts or similar public-sector work.",
          "Hi Chris - if someone else manages partner/vendor relationships for musician services, I would appreciate the right contact."
        ],
        crmNote: "Primary channel target. Clay identified BD owner; Snov supplied email candidate."
      },
      {
        priority: 3,
        organization: "Likely NEA applicants and recent arts grantees",
        context: "Active NEA Grants for Arts Projects deadline on July 9, 2026. Jammcard can be positioned as a named music talent/programming partner.",
        contactInfo: "Use internal target list; source-native NEA program contact for eligibility only: apply@arts.gov / 202-682-5504.",
        contactType: "Target list plus source-native program contact",
        sendability: "Send after selecting specific organizations. Do not send sales pitch to NEA program contact.",
        owner: "Executive Director, Arts Program Director, Grants Manager, Festival Director",
        sourceUrl: "https://www.grants.gov/search-results-detail/362192",
        email: {
          subject: "Potential Jammcard partner for your NEA arts project",
          body: `Hi [Name],

I saw the current NEA Grants for Arts Projects cycle and wanted to reach out because Jammcard may be a useful implementation partner for music, performance, or public-facing arts programming.

Jammcard works with a vetted network of professional musicians and music industry talent. If your team is preparing, submitting, or implementing an arts project that needs credible artist talent, booking support, or music-programming infrastructure, we may be able to strengthen the project as a named partner or post-award resource.

Would you be the right person to discuss programming partners, or is there someone else who owns artist/talent partnerships for this project?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up in case this is relevant for your NEA project or post-award programming. Jammcard can support vetted musician sourcing and public-facing music programming if useful.",
          "Hi [Name] - closing the loop. If artist/talent partnerships are handled by someone else on your team, I would appreciate a pointer to the right person."
        ],
        crmNote: "NEA partner lane. Goal is partner routing, not direct grant contact sales."
      },
      {
        priority: 4,
        organization: "South Carolina parks/tourism amphitheater project",
        context: "A $300,000 public award supports an outdoor amphitheater at Boyd Pond Park with intended musical performances and cultural celebrations.",
        contactInfo: "Clay named role candidates: Colby Parnell, Parks and Recreation Director; Tandra Cooks, Recreation Manager; Carolyn Rushton, Recreation Supervisor; Becky D., Procurement Director; Linda Hallman, Purchasing Spec; Debbie Pearson, Purchasing Manager; Diane Winbigler, Recreation Supervisor. Emails pending/not returned by Clay.",
        contactType: "Clay named role candidates",
        sendability: "Research official email or use LinkedIn/department routing first, then send.",
        owner: "Parks/Recreation Director, Recreation Manager, or Procurement Director",
        sourceUrl: "https://www.usaspending.gov/award/P24AF01844",
        email: {
          subject: "Live music programming support for Boyd Pond Park",
          body: `Hi [Name],

I came across public funding tied to the Boyd Pond Park amphitheater and its future use for musical performances, community presentations, and cultural celebrations.

Jammcard can help source vetted professional musicians and support live music programming for public spaces, amphitheaters, parks, tourism programs, and cultural activations.

Who on your team owns launch-season programming or partner selection for the amphitheater?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on the Boyd Pond Park amphitheater programming note. Is there a program owner or events contact I should route this to?",
          "Hi [Name] - I will close the loop here. If there is a parks, tourism, or events contact planning live programming, I would appreciate the referral."
        ],
        crmNote: "Funded public programming buyer. Needs named project owner before send."
      },
      {
        priority: 5,
        organization: "City of Seattle arts/culture program",
        context: "NEA-backed city arts funding included live music performances, validating a city arts-office programming lane.",
        contactInfo: "Clay named role candidates: Ashraf Hasham, Partnerships/Education/Grants Manager; Robert Rutherford, Public Art Program Manager; Hernan Paganini, Seattle Office of Arts & Culture Public Art; Chris Swenson, Film Program Manager; Ed King, Seattle Arts Commission. Emails pending/not returned by Clay.",
        contactType: "Clay named role candidates",
        sendability: "Research official email or use LinkedIn/department routing first, then send.",
        owner: "Arts/culture partnerships, public art, film/events, or grants manager",
        sourceUrl: "https://www.usaspending.gov/award/1953663-62-26",
        email: {
          subject: "Musician sourcing for city arts programming",
          body: `Hi [Name],

I saw public arts funding tied to live music performances and wanted to ask whether Jammcard could be relevant for upcoming city cultural programming.

Jammcard helps source vetted professional musicians and could support exhibitions, public events, and community-facing performances where a city team needs credible talent quickly.

Are you the right person for live music programming, or should I reach someone on the arts/events team?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - checking back on my note about musician sourcing for city arts programming. Is there someone on the arts/events side who owns this?",
          "Hi [Name] - last follow-up. Happy to send a short overview if public programming or live music talent sourcing is on your roadmap."
        ],
        crmNote: "City arts/public event buyer lane. Needs named Seattle program owner."
      },
      {
        priority: 6,
        organization: "ReImagine ATL",
        context: "Public funding for creative workforce development and apprenticeship programs. Jammcard can support music-industry mentor/talent-network access.",
        contactInfo: "Clay named role candidates: Emily Kuester, Director of Workforce Development; Jessie Sparrow, Executive Director; Alio Issoufou, Job Placement Coordinator. Clay did not return direct emails. Snov candidates: info@reimagineatl.com; julie@reimagineatl.com; terp@reimagineatl.com.",
        contactType: "Clay named contacts + Snov-generated email candidates",
        sendability: "Use named-role personalization; verify best email before send. Info@ is safest first route if no direct email is confirmed.",
        owner: "Director of Workforce Development, Executive Director, Job Placement Coordinator",
        sourceUrl: "https://www.usaspending.gov/award/1945309-34-26",
        email: {
          subject: "Music industry mentors for creative workforce programming",
          body: `Hi [Name],

I saw ReImagine ATL's creative workforce and apprenticeship work and wanted to ask whether Jammcard could support future programming with music-industry professionals, mentors, or artist/talent network access.

Jammcard works with professional musicians and music industry talent, which may be useful for youth creative workforce programs that want real industry exposure.

Would you be the right person to discuss program partnerships?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether Jammcard's professional music network could support creative workforce programming or mentorship.",
          "Hi [Name] - if someone else owns workforce or youth program partnerships, I would appreciate a pointer."
        ],
        crmNote: "Creative workforce partner target. Verify best contact before automated send."
      },
      {
        priority: 7,
        organization: "Jackson Symphony Association",
        context: "NEA-supported public concert funding. Jammcard can support guest artist sourcing, local musician discovery, or community concert amplification.",
        contactInfo: "Snov candidates: info@jacksonsymphony.org; school.jso@jacksonsymphony.org; joan.cummings@jacksonsymphony.org.",
        contactType: "Snov-generated domain email candidates",
        sendability: "Verify role before send; info@ is safest first route.",
        owner: "Executive Director, Artistic Director, Community Engagement Director, Production Manager",
        sourceUrl: "https://www.usaspending.gov/award/1945748-31-26",
        email: {
          subject: "Guest artist and musician sourcing support",
          body: `Hi [Name],

I saw your public concert programming work and wanted to ask whether Jammcard could support upcoming programming with vetted guest artists, local musician sourcing, or music-industry talent connections.

Jammcard is built around professional music talent and may be useful where a funded program needs reliable artist sourcing without adding extra lift to the internal programming team.

Would it make sense to connect with whoever manages artist booking, production, or community programming?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - following up on whether Jammcard could support guest artist or musician sourcing for public concert programming.",
          "Hi [Name] - if programming or production partnerships are handled by someone else, I would appreciate the right contact."
        ],
        crmNote: "Funded arts organization partner target. Verify best role."
      }
    ],
    signals: [
      {
        title: "Public event entertainment and musician-services contractor lane",
        why: "This is the clearest Jammcard-fit lane: public agencies and incumbent vendors are already buying event entertainment, musician services, and recurring music support. Jammcard can pursue vendors and program owners as a talent-sourcing partner rather than waiting for a grant cycle.",
        whyShort: "Best-fit lane: public money is already moving to event entertainment and musician-services vendors.",
        target: "DEGY, LADGOV, musician-services vendors, public-event producers, and agency contracting offices",
        source: "USAspending.gov + Clay",
        sourceUrl: "https://www.usaspending.gov/search",
        revenueMotion: "Channel / Vendor Motion",
        actionability: "High Actionability",
        contactPath: "Director of Business Development, VP, Booking Agent, Business Development Specialist, Contracting Officer",
        nextAction: "Start with Clay-enriched DEGY and LADGOV contacts, then build a watchlist of similar event-entertainment and musician-services awards for rebids and partner outreach.",
        socialProof: "DEGY has a public event-entertainment award and Clay describes its business around college/military booking. LADGOV appears in musician-services public spending, and Clay identified a business development contact.",
        outreach: "Jammcard can be a vetted talent-sourcing layer for vendors and agencies that repeatedly need reliable professional musicians."
      },
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
        socialProof: "Grants.gov lists an active NEA arts funding cycle with music and presenting/multidisciplinary works in scope.",
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
        socialProof: "The USAspending award description explicitly references future musical performances and cultural celebrations at the amphitheater.",
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
        socialProof: "The public award is tied to live music performances, validating city arts offices as a buyer lane.",
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
        socialProof: "Grants.gov lists a source-native U.S. Embassy Ottawa contact and frames the program around U.S. citizen talent, artists, and cultural professionals.",
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
        socialProof: "USAspending shows public funding for creative workforce development; Snov returned domain email candidates for outreach routing.",
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
        socialProof: "USAspending shows NEA-supported public concert funding, and Snov returned Jackson Symphony domain contact candidates.",
        outreach: "Jammcard can expand the concert series with guest artists and professional talent infrastructure."
      },
      {
        title: "FY 2026 U.S. Creative Tech Exchange",
        why: "This active cultural-exchange opportunity is relevant if Jammcard can credibly frame musicians, creators, and technology-enabled talent networks as part of creative-economy exchange. The deadline is July 6, 2026, so it is urgent and only worth pursuing if a partner/application is already nearly ready.",
        target: "Bureau of Educational and Cultural Affairs",
        source: "Grants.gov",
        sourceUrl: "https://www.grants.gov/search-results-detail/362308",
        revenueMotion: "Direct Apply / Watchlist",
        actionability: "Low Actionability",
        contactPath: "Cultural Exchange Program Manager, Creative Economy Lead, International Programs Director",
        nextAction: "Use the source-native contact only if an application or eligible partner is ready today; otherwise add to next-cycle watchlist.",
        socialProof: "Grants.gov lists a source-native Bureau of Educational and Cultural Affairs contact, but the July 6 deadline makes this a same-day/next-cycle item.",
        outreach: "Jammcard sits at the intersection of professional creative talent and technology-enabled access, which can support creative-sector exchange programs."
      }
    ],
    actionPlan: [
      "Step 1: Upload the AI outreach package CSV or JSON to Jammcard's outreach AI instance.",
      "Step 2: Have the AI create separate queues for event/vendor channel contacts, funded public-programming owners, funded arts organizations, and grant/program contacts.",
      "Step 3: Start with Clay-enriched DEGY and LADGOV contacts, then use Snov contacts for funded arts organizations after role verification.",
      "Step 4: Create research tasks for South Carolina/Boyd Pond Park and City of Seattle because those are role paths, not verified personal contacts yet.",
      "Step 5: Send funded-buyer outreach to Jackson Symphony and ReImagine ATL after contact validation.",
      "Step 6: Keep NEA and Creative Tech Exchange as grant/program lanes; use source-native contacts only for eligibility or routing questions.",
      "Step 7: Track replies, referrals, requested materials, and next actions in CRM."
    ],
    notes:
      "Clay contacts were used for vendor, nonprofit, city arts, and parks/procurement role discovery. Grants.gov contacts are source-native program contacts. Snov.io contacts are domain-email candidates and should be verified before outreach. USAspending.gov records show public money flow and buyer/partner evidence; they are not automatically open solicitations."
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

const onlySlug = process.argv
  .find((arg) => arg.startsWith("--only="))
  ?.replace("--only=", "")
  .trim();

const selectedReports = onlySlug ? reports.filter((report) => report.slug === onlySlug) : reports;

for (const report of selectedReports) {
  await fs.writeFile(path.join(outDir, `${report.slug}-opportunity-signal-report.html`), reportHtml(report));
  await writeContactCsv(`${report.slug}-contacts.csv`, report.contacts);
  await writeOutreachPackage(report);
}

console.log(`Generated ${selectedReports.length} client opportunity report(s) in ${outDir}`);
