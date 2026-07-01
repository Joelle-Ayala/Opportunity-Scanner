import { promises as fs } from "node:fs";
import path from "node:path";

const endpoint = "https://api.sam.gov/opportunities/v2/search";
const defaultTerms = ["live music services", "entertainment services", "teacher recruitment"];
const ptypes = ["o", "k", "r", "s", "p"];

async function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(process.cwd(), filename);
    try {
      const raw = await fs.readFile(filePath, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...valueParts] = trimmed.split("=");
        if (!process.env[key]) {
          process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
        }
      }
    } catch {
      // Local env files are optional.
    }
  }
}

function formatSamDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

function oneYearAgo() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  date.setDate(date.getDate() + 1);
  return date;
}

async function searchTerm(term) {
  const results = [];

  for (const ptype of ptypes) {
    const params = new URLSearchParams({
      api_key: process.env.SAM_API_KEY,
      postedFrom: formatSamDate(oneYearAgo()),
      postedTo: formatSamDate(new Date()),
      title: term,
      limit: "3",
      offset: "0",
      ptype
    });

    const response = await fetch(`${endpoint}?${params}`);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SAM.gov returned ${response.status} for "${term}" (${ptype}): ${body.slice(0, 200)}`);
    }

    const data = await response.json();
    results.push(
      ...((data?.opportunitiesData ?? []).map((item) => ({
        ptype,
        title: item.title || "Untitled",
        type: item.type || item.baseType || "Unknown type",
        agency: item.fullParentPathName || item.department || item.subTier || "Unknown agency",
        deadline: item.responseDeadLine || "",
        url: item.uiLink || (item.noticeId ? `https://sam.gov/opp/${item.noticeId}/view` : "")
      })))
    );
  }

  return results;
}

async function main() {
  await loadLocalEnv();

  if (!process.env.SAM_API_KEY) {
    console.log("SAM_API_KEY is not configured. Add it to .env.local to enable SAM.gov connector testing.");
    process.exit(0);
  }

  const terms = process.argv.slice(2).join(" ").trim()
    ? [process.argv.slice(2).join(" ").trim()]
    : defaultTerms;

  for (const term of terms) {
    const results = await searchTerm(term);
    console.log(`\n${term}: ${results.length} result(s)`);
    for (const item of results.slice(0, 8)) {
      console.log(`- ${item.type}: ${item.title}`);
      console.log(`  ${item.agency}${item.deadline ? ` | deadline ${item.deadline}` : ""}`);
      if (item.url) console.log(`  ${item.url}`);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
