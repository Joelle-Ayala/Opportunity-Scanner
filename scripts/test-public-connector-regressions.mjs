import assert from "node:assert/strict";
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv4first");

const cases = [
  { company: "Reparel", term: "durable medical equipment" },
  { company: "Jammcard", term: "live music" },
  { company: "SchoolGig", term: "teacher recruitment" }
];

async function fetchJson(url, init = {}, timeoutMs = 30_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    assert.equal(response.ok, true, `HTTP ${response.status} from public connector smoke test`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function testUsaSpending(testCase) {
  const endDate = new Date().toISOString().slice(0, 10);
  const data = await fetchJson("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: {
        keywords: [testCase.term],
        award_type_codes: ["02", "03", "04", "05"],
        time_period: [{ start_date: "2024-01-01", end_date: endDate }],
        award_amounts: [{ lower_bound: 10000 }]
      },
      fields: ["Award ID", "Recipient Name", "Award Amount"],
      page: 1,
      limit: 3,
      sort: "Award Amount",
      order: "desc",
      subawards: false
    })
  });
  assert.equal(Array.isArray(data?.results), true);
  return data.results.length;
}

async function testGrantsGov(testCase) {
  const data = await fetchJson("https://api.grants.gov/v1/api/search2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rows: 5,
      keyword: testCase.term,
      oppStatuses: "forecasted|posted",
      eligibilities: "",
      agencies: "",
      aln: "",
      fundingCategories: ""
    })
  });
  const results = data?.data?.oppHits ?? [];
  assert.equal(Array.isArray(results), true);
  return results.length;
}

async function testFederalRegister(testCase) {
  const params = new URLSearchParams({
    "conditions[term]": testCase.term,
    "conditions[publication_date][gte]": "2023-01-01",
    order: "newest",
    per_page: "3"
  });
  const data = await fetchJson(`https://www.federalregister.gov/api/v1/documents.json?${params}`);
  const results = data?.results ?? [];
  assert.equal(Array.isArray(results), true);
  return results.length;
}

await Promise.all(
  cases.map(async (testCase) => {
    const [spending, grants, policy] = await Promise.all([
      testUsaSpending(testCase),
      testGrantsGov(testCase),
      testFederalRegister(testCase)
    ]);
    console.log(
      `PASS ${testCase.company}: USAspending ${spending}, Grants.gov ${grants}, Federal Register ${policy} raw result(s)`
    );
  })
);
