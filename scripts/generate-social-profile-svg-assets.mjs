import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const outputDir = join(process.cwd(), "public", "social-profile-kit", "svg");
const logoSource = join(process.cwd(), "public", "opportunity-scanner-logo.svg");
const colors = {
  navy: "#14213D",
  teal: "#0E7C86",
  green: "#2E9D70",
  amber: "#C7861D",
  coral: "#D95D39",
  paper: "#FBFAF7",
  mint: "#D7EFEC",
  line: "#D9DEE7",
  pale: "#E9F4F3"
};

function svgShell(width, height, body, options = {}) {
  const background = options.transparent
    ? ""
    : `<rect width="${width}" height="${height}" fill="${colors.navy}"/>`;
  const grid = options.grid === false
    ? ""
    : `<defs><pattern id="grid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" stroke="${colors.pale}" stroke-width="1" opacity="0.16"/></pattern></defs><rect width="${width}" height="${height}" fill="url(#grid)"/>`;
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">${background}${grid}${body}</svg>`;
}

function icon(x, y, size) {
  const scale = size / 512;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <rect width="512" height="512" rx="96" fill="${colors.navy}" stroke="${colors.paper}" stroke-width="22"/>
    <circle cx="150" cy="150" r="34" fill="${colors.green}"/>
    <circle cx="362" cy="150" r="34" fill="${colors.amber}"/>
    <circle cx="150" cy="362" r="34" fill="${colors.coral}"/>
    <circle cx="362" cy="362" r="34" fill="${colors.teal}"/>
    <path d="M150 150H362M150 150L362 362M150 362H362M362 150L150 362" stroke="${colors.pale}" stroke-width="18" stroke-linecap="round" opacity="0.42"/>
    <text x="256" y="285" text-anchor="middle" font-family="Arial, sans-serif" font-size="116" font-weight="800" fill="#FFFFFF">OS</text>
  </g>`;
}

function actionTable(x, y, width, height) {
  const inner = width - 48;
  return `<g transform="translate(${x} ${y})">
    <rect width="${width}" height="${height}" rx="18" fill="${colors.paper}"/>
    <rect x="24" y="26" width="${inner}" height="42" rx="8" fill="${colors.pale}"/>
    <rect x="24" y="84" width="${inner}" height="1" fill="${colors.line}"/>
    <rect x="24" y="108" width="${Math.round(inner * 0.24)}" height="42" rx="7" fill="${colors.pale}"/>
    <rect x="${Math.round(width * 0.31)}" y="108" width="${Math.round(inner * 0.29)}" height="42" rx="7" fill="${colors.pale}"/>
    <rect x="${Math.round(width * 0.65)}" y="108" width="${Math.round(inner * 0.29)}" height="42" rx="7" fill="${colors.pale}"/>
    <rect x="24" y="170" width="${Math.round(inner * 0.5)}" height="18" rx="9" fill="${colors.teal}"/>
    <rect x="${Math.round(width * 0.58)}" y="170" width="${Math.round(inner * 0.31)}" height="18" rx="9" fill="${colors.green}"/>
  </g>`;
}

function valueChips(x, y, fontSize = 18) {
  return `<g transform="translate(${x} ${y})" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#FFFFFF">
    <rect width="174" height="44" rx="7" fill="${colors.teal}"/><text x="87" y="29" text-anchor="middle">SOURCED SIGNALS</text>
    <rect x="190" width="162" height="44" rx="7" fill="${colors.green}"/><text x="271" y="29" text-anchor="middle">BUYER TARGETS</text>
    <rect x="368" width="150" height="44" rx="7" fill="${colors.amber}"/><text x="443" y="29" text-anchor="middle">NEXT ACTIONS</text>
  </g>`;
}

function banner({ width, height, iconX, iconY, iconSize, textX, titleY, titleSize, subtitleY, subtitleSize, tableX, tableY, tableWidth, tableHeight, chipsX, chipsY }) {
  return svgShell(width, height, `${icon(iconX, iconY, iconSize)}
    <text x="${textX}" y="${titleY}" font-family="Arial, sans-serif" font-size="${titleSize}" font-weight="800" fill="#FFFFFF">Opportunity Scanner</text>
    <text x="${textX}" y="${subtitleY}" font-family="Arial, sans-serif" font-size="${subtitleSize}" font-weight="650" fill="${colors.mint}">Public-sector revenue intelligence from your company website.</text>
    ${tableWidth ? actionTable(tableX, tableY, tableWidth, tableHeight) : ""}
    ${chipsX === undefined ? "" : valueChips(chipsX, chipsY, 16)}`);
}

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, "opportunity-scanner-avatar.svg"), await readFile(logoSource, "utf8"));

const assets = {
  "linkedin-company-cover.svg": banner({
    width: 4200, height: 700, iconX: 220, iconY: 150, iconSize: 400,
    textX: 760, titleY: 300, titleSize: 154, subtitleY: 405, subtitleSize: 54,
    tableX: 3180, tableY: 190, tableWidth: 700, tableHeight: 344
  }),
  "x-header.svg": banner({
    width: 1500, height: 500, iconX: 72, iconY: 80, iconSize: 112,
    textX: 72, titleY: 270, titleSize: 62, subtitleY: 327, subtitleSize: 22,
    tableX: 890, tableY: 146, tableWidth: 440, tableHeight: 216, chipsX: 72, chipsY: 390
  }),
  "facebook-cover.svg": banner({
    width: 1702, height: 630, iconX: 1280, iconY: 118, iconSize: 180,
    textX: 360, titleY: 255, titleSize: 78, subtitleY: 328, subtitleSize: 34,
    tableWidth: 0, tableX: 0, tableY: 0, tableHeight: 0, chipsX: 360, chipsY: 390
  }),
  "youtube-channel-banner.svg": svgShell(2560, 1440, `
    <rect x="662" y="551" width="1236" height="338" rx="24" fill="#14213D" stroke="#D7EFEC" stroke-width="2" opacity="0.96"/>
    ${icon(718, 620, 200)}
    <text x="970" y="704" font-family="Arial, sans-serif" font-size="72" font-weight="800" fill="#FFFFFF">Opportunity Scanner</text>
    <text x="970" y="772" font-family="Arial, sans-serif" font-size="32" font-weight="650" fill="${colors.mint}">Public-sector revenue intelligence from your company website.</text>
    ${valueChips(970, 810, 17)}
  `),
  "medium-publication-header.svg": svgShell(1500, 188, `
    ${icon(54, 34, 120)}
    <text x="210" y="88" font-family="Arial, sans-serif" font-size="52" font-weight="800" fill="#FFFFFF">Opportunity Scanner</text>
    <text x="210" y="132" font-family="Arial, sans-serif" font-size="23" font-weight="650" fill="${colors.mint}">Public-Sector Revenue Brief</text>
    <text x="1040" y="104" font-family="Arial, sans-serif" font-size="24" font-weight="650" fill="#FFFFFF">SOURCE → TARGET → ACTION</text>
  `),
  "substack-wordmark.svg": svgShell(1344, 256, `
    ${icon(36, 36, 184)}
    <text x="264" y="112" font-family="Arial, sans-serif" font-size="50" font-weight="800" fill="${colors.navy}">Public-Sector Revenue Brief</text>
    <text x="266" y="168" font-family="Arial, sans-serif" font-size="30" font-weight="650" fill="${colors.teal}">by Opportunity Scanner</text>
  `, { transparent: true, grid: false }),
  "substack-email-banner.svg": svgShell(1100, 220, `
    ${icon(28, 28, 164)}
    <text x="228" y="98" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="${colors.navy}">Public-Sector Revenue Brief</text>
    <text x="230" y="146" font-family="Arial, sans-serif" font-size="26" font-weight="650" fill="${colors.teal}">Source-backed opportunity intelligence for business operators</text>
  `, { transparent: true, grid: false }),
  "social-link-preview.svg": svgShell(1200, 630, `
    ${icon(72, 80, 112)}
    <text x="72" y="270" font-family="Arial, sans-serif" font-size="62" font-weight="800" fill="#FFFFFF">Opportunity Scanner</text>
    <text x="74" y="327" font-family="Arial, sans-serif" font-size="28" font-weight="650" fill="${colors.mint}">Public-sector revenue intelligence</text>
    <text x="74" y="366" font-family="Arial, sans-serif" font-size="28" font-weight="650" fill="${colors.mint}">from your company website.</text>
    ${actionTable(690, 115, 430, 364)}
    ${valueChips(72, 510, 18)}
  `)
};

for (const [filename, content] of Object.entries(assets)) {
  await writeFile(join(outputDir, filename), content);
}

console.log(`Generated ${Object.keys(assets).length + 1} SVG assets in ${outputDir}`);
