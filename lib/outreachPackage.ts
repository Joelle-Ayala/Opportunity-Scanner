import { signalLane } from "./actionability";
import { contactTargetsForSignal } from "./contactTargeting";
import { opportunityActionFor } from "./opportunityAction";
import { classificationLabel } from "./opportunityClassification";
import {
  classifyOpportunityRecord,
  type ClassifiedOpportunityRecord
} from "./opportunityRecordClassification";
import { listOpportunityEnrichmentRequests } from "./storage";
import {
  CompanyProfile,
  OpportunityEnrichmentRequestRecord,
  ScanRecord,
  StoredOpportunitySignal
} from "./types";

export type OutreachPackageRow = {
  priority: number;
  targetOrganization: string;
  opportunityContext: string;
  awardAmount: string;
  contactInfo: string;
  contactType: string;
  sendability: string;
  recommendedOwner: string;
  sourceUrl: string;
  firstEmailSubject: string;
  firstEmailBody: string;
  followUp1: string;
  followUp2: string;
  crmNote: string;
  workflowNote: string;
};

type EnrichedContact = {
  name: string;
  title: string;
  email: string;
  linkedinUrl: string;
  sourceUrl: string;
  confidence: string;
  source: string;
};

function opportunityHeadline(signal: StoredOpportunitySignal): string {
  const match = signal.opportunity_title.match(/^(.+?) received (\$[^:]+): (.+)$/);
  if (match) {
    const [, recipient, amount] = match;
    return `${signalLane(signal)}: ${recipient} funded ${amount}`;
  }
  return signal.opportunity_title;
}

function recordFor(signal: StoredOpportunitySignal): ClassifiedOpportunityRecord {
  return classifyOpportunityRecord({
    recordClass: signal.record_class,
    currentValidatedAt: signal.current_validated_at,
    sourceName: signal.source_name,
    sourceType: signal.source_type,
    deadline: signal.deadline,
    awardYear: signal.award_year,
    periodEnd: signal.period_end
  });
}

function targetFor(signal: StoredOpportunitySignal): string {
  return signal.likely_buyer_or_partner || signal.agency_or_funder || "the recipient";
}

function evidenceFundingContext(
  signal: StoredOpportunitySignal,
  record: ClassifiedOpportunityRecord
): string {
  const target = targetFor(signal);
  const amount = awardAmount(signal);
  const amountText = amount === "Not stated" ? "public funding" : `${amount} in public funding`;
  const yearText = record.awardYear ? ` in ${record.awardYear}` : "";
  return `${target} received ${amountText}${yearText}. This historical record is proof of past buyer budget; verify present needs before outreach.`;
}

function awardAmount(signal: StoredOpportunitySignal): string {
  const titleMatch = signal.opportunity_title.match(/\$[\d,]+(?:\.\d+)?/);
  if (titleMatch) {
    return titleMatch[0];
  }

  const raw = signal.raw_json ?? {};
  const candidates = [
    raw.awardAmount,
    raw.award_amount,
    raw.obligation,
    raw.total_obligation,
    raw.totalFundingAmount,
    raw.awardFloor,
    raw.awardCeiling
  ];
  const numeric = candidates.find((value) => typeof value === "number" || typeof value === "string");
  if (typeof numeric === "number") {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric);
  }
  if (typeof numeric === "string" && numeric.trim()) {
    return numeric.trim();
  }
  return "Not stated";
}

function sourceNativeContactText(signal: StoredOpportunitySignal): string[] {
  return contactTargetsForSignal(signal)
    .filter((target) => target.name || target.email || target.phone)
    .map((target) =>
      [
        target.organization,
        target.name,
        target.title,
        target.email,
        target.phone
      ]
        .filter(Boolean)
        .join(" | ")
    );
}

function enrichedContacts(requests: OpportunityEnrichmentRequestRecord[]): EnrichedContact[] {
  return requests.flatMap((request) => {
    const contacts = request.result_json?.contacts;
    if (!Array.isArray(contacts)) {
      return [];
    }
    return contacts
      .filter((contact): contact is Record<string, unknown> => typeof contact === "object" && contact !== null)
      .map((contact) => ({
        name: typeof contact.name === "string" ? contact.name : "",
        title: typeof contact.title === "string" ? contact.title : "",
        email: typeof contact.email === "string" ? contact.email : "",
        linkedinUrl: typeof contact.linkedin_url === "string" ? contact.linkedin_url : "",
        sourceUrl: typeof contact.source_url === "string" ? contact.source_url : "",
        confidence: typeof contact.confidence === "string" ? contact.confidence : "",
        source: typeof request.result_json?.provider === "string" ? request.result_json.provider : "enrichment"
      }))
      .filter((contact) => contact.email || contact.name || contact.linkedinUrl);
  });
}

function contactInfoFor(signal: StoredOpportunitySignal, requests: OpportunityEnrichmentRequestRecord[]): string {
  const sourceContacts = sourceNativeContactText(signal);
  const enriched = enrichedContacts(requests).map((contact) =>
    [
      contact.name,
      contact.title,
      contact.email,
      contact.linkedinUrl ? `LinkedIn: ${contact.linkedinUrl}` : "",
      contact.sourceUrl ? `Source: ${contact.sourceUrl}` : "",
      contact.confidence ? `${contact.confidence} confidence` : "",
      contact.source
    ]
      .filter(Boolean)
      .join(" | ")
  );
  const contactPath = contactTargetsForSignal(signal)
    .map((target) => `${target.organization}: ${target.roles.slice(0, 4).join(", ")}`)
    .slice(0, 2);

  return [...sourceContacts, ...enriched, ...contactPath].filter(Boolean).join("; ");
}

function contactTypeFor(signal: StoredOpportunitySignal, requests: OpportunityEnrichmentRequestRecord[]): string {
  const hasSourceNative = sourceNativeContactText(signal).length > 0;
  const enriched = enrichedContacts(requests);
  if (hasSourceNative && enriched.length > 0) {
    return "Source-native contact + enriched email candidates";
  }
  if (hasSourceNative) {
    return "Source-native contact";
  }
  if (enriched.length > 0) {
    return "Enriched named/email candidates";
  }
  return "Role-based contact path";
}

function sendabilityFor(signal: StoredOpportunitySignal, requests: OpportunityEnrichmentRequestRecord[]): string {
  const enriched = enrichedContacts(requests);
  const sourceContacts = sourceNativeContactText(signal);
  if (enriched.some((contact) => contact.email && contact.confidence === "high")) {
    return "Sendable after final human review; use named personalization.";
  }
  if (enriched.some((contact) => contact.email)) {
    return "Verify role fit before automated send; usable as a starting contact set.";
  }
  if (sourceContacts.length > 0) {
    return signal.source_name === "Grants.gov"
      ? "Use for eligibility/program questions, not as the sales buyer."
      : "Use source-listed contact first, then validate buyer or procurement owner.";
  }
  return "Needs named contact research before automated send; create a manual research task.";
}

function recommendedOwnerFor(signal: StoredOpportunitySignal, profile?: CompanyProfile): string {
  const classification = opportunityActionFor(signal, profile);
  return (classification.recommended_contact_roles.length > 0
    ? classification.recommended_contact_roles
    : contactTargetsForSignal(signal)[0]?.roles ?? ["Program Director", "Procurement Specialist"]
  )
    .slice(0, 3)
    .join(", ");
}

function subjectFor(signal: StoredOpportunitySignal, record: ClassifiedOpportunityRecord): string {
  const lane = signalLane(signal).toLowerCase();
  if (record.recordClass === "evidence") {
    if (/music|artist|arts|culture|event|festival|performance/.test(lane)) {
      return "Question about your present arts and programming needs";
    }
    if (/school|education|teacher|workforce|training/.test(lane)) {
      return "Question about your present education and workforce needs";
    }
    if (/health|medical|rehab|dme|clinical/.test(lane)) {
      return "Question about your present healthcare and rehab needs";
    }
    return "Question about your present program needs";
  }
  if (/music|artist|arts|culture|event|festival|performance/.test(lane)) {
    return "Talent support for public-sector programming";
  }
  if (/school|education|teacher|workforce|training/.test(lane)) {
    return "Support for funded education and workforce programs";
  }
  if (/health|medical|rehab|dme|clinical/.test(lane)) {
    return "Support for funded healthcare and rehab programs";
  }
  return "Potential support for your funded public-sector work";
}

function emailBodyFor(
  scan: ScanRecord,
  signal: StoredOpportunitySignal,
  record: ClassifiedOpportunityRecord,
  profile?: CompanyProfile
): string {
  const company = profile?.company_name || scan.company_name || "our team";
  const classification = opportunityActionFor(signal, profile);
  const target = targetFor(signal);
  const sourceContext = signal.external_evidence_summary || opportunityHeadline(signal);
  const angle = classification.outreach_angle || contactTargetsForSignal(signal)[0]?.outreachAngle;

  if (record.recordClass === "evidence") {
    return [
      "Hi [Name],",
      "",
      evidenceFundingContext(signal, record),
      "",
      `${company} may be relevant as a vendor, partner, or implementation resource. I wanted to ask how ${target} is handling this need now and whether there are any present priorities where support could be useful.`,
      "",
      "Would you be the right person to discuss present needs, or is there someone else who owns the program, partnership, procurement, or vendor path?",
      "",
      "Best,",
      "[Sender]"
    ].join("\n");
  }

  return [
    "Hi [Name],",
    "",
    `I came across public-sector funding or activity tied to ${target} and wanted to ask whether ${company} could be useful for the related work.`,
    "",
    sourceContext,
    "",
    angle || `${company} may be relevant as a vendor, partner, or implementation resource for this public-sector opportunity.`,
    "",
    "Would you be the right person to discuss this, or is there someone else who owns the program, partnership, procurement, or vendor path?",
    "",
    "Best,",
    "[Sender]"
  ].join("\n");
}

function followUpOne(
  scan: ScanRecord,
  signal: StoredOpportunitySignal,
  record: ClassifiedOpportunityRecord,
  profile?: CompanyProfile
): string {
  const company = profile?.company_name || scan.company_name || "our team";
  const target = targetFor(signal);
  if (record.recordClass === "evidence") {
    const yearText = record.awardYear ? ` from ${record.awardYear}` : "";
    return `Hi [Name] - quick follow-up on the historical funding record${yearText}. Is ${target} addressing a similar need now, and could ${company} be useful?`;
  }
  return `Hi [Name] - quick follow-up on whether ${company} could be relevant for ${target} based on the public-source signal I shared.`;
}

function followUpTwo(signal: StoredOpportunitySignal): string {
  const roles = contactTargetsForSignal(signal)[0]?.roles.slice(0, 2).join(" or ") || "program or procurement owner";
  return `Hi [Name] - if this is owned by someone else, I would appreciate a pointer to the right ${roles}.`;
}

export async function buildOutreachPackage(input: {
  scan: ScanRecord;
  profile?: CompanyProfile;
  signals: StoredOpportunitySignal[];
}): Promise<OutreachPackageRow[]> {
  const rows = await Promise.all(
    input.signals.map(async (signal, index): Promise<OutreachPackageRow> => {
      const classification = opportunityActionFor(signal, input.profile);
      const record = recordFor(signal);
      const requests = await listOpportunityEnrichmentRequests(input.scan.id, signal.id);
      const evidenceContext = evidenceFundingContext(signal, record);
      const evidenceNextStep = `Research ${targetFor(signal)} and ask about present needs before proposing a vendor or partnership path.`;
      return {
        priority: index + 1,
        targetOrganization: signal.likely_buyer_or_partner || signal.agency_or_funder || "Needs review",
        opportunityContext:
          record.recordClass === "current"
            ? `${opportunityHeadline(signal)} - ${classification.next_best_action}`
            : `${evidenceContext} ${evidenceNextStep}`,
        awardAmount: awardAmount(signal),
        contactInfo: contactInfoFor(signal, requests) || "No named contacts yet; use contact path and manual research task.",
        contactType: contactTypeFor(signal, requests),
        sendability: sendabilityFor(signal, requests),
        recommendedOwner: recommendedOwnerFor(signal, input.profile),
        sourceUrl: signal.source_url,
        firstEmailSubject: subjectFor(signal, record),
        firstEmailBody: emailBodyFor(input.scan, signal, record, input.profile),
        followUp1: followUpOne(input.scan, signal, record, input.profile),
        followUp2: followUpTwo(signal),
        crmNote:
          record.recordClass === "current"
            ? classification.crm_note
            : `${evidenceContext} Verify present needs and the responsible buyer, partner, or procurement path before outreach.`,
        workflowNote:
          record.recordClass === "current"
            ? `${classificationLabel(classification.revenue_motion)} | ${classificationLabel(classification.contact_strategy)} | ${classification.workflow_payload_ready ? "Workflow ready" : classification.workflow_payload_reason}`
            : `Funded-buyer evidence | ${classificationLabel(classification.contact_strategy)} | Present-needs research required`
      };
    })
  );

  return rows;
}

export function outreachPackageCsv(rows: OutreachPackageRow[]): string {
  const headers: Array<keyof OutreachPackageRow> = [
    "priority",
    "targetOrganization",
    "opportunityContext",
    "awardAmount",
    "contactInfo",
    "contactType",
    "sendability",
    "recommendedOwner",
    "sourceUrl",
    "firstEmailSubject",
    "firstEmailBody",
    "followUp1",
    "followUp2",
    "crmNote",
    "workflowNote"
  ];
  const labels = [
    "Priority",
    "Target Organization",
    "Opportunity Context",
    "Award Amount",
    "Contact Info",
    "Contact Type",
    "Sendability",
    "Recommended Owner",
    "Source URL",
    "First Email Subject",
    "First Email Body",
    "Follow Up 1",
    "Follow Up 2",
    "CRM Note",
    "Workflow Note"
  ];
  const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [labels, ...rows.map((row) => headers.map((header) => row[header]))]
    .map((row) => row.map(cell).join(","))
    .join("\n");
}

export function outreachPackageMarkdown(rows: OutreachPackageRow[], scan: ScanRecord, profile?: CompanyProfile): string {
  const company = profile?.company_name || scan.company_name || scan.company_url;
  return [
    `# ${company} Outreach Package`,
    "",
    `Scan ID: ${scan.id}`,
    "",
    "## How To Use This",
    "",
    "- Upload the CSV or JSON into the outbound AI/workflow instance.",
    "- Treat source-native grant contacts as program/eligibility contacts unless the row says otherwise.",
    "- Send only rows marked sendable after review; otherwise create a research task first.",
    "- Log source URL, contact type, email sent, reply, follow-up date, and next action in CRM.",
    "",
    "## Targets",
    "",
    ...rows.flatMap((row) => [
      `### ${row.priority}. ${row.targetOrganization}`,
      "",
      `- Opportunity context: ${row.opportunityContext}`,
      `- Award amount: ${row.awardAmount}`,
      `- Contact info: ${row.contactInfo}`,
      `- Contact type: ${row.contactType}`,
      `- Sendability: ${row.sendability}`,
      `- Recommended owner: ${row.recommendedOwner}`,
      `- Source: ${row.sourceUrl}`,
      `- CRM note: ${row.crmNote}`,
      "",
      `Subject: ${row.firstEmailSubject}`,
      "",
      "```text",
      row.firstEmailBody,
      "```",
      "",
      "Follow-up 1:",
      "",
      "```text",
      row.followUp1,
      "```",
      "",
      "Follow-up 2:",
      "",
      "```text",
      row.followUp2,
      "```",
      ""
    ])
  ].join("\n");
}
