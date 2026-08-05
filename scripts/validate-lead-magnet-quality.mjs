import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdtemp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  handleLeadMagnetAccessRequest,
  LEAD_MAGNET_CATALOG
} from "../lib/leadMagnets.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PDF_DIR = join(ROOT, "public", "lead-magnets");
const SOURCE_DIR = join(ROOT, "docs", "lead-magnets");
const EXPECTED_PDF_COUNT = 10;
const MIN_PAGES = 8;
const MAX_PAGES = 16;
const MIN_PDF_BYTES = 20_000;
const MIN_NON_WHITE_RATIO = 0.002;
const LETTER_WIDTH_POINTS = 612;
const LETTER_HEIGHT_POINTS = 792;
const INTERNAL_PRODUCT_SPEC_PATTERN = /Opportunity Scanner (?:should|must|can|will)|the (?:product|platform) should/i;
const UNSUPPORTED_PRODUCT_CLAIM_PATTERN = /native crm|syncs? (?:directly )?(?:with|to) (?:your )?crm|always-on monitoring|live monitoring|(?:Opportunity Scanner|we|the product|the platform) (?:automatically )?submits?\b/i;
const PRODUCT_PROOF_ASSETS = [
  "report-overview.png",
  "report-pipeline.png",
  "report-actions.png"
];

function commandOutput(command, args, env = process.env) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const detail = error?.stderr?.toString().trim() || error.message;
    throw new Error(`${command} failed: ${detail}`);
  }
}

async function findExecutable(command) {
  for (const directory of process.env.PATH?.split(delimiter) ?? []) {
    const candidate = join(directory, command);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {}
  }
  return null;
}

async function fontconfigEnvironment(cacheRoot, executable) {
  const candidates = [
    process.env.FONTCONFIG_FILE,
    executable && resolve(dirname(executable), "../../native/poppler/poppler/etc/fonts/fonts.conf"),
    "/etc/fonts/fonts.conf"
  ].filter(Boolean);
  let fontconfigFile;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      fontconfigFile = candidate;
      break;
    } catch {}
  }
  const xdgCache = join(cacheRoot, "cache");
  await mkdir(join(xdgCache, "fontconfig"), { recursive: true });
  return {
    ...process.env,
    HOME: cacheRoot,
    XDG_CACHE_HOME: xdgCache,
    ...(fontconfigFile ? { FONTCONFIG_FILE: fontconfigFile } : {})
  };
}

function parsePdfInfo(output, fileName) {
  const pages = Number(output.match(/^Pages:\s+(\d+)$/m)?.[1]);
  const size = output.match(/^Page size:\s+([\d.]+) x ([\d.]+) pts/m);
  assert.ok(Number.isInteger(pages), `${fileName}: pdfinfo did not report a page count`);
  assert.ok(size, `${fileName}: pdfinfo did not report a page size`);
  return { pages, width: Number(size[1]), height: Number(size[2]) };
}

function ppmPixels(buffer, fileName) {
  let cursor = 0;
  const tokens = [];

  while (tokens.length < 4) {
    while (cursor < buffer.length && /\s/.test(String.fromCharCode(buffer[cursor]))) cursor += 1;
    if (buffer[cursor] === 35) {
      while (cursor < buffer.length && buffer[cursor] !== 10) cursor += 1;
      continue;
    }
    const start = cursor;
    while (cursor < buffer.length && !/\s/.test(String.fromCharCode(buffer[cursor]))) cursor += 1;
    tokens.push(buffer.subarray(start, cursor).toString("ascii"));
  }

  assert.equal(tokens[0], "P6", `${fileName}: raster output is not binary PPM`);
  const width = Number(tokens[1]);
  const height = Number(tokens[2]);
  assert.equal(Number(tokens[3]), 255, `${fileName}: raster output has an unsupported color depth`);
  while (cursor < buffer.length && /\s/.test(String.fromCharCode(buffer[cursor]))) cursor += 1;
  const pixels = buffer.subarray(cursor);
  assert.equal(pixels.length, width * height * 3, `${fileName}: raster output is truncated`);
  return { width, height, pixels };
}

function nonWhiteRatio(pixels) {
  let nonWhite = 0;
  const pixelCount = pixels.length / 3;
  for (let index = 0; index < pixels.length; index += 3) {
    if (pixels[index] < 248 || pixels[index + 1] < 248 || pixels[index + 2] < 248) {
      nonWhite += 1;
    }
  }
  return nonWhite / pixelCount;
}

function captureRequest(slug) {
  return new Request("http://local.test/api/lead-magnets/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slug,
      name: "Lead Magnet QA",
      email: "lead-magnet-qa@example.com",
      company: "Opportunity Scanner QA",
      website: "https://example.com",
      source: "automated-quality-validation"
    })
  });
}

const checks = [];
function check(name, run) {
  checks.push({ name, run });
}

check("catalog has one flagship and one entry for each of nine industries", async () => {
  const entries = Object.entries(LEAD_MAGNET_CATALOG);
  assert.equal(entries.length, EXPECTED_PDF_COUNT);
  assert.equal(entries.filter(([, item]) => item.industrySlug === null).length, 1);
  const industrySlugs = entries.map(([, item]) => item.industrySlug).filter(Boolean);
  assert.equal(industrySlugs.length, 9);
  assert.equal(new Set(industrySlugs).size, 9);
});

check("catalog, public PDFs, and source documents have exact one-to-one coverage", async () => {
  const catalogFiles = Object.values(LEAD_MAGNET_CATALOG)
    .map((entry) => basename(entry.accessPath))
    .sort();
  assert.equal(new Set(catalogFiles).size, EXPECTED_PDF_COUNT);
  const publicFiles = (await readdir(PDF_DIR)).filter((file) => file.endsWith(".pdf")).sort();
  const sourceFiles = (await readdir(SOURCE_DIR))
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ".pdf"))
    .sort();
  assert.deepEqual(publicFiles, catalogFiles);
  assert.deepEqual(sourceFiles, catalogFiles);
});

check("public guide, resource, industry, and sitemap routes derive links from the catalog", async () => {
  const routeContracts = [
    ["app/guides/page.tsx", /leadMagnets\.map/],
    ["app/resources/page.tsx", /leadMagnets\.map/],
    ["app/guides/\[slug\]/page.tsx", /leadMagnets\.map/],
    ["app/industries/\[slug\]/page.tsx", /getLeadMagnetForIndustry/],
    ["app/sitemap.ts", /leadMagnets\.map/]
  ];
  for (const [relativePath, pattern] of routeContracts) {
    const source = await readFile(join(ROOT, relativePath.replaceAll("\\", "")), "utf8");
    assert.match(source, pattern, `${relativePath}: expected catalog-driven public link coverage`);
  }
});

check("all catalog paths are safe public PDF links", async () => {
  for (const [slug, entry] of Object.entries(LEAD_MAGNET_CATALOG)) {
    assert.equal(entry.accessPath, `/lead-magnets/${slug}.pdf`);
    assert.doesNotMatch(entry.accessPath, /\.\.|:|\/\//);
  }
});

check("lead magnet sources and generator use customer-facing product truth", async () => {
  const sourceFiles = (await readdir(SOURCE_DIR)).filter((file) => file.endsWith(".md"));
  for (const file of sourceFiles) {
    const source = await readFile(join(SOURCE_DIR, file), "utf8");
    assert.doesNotMatch(source, INTERNAL_PRODUCT_SPEC_PATTERN, `${file}: internal product-spec voice leaked into customer copy`);
    assert.doesNotMatch(source, UNSUPPORTED_PRODUCT_CLAIM_PATTERN, `${file}: unsupported product claim leaked into customer copy`);
  }

  const generator = await readFile(join(ROOT, "scripts", "generate-lead-magnet-pdfs.py"), "utf8");
  for (const asset of PRODUCT_PROOF_ASSETS) {
    assert.match(generator, new RegExp(asset.replace(".", "\\.")), `PDF generator does not reference ${asset}`);
  }
  assert.match(generator, /official source/i, "PDF generator must explain the official-source step");
  assert.match(generator, /start (?:a |the )?pursuit/i, "PDF generator must explain how to start a pursuit");
  assert.match(generator, /does not submit applications or bids/i, "PDF generator must state the submission boundary");
  assert.match(generator, /secure (?:workflow )?webhook/i, "PDF generator must describe the secure webhook accurately");
  assert.doesNotMatch(generator, UNSUPPORTED_PRODUCT_CLAIM_PATTERN, "PDF generator contains an unsupported product claim");
});

check("every PDF is structurally healthy and passes available page/raster validation", async () => {
  const pdfinfo = await findExecutable("pdfinfo");
  const pdftoppm = await findExecutable("pdftoppm");
  const renderDir = await mkdtemp(join(tmpdir(), "opportunity-scanner-lead-magnet-qa-"));
  try {
    const renderEnvironment = pdftoppm
      ? await fontconfigEnvironment(renderDir, pdftoppm)
      : process.env;
    for (const [slug, entry] of Object.entries(LEAD_MAGNET_CATALOG)) {
      const pdfPath = join(ROOT, "public", entry.accessPath);
      const fileStats = await stat(pdfPath);
      assert.ok(fileStats.size >= MIN_PDF_BYTES, `${slug}: PDF is unexpectedly small`);
      const pdfBytes = await readFile(pdfPath);
      assert.equal(pdfBytes.subarray(0, 5).toString("ascii"), "%PDF-", `${slug}: missing PDF header`);
      assert.match(pdfBytes.subarray(-1024).toString("latin1"), /%%EOF\s*$/, `${slug}: missing PDF end marker`);
      const imageObjects = pdfBytes.toString("latin1").match(/\/Subtype\s*\/Image/g) ?? [];
      assert.ok(imageObjects.length >= PRODUCT_PROOF_ASSETS.length, `${slug}: product-proof screenshots are missing`);

      if (!pdfinfo) continue;
      const info = parsePdfInfo(commandOutput(pdfinfo, [pdfPath]), basename(pdfPath));
      assert.ok(info.pages >= MIN_PAGES && info.pages <= MAX_PAGES, `${slug}: unexpected ${info.pages}-page PDF`);
      assert.equal(info.width, LETTER_WIDTH_POINTS, `${slug}: PDF width is not US Letter`);
      assert.equal(info.height, LETTER_HEIGHT_POINTS, `${slug}: PDF height is not US Letter`);

      if (!pdftoppm) continue;
      const outputPrefix = join(renderDir, slug);
      commandOutput(pdftoppm, ["-r", "36", pdfPath, outputPrefix], renderEnvironment);
      const renders = (await readdir(renderDir))
        .filter((file) => file.startsWith(`${slug}-`) && file.endsWith(".ppm"))
        .sort();
      assert.equal(renders.length, info.pages, `${slug}: not every PDF page rasterized`);
      for (const render of renders) {
        const { width, height, pixels } = ppmPixels(await readFile(join(renderDir, render)), render);
        assert.ok(width > 250 && height > 300, `${render}: raster dimensions are unexpectedly small`);
        const ratio = nonWhiteRatio(pixels);
        assert.ok(ratio >= MIN_NON_WHITE_RATIO, `${render}: page appears blank (${ratio.toFixed(4)} non-white)`);
      }
    }
    if (!pdfinfo) console.log("SKIP pdfinfo page-count and dimensions check (tool not installed)");
    if (!pdftoppm) console.log("SKIP pdftoppm raster/nonblank check (tool not installed)");
  } finally {
    await rm(renderDir, { recursive: true, force: true });
  }
});

check("capture contract returns only the allowlisted PDF path for every lead magnet", async () => {
  for (const [slug, entry] of Object.entries(LEAD_MAGNET_CATALOG)) {
    const saved = [];
    const response = await handleLeadMagnetAccessRequest(captureRequest(slug), {
      async saveCapture(input) {
        saved.push(input);
        return { id: `qa-${slug}` };
      }
    });
    assert.equal(response.status, 201, `${slug}: capture request failed`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      ok: true,
      leadMagnet: { slug },
      accessPath: entry.accessPath
    });
    assert.equal(saved.length, 1, `${slug}: capture was not persisted exactly once`);
    assert.equal(saved[0].leadMagnetSlug, slug);
  }
});

let passed = 0;
for (const { name, run } of checks) {
  await run();
  passed += 1;
  console.log(`PASS ${name}`);
}

console.log(`\nLead magnet file and visual quality validation passed: ${passed}/${checks.length} checks.`);
