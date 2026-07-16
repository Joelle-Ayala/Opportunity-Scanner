import { readFile } from "node:fs/promises";

const assets = {
  "public/social-profile-kit/png/avatar-1024.png": [1024, 1024],
  "public/social-profile-kit/png/avatar-linkedin-x-400.png": [400, 400],
  "public/social-profile-kit/png/avatar-facebook-320.png": [320, 320],
  "public/social-profile-kit/png/avatar-substack-256.png": [256, 256],
  "public/social-profile-kit/png/avatar-youtube-800.png": [800, 800],
  "public/social-profile-kit/png/video-watermark-150.png": [150, 150],
  "public/social-profile-kit/png/linkedin-company-cover-4200x700.png": [4200, 700],
  "public/social-profile-kit/png/x-header-1500x500.png": [1500, 500],
  "public/social-profile-kit/png/facebook-cover-1702x630.png": [1702, 630],
  "public/social-profile-kit/png/facebook-cover-851x315.png": [851, 315],
  "public/social-profile-kit/png/youtube-channel-banner-2560x1440.png": [2560, 1440],
  "public/social-profile-kit/png/medium-publication-header-1500x188.png": [1500, 188],
  "public/social-profile-kit/png/substack-wordmark-1344x256.png": [1344, 256],
  "public/social-profile-kit/png/substack-email-banner-1100x220.png": [1100, 220],
  "public/social-profile-kit/png/social-link-preview-1200x630.png": [1200, 630]
};

const errors = [];
for (const [file, [expectedWidth, expectedHeight]] of Object.entries(assets)) {
  try {
    const data = await readFile(file);
    const signature = data.subarray(1, 4).toString("ascii");
    if (signature !== "PNG") {
      errors.push(`${file}: not a PNG`);
      continue;
    }
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    if (width !== expectedWidth || height !== expectedHeight) {
      errors.push(`${file}: expected ${expectedWidth}x${expectedHeight}, found ${width}x${height}`);
    }
  } catch (error) {
    errors.push(`${file}: ${error instanceof Error ? error.message : "missing"}`);
  }
}

const guide = await readFile("docs/social-profile-kit/profile-creation-kit.md", "utf8");
for (const platform of [
  "LinkedIn Company Page",
  "## X",
  "## YouTube",
  "## Instagram",
  "## Threads",
  "## TikTok",
  "## Facebook Page",
  "## Substack",
  "## Medium Publication"
]) {
  if (!guide.includes(platform)) errors.push(`Profile guide is missing ${platform}`);
}

const bios = {
  x: "Source-backed public-sector revenue intelligence. Find funding, procurement, funded buyers, partners, policy signals, and next actions.",
  instagram: "Public-sector revenue intelligence\nFunding • procurement • funded buyers\nSource → target → next action\nScan your website ↓",
  tiktok: "Public-sector revenue intelligence from your company website."
};
if (bios.x.length > 160) errors.push(`X bio exceeds 160 characters (${bios.x.length})`);
if (bios.instagram.length > 150) errors.push(`Instagram bio exceeds 150 characters (${bios.instagram.length})`);
if (bios.tiktok.length > 80) errors.push(`TikTok bio exceeds 80 characters (${bios.tiktok.length})`);

if (errors.length > 0) {
  console.error(`Social profile kit validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Social profile kit validation passed for ${Object.keys(assets).length} PNG assets.`);
console.log(`Bio lengths: X ${bios.x.length}/160, Instagram ${bios.instagram.length}/150, TikTok ${bios.tiktok.length}/80.`);
