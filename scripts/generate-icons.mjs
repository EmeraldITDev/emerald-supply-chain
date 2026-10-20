/**
 * Emerald SCM icon generator
 *
 * Rules:
 * - Masters live in design/icons/ and are never edited.
 * - EMERALD_Scm_DARK_png.png = teal glyph for LIGHT backgrounds / light browser tabs.
 * - EMERALD_Scm_LIGHT_png.png = white glyph for DARK backgrounds / dark browser tabs / app icons.
 * - Brand fill / theme_color is sampled from the DARK glyph (#0E5070).
 * - Favicons: transparent canvas, ~6% padding, no upscaling blur (masters are 512).
 * - apple-touch-icon: opaque brand square, no transparency, no baked rounded corners.
 * - PWA "any": brand fill, white glyph ~70% of canvas, corners stay opaque.
 * - PWA "maskable": brand fill, white glyph inside the central 60% safe zone.
 * - In-app brand copies: 256×256 transparent glyphs in public/brand/.
 *
 * Run: npm run icons
 */

import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const toIco = require("to-ico");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

/** Sampled from EMERALD_Scm_DARK_png.png opaque glyph pixels (dominant RGB 14,80,112). */
const BRAND_HEX = "#0E5070";
const BRAND_RGB = { r: 0x0e, g: 0x50, b: 0x70 };

const MASTER_DARK = path.join(root, "design/icons/EMERALD_Scm_DARK_png.png");
const MASTER_LIGHT = path.join(root, "design/icons/EMERALD_Scm_LIGHT_png.png");
const OUT_ICONS = path.join(root, "public/icons");
const OUT_BRAND = path.join(root, "public/brand");
const OUT_FAVICON_ICO = path.join(root, "public/favicon.ico");

const FAVICON_PAD = 0.06;

async function ensureDirs() {
  await mkdir(OUT_ICONS, { recursive: true });
  await mkdir(OUT_BRAND, { recursive: true });
}

/** Resize glyph to fit inside `inner` px, centered on a transparent `size` canvas. */
async function glyphOnTransparent(masterPath, size, padRatio) {
  const inner = Math.max(1, Math.round(size * (1 - 2 * padRatio)));
  const glyph = await sharp(masterPath)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: glyph, gravity: "centre" }])
    .png()
    .toBuffer();
}

/**
 * White glyph centred at `scale` of canvas on solid brand background.
 * Corners stay opaque brand fill (never transparent) so OS masks / iOS
 * rounding never flash black.
 */
async function glyphOnBrand(size, scale) {
  const glyphSize = Math.max(1, Math.round(size * scale));
  const glyph = await sharp(MASTER_LIGHT)
    .resize(glyphSize, glyphSize, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { ...BRAND_RGB, alpha: 1 },
    },
  })
    .composite([{ input: glyph, gravity: "centre" }])
    .png()
    .toBuffer();
}

async function writePng(filePath, buffer) {
  await writeFile(filePath, buffer);
  console.log("wrote", path.relative(root, filePath));
}

async function main() {
  await ensureDirs();

  // Browser favicons (transparent)
  for (const size of [16, 32, 48]) {
    await writePng(
      path.join(OUT_ICONS, `favicon-${size}.png`),
      await glyphOnTransparent(MASTER_DARK, size, FAVICON_PAD),
    );
    await writePng(
      path.join(OUT_ICONS, `favicon-dark-${size}.png`),
      await glyphOnTransparent(MASTER_LIGHT, size, FAVICON_PAD),
    );
  }

  const icoBuf = await toIco([
    await readFile(path.join(OUT_ICONS, "favicon-16.png")),
    await readFile(path.join(OUT_ICONS, "favicon-32.png")),
    await readFile(path.join(OUT_ICONS, "favicon-48.png")),
  ]);
  await writeFile(OUT_FAVICON_ICO, icoBuf);
  console.log("wrote", path.relative(root, OUT_FAVICON_ICO));

  // App / PWA icons (brand fill + white glyph)
  await writePng(
    path.join(OUT_ICONS, "apple-touch-icon.png"),
    await glyphOnBrand(180, 0.78),
  );
  await writePng(
    path.join(OUT_ICONS, "pwa-192x192.png"),
    await glyphOnBrand(192, 0.7),
  );
  await writePng(
    path.join(OUT_ICONS, "pwa-512x512.png"),
    await glyphOnBrand(512, 0.7),
  );
  // Maskable: glyph inside central 60% safe zone
  await writePng(
    path.join(OUT_ICONS, "pwa-maskable-192x192.png"),
    await glyphOnBrand(192, 0.6),
  );
  await writePng(
    path.join(OUT_ICONS, "pwa-maskable-512x512.png"),
    await glyphOnBrand(512, 0.6),
  );

  // In-app logos (256×256 transparent)
  await writePng(
    path.join(OUT_BRAND, "EMERALD_Scm_DARK_png.png"),
    await sharp(MASTER_DARK)
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer(),
  );
  await writePng(
    path.join(OUT_BRAND, "EMERALD_Scm_LIGHT_png.png"),
    await sharp(MASTER_LIGHT)
      .resize(256, 256, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png()
      .toBuffer(),
  );

  // Remove legacy root icon files if present
  const legacy = [
    "public/favicon.png",
    "public/apple-touch-icon.png",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/icon.svg",
  ];
  for (const rel of legacy) {
    try {
      await rm(path.join(root, rel));
      console.log("removed", rel);
    } catch {
      /* already gone */
    }
  }

  console.log(`Done. Brand colour ${BRAND_HEX}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
