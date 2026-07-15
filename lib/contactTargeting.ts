import type { StoredOpportunitySignal } from "./types";
import { signalLane } from "./actionability";

export type ContactTarget = {
  organization: string;
  roles: string[];
  why: string;
  outreachAngle: string;
  searchUrl: string;
  name?: string;
  title?: string;
  email?: string;
  phone?: string;
  source?: string;
};

function searchUrl(parts: string[]): string {
  const query = parts.filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function evidenceText(signal: StoredOpportunitySignal): string {
  return [
    signal.opportunity_title,
    signal.external_evidence_summary,
    signal.query_used,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner,
    signalLane(signal)
  ]
    .join(" ")
    .toLowerCase();
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function sourceContacts(signal: StoredOpportunitySignal): ContactTarget[] {
  const sourceContactIsActionable =
    (signal.source_name === "SAM.gov" &&
      (signal.source_type === "active_contract" ||
        signal.source_type === "procurement_category" ||
        signal.revenue_pathway === "procurement_bid" ||
        signal.revenue_pathway === "sell_to_agency")) ||
    (signal.source_name === "Grants.gov" && signal.revenue_pathway === "direct_apply");

  if (!sourceContactIsActionable) {
    return [];
  }

  const contacts = signal.raw_json?.pointOfContact;
  if (!Array.isArray(contacts)) {
    return [];
  }

  const organization = signal.likely_buyer_or_partner || signal.agency_or_funder || "Source-listed organization";

  return contacts
    .map((item): ContactTarget | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const name = String(record.fullName || record.fullname || "").trim();
      const title = String(record.title || record.type || "").trim();
      const email = String(record.email || "").trim();
      const phone = String(record.phone || "").trim();

      if (!name && !title && !email && !phone) {
        return null;
      }

      const roles = unique([title || "Source-listed point of contact"]);
      return {
        organization,
        roles,
        name: name || undefined,
        title: title || undefined,
        email: email || undefined,
        phone: phone || undefined,
        source: signal.source_name,
        why: "Source-listed contact: this person/contact was included directly in the source record.",
        outreachAngle: outreachAngleForSignal(signal),
        searchUrl: searchUrl([organization, name || title, email ? "" : "email contact"])
      };
    })
    .filter((item): item is ContactTarget => Boolean(item));
}

function roleSetForSignal(signal: StoredOpportunitySignal): string[] {
  const lane = signalLane(signal).toLowerCase();
  const evidence = evidenceText(signal);

  if (/tourism|parks|recreation|placemaking|public space|public plaza|open streets|downtown|bid|business improvement district|city of|county/.test(`${lane} ${evidence}`)) {
    return [
      "Special Events Manager",
      "Cultural Affairs Manager",
      "Parks and Recreation Director",
      "Tourism or Downtown Partnership Director",
      "Procurement Specialist"
    ];
  }

  if (/teacher recruitment|teacher recruiting|teacher hiring|teacher staffing|teacher shortage|teacher residency|educator workforce|educator recruitment|district hiring|school district recruiting|applicant tracking|talent acquisition|hiring platform/.test(`${lane} ${evidence}`)) {
    return [
      "District HR Director",
      "Talent Acquisition Director",
      "Teacher Recruitment Lead",
      "Educator Workforce Program Manager",
      "Procurement Specialist"
    ];
  }

  if (/school|district|education|teaching artist|arts education|enrichment/.test(`${lane} ${evidence}`)) {
    return [
      "VAPA Coordinator",
      "Arts Coordinator",
      "Arts Education Program Director",
      "Enrichment Program Director",
      "Arts Funding Program Lead",
      "CTE or Workforce Program Director",
      "Procurement Specialist"
    ];
  }

  if (/symphony|performing arts|arts council|artist|musician|concert|live music|event entertainment|booking/.test(`${lane} ${evidence}`)) {
    return [
      "Executive Director",
      "Programming Director",
      "Events or Production Manager",
      "Partnerships Director",
      "Grants Manager"
    ];
  }

  if (/medical|rehab|dme|prosthetic|orthotic|clinical|health/.test(`${lane} ${evidence}`)) {
    return [
      "Procurement Manager",
      "Clinical Program Director",
      "Rehab Services Director",
      "Partnerships Director",
      "Grants Manager"
    ];
  }

  return ["Program Director", "Procurement Specialist", "Partnerships Director", "Grants Manager"];
}

function outreachAngleForSignal(signal: StoredOpportunitySignal): string {
  const lane = signalLane(signal).toLowerCase();
  const evidence = evidenceText(signal);

  if (/live music|concert|musician|performer|event entertainment|festival|public event|cultural programming/.test(`${lane} ${evidence}`)) {
    return "Lead with a specific live-music or performer booking angle: ask who manages programming, vendor selection, or partner bookings for the funded event/program.";
  }

  if (/tourism|placemaking|downtown|public space|open streets|public plaza|bid|business improvement district/.test(`${lane} ${evidence}`)) {
    return "Lead with public-space activation: position the company as a way to source reliable live programming for visitor, downtown, or community event goals.";
  }

  if (/teacher recruitment|teacher recruiting|teacher hiring|teacher staffing|teacher shortage|teacher residency|educator workforce|educator recruitment|district hiring|school district recruiting|applicant tracking|talent acquisition|hiring platform/.test(`${lane} ${evidence}`)) {
    return "Lead with educator hiring outcomes: ask who owns teacher recruitment, candidate pipelines, district HR systems, or funded workforce implementation.";
  }

  if (/school|education|enrichment|teaching artist/.test(`${lane} ${evidence}`)) {
    return "Lead with enrichment delivery: ask who manages arts programming, after-school enrichment, or vendor partnerships for funded student programs.";
  }

  if (/medical|rehab|dme|prosthetic|orthotic/.test(`${lane} ${evidence}`)) {
    return "Lead with the relevant product/use case and ask who owns purchasing, clinical recommendations, distributor relationships, or patient support programs.";
  }

  return "Lead with the source record, explain the relevant fit in one sentence, and ask who owns vendor, partner, or program decisions.";
}

export function contactTargetsForSignal(signal: StoredOpportunitySignal): ContactTarget[] {
  const directContacts = sourceContacts(signal);
  if (directContacts.length > 0) {
    return directContacts;
  }

  const buyer = signal.likely_buyer_or_partner || signal.agency_or_funder || "Buyer or funded organization";
  const agency = signal.agency_or_funder;
  const lane = signalLane(signal);
  const roles = roleSetForSignal(signal);
  const targets: ContactTarget[] = [
    {
      organization: buyer,
      roles,
      why: "Primary path: this is the named buyer, recipient, or funded organization tied to the signal.",
      outreachAngle: outreachAngleForSignal(signal),
      searchUrl: searchUrl([buyer, roles.slice(0, 3).join(" OR "), "email contact"])
    }
  ];

  if (agency && agency !== buyer) {
    targets.push({
      organization: agency,
      roles: unique(["Program Officer", "Grants Manager", "Procurement Specialist", ...roles.slice(0, 2)]),
      why: "Agency path: use this if the funding agency controls the program, procurement route, or approved-vendor process.",
      outreachAngle: `Ask who manages vendors, partners, or subrecipients for ${lane}.`,
      searchUrl: searchUrl([agency, lane, "program officer procurement contact"])
    });
  }

  return targets;
}

export function primaryContactTarget(signal: StoredOpportunitySignal): ContactTarget {
  return contactTargetsForSignal(signal)[0];
}

export function contactDiscoverySummary(signal: StoredOpportunitySignal): {
  verifiedContacts: number;
  targetRoles: number;
  statusLabel: string;
  detailLabel: string;
} {
  const targets = contactTargetsForSignal(signal);
  const verifiedContacts = targets.filter((target) => target.name || target.email || target.phone).length;
  const targetRoles = unique(targets.flatMap((target) => target.roles)).length;

  if (verifiedContacts > 0) {
    return {
      verifiedContacts,
      targetRoles,
      statusLabel: `${verifiedContacts} verified contact${verifiedContacts === 1 ? "" : "s"}`,
      detailLabel: `${targetRoles} relevant role${targetRoles === 1 ? "" : "s"} mapped`
    };
  }

  return {
    verifiedContacts,
    targetRoles,
    statusLabel: "0 verified contacts",
    detailLabel: `${targetRoles} target role${targetRoles === 1 ? "" : "s"} identified`
  };
}
