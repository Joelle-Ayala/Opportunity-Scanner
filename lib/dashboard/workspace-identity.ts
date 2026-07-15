export type WorkspaceIdentityReport = {
  companyName: string;
  companyUrl?: string;
  status?: string;
};

function normalizedIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] || "";
}

function reportHostname(companyUrl?: string): string {
  if (!companyUrl) return "";
  try {
    return new URL(companyUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return companyUrl.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").toLowerCase();
  }
}

function reportMatchesEmailDomain(email: string, report: WorkspaceIdentityReport): boolean {
  const domain = emailDomain(email);
  if (!domain) return false;

  const companyToken = normalizedIdentity(report.companyName);
  const hostnameToken = normalizedIdentity(reportHostname(report.companyUrl));
  const domainToken = normalizedIdentity(domain);
  const domainLabel = normalizedIdentity(domain.split(".")[0] || "");

  if (domainToken && hostnameToken === domainToken) return true;
  if (domainLabel.length < 3) return false;
  return companyToken.includes(domainLabel) || hostnameToken.includes(domainLabel);
}

export function workspaceCompanyFor(
  email: string,
  reports: WorkspaceIdentityReport[]
): string | undefined {
  const readyReports = reports.filter((report) => !report.status || report.status === "ready");
  const matchingReport = readyReports.find((report) => reportMatchesEmailDomain(email, report));
  return matchingReport?.companyName || readyReports[0]?.companyName;
}
