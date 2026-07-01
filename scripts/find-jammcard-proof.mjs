const terms = [
  "live music performance",
  "live music services",
  "musical performance",
  "musician services",
  "event entertainment",
  "event entertainment services",
  "public concerts",
  "summer concert series",
  "festival entertainment",
  "performer services",
  "performing artist services",
  "public event production"
];

const endDate = new Date().toISOString().slice(0, 10);
const awardTypeGroups = [
  ["A", "B", "C", "D"],
  ["02", "03", "04", "05", "F001", "F002"]
];

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function directScore(item, term) {
  const text = [
    term,
    item["Recipient Name"],
    item["Awarding Agency"],
    item.Description,
    item["Place of Performance State Code"]
  ]
    .join(" ")
    .toLowerCase();
  let score = 0;
  if (/live music|music performance|musical performance|musician services|performer services|performing artist|event entertainment|festival entertainment|concert|summer concert|public concerts|public event production|event production services/.test(text)) score += 60;
  if (/city of|county|department of parks|parks|recreation|tourism|downtown|public venue|academy|university|military band/.test(text)) score += 30;
  if ((item["End Date"] || "") >= "2026-06-29") score += 30;
  else if ((item["End Date"] || "") >= "2025-01-01") score += 12;
  if (/visual arts|museum visit|graphic artist|workforce development|case management/.test(text)) score -= 45;
  score += Math.min(20, Math.log10(Math.max(1, item["Award Amount"] || 1)) * 4);
  return score;
}

async function search(term) {
  const rows = [];
  for (const awardTypeCodes of awardTypeGroups) {
    const response = await fetch("https://api.usaspending.gov/api/v2/search/spending_by_award/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filters: {
          keywords: [term],
          award_type_codes: awardTypeCodes,
          time_period: [{ start_date: "2024-01-01", end_date: endDate }],
          award_amounts: [{ lower_bound: 10000 }]
        },
        fields: [
          "Award ID",
          "Recipient Name",
          "Award Amount",
          "Start Date",
          "End Date",
          "Awarding Agency",
          "Description",
          "Award Type",
          "Place of Performance State Code"
        ],
        page: 1,
        limit: 8,
        sort: "Award Amount",
        order: "desc",
        subawards: false
      })
    });
    if (!response.ok) continue;
    const data = await response.json();
    rows.push(...(data.results || []).map((item) => ({ ...item, term })));
  }
  return rows;
}

const seen = new Set();
const all = [];
for (const term of terms) {
  const rows = await search(term);
  for (const row of rows) {
    const id = row["Award ID"] || `${row.term}-${row["Recipient Name"]}`;
    if (seen.has(id)) continue;
    seen.add(id);
    all.push(row);
  }
}

const ranked = all
  .map((row) => ({
    score: directScore(row, row.term),
    term: row.term,
    awardId: row["Award ID"],
    recipient: row["Recipient Name"] || "Recipient not listed",
    amount: row["Award Amount"] || 0,
    start: row["Start Date"] || "",
    end: row["End Date"] || "",
    agency: row["Awarding Agency"] || "Agency not listed",
    state: row["Place of Performance State Code"] || "",
    description: row.Description || ""
  }))
  .filter((row) => row.score >= 55)
  .sort((a, b) => b.score - a.score)
  .slice(0, 20);

console.log(JSON.stringify(ranked, null, 2));
