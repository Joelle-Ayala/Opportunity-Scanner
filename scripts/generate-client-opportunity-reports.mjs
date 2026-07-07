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
      <p class="section-intro">These are short first touches the team can adapt today. They are intentionally specific to the signal and ask for the right owner instead of assuming a personal contact is always available.</p>
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
      `AI-ready outreach package for ${report.company} business development follow-up. Use source context, contacts, drafts, and follow-up logic to create tasks, draft sends, and manage replies.`,
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
    slug: "schoolgig",
    company: "SchoolGig",
    date: "July 6, 2026",
    primaryMotion: "Education Workforce",
    sources: ["USAspending.gov", "Clay", "Grants.gov", "Source-native contacts"],
    summary:
      "SchoolGig's strongest public-sector path is educator workforce, teacher recruitment and retention, grow-your-own pipelines, teaching-artist staffing, and education HR/recruiting infrastructure. The best opportunities are not generic education grants. They are funded programs and incumbent vendors that already touch school staffing, educator pipelines, apprenticeships, arts education delivery, or hiring infrastructure.",
    digest: [
      {
        label: "Best first move",
        title: "Educator workforce sprint",
        body: "Start with Alaska Council of School Administrators and NYSUT because both awards explicitly fund teacher recruitment, retention, apprenticeship, and district/BOCES participation."
      },
      {
        label: "Secondary lane",
        title: "Arts education staffing",
        body: "Use Kennedy Center and MOAD as teaching-artist and arts education partner lanes where SchoolGig can support instructor, teaching artist, and enrichment staffing."
      },
      {
        label: "Contact status",
        title: "Named roles plus source contacts",
        body: "Clay found named contacts for NYSUT, Kennedy Center, Westat, YRCI, and LADGOV. Some direct emails were not returned, so use LinkedIn/manual routing or official org contact paths where needed."
      }
    ],
    firstMoves: [
      "Today: build outreach queues for educator workforce, grow-your-own/apprenticeship, arts education staffing, and HR/recruiting tech vendors.",
      "Start with Alaska Council of School Administrators and NYSUT because they have the cleanest SchoolGig fit and clear public funding tied to educator workforce.",
      "Use Kennedy Center and MOAD as arts education/teaching-artist staffing lanes, not generic arts outreach.",
      "Use LADGOV as the first sendable vendor/channel test because named contacts and email candidates are already available.",
      "Use YRCI, Westat, Trewon, and similar vendors as channel intelligence or partner targets; do not treat every federal HR vendor as a direct SchoolGig buyer."
    ],
    coverage: [
      "Local scan coverage: latest SchoolGig scan from June 30, 2026 includes 21 opportunity records; the evaluator reports 18 visible clean signals after weak-fit screening.",
      "Curated coverage: 8 priority opportunity rows are included here because they map most directly to SchoolGig's education workforce, district staffing, teaching-artist, and HR/recruiting workflows.",
      "Kennedy Center was moved into this SchoolGig package because it is an arts education and teaching-artist staffing signal, not a Jammcard event/vendor signal.",
      "Broad cultural, healthcare, transit, or generic workforce records were downgraded unless the source explicitly connected to educator hiring, school staffing, arts education, teacher shortage, or HR/recruiting infrastructure.",
      "Live enrichment on July 6, 2026 used Clay for named contacts on NYSUT, Kennedy Center, Westat, YRCI, and LADGOV. Direct emails were not returned for several public-sector or nonprofit contacts, so the package preserves named role paths instead of inventing emails."
    ],
    contacts: [
      {
        organization: "Alaska Council of School Administrators / rural educator recruitment",
        contact: "Executive Director; educator workforce program lead; district HR/recruitment directors across the seven partner districts",
        entries: [
          "Executive Director / superintendent association leadership | Email: research needed",
          "Educator workforce program lead | Email: research needed",
          "District HR or recruitment directors for the seven partner districts | Email: research needed"
        ],
        type: "Source-backed role path",
        recommendedUse: "Resolve ACSA project owner and partner district HR leads before sending. Use recruitment/retention and rural educator pipeline language.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "NYSUT Education and Learning Trust",
        contact: "Clay named contacts: Tyrone Hendrix, Executive Director; Peter Applebee, Director of Policy and Program Development; Amy Rudat, Deputy Director, Research and Educational Services; Carrie Andrews, Director of Constituency Programs and Services; Dana Osta, Program Services",
        entries: [
          "Tyrone Hendrix, Executive Director | LinkedIn: https://www.linkedin.com/in/tyronehendrix/ | Email: not found by Clay",
          "Peter Applebee, Director of Policy and Program Development | LinkedIn: https://www.linkedin.com/in/peter-applebee-8056873/ | Email: not found by Clay",
          "Amy Rudat, Deputy Director, Research and Educational Services | LinkedIn: https://www.linkedin.com/in/amyrudat/ | Email: not found by Clay",
          "Carrie Andrews, Director of Constituency Programs and Services | LinkedIn: https://www.linkedin.com/in/carrie-andrews-2bbab360/ | Email: not found by Clay",
          "Dana Osta, Program Services | LinkedIn: https://www.linkedin.com/in/dana-osta-572255a0/ | Email: not found by Clay"
        ],
        type: "Clay named role contacts",
        recommendedUse: "Use named roles for manual routing and LinkedIn/email research. Lead with educator apprenticeship, employer incentives, BOCES/district participation, and candidate pipeline support.",
        source: "Clay + USAspending.gov"
      },
      {
        organization: "John F. Kennedy Center for the Performing Arts",
        contact: "Clay named contacts: Jordan LaSalle, Vice President of Education; Darrell Ayers, Vice President, Education and Jazz; Ashi Day, Manager, Music & Washington National Opera Education; Debi Segal, Assistant Manager, Special Education. Backup Snov candidates from prior pull: info@kennedy-center.org; sarah@kennedy-center.org; msholt@kennedy-center.org",
        entries: [
          "Jordan LaSalle, Vice President of Education | LinkedIn: https://www.linkedin.com/in/jordan-lasalle-b987665/ | Email: pending/not returned by Clay",
          "Darrell Ayers, Vice President, Education and Jazz | LinkedIn: https://www.linkedin.com/in/darrell-ayers-b493952/ | Email: pending/not returned by Clay",
          "Ashi Day, Manager, Music & Washington National Opera Education | LinkedIn: https://www.linkedin.com/in/ashiday/ | Email: pending/not returned by Clay",
          "Debi Segal, Assistant Manager, Special Education | LinkedIn: https://www.linkedin.com/in/debi-segal-50bab441/ | Email: pending/not returned by Clay",
          "info@kennedy-center.org | Snov-generated domain candidate",
          "sarah@kennedy-center.org | Snov-generated domain candidate",
          "msholt@kennedy-center.org | Snov-generated domain candidate"
        ],
        type: "Clay named contacts + Snov backup candidates",
        recommendedUse: "Use for arts education and teaching-artist staffing routing. Do not frame as live-event booking.",
        source: "Clay + Snov.io + USAspending.gov"
      },
      {
        organization: "Museum of the African Diaspora / Bay Area Title I arts education",
        contact: "Education Director; school partnerships lead; teaching artist coordinator; teacher professional development manager",
        entries: [
          "Education Director / school partnerships lead | Email: research needed",
          "Teaching artist coordinator | Email: research needed",
          "Teacher professional development manager | Email: research needed"
        ],
        type: "Source-backed role path",
        recommendedUse: "Use as a teaching-artist and standards-aligned arts education staffing lane. Resolve the education program owner before sending.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "Westat / education research and staffing data vendor lane",
        contact: "Clay named contacts: Justin Baer, Vice President and Practice Director for Education and Social Policy; Amy Lally, Senior Business Development Specialist; Aliya Pilchen, Principal Research Associate, Education Studies; Shaliza Buckredan, Senior Talent Acquisition Specialist; Peter Morrison, Business Development Manager",
        entries: [
          "Justin Baer, Vice President and Practice Director for Education and Social Policy | LinkedIn: https://www.linkedin.com/in/justin-baer-193270109/ | Email: pending/not returned by Clay",
          "Amy Lally, Senior Business Development Specialist | LinkedIn: https://www.linkedin.com/in/amyklally/ | Email: pending/not returned by Clay",
          "Aliya Pilchen, Principal Research Associate, Education Studies | LinkedIn: https://www.linkedin.com/in/aliya-pilchen-736ab152/ | Email: pending/not returned by Clay",
          "Shaliza Buckredan, Senior Talent Acquisition Specialist | LinkedIn: https://www.linkedin.com/in/shaliza-buckredan-4437aa6/ | Email: pending/not returned by Clay",
          "Peter Morrison, Business Development Manager | LinkedIn: https://www.linkedin.com/in/peter-morrison-a0a37354/ | Email: pending/not returned by Clay"
        ],
        type: "Clay named role contacts",
        recommendedUse: "Use for partner/channel research around education data, teacher workforce research, and government education services.",
        source: "Clay + USAspending.gov"
      },
      {
        organization: "YRCI / government talent acquisition vendor lane",
        contact: "Clay named contacts: Colin Waitt, Director of Business Development; Max Wyche, Director, Human Capital Business Development & Client Engagement; George Carelock, Program Manager; Sonia K., Senior HR Staffing Specialist; Eric Hoyt, Senior Staffing Specialist",
        entries: [
          "Colin Waitt, Director of Business Development | LinkedIn: https://www.linkedin.com/in/colin-waitt-87aa3817b/ | Email: pending/not returned by Clay",
          "Max Wyche, Director, Human Capital Business Development & Client Engagement | LinkedIn: https://www.linkedin.com/in/max-wyche-1aaa6b69/ | Email: pending/not returned by Clay",
          "George Carelock, Program Manager | LinkedIn: https://www.linkedin.com/in/george-carelock-50692a148/ | Email: pending/not returned by Clay",
          "Sonia K., Senior Human Resources Specialist (Staffing) | LinkedIn: https://www.linkedin.com/in/sonia-mk/ | Email: pending/not returned by Clay",
          "Eric Hoyt, Senior Staffing Specialist | LinkedIn: https://www.linkedin.com/in/ephoyt95/ | Email: pending/not returned by Clay"
        ],
        type: "Clay named role contacts",
        recommendedUse: "Use as a channel/vendor research target for talent acquisition services. Do not lead with K-12 unless education-specific fit is confirmed.",
        source: "Clay + USAspending.gov"
      },
      {
        organization: "LADGOV Corp / teaching artist vendor signal",
        contact: "Chris Bradley, Business Development Specialist, cbradley@ladgov.com; Ouidad Mandour, ouidad.mandour@ladgov.com",
        entries: [
          "Chris Bradley, Business Development Specialist | cbradley@ladgov.com | LinkedIn: https://www.linkedin.com/in/chris-bradley-5a71aa237/",
          "Ouidad Mandour | ouidad.mandour@ladgov.com | Snov backup candidate"
        ],
        type: "Clay-identified contact + Snov email candidates",
        recommendedUse: "Useful adjacent vendor/channel target for teaching-artist style staffing. Verify whether LADGOV handles education, tutor, or arts-instruction contracts.",
        source: "Clay + Snov.io + USAspending.gov"
      },
      {
        organization: "Grants.gov source-native education contacts",
        contact: "Holly Clark / OESE.ComprehensiveCenters@ed.gov / 202-245-6408; reshone.moore@ed.gov; ben.witthoefft@ed.gov / 202-795-7407",
        entries: [
          "Holly Clark, Management and Program Analyst | OESE.ComprehensiveCenters@ed.gov | 202-245-6408",
          "Reshone Moore | reshone.moore@ed.gov | Talent Search source-native contact",
          "Ben Witthoefft | ben.witthoefft@ed.gov | Talent Search source-native contact | 202-795-7407"
        ],
        type: "Source-native program contacts",
        recommendedUse: "Use only for eligibility, program, or routing questions. Do not send sales pitches to Grants.gov program contacts.",
        source: "Grants.gov connector"
      }
    ],
    contactProof: [
      "Clay found named contacts for NYSUT, Kennedy Center, Westat, YRCI, and LADGOV, but several direct emails were not returned. Use those as named routing targets, LinkedIn/manual research tasks, official contact-path inputs, or verified email sends where available.",
      "Existing LADGOV contacts from the Jammcard enrichment pass are available for the teaching-artist vendor lane: Chris Bradley at cbradley@ladgov.com and Ouidad Mandour at ouidad.mandour@ladgov.com.",
      "Source-native Grants.gov contacts are available for OESE Comprehensive Centers and Talent Search, but those should be used for eligibility or program questions only.",
      "Alaska Council of School Administrators and MOAD are strong source-backed opportunities, but they need official contact resolution before automated outreach.",
      "Recommended automation rule: classify every contact as confirmed email, candidate email, named person without email, or role path before sending."
    ],
    liveRefresh: [
      "Latest local SchoolGig scan reviewed July 6, 2026: 21 source-backed records, with 8 priority rows selected for the paid-style package.",
      "Clay enrichment run July 6, 2026 found named contacts for NYSUT, Kennedy Center, Westat, YRCI, and LADGOV. Alaska Council of School Administrators did not resolve through the tested domain, so it remains a source-backed role path.",
      "The Kennedy Center National Arts Education signal was moved into SchoolGig because it is an arts education and teaching-artist staffing lane.",
      "Weak-fit records were intentionally excluded or downgraded if they were generic cultural programming, healthcare, transit, or broad workforce records without a school staffing or educator pipeline angle."
    ],
    emailDrafts: [
      {
        useCase: "Educator workforce recipient / rural teacher recruitment",
        subject: "Support for hard-to-fill educator roles",
        body: `Hi [Name],

I saw the public funding tied to educator recruitment and retention, and thought SchoolGig may be relevant as your team works with districts on hard-to-fill teacher and school staffing needs.

SchoolGig is built around education hiring workflows, so the fit may be candidate sourcing, role visibility, district recruitment support, or helping funded partners reach educators for shortage-area roles.

Would you be the right person to discuss educator workforce partnerships, or should I connect with someone on the program or district HR side?

Best,
[Sender]`
      },
      {
        useCase: "Educator apprenticeship / grow-your-own pipeline",
        subject: "Candidate pipeline support for educator apprenticeship programs",
        body: `Hi [Name],

I saw the educator workforce and apprenticeship funding connected to your work and wanted to ask whether SchoolGig could support district or BOCES partners with candidate pipeline visibility, recruitment workflows, or hard-to-fill education roles.

SchoolGig may be useful where funded educator pathways need to connect aspiring educators, career changers, paraprofessionals, and school employers.

Would it make sense to compare notes on where your program needs recruitment or employer-engagement support?

Best,
[Sender]`
      },
      {
        useCase: "Arts education / teaching artist staffing",
        subject: "Teaching artist and education staffing support",
        body: `Hi [Name],

I saw public funding tied to arts education, teaching artists, teacher professional development, and school-facing programming.

SchoolGig may be useful where programs need to find, organize, or route qualified educators, teaching artists, and enrichment staff into school or district-facing opportunities.

Who owns educator, teaching artist, or school partnership staffing for this program?

Best,
[Sender]`
      },
      {
        useCase: "HR/recruiting technology vendor or channel partner",
        subject: "Education hiring workflow partnership",
        body: `Hi [Name],

I saw public-sector talent acquisition or education workforce work tied to your organization and wanted to ask whether there may be a partner fit with SchoolGig.

SchoolGig focuses on education hiring workflows and could be useful where a program or client needs school-specific candidate sourcing, role distribution, or educator pipeline support.

Would you be the right person for partnership or business development conversations around education workforce needs?

Best,
[Sender]`
      }
    ],
    outreachRules: [
      "Use the CSV or JSON as the upload source for a SchoolGig outreach AI instance.",
      "Prioritize educator workforce and school staffing lanes before broad HR/recruiting technology or generic education grants.",
      "Do not send sales emails to Grants.gov program contacts. Use source-native program contacts only for eligibility, program, or routing questions.",
      "For Clay contacts without emails, create a manual research or LinkedIn-routing task instead of inventing an email.",
      "Treat YRCI, Westat, Trewon, and similar vendors as channel or market-map targets unless a direct SchoolGig education hiring fit is confirmed.",
      "Log source URL, award amount, revenue motion, contact type, sendability, email sent, reply, follow-up date, and next action in CRM."
    ],
    outreachTargets: [
      {
        priority: 1,
        organization: "Alaska Council of School Administrators / rural educator recruitment",
        context: "$6,840,910 Department of Education award for Raising the Bar for Rural Alaskan Educators, a seven-district partnership to improve teacher recruitment and retention.",
        contactInfo: "Resolve ACSA executive director, educator workforce program lead, and district HR/recruitment directors across the seven partner districts.",
        contactType: "Source-backed role path",
        sendability: "Research named owner first, then send.",
        owner: "Executive Director, educator workforce lead, district HR/recruitment director",
        sourceUrl: "https://www.usaspending.gov/award/S374A230034",
        email: {
          subject: "Support for rural educator recruitment",
          body: `Hi [Name],

I saw the Raising the Bar for Rural Alaskan Educators award and the focus on teacher recruitment and retention across partner districts.

SchoolGig may be useful where districts need more visibility for hard-to-fill educator roles, candidate sourcing support, or a school-specific hiring workflow.

Would you be the right person to discuss educator recruitment support, or should I connect with the program or district HR lead?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether SchoolGig could support rural teacher recruitment or district hiring visibility tied to this program.",
          "Hi [Name] - if someone else owns educator workforce or district recruitment partnerships, I would appreciate the right contact."
        ],
        crmNote: "Highest-fit SchoolGig target. Award amount: $6,840,910. Needs named program owner and partner district HR routing."
      },
      {
        priority: 2,
        organization: "NYSUT Education and Learning Trust / educator apprenticeship",
        context: "$5,657,497 Department of Labor award to re-engineer the educator workforce model, develop 75 registered apprenticeship programs, support pre-apprenticeships, and engage school districts/BOCES.",
        contactInfo: "Clay named contacts: Tyrone Hendrix, Peter Applebee, Amy Rudat, Carrie Andrews, Dana Osta. Direct emails not found by Clay.",
        contactType: "Clay named role contacts",
        sendability: "Use LinkedIn/manual email research or official NYSUT routing before send.",
        owner: "Program development, apprenticeship, educator workforce, employer engagement",
        sourceUrl: "https://www.usaspending.gov/award/AP386392260A36",
        email: {
          subject: "Candidate pipeline support for educator apprenticeships",
          body: `Hi [Name],

I saw the educator workforce apprenticeship award and the focus on district/BOCES participation, registered apprenticeship pathways, and bringing more people into the profession.

SchoolGig may be useful as a school-specific hiring and candidate pipeline layer for participating districts, apprentices, paraprofessionals, and career changers.

Would it make sense to compare notes on where your program needs recruitment, candidate visibility, or employer-engagement support?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - checking back on whether SchoolGig could support candidate pipeline or district hiring workflows for educator apprenticeship partners.",
          "Hi [Name] - if apprenticeship partnerships or employer engagement is owned by someone else, I would appreciate the referral."
        ],
        crmNote: "Very strong educator workforce/training lane. Award amount: $5,657,497. Direct email research needed."
      },
      {
        priority: 3,
        organization: "Kennedy Center National Arts Education Program",
        context: "$32,000,000 Department of Education award for Kennedy Center National Arts Education Program through September 30, 2026.",
        contactInfo: "Clay named contacts: Jordan LaSalle, Darrell Ayers, Ashi Day, Debi Segal. Backup Snov candidates: info@kennedy-center.org; sarah@kennedy-center.org; msholt@kennedy-center.org.",
        contactType: "Clay named contacts + Snov backup candidates",
        sendability: "Verify email before send; use arts education and teaching-artist staffing language.",
        owner: "Vice President of Education, education program lead, teaching artist program lead",
        sourceUrl: "https://www.usaspending.gov/award/S351A220007",
        email: {
          subject: "Teaching artist and education staffing support",
          body: `Hi [Name],

I saw the Kennedy Center National Arts Education Program award and wanted to ask whether SchoolGig could be useful around teaching artist, educator, or school partnership staffing.

SchoolGig is focused on education hiring workflows and may help programs find or route qualified educators, teaching artists, and enrichment staff into school-facing opportunities.

Would you be the right person to discuss education staffing or teaching artist partnership needs?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether SchoolGig could support teaching artist or school-facing education staffing needs.",
          "Hi [Name] - if another team handles arts education partnerships or teaching artist routing, I would appreciate the right contact."
        ],
        crmNote: "Strong arts education/teaching artist lane. Award amount: $32,000,000. Keep out of generic event/live performance framing."
      },
      {
        priority: 4,
        organization: "Museum of the African Diaspora / Title I arts education",
        context: "$500,000 IMLS award for Title I student visual literacy and arts programming, teaching artists, teacher advisory committee work, and teacher professional development.",
        contactInfo: "Resolve Education Director, school partnerships lead, teaching artist coordinator, and teacher professional development manager.",
        contactType: "Source-backed role path",
        sendability: "Research named education/program owner first, then send.",
        owner: "Education Director, school partnerships lead, teaching artist coordinator",
        sourceUrl: "https://www.usaspending.gov/award/MH-253053-OMS-23",
        email: {
          subject: "Teaching artist staffing support for school programs",
          body: `Hi [Name],

I saw the public award supporting Title I student arts programming, teaching artists, teacher advisory work, and teacher professional development.

SchoolGig may be useful where school-facing arts education programs need to find, organize, or route qualified educators and teaching artists.

Would you be the right person to discuss educator or teaching artist staffing support?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether SchoolGig could support teaching artist or educator staffing for school-facing arts programs.",
          "Hi [Name] - if education partnerships are owned by someone else, I would appreciate a pointer."
        ],
        crmNote: "Good California arts education proof and possible partner target. Award amount: $500,000."
      },
      {
        priority: 5,
        organization: "Trewon Technologies / Teacher Shortage Areas data signal",
        context: "$989,054 Department of Education award for Teacher Shortage Areas reference tooling showing where states and schools are hiring administrators and licensed teachers.",
        contactInfo: "Resolve product/program owner, education data lead, or Department of Education program/procurement contact.",
        contactType: "Source-backed vendor/contact path",
        sendability: "Research named owner first. Use as market-map and possible channel target.",
        owner: "Education data lead, product/program owner, contracting officer",
        sourceUrl: "https://www.usaspending.gov/award/91990022F0380",
        email: {
          subject: "Teacher shortage data and school hiring workflows",
          body: `Hi [Name],

I saw the Teacher Shortage Areas work and thought there may be overlap with SchoolGig's education hiring workflow.

SchoolGig could potentially complement teacher shortage data by helping districts distribute hard-to-fill roles, reach candidates, or manage school-specific hiring signals.

Would you be the right person to discuss education workforce data and hiring workflow partnerships?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - checking back on whether SchoolGig could be relevant to teacher shortage and district hiring workflows.",
          "Hi [Name] - if another person owns education data partnerships or product strategy, I would appreciate the referral."
        ],
        crmNote: "Market-map/vendor signal. Award amount: $989,054. Useful for product positioning and possible channel research."
      },
      {
        priority: 6,
        organization: "YRCI / government talent acquisition services",
        context: "$15,919,221 GSA/OPM talent acquisition services award. This validates government demand for outsourced recruiting and talent acquisition infrastructure.",
        contactInfo: "Clay named contacts: Colin Waitt, Max Wyche, George Carelock, Sonia K., Eric Hoyt. Emails pending/not returned by Clay.",
        contactType: "Clay named role contacts",
        sendability: "Research direct emails or use LinkedIn/manual routing before send. Treat as channel, not direct K-12 buyer.",
        owner: "Business development, human capital business development, staffing program manager",
        sourceUrl: "https://www.usaspending.gov/award/47QFMA20F0013",
        email: {
          subject: "Education hiring workflow partnership",
          body: `Hi [Name],

I saw YRCI's public-sector talent acquisition work and wanted to ask whether there may be a partner fit with SchoolGig around education hiring workflows.

SchoolGig focuses specifically on education roles and school hiring needs, which could be useful where public-sector or education-adjacent clients need role distribution, candidate sourcing, or educator pipeline support.

Would you be the right person for partnership or business development conversations around education workforce needs?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether there may be a fit between YRCI's talent acquisition work and SchoolGig's education hiring workflow.",
          "Hi [Name] - if another BD or human capital lead owns partner discussions, I would appreciate the right contact."
        ],
        crmNote: "Channel/vendor target. Award amount: $15,919,221. Confirm education-specific fit before spending too much time."
      },
      {
        priority: 7,
        organization: "Westat / education workforce research and services",
        context: "$9,954,119 Department of Education award involving Schools and Staffing Survey, Teacher Follow-up Survey, principal follow-up, beginning teacher longitudinal work, teacher quality, school staffing, and teacher/principal attrition.",
        contactInfo: "Clay named contacts: Justin Baer, Amy Lally, Aliya Pilchen, Shaliza Buckredan, Peter Morrison. Emails pending/not returned by Clay.",
        contactType: "Clay named role contacts",
        sendability: "Research direct emails or use LinkedIn/manual routing before send. Treat as research/channel, not first sales target.",
        owner: "Education and social policy lead, business development, talent acquisition",
        sourceUrl: "https://www.usaspending.gov/award/0001",
        email: {
          subject: "Education staffing data and hiring workflow fit",
          body: `Hi [Name],

I saw Westat's education workforce and school staffing data work and wanted to ask whether SchoolGig could be relevant as an education hiring workflow partner.

SchoolGig focuses on school-specific hiring and candidate routing, which may complement projects involving teacher shortage, school staffing, or educator pipeline research.

Would it make sense to compare notes on education workforce data and implementation needs?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether SchoolGig could be relevant to education workforce or school staffing projects.",
          "Hi [Name] - if another education practice or business development lead owns this, I would appreciate the referral."
        ],
        crmNote: "Research/channel target. Award amount: $9,954,119. Useful proof for school staffing data market demand."
      },
      {
        priority: 8,
        organization: "LADGOV Corp / teaching artist and tutor vendor channel",
        context: "$29,346 public award for musician/tutor-style services at the U.S. Merchant Marine Academy band. This is smaller than the workforce awards, but it is more sendable because contact paths are available.",
        contactInfo: "Chris Bradley, Business Development Specialist, cbradley@ladgov.com; Ouidad Mandour, ouidad.mandour@ladgov.com.",
        contactType: "Clay-identified contact + Snov email candidates",
        sendability: "Verify emails before send. Use as a vendor/channel test, not as the top direct revenue opportunity.",
        owner: "Business development, government contracts, education/tutor services owner",
        sourceUrl: "https://www.usaspending.gov/award/6923G224P000179",
        email: {
          subject: "Education staffing support for public-sector service contracts",
          body: `Hi [Name],

I saw LADGOV's public-sector musician and tutor-style service work and wanted to ask whether SchoolGig could be a useful partner for education, arts instruction, or school-facing staffing needs.

SchoolGig focuses on education hiring workflows and may be relevant when public-sector contracts need qualified instructors, teaching artists, tutors, or education support talent.

Would it make sense to compare notes on whether SchoolGig could support any education or arts-instruction staffing lanes?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether SchoolGig could support education, tutor, or teaching-artist staffing for LADGOV contracts.",
          "Hi [Name] - if another person owns education services or government-contract partnerships, I would appreciate the right contact."
        ],
        crmNote: "Most sendable vendor/channel test. Award amount: $29,346. Confirm LADGOV has education/tutor/teaching-artist contract needs before broader pursuit."
      }
    ],
    signals: [
      {
        title: "Rural Alaska educator recruitment and retention",
        why: "A $6.84M Department of Education award funds a seven-district partnership to improve teacher recruitment and retention in rural Alaska. This is the cleanest SchoolGig fit because the source explicitly names teacher recruitment and retention.",
        whyShort: "$6.84M award explicitly tied to teacher recruitment and retention across seven districts.",
        target: "Alaska Council of School Administrators and partner school districts",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/S374A230034",
        revenueMotion: "Partner with Recipient",
        actionability: "High Actionability",
        contactPath: "Executive Director, educator workforce lead, district HR/recruitment directors",
        nextAction: "Resolve ACSA program owner and the seven partner district HR/recruitment leads, then pitch SchoolGig as a hard-to-fill educator role and candidate visibility partner.",
        socialProof: "The award description says the partnership is designed to improve teacher recruitment and retention.",
        outreach: "SchoolGig can support rural educator pipeline visibility, role distribution, and school-specific candidate sourcing."
      },
      {
        title: "NYSUT educator apprenticeship and grow-your-own pipeline",
        why: "A $5.66M Department of Labor award funds educator workforce re-engineering, registered apprenticeships, pre-apprenticeships, district/BOCES employer participation, and candidate pathways into teaching.",
        whyShort: "$5.66M educator apprenticeship award involving districts, BOCES, apprenticeships, and candidate pipelines.",
        target: "NYSUT Education and Learning Trust, districts, BOCES, apprenticeship sponsors",
        source: "USAspending.gov + Clay",
        sourceUrl: "https://www.usaspending.gov/award/AP386392260A36",
        revenueMotion: "Partner with Recipient",
        actionability: "High Actionability",
        contactPath: "Workforce program director, apprenticeship lead, employer engagement lead, district/BOCES HR",
        nextAction: "Use Clay named contacts to route toward the apprenticeship or employer engagement owner and position SchoolGig as candidate pipeline and district hiring workflow support.",
        socialProof: "The award lists 75 registered apprenticeship programs, 35 expanded programs, 250+ stakeholders, and 1,725 RAP participants.",
        outreach: "SchoolGig can help funded educator apprenticeship programs connect career changers, paraprofessionals, apprentices, and districts."
      },
      {
        title: "Kennedy Center National Arts Education Program",
        why: "A $32M Department of Education award supports national arts education programming through September 2026. For SchoolGig, this is a teaching-artist and arts education staffing lane.",
        whyShort: "$32M national arts education award with teaching artist and school-program routing potential.",
        target: "John F. Kennedy Center for the Performing Arts",
        source: "USAspending.gov + Clay + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/S351A220007",
        revenueMotion: "Partner with Recipient",
        actionability: "High Actionability",
        contactPath: "Vice President of Education, education program lead, teaching artist program lead, regional implementation partners",
        nextAction: "Start with Kennedy education leadership and ask who owns teaching artist staffing, regional implementation, or school partnership support.",
        socialProof: "The award is active through September 30, 2026 and directly funds national arts education work.",
        outreach: "SchoolGig can support programs that need qualified educators, teaching artists, enrichment staff, or school-facing talent routing."
      },
      {
        title: "MOAD Title I arts education and teacher professional development",
        why: "A $500K IMLS award funds Title I school arts programming, teaching artists, teacher advisory committee work, standards-aligned resources, and teacher professional development.",
        whyShort: "$500K arts education award with teaching artists, teacher PD, and Title I school partnerships.",
        target: "Museum of the African Diaspora, San Francisco Public Library partner route, Bay Area school partners",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/MH-253053-OMS-23",
        revenueMotion: "Partner with Recipient",
        actionability: "Medium Actionability",
        contactPath: "Education Director, school partnerships lead, teaching artist coordinator, teacher PD manager",
        nextAction: "Resolve the MOAD education program owner and pitch SchoolGig around teaching artist and educator staffing support.",
        socialProof: "The award explicitly mentions teaching artists, teacher advisory work, Title I students, teacher PD, and standards-aligned curricular resources.",
        outreach: "SchoolGig can help arts education programs find and organize teaching artists and school-facing educators."
      },
      {
        title: "Teacher Shortage Areas data and state hiring signals",
        why: "A $989K Department of Education award funds Teacher Shortage Areas reference tooling showing where states and schools are hiring academic administrators and licensed teachers.",
        whyShort: "$989K teacher shortage data award shows demand for state and district educator hiring intelligence.",
        target: "Trewon Technologies, Department of Education program/procurement path, state education agencies",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/91990022F0380",
        revenueMotion: "Channel / Distributor Motion",
        actionability: "Medium Actionability",
        contactPath: "Education data lead, product/program owner, contracting officer, state education agency workforce lead",
        nextAction: "Use this as market-map proof and research whether SchoolGig can connect shortage-area data to role distribution and candidate sourcing.",
        socialProof: "The source description says the tool shows where states and schools are looking to hire administrators and licensed teachers.",
        outreach: "SchoolGig can turn shortage-area intelligence into live hiring workflows and candidate-routing actions."
      },
      {
        title: "YRCI public-sector talent acquisition services",
        why: "A $15.9M GSA/OPM talent acquisition services award validates government demand for recruiting infrastructure and human capital support. This is not education-specific, but it is useful as a channel/vendor proof point.",
        whyShort: "$15.9M talent acquisition services award validates outsourced recruiting infrastructure demand.",
        target: "YRCI / federal HR and talent acquisition channel",
        source: "USAspending.gov + Clay",
        sourceUrl: "https://www.usaspending.gov/award/47QFMA20F0013",
        revenueMotion: "Channel / Distributor Motion",
        actionability: "Medium Actionability",
        contactPath: "Business development, human capital BD, staffing program manager",
        nextAction: "Use Clay named contacts for partner discovery, but qualify education-specific fit before deep pursuit.",
        socialProof: "The award description references OPM HRS talent acquisition services.",
        outreach: "SchoolGig can be positioned as an education-specific hiring workflow layer for broader talent acquisition vendors."
      },
      {
        title: "Westat school staffing and teacher workforce research",
        why: "A $9.95M Department of Education award covers schools and staffing surveys, teacher follow-up, principal follow-up, teacher quality, school staffing, teacher working conditions, and teacher/principal attrition.",
        whyShort: "$9.95M Department of Education award validates demand for school staffing and teacher workforce intelligence.",
        target: "Westat education/social policy practice",
        source: "USAspending.gov + Clay",
        sourceUrl: "https://www.usaspending.gov/award/0001",
        revenueMotion: "Research Only",
        actionability: "Medium Actionability",
        contactPath: "Education/social policy lead, business development, research project lead, talent acquisition",
        nextAction: "Use as market proof and possible research/channel partner; do not treat as the first direct sales target.",
        socialProof: "The award description explicitly references Schools and Staffing Survey, Teacher Follow-up Survey, school staffing, and teacher/principal attrition.",
        outreach: "SchoolGig can complement education workforce research with real hiring workflow and candidate movement."
      },
      {
        title: "LADGOV teaching artist and tutor vendor channel",
        why: "A $29K public award for musician/tutor-style services is smaller than the workforce awards, but it gives SchoolGig a practical vendor/channel test with named contacts already available.",
        whyShort: "$29K award with sendable vendor/channel contacts for education, tutor, and teaching-artist fit testing.",
        target: "LADGOV Corp / education, tutor, musician-services, and public-sector staffing lanes",
        source: "USAspending.gov + Clay + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/6923G224P000179",
        revenueMotion: "Sell to Award Recipient",
        actionability: "Medium Actionability",
        contactPath: "Chris Bradley, business development; Ouidad Mandour email candidate; government contracts or education services owner",
        nextAction: "Verify emails, then ask whether LADGOV pursues education, tutor, teaching-artist, or school-facing staffing contracts where SchoolGig could support talent supply.",
        socialProof: "The award shows LADGOV already performs public-sector musician/tutor-style service work, and enrichment found named contact paths.",
        outreach: "SchoolGig can be positioned as a partner for education, tutor, teaching artist, and school-facing staffing support."
      }
    ],
    actionPlan: [
      "Step 1: Upload the SchoolGig AI outreach package CSV or JSON to the outreach AI instance.",
      "Step 2: Create separate queues for educator workforce, grow-your-own/apprenticeship, arts education/teaching artists, HR/recruiting tech vendors, and grant watchlist.",
      "Step 3: Start with Alaska Council of School Administrators and NYSUT because they are the cleanest educator workforce opportunities.",
      "Step 4: Use Kennedy Center and MOAD for arts education and teaching artist staffing outreach.",
      "Step 5: Use LADGOV as a sendable vendor/channel test while deeper owner research continues for ACSA and MOAD.",
      "Step 6: Use YRCI, Westat, and Trewon as channel/market-map targets and qualify before sending broad outreach.",
      "Step 7: Treat Grants.gov contacts as program contacts only; build recipient/applicant target lists before sales outreach.",
      "Step 8: Track source URL, award amount, contact status, email sent, reply, next action, and follow-up date in CRM."
    ],
    notes:
      "SchoolGig report logic prioritizes educator workforce, school staffing, grow-your-own pipelines, district/BOCES participation, teaching artists, arts education staffing, and education HR/recruiting infrastructure. USAspending.gov records show public money flow and buyer/channel evidence; they are not automatically open solicitations. Clay contacts without direct emails should be handled as named routing targets, not send-ready contacts."
  },
  {
    slug: "reparel",
    company: "Reparel",
    date: "July 7, 2026",
    primaryMotion: "Channel / Buyer",
    sources: ["USAspending.gov", "Snov.io", "Opportunity Scanner contact logic", "Reparel website scan"],
    summary:
      "Reparel's strongest public-sector path is not a generic grant strategy. It is a buyer and channel strategy around rehabilitation supplies, physical therapy supplies, orthotic supplies, VA/HHS purchasing, and DME-adjacent ordering routes. The outbound goal is to validate which distributors, buying offices, and orthotics suppliers can evaluate Reparel as a recovery sleeve, brace/boot undersleeve, post-op support, and reimbursable clinical support product.",
    digest: [
      {
        label: "Best first move",
        title: "Supplier onboarding sprint",
        body: "Start with Performance Health and the HHS rehab-supply BPA recipients because they have the clearest fit with rehab, PT, orthotic, and clinical supply channels."
      },
      {
        label: "Active signal",
        title: "KLM Labs orthotics lane",
        body: "KLM Laboratories has an active HHS orthotics-related award ending July 25, 2026, making it a time-sensitive channel and market-map target."
      },
      {
        label: "Contact status",
        title: "Mixed sendability",
        body: "Snov produced email candidates for Performance Health and Footmaxx. First Nations, National Environmental, KLM, Apex, and agency routes still need owner/contact research before outreach."
      }
    ],
    firstMoves: [
      "Start with Performance Health, First Nations Distribution, National Environmental, and KLM because they are tied to current or near-current HHS rehab, orthotic, or clinical supply buying.",
      "Use Snov-generated contacts only where the domain is clear; verify role fit before outreach and do not assume a general inbox is the decision-maker.",
      "Lead with product-category fit: recovery sleeve, post-op support, brace/boot undersleeve, pain/swelling support, PT/rehab supply, and reimbursable DME-adjacent positioning.",
      "Use VA and DOD records as market evidence, then identify the current buying office, distributor channel, prosthetics route, or supplier onboarding path.",
      "Build a simple evidence packet before outbound: product sheet, reimbursable/PDAC positioning, clinical use cases, brace/boot undersleeve positioning, and ordering/contact path."
    ],
    coverage: [
      "Latest local Reparel scan reviewed July 7, 2026: evaluator reports 9 source-backed signals, 6 yes/maybe, and 0 issues.",
      "The package prioritizes HHS rehabilitation supply BPAs, active/current orthotics purchasing, VA physical therapy/prosthetics routes, and DOD orthotics evidence.",
      "KLM Laboratories was added from prior Reparel source data because it is an active/current orthotics signal ending July 25, 2026.",
      "Large DMEPOS infrastructure records such as CGS Administrators, Empower AI, and Softrams are intentionally kept out of the outreach queue because they are reimbursement/admin infrastructure signals, not near-term buyer/channel targets.",
      "Sampson's Prosthetic Laboratory appears in prior data as orthotics market evidence, but it is not included as a primary outreach target in this package."
    ],
    contacts: [
      {
        organization: "Performance Health Supply / Performance Health",
        contact: "info@performancehealth.com; customersupport@performancehealth.com; blands@performancehealth.com",
        entries: [
          "info@performancehealth.com | Snov-generated domain email candidate",
          "customersupport@performancehealth.com | Snov-generated domain email candidate",
          "blands@performancehealth.com | Snov-generated domain email candidate"
        ],
        type: "Snov-generated domain email candidates",
        recommendedUse: "Verify role and route to rehab supply category, government sales, DME/orthotics product, or supplier onboarding.",
        source: "Snov.io v2 domain search"
      },
      {
        organization: "Footmaxx",
        contact: "michael.kinney@footmaxx.com; charlie.doll@footmaxx.com; rob.martin@footmaxx.com",
        entries: [
          "michael.kinney@footmaxx.com | Snov-generated domain email candidate",
          "charlie.doll@footmaxx.com | Snov-generated domain email candidate",
          "rob.martin@footmaxx.com | Snov-generated domain email candidate"
        ],
        type: "Snov-generated domain email candidates",
        recommendedUse: "Verify role before outreach; use as orthotics-channel intelligence, not the first Reparel sales target.",
        source: "Snov.io v2 domain search"
      },
      {
        organization: "First Nations Distribution LLC",
        contact: "Government Contracts Manager; Medical Supply Category Manager; Clinical Supply Manager",
        entries: [
          "Government Contracts Manager | Email/domain research needed",
          "Medical Supply Category Manager | Email/domain research needed",
          "Clinical Supply Manager | Email/domain research needed",
          "SAM.gov entity or BPA ordering contact | Source-native research needed"
        ],
        type: "Generated role contact path",
        recommendedUse: "Resolve company domain or SAM/UEI profile, then ask how rehab supply products are added to public-sector BPA ordering paths.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "National Environmental Inc.",
        contact: "Government Contracts Manager; Physical Therapy Supply Buyer; Clinical Supply Manager",
        entries: [
          "Government Contracts Manager | Email/domain research needed",
          "Physical Therapy Supply Buyer | Email/domain research needed",
          "Clinical Supply Manager | Email/domain research needed",
          "HHS/IHS buying office contact attached to award | Source-native research needed"
        ],
        type: "Generated role contact path",
        recommendedUse: "Validate whether the recipient is a relevant distributor; if not, pivot to the HHS/IHS buying office.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "KLM Laboratories / HHS orthotics supply lane",
        contact: "Orthotics product owner; government contracts manager; HHS/IHS ordering office",
        entries: [
          "Orthotics product owner | Email/domain research needed",
          "Government contracts manager | Email/domain research needed",
          "HHS/IHS ordering office for WRSU orthotics supplies | Source-native research needed"
        ],
        type: "Generated role contact path",
        recommendedUse: "Treat as an active/current orthotics market-map target. Resolve contact path before outreach because no verified connector email is available yet.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      },
      {
        organization: "Department of Veterans Affairs physical therapy/prosthetics route",
        contact: "VA Prosthetics Representative; VA Physical Therapy Supply Buyer; Procurement Specialist",
        entries: [
          "VA Prosthetics Representative | Facility/office research needed",
          "VA Physical Therapy Supply Buyer | Facility/office research needed",
          "VA Procurement Specialist | Contracting office research needed",
          "Apex Integrated Distribution channel/account contact | Email/domain research needed"
        ],
        type: "Generated office contact path",
        recommendedUse: "Use VA award evidence to identify current prosthetics, orthotics, and PT supply buying offices.",
        source: "USAspending.gov + Opportunity Scanner contact logic"
      }
    ],
    contactProof: [
      "Snov-generated domain candidates are available for Performance Health and Footmaxx, but they should be verified before automated sending.",
      "First Nations Distribution, National Environmental, KLM Laboratories, and Apex/VA routes need contact research before outreach.",
      "KLM is included because the source data shows an active HHS orthotics supplies award ending July 25, 2026.",
      "VA/DOD records should be treated as market-map and procurement-path evidence until a current buying office or active vehicle is identified.",
      "Recommended automation rule: classify every contact as confirmed email, candidate email, named person without email, role path, agency office path, or market evidence before sending."
    ],
    liveRefresh: [
      "Updated package created July 7, 2026 for outbound operations review.",
      "Local report evaluator shows Reparel at 0 issues, with 9 source-backed signals and 6 yes/maybe signals.",
      "KLM Laboratories added as active/current orthotics evidence; Sampson's Prosthetic Laboratory remains prior evidence only.",
      "No new live email enrichment was completed in this pass beyond existing Snov candidates; unresolved targets are intentionally marked as research tasks rather than invented contacts."
    ],
    emailDrafts: [
      {
        useCase: "Distributor or supplier onboarding",
        subject: "Supplier fit for rehab and recovery sleeve products",
        body: `Hi [Name],

I saw public-sector rehab and medical supply activity connected to your organization and wanted to ask who handles supplier onboarding or category review for rehab, PT, orthotics, or DME-adjacent products.

Reparel makes clinically positioned recovery sleeves used for pain, swelling, post-op recovery, and brace or boot undersleeve support. We are evaluating whether the product fits existing public-sector rehab supply ordering paths.

Would you be the right person to discuss supplier onboarding, or should I connect with someone on the rehab supply/category team?

Best,
[Sender]`
      },
      {
        useCase: "Agency or buying office routing",
        subject: "Finding the right rehab supply ordering path",
        body: `Hi [Name],

I am trying to identify the right procurement or clinical supply route for rehab, physical therapy, orthotic, and recovery support products.

Reparel's product line includes recovery sleeves and brace/boot undersleeves that may fit patient support, post-op, arthritis, and PT recovery use cases.

Could you point me toward the right ordering office, procurement contact, or vendor-registration path for this category?

Best,
[Sender]`
      },
      {
        useCase: "Orthotics supplier or channel partner",
        subject: "Orthotics-adjacent recovery sleeve fit",
        body: `Hi [Name],

I saw public-sector orthotics supply work connected to your organization and wanted to ask whether Reparel could be evaluated as an adjacent product for recovery, swelling, pain support, or brace and boot undersleeve use.

The goal is not to replace orthotics. The question is whether Reparel can complement orthotic and bracing pathways where patients need a comfortable recovery sleeve or undersleeve option.

Who would be the right person to discuss product fit or supplier onboarding?

Best,
[Sender]`
      },
      {
        useCase: "Evidence packet follow-up",
        subject: "Reparel product information for review",
        body: `Hi [Name],

Following up with a concise Reparel review packet would be helpful if your team evaluates rehab, PT, orthotic, or DME-adjacent products.

The packet can include product line summary, clinical positioning, reimbursement/PDAC notes where applicable, use cases, and recommended ordering/category language.

Would that be useful for your supplier review process?

Best,
[Sender]`
      }
    ],
    signals: [
      {
        title: "HHS BPA for medical and rehabilitation supplies: First Nations Distribution",
        why: "HHS awarded First Nations Distribution $46,400 for a BPA covering miscellaneous medical and rehabilitation supplies through March 2027.",
        whyShort: "$46.4K HHS BPA for miscellaneous medical and rehabilitation supplies through March 2027.",
        target: "First Nations Distribution LLC / HHS buying office",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P00458",
        revenueMotion: "Channel / Distributor Motion",
        actionability: "High Actionability",
        contactPath: "Government contracts, medical supply category, clinical supply, procurement",
        nextAction: "Resolve the company domain/SAM entity and ask how products are added to public-sector BPA ordering catalogs.",
        socialProof: "The source description references miscellaneous medical and rehabilitation supplies and materials.",
        outreach: "Reparel may fit rehab supply ordering paths as a recovery sleeve and orthotic-adjacent SKU."
      },
      {
        title: "HHS BPA for rehab supplies: Performance Health Supply",
        why: "HHS awarded Performance Health Supply $21,600 for miscellaneous medical and rehabilitation supplies through April 2027.",
        whyShort: "$21.6K HHS rehab-supply BPA with a clear distributor/category fit.",
        target: "Performance Health Supply / Performance Health",
        source: "USAspending.gov + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P00547",
        revenueMotion: "Channel / Distributor Motion",
        actionability: "High Actionability",
        contactPath: "Rehab supply category, DME/orthotics product, government sales, clinical supply buyer",
        nextAction: "Use Snov candidates to route toward supplier onboarding and rehab product-category fit.",
        socialProof: "Performance Health is the cleanest known distributor-style lane in the package, and Snov candidates exist for initial routing.",
        outreach: "Reparel supports post-op, arthritis, brace undersleeve, and PT recovery use cases that may fit public-sector supply channels."
      },
      {
        title: "HHS physical rehabilitation BPA: National Environmental",
        why: "HHS awarded National Environmental $20,000 for physical therapy supplies for direct patient care on an as-needed basis through September 2026.",
        whyShort: "$20K HHS physical rehabilitation BPA for as-needed direct patient care supplies through September 2026.",
        target: "National Environmental Inc. / HHS buying office",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P01050",
        revenueMotion: "Sell to Award Recipient",
        actionability: "High Actionability",
        contactPath: "Government contracts, PT supply buyer, rehab services, clinical supply",
        nextAction: "Verify whether the recipient is a relevant distributor; if not, use the record to identify the buying office.",
        socialProof: "The award description references required physical therapy supplies for direct patient care on an as-needed basis.",
        outreach: "Reparel may fit an as-needed physical rehabilitation supply category for patient recovery support."
      },
      {
        title: "Active HHS orthotics supply lane: KLM Laboratories",
        why: "HHS awarded KLM Laboratories $55,104 for custom over-the-counter foot and ankle orthotics supplies, with the award running through July 25, 2026.",
        whyShort: "$55.1K active/current HHS award for foot and ankle orthotics supplies through July 25, 2026.",
        target: "KLM Laboratories / HHS-IHS orthotics buying route",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/75H71225F28005",
        revenueMotion: "Sell to Award Recipient",
        actionability: "High Actionability",
        contactPath: "Orthotics product owner, government contracts manager, HHS/IHS ordering office",
        nextAction: "Resolve KLM's supplier/contact path and test whether Reparel can complement foot and ankle orthotics as a recovery sleeve or brace/boot undersleeve.",
        socialProof: "The record explicitly references custom over-the-counter foot and ankle orthotics supplies.",
        outreach: "Reparel can complement orthotic supply lanes as a comfortable recovery sleeve and brace/boot undersleeve product."
      },
      {
        title: "VA physical therapy supplies: Apex Integrated Distribution",
        why: "VA purchase activity for physical therapy supplies validates a VA market lane for PT, prosthetics, orthotics, and recovery support supplies.",
        whyShort: "$14.1K VA physical therapy supply purchase, useful as VA market-map evidence.",
        target: "Department of Veterans Affairs / Apex Integrated Distribution",
        source: "USAspending.gov",
        sourceUrl: "https://www.usaspending.gov/award/36C24W25P0146",
        revenueMotion: "Sell to Agency",
        actionability: "Medium Actionability",
        contactPath: "VA prosthetics, PT supply buyer, procurement specialist",
        nextAction: "Map similar active VA supply routes and determine whether Reparel should pursue VA procurement or distributor onboarding.",
        socialProof: "The source points to VA physical therapy supply purchasing, which is adjacent to Reparel's post-op and rehab positioning.",
        outreach: "Reparel is positioned around recovery, inflammation, post-op use, and clinical support in PT supply routes."
      },
      {
        title: "DOD orthotic supplies: Footmaxx",
        why: "DOD awarded Footmaxx for orthotic supplies, showing military medical purchasing includes orthotic supply lanes adjacent to Reparel.",
        whyShort: "$72.2K DOD orthotics supply award, useful as military medical channel evidence.",
        target: "Footmaxx / DOD medical supply channel",
        source: "USAspending.gov + Snov.io",
        sourceUrl: "https://www.usaspending.gov/award/HT009024FG0310039",
        revenueMotion: "Channel / Distributor Motion",
        actionability: "Medium Actionability",
        contactPath: "Orthotics product manager, government contracts, DOD medical supply buyer",
        nextAction: "Use Footmaxx as channel intelligence while researching active DOD or military treatment facility supply vehicles.",
        socialProof: "Snov-generated Footmaxx contact candidates are available, but the award should be treated as market evidence before sending.",
        outreach: "Reparel can complement orthotic and bracing categories as a recovery sleeve and brace/boot undersleeve."
      }
    ],
    outreachRules: [
      "Use this package as a review and outbound-operations input, not an automatic send list.",
      "Prioritize supplier onboarding and category-fit conversations before agency procurement outreach.",
      "Verify Snov-generated email candidates before sending; do not invent contacts for role-path targets.",
      "Separate active/current signals from market-map evidence. KLM, First Nations, Performance Health, and National Environmental are more time-sensitive than Footmaxx or Apex.",
      "Do not pitch large DMEPOS infrastructure vendors such as CGS, Empower AI, or Softrams as near-term buyers.",
      "Lead with product-category fit: recovery sleeve, post-op support, brace/boot undersleeve, pain/swelling support, PT/rehab supply, and reimbursable DME-adjacent positioning.",
      "Log source URL, award amount, contact status, email sent, reply, requested materials, and next action in CRM."
    ],
    outreachTargets: [
      {
        priority: 1,
        organization: "Performance Health Supply / Performance Health",
        context: "$21,600 HHS award for miscellaneous medical and rehabilitation supplies through April 2027.",
        contactInfo: "Snov candidates: info@performancehealth.com; customersupport@performancehealth.com; blands@performancehealth.com.",
        contactType: "Snov-generated domain email candidates",
        sendability: "Verify role fit first; use as supplier onboarding/category routing.",
        owner: "Rehab supply category manager, DME/orthotics product manager, government sales lead",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P00547",
        email: {
          subject: "Supplier fit for rehab and recovery sleeve products",
          body: `Hi [Name],

I saw Performance Health's public-sector rehab supply activity and wanted to ask who handles supplier onboarding or category review for rehab, PT, orthotics, or DME-adjacent products.

Reparel makes clinically positioned recovery sleeves used for pain, swelling, post-op recovery, and brace or boot undersleeve support. We are evaluating whether the product fits existing public-sector rehab supply ordering paths.

Would you be the right person to discuss supplier onboarding, or should I connect with someone on the rehab supply/category team?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on whether Reparel would fit a rehab, PT, orthotics, or DME-adjacent supplier review path.",
          "Hi [Name] - if supplier onboarding sits with another category or government sales contact, I would appreciate the right route."
        ],
        crmNote: "Highest-sendability Reparel target. Award amount: $21,600. Verify contact role before send; ask for supplier onboarding/category path."
      },
      {
        priority: 2,
        organization: "First Nations Distribution LLC / HHS rehab supply BPA",
        context: "$46,400 HHS BPA for miscellaneous medical and rehabilitation supplies through March 2027.",
        contactInfo: "Government contracts manager, medical supply category manager, clinical supply manager, or SAM.gov entity contact. Email/domain research needed.",
        contactType: "Role path / source-backed contact research",
        sendability: "Research named owner first, then send.",
        owner: "Government contracts, medical supply category, clinical supply, procurement",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P00458",
        email: {
          subject: "Rehab supply product fit for BPA ordering paths",
          body: `Hi [Name],

I saw the HHS medical and rehabilitation supplies BPA connected to First Nations Distribution and wanted to ask who handles product/category review for rehab, PT, orthotic, or DME-adjacent products.

Reparel may fit as a recovery sleeve, post-op support product, or brace/boot undersleeve in rehab supply ordering paths.

Would you be the right person to discuss supplier onboarding or product fit?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - checking back on the best route for rehab supply product review or supplier onboarding.",
          "Hi [Name] - if this sits with a different government contracts or clinical supply contact, I would appreciate the referral."
        ],
        crmNote: "High-value HHS rehab supply route. Award amount: $46,400. Needs domain/SAM/contact research before send."
      },
      {
        priority: 3,
        organization: "National Environmental Inc. / HHS physical rehabilitation BPA",
        context: "$20,000 HHS award for physical therapy supplies for direct patient care on an as-needed basis through September 2026.",
        contactInfo: "Government contracts manager, physical therapy supply buyer, clinical supply manager, or HHS/IHS buying office. Email/domain research needed.",
        contactType: "Role path / source-backed contact research",
        sendability: "Research recipient fit and buying office first.",
        owner: "Government contracts, PT supply buyer, rehab services, clinical supply",
        sourceUrl: "https://www.usaspending.gov/award/75H71025P01050",
        email: {
          subject: "Physical rehabilitation supply fit",
          body: `Hi [Name],

I saw the HHS physical rehabilitation supply award tied to direct patient care and wanted to understand the right route for evaluating related rehab support products.

Reparel's recovery sleeves may be relevant where patients need support for pain, swelling, post-op recovery, or use under braces and boots.

Who would be the right person to discuss whether this product category fits the rehab supply path?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on the right route for physical rehabilitation supply/product review.",
          "Hi [Name] - if the buying office rather than National Environmental owns this category, I would appreciate the right contact path."
        ],
        crmNote: "Time-sensitive HHS rehab supply route. Award amount: $20,000. Validate recipient/channel fit before pitch."
      },
      {
        priority: 4,
        organization: "KLM Laboratories / active HHS orthotics supply lane",
        context: "$55,104 HHS award for custom over-the-counter foot and ankle orthotics supplies, active through July 25, 2026.",
        contactInfo: "Orthotics product owner, government contracts manager, or HHS/IHS ordering office. Email/domain research needed.",
        contactType: "Role path / source-backed contact research",
        sendability: "Research named owner first; do not send until contact is resolved.",
        owner: "Orthotics product owner, government contracts, HHS/IHS ordering office",
        sourceUrl: "https://www.usaspending.gov/award/75H71225F28005",
        email: {
          subject: "Orthotics-adjacent recovery sleeve fit",
          body: `Hi [Name],

I saw the HHS foot and ankle orthotics supply work connected to KLM Laboratories and wanted to ask whether Reparel could be evaluated as an adjacent product for recovery, swelling, pain support, or brace and boot undersleeve use.

The goal is not to replace orthotics. The question is whether Reparel can complement orthotic and bracing pathways where patients need a comfortable recovery sleeve or undersleeve option.

Who would be the right person to discuss product fit or supplier onboarding?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - checking back on whether Reparel could be reviewed as an orthotics-adjacent recovery sleeve or undersleeve product.",
          "Hi [Name] - if another product/category or government contracts owner handles this, I would appreciate the right route."
        ],
        crmNote: "Active/current orthotics lane. Award amount: $55,104. Time-sensitive because award end date is July 25, 2026."
      },
      {
        priority: 5,
        organization: "Department of Veterans Affairs / Apex Integrated Distribution PT supply route",
        context: "$14,078 VA purchase activity for physical therapy supplies. Use as VA prosthetics/PT supply market-map evidence.",
        contactInfo: "VA prosthetics representative, VA PT supply buyer, procurement specialist, or Apex channel contact. Research needed.",
        contactType: "Agency office path / channel research",
        sendability: "Research current buying office or active vehicle first.",
        owner: "VA prosthetics, PT supply buyer, procurement, distributor channel",
        sourceUrl: "https://www.usaspending.gov/award/36C24W25P0146",
        email: {
          subject: "Finding the right VA rehab supply route",
          body: `Hi [Name],

I am trying to identify the right VA procurement or clinical supply route for rehab, physical therapy, orthotic, and recovery support products.

Reparel's product line includes recovery sleeves and brace/boot undersleeves that may fit patient support, post-op, arthritis, and PT recovery use cases.

Could you point me toward the right ordering office, procurement contact, or vendor-registration path for this category?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - quick follow-up on the right VA route for rehab, PT, orthotic, or recovery support supply review.",
          "Hi [Name] - if this should go through a prosthetics, PT supply, or procurement office, I would appreciate the right direction."
        ],
        crmNote: "VA market-map target. Award amount: $14,078. Do not send until buying office/current route is identified."
      },
      {
        priority: 6,
        organization: "Footmaxx / DOD orthotic supplies channel evidence",
        context: "$72,180 DOD orthotic supplies award. Use as orthotics-channel evidence and possible channel intelligence.",
        contactInfo: "Snov candidates: michael.kinney@footmaxx.com; charlie.doll@footmaxx.com; rob.martin@footmaxx.com.",
        contactType: "Snov-generated domain email candidates",
        sendability: "Verify role before send; lower priority than active HHS/rehab supply lanes.",
        owner: "Orthotics product manager, government contracts, DOD medical supply channel",
        sourceUrl: "https://www.usaspending.gov/award/HT009024FG0310039",
        email: {
          subject: "Orthotics-adjacent recovery sleeve fit",
          body: `Hi [Name],

I saw Footmaxx's public-sector orthotics supply work and wanted to ask whether Reparel could be relevant as an adjacent product for recovery, swelling, pain support, or brace and boot undersleeve use.

Reparel may complement orthotic and bracing pathways where patients need a comfortable recovery sleeve or undersleeve option.

Would you be the right person to discuss product fit or channel partnership?

Best,
[Sender]`
        },
        followUps: [
          "Hi [Name] - checking back on whether Reparel could fit as an orthotics-adjacent recovery sleeve or undersleeve product.",
          "Hi [Name] - if another product or government contracts contact owns this, I would appreciate the referral."
        ],
        crmNote: "Orthotics-channel evidence. Award amount: $72,180. Verify role/contact before send; not first priority."
      }
    ],
    actionPlan: [
      "Day 1: Finalize a one-page public-sector product positioning note for Reparel with product/category language that can be reused in outreach.",
      "Day 2: Build a target sheet for Performance Health, First Nations Distribution, National Environmental, KLM Laboratories, Apex/VA, and Footmaxx.",
      "Day 3: Validate which targets are distributors, resellers, catalog suppliers, direct service providers, or agency buying-office routes.",
      "Day 4: Identify the HHS/IHS, VA, and DOD buying offices attached to the top records.",
      "Day 5: Send supplier-onboarding/product-fit outreach only to contacts that pass role verification; otherwise create manual research tasks.",
      "Day 6: Log responses and requests for product sheets, reimbursement notes, or clinical evidence.",
      "Day 7: Choose the next pursuit path: channel onboarding, agency procurement mapping, or evidence packet."
    ],
    notes:
      "USAspending.gov records show money flow and buyer/channel evidence. They are not open solicitations unless separately verified. Snov.io contacts are domain-email candidates and should be verified before outreach. Where a domain could not be safely resolved, this report preserves a role or office contact path rather than inventing a personal contact. KLM Laboratories is included from prior Reparel source data because its award remains active/current as of July 7, 2026."
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
