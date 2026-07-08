import { promises as fs } from "node:fs";
import path from "node:path";

const dataPath = path.join(process.cwd(), ".data", "local-db.json");
const outputPath = path.join(process.cwd(), "output", "quality", "report-quality-latest.json");
const currentDate = new Date().toISOString().slice(0, 10);
const defaultCompanyMatchers = [
  { key: "jammcard", label: "Jammcard", pattern: /jammcard/i },
  { key: "schoolgig", label: "SchoolGig", pattern: /schoolgig|schoolgig\.us/i },
  { key: "reparel", label: "Reparel", pattern: /reparel/i }
];

function parseArgs(argv) {
  const options = {
    all: false,
    latestPerCompany: false,
    scanIds: [],
    companies: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--all") {
      options.all = true;
    } else if (arg === "--latest-per-company") {
      options.latestPerCompany = true;
    } else if (arg === "--scan" && next) {
      options.scanIds.push(...next.split(",").map((item) => item.trim()).filter(Boolean));
      index += 1;
    } else if (arg === "--company" && next) {
      options.companies.push(...next.split(",").map((item) => item.trim()).filter(Boolean));
      index += 1;
    }
  }

  return options;
}

function textOf(...parts) {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function signalLane(signal) {
  const laneReason = (signal.reasoning || []).find((item) => item.startsWith("Inferred lane:"));
  return laneReason?.replace("Inferred lane:", "").trim() || (signal.revenue_pathway || "").replaceAll("_", " ");
}

function rawDate(signal, field) {
  return typeof signal.raw_json?.[field] === "string" ? signal.raw_json[field] : "";
}

function profileText(profile = {}) {
  return textOf(
    profile.company_name,
    profile.summary,
    ...(profile.industries || []),
    ...(profile.keywords || []),
    ...(profile.public_sector_search_terms || []),
    ...(profile.opportunity_lanes || [])
  );
}

function selectedPlaybookIds(profile = {}) {
  return (profile.selected_playbooks || [])
    .map((playbook) => playbook?.playbook_id)
    .filter(Boolean);
}

function hasSelectedPlaybook(profile, playbookId) {
  return selectedPlaybookIds(profile).includes(playbookId);
}

function isEducationWorkforceProfile(profile) {
  if (hasSelectedPlaybook(profile, "education_workforce_training")) {
    return true;
  }

  return /schoolgig|teacher|teachers|educator|educators|substitute|teacher shortage|teacher recruitment|school staffing|school district hiring|hiring platform|recruiting|recruitment|job board|talent acquisition|applicant tracking/.test(
    profileText(profile)
  );
}

function isMedicalSupplyProfile(profile) {
  if (hasSelectedPlaybook(profile, "healthcare_rehab_dme")) {
    return true;
  }

  return /medical|orthotic|prosthetic|rehab|physical therapy|compression|dme|sleeve/.test(profileText(profile));
}

function isCreativeWorkforceProfile(profile) {
  if (hasSelectedPlaybook(profile, "music_arts_creative_economy")) {
    return true;
  }

  if (hasSelectedPlaybook(profile, "education_workforce_training")) {
    return false;
  }

  return /jammcard|music|musician|artist|artists|creative|entertainment|performing arts|live event|cultural|venue|production/.test(
    profileText(profile)
  );
}

function isEducationWorkforceFit(text) {
  return /teacher|teachers|educator|educators|principal|principals|substitute teacher|teacher shortage|teacher recruitment|teacher residency|school staffing|school workforce|school district recruiting|applicant tracking|human resources software|job board|talent acquisition|recruiting platform|arts education|teaching artist|teaching artists|school arts|vapa|expanded learning|arts enrichment|artist educator|artist educators/.test(
    text
  );
}

function isClearEducationMoveForwardFit(text) {
  const staffingOrHrPath =
    /teacher|teachers|educator|educators|principal|principals|substitute teacher|teacher shortage|teacher recruitment|teacher residency|school staffing|educator workforce|school workforce|district workforce|school district recruiting|district recruiting|school hr|district hr|human resources|applicant tracking|job board|talent acquisition|recruiting platform|hiring platform|workforce hiring/.test(
      text
    );
  const schoolArtsStaffingPath =
    /prop 28|proposition 28|teaching artist|teaching artists|artist educator|artist educators|school arts|arts education staffing|arts enrichment|expanded learning|vapa|visual and performing arts/.test(
      text
    );
  const districtVendorPath =
    /school district|local educational agency|\blea\b|district procurement|district vendor|district contract|department of education procurement|education procurement/.test(
      text
    ) &&
    /staffing|recruiting|hiring|teacher|educator|human resources|hr|applicant tracking|job board|vendor|procurement|arts enrichment|teaching artist|school arts/.test(
      text
    );

  return staffingOrHrPath || schoolArtsStaffingPath || districtVendorPath;
}

function isEducationScreenedOut(profile, signal) {
  if (!isEducationWorkforceProfile(profile)) return false;
  const lane = signalLane(signal).toLowerCase();
  const evidence = textOf(
    signal.opportunity_title,
    signal.external_evidence_summary,
    signal.why_it_matters,
    signal.recommended_action,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner,
    signal.query_used,
    lane
  );

  return !isClearEducationMoveForwardFit(evidence);
}

function isEducationDomainMismatch(text) {
  return /behavioral health|mental health|suicide|988|crisis|clinical|clinician|therapist|medicaid|healthcare|department of health|substance use|telehealth|prison|jail|incarcerated|reentry|correctional|justice center|law enforcement custody/.test(
    text
  );
}

function isMedicalSupplyFit(text) {
  return /orthotic|prosthetic|rehabilitation supplies|physical therapy supplies|durable medical equipment|dme|medical supplies|compression garment|bracing|medical supply distributor|veterans affairs|visn/.test(
    text
  );
}

function isCreativeWorkforceFit(text) {
  return /music|musician|musicians|artist|artists|arts|creative economy|creative workforce|arts workforce|performing arts|live entertainment|event production|cultural programming|music education|public arts|festival|venue|musical performance|live music|performer services|performers|concert|event entertainment|public event|tourism/.test(
    text
  );
}

function isCreativeDomainMismatch(text) {
  return /teacher shortage|teacher residency|school staffing|substitute teacher|educator workforce|student athlete|medical supplies|medicaid|medicare|behavioral health|mental health|correctional|reentry|environmental quality|environmental protection|water quality|air quality/.test(
    text
  );
}

function hasCreativePublicEventSignal(signals) {
  return signals.some((signal) => {
    const lane = signalLane(signal).toLowerCase();
    const evidence = textOf(
      signal.opportunity_title,
      signal.external_evidence_summary,
      signal.query_used,
      signal.agency_or_funder,
      signal.likely_buyer_or_partner,
      lane
    );
    return /live music|live performance|musical performance|public concerts|concert series|event entertainment|public event|event production|performer services|parks|recreation|festival|tourism|placemaking|downtown/.test(
      evidence
    );
  });
}

function buildSignals(db, scanId) {
  return db.scan_opportunities
    .filter((item) => item.scan_id === scanId && item.hidden !== true)
    .map((scanOpportunity) => {
      const opportunity = db.opportunities.find((item) => item.id === scanOpportunity.opportunity_id);
      if (!opportunity) return null;
      const raw = opportunity.raw_json || {};
      return {
        ...raw,
        id: opportunity.id,
        title: opportunity.title,
        relevance_score: scanOpportunity.relevance_score,
        novelty_score: scanOpportunity.novelty_score,
        confidence_score: scanOpportunity.confidence_score,
        reasoning: scanOpportunity.reasoning_json || raw.reasoning || [],
        recommended_action: scanOpportunity.recommended_action || raw.recommended_action || "",
        human_review_required: scanOpportunity.human_review_required,
        created_at: opportunity.created_at
      };
    })
    .filter(Boolean);
}

function getScanDisplayText(scan) {
  return textOf(scan.company_name, scan.company_url, scan.industry, scan.customer_type);
}

function scanCompletedAt(scan) {
  return scan.completed_at || scan.created_at || "";
}

function selectLatestPerCompany(scans, companies = []) {
  const matchers =
    companies.length > 0
      ? companies.map((company) => ({
          key: company.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
          label: company,
          pattern: new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        }))
      : defaultCompanyMatchers;

  return matchers
    .map((matcher) =>
      scans
        .filter((scan) => matcher.pattern.test(getScanDisplayText(scan)))
        .sort((a, b) => scanCompletedAt(b).localeCompare(scanCompletedAt(a)))[0]
    )
    .filter(Boolean);
}

function selectScans(scans, options) {
  if (options.all) {
    return scans;
  }

  if (options.scanIds.length > 0) {
    const selectedIds = new Set(options.scanIds);
    return scans.filter((scan) => selectedIds.has(scan.id));
  }

  return selectLatestPerCompany(scans, options.companies);
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item) || "Unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sourceBreakdown(signals) {
  return {
    by_source: countBy(signals, (signal) => signal.source_name),
    by_type: countBy(signals, (signal) => signal.source_type),
    by_actionability: countBy(signals, (signal) => signal.actionability),
    by_revenue_pathway: countBy(signals, (signal) => signal.revenue_pathway),
    query_count: new Set(signals.map((signal) => signal.query_used).filter(Boolean)).size,
    move_forward_count: signals.filter((signal) => ["yes", "maybe"].includes(signal.actionability)).length,
    high_confidence_count: signals.filter((signal) => signal.confidence_score >= 70).length
  };
}

function evaluateScanLevel({ profile, signals }) {
  const issues = [];
  const moveForwardCount = signals.filter((signal) => ["yes", "maybe"].includes(signal.actionability)).length;
  const highConfidenceCount = signals.filter((signal) => signal.confidence_score >= 70).length;

  if (signals.length < 3) {
    issues.push({
      code: "LOW_SIGNAL_VOLUME",
      severity: "high",
      message: "Report has fewer than three visible sourced signals.",
      signal_id: "",
      signal_title: "Report needs more visible sourced opportunity signals",
      lane: "",
      query_used: ""
    });
  }

  if (moveForwardCount < 2) {
    issues.push({
      code: "LOW_MOVE_FORWARD_VOLUME",
      severity: "high",
      message: "Report has fewer than two yes/maybe opportunities, which makes the free preview feel thin.",
      signal_id: "",
      signal_title: "Report needs more yes/maybe move-forward opportunities",
      lane: "",
      query_used: ""
    });
  }

  if (highConfidenceCount < 2) {
    issues.push({
      code: "LOW_CONFIDENCE_VOLUME",
      severity: "medium",
      message: "Report has fewer than two high-confidence signals.",
      signal_id: "",
      signal_title: "Report needs more high-confidence evidence",
      lane: "",
      query_used: ""
    });
  }

  if (isCreativeWorkforceProfile(profile) && signals.length > 0 && !hasCreativePublicEventSignal(signals)) {
    issues.push({
      code: "CREATIVE_PUBLIC_EVENT_REGRESSION",
      severity: "high",
      message:
        "Creative/live-performance scan has sourced signals but none in the live performance, public event, concert, tourism, placemaking, or event-production lane.",
      signal_id: "",
      signal_title: "Creative scan missing public-event/live-performance signal class",
      lane: "",
      query_used: ""
    });
  }

  return issues;
}

function evaluateSignal({ scan, profile, signal }) {
  const issues = [];
  const lane = signalLane(signal).toLowerCase();
  const evidence = textOf(
    signal.opportunity_title,
    signal.external_evidence_summary,
    signal.why_it_matters,
    signal.recommended_action,
    signal.agency_or_funder,
    signal.likely_buyer_or_partner,
    signal.query_used,
    lane
  );
  const endDate = signal.deadline || rawDate(signal, "End Date");

  if (scan.company_name !== "Reparel" && /reparel/.test(evidence)) {
    issues.push({
      code: "HARDCODED_EXAMPLE_COMPANY",
      severity: "high",
      message: "Generic report output contains Reparel-specific wording."
    });
  }

  if (isEducationWorkforceProfile(profile)) {
    if (!isEducationWorkforceFit(evidence)) {
      issues.push({
        code: "EDUCATION_WEAK_FIT",
        severity: "medium",
        message: "Education workforce profile has a signal without clear teacher, educator, school staffing, recruiting, or HR tech evidence."
      });
    }

    if (isEducationDomainMismatch(evidence)) {
      issues.push({
        code: "EDUCATION_DOMAIN_MISMATCH",
        severity: "high",
        message: "Education workforce profile has a health, crisis, justice, or correctional workforce signal that likely belongs to another market."
      });
    }
  }

  if (isMedicalSupplyProfile(profile) && lane.includes("infrastructure") && signal.relevance_score >= 65) {
    issues.push({
      code: "MEDICAL_INFRASTRUCTURE_SURFACED",
      severity: "medium",
      message: "Medical supply profile has a reimbursement/infrastructure record with enough score to review for hiding or prior-context labeling."
    });
  }

  if (isMedicalSupplyProfile(profile) && !isMedicalSupplyFit(evidence) && signal.relevance_score >= 72) {
    issues.push({
      code: "MEDICAL_WEAK_FIT",
      severity: "medium",
      message: "Medical supply profile has a high-scoring signal without clear orthotic, prosthetic, rehab, DME, physical therapy, or distributor evidence."
    });
  }

  if (isCreativeWorkforceProfile(profile)) {
    if (!isCreativeWorkforceFit(evidence)) {
      issues.push({
        code: "CREATIVE_WEAK_FIT",
        severity: "medium",
        message: "Creative workforce profile has a signal without clear music, artist, arts workforce, cultural programming, live event, or public arts evidence."
      });
    }

    if (isCreativeDomainMismatch(evidence)) {
      issues.push({
        code: "CREATIVE_DOMAIN_MISMATCH",
        severity: "high",
        message: "Creative workforce profile has an education, health, correctional, or reentry workforce signal that likely belongs to another market."
      });
    }
  }

  if (
    endDate &&
    endDate < currentDate &&
    signal.relevance_score >= 72 &&
    !["historical_award", "funded_buyer", "policy_signal"].includes(signal.source_type)
  ) {
    issues.push({
      code: "DATED_HIGH_SCORE_SIGNAL",
      severity: "low",
      message: "High-scoring signal has already ended; it should be labeled as recent/prior evidence, not a live lead."
    });
  }

  if (!signal.revenue_pathway) {
    issues.push({
      code: "MISSING_ROUTE",
      severity: "medium",
      message: "Signal has no revenue pathway, so the report cannot explain who to contact next."
    });
  }

  return issues.map((issue) => ({
    ...issue,
    signal_id: signal.id,
    signal_title: signal.opportunity_title || signal.title,
    lane: signalLane(signal),
    query_used: signal.query_used || ""
  }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = JSON.parse(await fs.readFile(dataPath, "utf8"));
  const completedScans = (db.scans || []).filter((scan) => scan.status === "completed");
  const scansToEvaluate = selectScans(completedScans, options);
  const results = [];

  for (const scan of scansToEvaluate) {
    const profileRecord = (db.company_profiles || [])
      .filter((profile) => profile.scan_id === scan.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const profile = profileRecord?.profile_json || {};
    const signals = buildSignals(db, scan.id).filter((signal) => !isEducationScreenedOut(profile, signal));
    const issues = [
      ...evaluateScanLevel({ profile, signals }),
      ...signals.flatMap((signal) => evaluateSignal({ scan, profile, signal }))
    ];

    results.push({
      scan_id: scan.id,
      report_url: `http://localhost:3000/reports/${scan.id}`,
      company_name: profile.company_name || scan.company_name || scan.company_url,
      company_url: scan.company_url,
      profile_type: isEducationWorkforceProfile(profile)
        ? "education_workforce"
        : isCreativeWorkforceProfile(profile)
        ? "creative_workforce"
        : isMedicalSupplyProfile(profile)
        ? "medical_supply"
        : "general",
      selected_playbooks: (profile.selected_playbooks || []).map((playbook) => playbook.name),
      signal_count: signals.length,
      source_breakdown: sourceBreakdown(signals),
      issue_count: issues.length,
      issues
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    mode: options.all
      ? "all_completed_scans"
      : options.scanIds.length > 0
      ? "selected_scan_ids"
      : "latest_per_company",
    scan_count: results.length,
    total_completed_scan_count: completedScans.length,
    issue_count: results.reduce((sum, result) => sum + result.issue_count, 0),
    high_issue_count: results.reduce(
      (sum, result) => sum + result.issues.filter((issue) => issue.severity === "high").length,
      0
    ),
    results
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(summary, null, 2));

  console.log(`Checked ${summary.scan_count} completed scan(s) in ${summary.mode} mode.`);
  console.log(`Total completed scans in local DB: ${summary.total_completed_scan_count}.`);
  console.log(`Found ${summary.issue_count} issue(s), including ${summary.high_issue_count} high-priority issue(s).`);
  console.log(`Saved ${outputPath}`);

  for (const result of results) {
    const sources = Object.entries(result.source_breakdown.by_source)
      .map(([source, count]) => `${source}: ${count}`)
      .join(", ");
    console.log(
      `\n${result.company_name} (${result.scan_id}) - ${result.signal_count} signal(s), ${result.source_breakdown.move_forward_count} yes/maybe, ${result.issue_count} issue(s)`
    );
    console.log(`Sources: ${sources || "None"}`);
  }

  for (const result of results.filter((item) => item.issue_count > 0).slice(0, 12)) {
    console.log(`\n${result.company_name} (${result.scan_id})`);
    for (const issue of result.issues.slice(0, 8)) {
      console.log(`- [${issue.severity}] ${issue.code}: ${issue.signal_title}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
