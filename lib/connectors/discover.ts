import { CompanyProfile, OpportunitySignal } from "../types";
import { searchFederalRegister } from "./federalRegister";
import { searchGrantsGov } from "./grantsGov";
import { isSamGovConfigured, searchSamGov } from "./samGov";
import { collectSearchTerms } from "./shared";
import { searchStateLocalPortals } from "./stateLocalPortals";
import { searchUsaSpending } from "./usaspending";
import {
  failedConnectorRun,
  runConnector,
  type ConnectorRunStatus,
  type RunConnectorOptions
} from "./runtime";

function shouldQuerySource(profile: CompanyProfile, source: string): boolean {
  if (!profile.activated_source_categories?.length) {
    return true;
  }

  return profile.activated_source_categories.includes(source);
}

export type ConnectorDiscoveryResult = {
  signals: OpportunitySignal[];
  runs: ConnectorRunStatus[];
};

export async function discoverExternalSignalsWithStatus(
  profile: CompanyProfile
): Promise<ConnectorDiscoveryResult> {
  const queryPlan = collectSearchTerms(profile, 18);
  const shouldTryUsaSpending = shouldQuerySource(profile, "usaspending.gov");
  const shouldTryFederalRegister = shouldQuerySource(profile, "federal_register");

  const shouldTryGrants =
    shouldQuerySource(profile, "grants.gov") || profile.planned_source_categories?.includes("grants.gov");

  const shouldTrySam =
    shouldQuerySource(profile, "sam.gov") || profile.planned_source_categories?.includes("sam.gov");

  const shouldTryStateLocal =
    shouldQuerySource(profile, "state_local") ||
    profile.planned_source_categories?.some((source) =>
      /state|local|city|county|school_district|procurement|parks|tourism|arts_council|education_department|workforce_board/i.test(source)
    );

  const definitions: RunConnectorOptions[] = [
    {
      sourceId: "usaspending.gov",
      sourceName: "USAspending.gov",
      enabled: shouldTryUsaSpending,
      queryPlan,
      nextTest: "Run Reparel, Jammcard, and SchoolGig award-source regression scans.",
      notes: "Historical award and funded-buyer evidence; not an open-bid source.",
      execute: (context) => searchUsaSpending(profile, context)
    },
    {
      sourceId: "grants.gov",
      sourceName: "Grants.gov",
      enabled: shouldTryGrants,
      queryPlan,
      nextTest: "Validate deadlines, eligibility, and program-contact labeling across the regression companies.",
      notes: "Active and forecasted grant source with program contacts where available.",
      execute: (context) => searchGrantsGov(profile, context)
    },
    {
      sourceId: "federal_register",
      sourceName: "Federal Register",
      enabled: shouldTryFederalRegister,
      queryPlan,
      nextTest: "Confirm policy records remain monitor/research signals unless paired with an action path.",
      notes: "Policy-demand context; not a direct sales opportunity by itself.",
      execute: (context) => searchFederalRegister(profile, context)
    },
    {
      sourceId: "sam.gov",
      sourceName: "SAM.gov",
      enabled: shouldTrySam,
      credentialRequired: true,
      credentialConfigured: isSamGovConfigured(),
      queryPlan,
      nextTest: "Configure the approved key, then test medical, live-performance, and teacher-recruitment notices.",
      notes: "Active federal procurement source; skipped safely when credentials are missing.",
      execute: (context) => searchSamGov(profile, context)
    },
    {
      sourceId: "state_local",
      sourceName: "State/local portal routing",
      enabled: shouldTryStateLocal,
      disabled: shouldTryStateLocal,
      queryPlan,
      nextTest: "Enable only after a portal connector verifies real postings, deadlines, and buyer/contact paths.",
      notes: "Deliberately disabled so portal search routes are not presented as confirmed opportunities.",
      execute: () => searchStateLocalPortals(profile)
    }
  ];

  const settled = await Promise.allSettled(definitions.map((definition) => runConnector(definition)));
  const results = settled.map((result, index) =>
    result.status === "fulfilled" ? result.value : failedConnectorRun(definitions[index], result.reason)
  );

  return {
    signals: results.flatMap((result) => result.signals),
    runs: results.map((result) => result.run)
  };
}

export async function discoverExternalSignals(profile: CompanyProfile): Promise<OpportunitySignal[]> {
  const result = await discoverExternalSignalsWithStatus(profile);
  return result.signals;
}
