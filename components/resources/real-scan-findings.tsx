/*
 * DATA FRESHNESS POLICY
 * These are historical award records = funded-buyer evidence. NEVER render or
 * write urgency ("closing soon", "deadline") from this data.
 * Scanned companies are anonymized exactly as the asset file specifies; award
 * recipients and amounts are public record and cited as-is.
 */
import realScanFindingsJson from "@/content/real-scan-findings.json";

export type RealScanVertical =
  | "creative-economy"
  | "education-workforce"
  | "healthcare-dme";

export type RealScanFinding = {
  recipient: string | null;
  amount: number;
  amount_display: string;
  award_year: number | null;
  agency: string;
  source_system: string;
  source_url: string;
  evidence: string;
  implication: string;
};

export type RealScanAggregate = {
  sourced_signals: number;
  distinct_federal_agencies: number;
  source_system_count: number;
  source_systems: string[];
};

export type RealScanVerticalData = {
  name: string;
  anonymized_company: string;
  aggregate: RealScanAggregate;
  narrative: string;
  findings: RealScanFinding[];
};

export type CrossSiteAggregates = {
  opportunities_surfaced: number;
  source_system_count: number;
  source_systems: string[];
  distinct_agencies_per_scan: {
    minimum: number;
    maximum: number;
    display: string;
  };
  award_evidence_range: {
    minimum: number;
    maximum: number;
    display: string;
  };
};

type RealScanDataset = {
  _policy: {
    classification: "evidence";
    rules: string[];
  };
  label: string;
  as_of: string;
  as_of_display: string;
  verticals: Record<RealScanVertical, RealScanVerticalData>;
  cross_site_aggregates: CrossSiteAggregates;
};

const realScanData = realScanFindingsJson as RealScanDataset;

export const REAL_SCAN_VERTICALS = Object.freeze(
  Object.keys(realScanData.verticals) as RealScanVertical[]
);

export function getRealScanVertical(vertical: RealScanVertical): RealScanVerticalData {
  return realScanData.verticals[vertical];
}

export function getRealScanFindings(
  vertical: RealScanVertical,
  limit: 2 | 3 = 3
): RealScanFinding[] {
  return getRealScanVertical(vertical).findings.slice(0, limit);
}

export function getCrossSiteAggregates(): CrossSiteAggregates {
  return realScanData.cross_site_aggregates;
}

type RealScanFindingsProps = {
  vertical: RealScanVertical;
  limit?: 2 | 3;
  className?: string;
};

export function RealScanFindings({
  vertical,
  limit = 3,
  className = ""
}: RealScanFindingsProps) {
  const verticalData = getRealScanVertical(vertical);
  const findings = getRealScanFindings(vertical, limit);
  const sectionId = `real-scan-findings-${vertical}`;

  return (
    <section
      aria-labelledby={sectionId}
      className={`rounded-lg border border-line bg-field p-5 shadow-sm sm:p-6 ${className}`.trim()}
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          {realScanData.label}
        </p>
        <h2 id={sectionId} className="mt-2 text-2xl font-semibold text-ink">
          Funded-buyer evidence from a real {verticalData.name.toLowerCase()} scan
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Historical public award records surfaced for {verticalData.anonymized_company}. As of{" "}
          <time dateTime={realScanData.as_of}>{realScanData.as_of_display}</time>.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {findings.map((finding) => (
          <article
            key={`${finding.recipient ?? "recipient-not-supplied"}-${finding.amount}`}
            className="min-w-0 rounded-lg border border-line bg-white p-5"
          >
            <p className="text-2xl font-semibold text-ink">{finding.amount_display}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
              Historical award
              {finding.award_year
                ? ` - ${finding.award_year}`
                : " - award year not supplied in curated record"}
            </p>

            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="font-semibold text-slate-500">Recipient</dt>
                <dd className="mt-1 font-semibold text-ink">
                  {finding.recipient ?? "Recipient not supplied in curated record"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Agency</dt>
                <dd className="mt-1 text-slate-700">{finding.agency}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Source system</dt>
                <dd className="mt-1 text-slate-700">
                  <a
                    href={finding.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-accent hover:underline"
                  >
                    {finding.source_system} award record
                  </a>
                </dd>
              </div>
            </dl>

            <p className="mt-4 border-t border-line pt-4 text-sm leading-6 text-slate-700">
              <span className="font-semibold text-ink">{finding.evidence}.</span>{" "}
              {finding.implication}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
