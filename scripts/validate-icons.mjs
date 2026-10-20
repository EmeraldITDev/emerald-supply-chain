/**
 * Validate built PWA manifest icon entries against real PNG dimensions.
 * Usage: node scripts/validate-icons.mjs [distDir]
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.resolve(root, process.argv[2] || "dist");

const manifestPath = path.join(distDir, "manifest.webmanifest");
const raw = await readFile(manifestPath, "utf8");
const manifest = JSON.parse(raw);

const rows = [];
let ok = true;

for (const icon of manifest.icons || []) {
  const srcPath = icon.src.replace(/^\//, "").split("?")[0];
  const filePath = path.join(distDir, srcPath);
  let actual = "MISSING";
  let match = false;
  try {
    const meta = await sharp(filePath).metadata();
    actual = `${meta.width}x${meta.height}`;
    const declared = String(icon.sizes || "");
    match = declared.split(/\s+/).some((s) => s === actual);
    if (!match) ok = false;
  } catch {
    ok = false;
  }
  rows.push({
    src: icon.src,
    purpose: icon.purpose,
    declared: icon.sizes,
    actual,
    match: match ? "yes" : "NO",
  });
}

console.log(`Manifest: ${manifestPath}`);
console.log(`name=${manifest.name} short_name=${manifest.short_name}`);
console.log(
  `theme_color=${manifest.theme_color} background_color=${manifest.background_color}`,
);
console.log("");
console.log(
  "src".padEnd(40),
  "purpose".padEnd(12),
  "declared".padEnd(12),
  "actual".padEnd(12),
  "match",
);
console.log("-".repeat(90));
for (const r of rows) {
  console.log(
    r.src.padEnd(40),
    String(r.purpose).padEnd(12),
    String(r.declared).padEnd(12),
    String(r.actual).padEnd(12),
    r.match,
  );
}

const requiredFiles = [
  "favicon.ico",
  "icons/favicon-16.png",
  "icons/favicon-32.png",
  "icons/favicon-48.png",
  "icons/favicon-dark-16.png",
  "icons/favicon-dark-32.png",
  "icons/favicon-dark-48.png",
  "icons/apple-touch-icon.png",
  "icons/pwa-192x192.png",
  "icons/pwa-512x512.png",
  "icons/pwa-maskable-192x192.png",
  "icons/pwa-maskable-512x512.png",
  "brand/EMERALD_Scm_DARK_png.png",
  "brand/EMERALD_Scm_LIGHT_png.png",
];

console.log("\nReferenced assets in dist:");
for (const rel of requiredFiles) {
  try {
    await readFile(path.join(distDir, rel));
    console.log("  OK ", rel);
  } catch {
    ok = false;
    console.log("  MISSING", rel);
  }
}

// purpose must not combine any+maskable
for (const icon of manifest.icons || []) {
  const purposes = String(icon.purpose || "any").split(/\s+/);
  if (purposes.includes("any") && purposes.includes("maskable")) {
    ok = false;
    console.log("FAIL: combined purpose on", icon.src);
  }
}

if (!ok) {
  console.error("\nValidation FAILED");
  process.exit(1);
}
console.log("\nValidation OK");
