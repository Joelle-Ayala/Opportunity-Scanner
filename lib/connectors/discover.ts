import { CompanyProfile, OpportunitySignal } from "../types";
import { searchFederalRegister } from "./federalRegister";
import { searchGrantsGov } from "./grantsGov";
import { isSamGovConfigured, searchSamGov } from "./samGov";
import { searchStateLocalPortals } from "./stateLocalPortals";
import { searchUsaSpending } from "./usaspending";

function shouldQuerySource(profile: CompanyProfile, source: string): boolean {
  if (!profile.activated_source_categories?.length) {
    return true;
  }

  return profile.activated_source_categories.includes(source);
}

export async function discoverExternalSignals(profile: CompanyProfile): Promise<OpportunitySignal[]> {
  const searches: Array<Promise<OpportunitySignal[]>> = [];

  if (shouldQuerySource(profile, "usaspending.gov")) {
    searches.push(searchUsaSpending(profile));
  }

  if (shouldQuerySource(profile, "federal_register")) {
    searches.push(searchFederalRegister(profile));
  }

  const shouldTryGrants =
    shouldQuerySource(profile, "grants.gov") || profile.planned_source_categories?.includes("grants.gov");
  if (shouldTryGrants) {
    searches.push(searchGrantsGov(profile));
  }

  const shouldTrySam =
    shouldQuerySource(profile, "sam.gov") || profile.planned_source_categories?.includes("sam.gov");
  if (shouldTrySam && isSamGovConfigured()) {
    searches.push(searchSamGov(profile));
  }

  const shouldTryStateLocal =
    shouldQuerySource(profile, "state_local") ||
    profile.planned_source_categories?.some((source) =>
      /state|local|city|county|school_district|procurement|parks|tourism|arts_council|education_department|workforce_board/i.test(source)
    );
  if (shouldTryStateLocal) {
    searches.push(searchStateLocalPortals(profile));
  }

  const results = await Promise.allSettled(searches);

  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
