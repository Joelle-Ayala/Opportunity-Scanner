import { discoverExternalSignalsWithStatus } from "./connectors/discover";
import { generateCompanyProfile } from "./profile";
import { applyProfileFeedbackToProfile } from "./profileRefinement";
import { scrapeCompanyWebsite } from "./scraper";
import {
  listProfileFeedbackForCompanyUrl,
  saveCompanyProfile,
  saveConnectorRunStatuses,
  saveOpportunitySignals,
  updateScan
} from "./storage";
import type { ScanInput } from "./types";

export async function executeScanPipeline(scanId: string, input: ScanInput): Promise<void> {
  await updateScan(scanId, { status: "scraping" });
  const scraped = await scrapeCompanyWebsite(input.companyUrl);

  await updateScan(scanId, { status: "profiling" });
  const inferredProfile = await generateCompanyProfile(input, scraped.rawText);
  const priorFeedback = await listProfileFeedbackForCompanyUrl(input.companyUrl);
  const profile =
    priorFeedback.length > 0
      ? applyProfileFeedbackToProfile(inferredProfile, priorFeedback)
      : inferredProfile;

  await updateScan(scanId, { selected_playbooks: profile.selected_playbooks });
  await saveCompanyProfile(scanId, profile, scraped.rawText, scraped.pages);

  await updateScan(scanId, { status: "discovering" });
  const discovery = await discoverExternalSignalsWithStatus(profile);
  await saveConnectorRunStatuses(scanId, discovery.runs);
  await saveOpportunitySignals(scanId, discovery.signals, profile);

  await updateScan(scanId, {
    status: "completed",
    completed_at: new Date().toISOString()
  });
}
