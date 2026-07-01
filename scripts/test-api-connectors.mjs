import { existsSync, readFileSync } from "node:fs";
import { setDefaultResultOrder } from "node:dns";
import path from "node:path";

setDefaultResultOrder("ipv4first");

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const envPath = path.join(process.cwd(), filename);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!key || process.env[key]) continue;
      process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

function pass(name, detail) {
  console.log(`PASS ${name}: ${detail}`);
}

function warn(name, detail) {
  console.log(`WARN ${name}: ${detail}`);
}

function fail(name, detail) {
  console.log(`FAIL ${name}: ${detail}`);
}

async function testUsaSpending() {
  const response = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: {
        keywords: ["live music"],
        award_type_codes: ["02", "03", "04", "05"],
        time_period: [{ start_date: "2025-01-01", end_date: "2026-06-30" }]
      },
      fields: ["Award ID", "Recipient Name", "Award Amount", "End Date"],
      page: 1,
      limit: 1,
      sort: "Award Amount",
      order: "desc",
      subawards: false
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  pass("USAspending.gov", `${data?.results?.length ?? 0} sample award result(s)`);
}

async function testGrantsGov() {
  const searchResponse = await fetch("https://api.grants.gov/v1/api/search2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rows: 1,
      keyword: "arts education",
      oppStatuses: "forecasted|posted",
      eligibilities: "",
      agencies: "",
      aln: "",
      fundingCategories: ""
    })
  });
  if (!searchResponse.ok) throw new Error(`search2 HTTP ${searchResponse.status}`);
  const searchData = await searchResponse.json();
  const hit = searchData?.data?.oppHits?.[0];
  if (!hit?.id) {
    warn("Grants.gov", "search2 worked but returned no sample opportunity");
    return;
  }

  const detailResponse = await fetch("https://api.grants.gov/v1/api/fetchOpportunity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ opportunityId: Number(hit.id) })
  });
  if (!detailResponse.ok) throw new Error(`fetchOpportunity HTTP ${detailResponse.status}`);
  const detailData = await detailResponse.json();
  const contact = detailData?.data?.synopsis?.agencyContactEmail ? "with contact" : "without contact";
  pass("Grants.gov", `search2 + fetchOpportunity worked (${contact})`);
}

async function testSamGov() {
  if (!process.env.SAM_API_KEY) {
    warn("SAM.gov", "SAM_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    api_key: process.env.SAM_API_KEY,
    postedFrom: "06/01/2026",
    postedTo: "06/30/2026",
    title: "music",
    limit: "1",
    offset: "0",
    ptype: "o"
  });
  const response = await fetch(`https://api.sam.gov/opportunities/v2/search?${params}`);
  const text = await response.text();
  if (response.status === 429) {
    warn("SAM.gov", "key is valid-looking but currently rate limited/quota throttled");
    return;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  pass("SAM.gov", `${data?.opportunitiesData?.length ?? 0} sample opportunity result(s)`);
}

async function testRegulationsGov() {
  if (!process.env.REGULATIONS_API_KEY) {
    warn("Regulations.gov", "REGULATIONS_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    "filter[searchTerm]": "music",
    "page[size]": "5",
    sort: "-postedDate"
  });
  const response = await fetch(`https://api.regulations.gov/v4/documents?${params}`, {
    headers: { "X-Api-Key": process.env.REGULATIONS_API_KEY }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  pass("Regulations.gov", `${data?.data?.length ?? 0} sample document result(s)`);
}

async function testCensus() {
  if (!process.env.CENSUS_API_KEY) {
    warn("Census", "CENSUS_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    get: "NAME,B01003_001E",
    for: "state:06",
    key: process.env.CENSUS_API_KEY
  });
  const response = await fetch(`https://api.census.gov/data/2023/acs/acs5?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  pass("Census", `${data?.[1]?.[0] ?? "sample geography"} population table returned`);
}

async function testBls() {
  if (!process.env.BLS_API_KEY) {
    warn("BLS", "BLS_API_KEY not configured");
    return;
  }

  const response = await fetch("https://api.bls.gov/publicAPI/v2/timeseries/data/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seriesid: ["CUUR0000SA0"],
      startyear: "2024",
      endyear: "2024",
      registrationkey: process.env.BLS_API_KEY
    })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.status !== "REQUEST_SUCCEEDED") {
    throw new Error(data.message?.join("; ") || data.status || "BLS request failed");
  }
  const points = data?.Results?.series?.[0]?.data?.length ?? 0;
  pass("BLS", `${points} CPI sample data point(s) returned`);
}

async function testFred() {
  if (!process.env.FRED_API_KEY) {
    warn("FRED", "FRED_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    series_id: "UNRATE",
    api_key: process.env.FRED_API_KEY,
    file_type: "json",
    limit: "1",
    sort_order: "desc"
  });
  const response = await fetch(`https://api.stlouisfed.org/fred/series/observations?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const observation = data?.observations?.[0];
  if (!observation) {
    throw new Error("No sample observation returned");
  }
  pass("FRED", `latest UNRATE sample returned for ${observation.date}`);
}

async function testOnet() {
  if (!process.env.ONET_API_KEY) {
    warn("O*NET", "ONET_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    keyword: "musician",
    start: "1",
    end: "3"
  });
  const response = await fetch(`https://api-v2.onetcenter.org/online/search?${params}`, {
    headers: { "X-API-Key": process.env.ONET_API_KEY }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const careers = data?.career ?? data?.careers ?? data?.occupation ?? data?.occupations ?? [];
  const count = Array.isArray(careers) ? careers.length : data ? 1 : 0;
  pass("O*NET", `${count} occupation search result(s) returned`);
}

async function testDol() {
  if (!process.env.DOL_API_KEY) {
    warn("DOL", "DOL_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    "X-API-KEY": process.env.DOL_API_KEY,
    limit: "1"
  });
  const response = await fetch(`https://api.dol.gov/v4/get/OSHA/accident/json?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const count = data?.data?.length ?? 0;
  pass("DOL", `${count} OSHA accident sample record(s) returned`);
}

async function testUsaJobs() {
  if (!process.env.USAJOBS_API_KEY || !process.env.USAJOBS_USER_AGENT) {
    warn("USAJOBS", "USAJOBS_API_KEY or USAJOBS_USER_AGENT not configured");
    return;
  }

  const params = new URLSearchParams({
    Keyword: "music",
    LocationName: "United States",
    ResultsPerPage: "1"
  });
  const response = await fetch(`https://data.usajobs.gov/api/search?${params}`, {
    headers: {
      Host: "data.usajobs.gov",
      "User-Agent": process.env.USAJOBS_USER_AGENT,
      "Authorization-Key": process.env.USAJOBS_API_KEY
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  const count = data?.SearchResult?.SearchResultCount ?? 0;
  pass("USAJOBS", `${count} sample job posting result(s) returned`);
}

async function testCollegeScorecard() {
  if (!process.env.COLLEGE_SCORECARD_API_KEY) {
    warn("College Scorecard", "COLLEGE_SCORECARD_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    api_key: process.env.COLLEGE_SCORECARD_API_KEY,
    "school.name": "music",
    fields: "id,school.name,school.state,latest.student.size",
    per_page: "1"
  });
  const response = await fetch(`https://api.data.gov/ed/collegescorecard/v1/schools?${params}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  pass("College Scorecard", `${data?.results?.length ?? 0} sample school result(s) returned`);
}

async function testSnov() {
  if (!process.env.SNOV_CLIENT_ID || !process.env.SNOV_CLIENT_SECRET) {
    warn("Snov", "SNOV_CLIENT_ID or SNOV_CLIENT_SECRET not configured");
    return;
  }

  const response = await fetch("https://api.snov.io/v1/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SNOV_CLIENT_ID,
      client_secret: process.env.SNOV_CLIENT_SECRET
    })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  if (!data?.access_token) {
    throw new Error("No access token returned");
  }
  pass("Snov", "OAuth token returned");
}

async function testApollo() {
  if (!process.env.APOLLO_API_KEY) {
    warn("Apollo", "APOLLO_API_KEY not configured");
    return;
  }

  const response = await fetch("https://api.apollo.io/api/v1/auth/health", {
    headers: {
      "X-Api-Key": process.env.APOLLO_API_KEY,
      "Content-Type": "application/json"
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  pass("Apollo", data?.healthy ? "auth health returned healthy" : "auth health endpoint returned");
}

async function testProspeo() {
  if (!process.env.PROSPEO_API_KEY) {
    warn("Prospeo", "PROSPEO_API_KEY not configured");
    return;
  }

  const response = await fetch("https://api.prospeo.io/account-information", {
    headers: {
      "X-KEY": process.env.PROSPEO_API_KEY,
      "Content-Type": "application/json"
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  const plan = data?.response?.current_plan ? `plan ${data.response.current_plan}` : "account information returned";
  pass("Prospeo", plan);
}

async function testPeopleDataLabs() {
  if (!process.env.PEOPLE_DATA_LABS_API_KEY) {
    warn("People Data Labs", "PEOPLE_DATA_LABS_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    api_key: process.env.PEOPLE_DATA_LABS_API_KEY
  });
  const response = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${params}`);
  const text = await response.text();
  if (response.status === 400 && /required|params|parameter|input/i.test(text)) {
    pass("People Data Labs", "key accepted; enrichment endpoint requested missing parameters");
    return;
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  pass("People Data Labs", "enrichment endpoint returned");
}

async function testHunter() {
  if (!process.env.HUNTER_API_KEY) {
    warn("Hunter", "HUNTER_API_KEY not configured");
    return;
  }

  const params = new URLSearchParams({
    api_key: process.env.HUNTER_API_KEY
  });
  const response = await fetch(`https://api.hunter.io/v2/account?${params}`);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  const data = JSON.parse(text);
  const calls = data?.data?.calls;
  pass("Hunter", calls ? "account endpoint returned usage info" : "account endpoint returned");
}

async function testClay() {
  if (!process.env.CLAY_API_KEY) {
    warn("Clay", "CLAY_API_KEY not configured");
    return;
  }

  const response = await fetch("https://api.clay.com/v3", {
    headers: {
      Authorization: `Bearer ${process.env.CLAY_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  warn("Clay", "key is configured, but the root endpoint does not validate auth; choose a Clay workflow endpoint before production use");
}

const tests = [
  ["USAspending.gov", testUsaSpending],
  ["Grants.gov", testGrantsGov],
  ["SAM.gov", testSamGov],
  ["Regulations.gov", testRegulationsGov],
  ["Census", testCensus],
  ["BLS", testBls],
  ["FRED", testFred],
  ["O*NET", testOnet],
  ["DOL", testDol],
  ["USAJOBS", testUsaJobs],
  ["College Scorecard", testCollegeScorecard],
  ["Snov", testSnov],
  ["Apollo", testApollo],
  ["Prospeo", testProspeo],
  ["People Data Labs", testPeopleDataLabs],
  ["Hunter", testHunter],
  ["Clay", testClay]
];

loadLocalEnv();

let failures = 0;
for (const [name, test] of tests) {
  try {
    await test();
  } catch (error) {
    failures += 1;
    fail(name, error instanceof Error ? error.message : String(error));
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
