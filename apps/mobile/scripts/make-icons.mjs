#!/usr/bin/env node
// Placeholder app icons, one set per seasonal theme (`APP_ICONS` in packages/shared/src/themes.ts):
//   assets/icons/icon-<theme>.png             1024² opaque: theme accent + white capsule (iOS / primary)
//   assets/icons/icon-<theme>-foreground.png  1024² transparent capsule inside the adaptive safe zone
//   assets/icons/icon-<theme>-background.png  1024² solid accent (Android adaptive background)
//   assets/icons/icon-monochrome.png          1024² white capsule (Android 13 themed icon)
//   assets/widget-preview/next-dose-2x2.png   Android widget picker preview
// Accents are read from the shared theme sources (light scheme), so a token change is one re-run
// away: `pnpm --filter mobile icons`. PNGs are encoded with sharp when it resolves from the
// workspace, otherwise with the tiny zlib encoder below. Replace with designed art before release.
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const sharedSrc = join(appRoot, '..', '..', 'packages', 'shared', 'src');
const iconsDir = join(appRoot, 'assets', 'icons');
const previewDir = join(appRoot, 'assets', 'widget-preview');
const SIZE = 1024;

// ---------------------------------------------------------------------------
// Theme accents from packages/shared (plain-text parse: the sources are TypeScript)

function readThemes() {
  const themesTs = readFileSync(join(sharedSrc, 'themes.ts'), 'utf8');
  const tokensTs = readFileSync(join(sharedSrc, 'tokens.ts'), 'utf8');
  const idsBlock = themesTs.match(/THEME_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!idsBlock) throw new Error('THEME_IDS not found in themes.ts');
  const ids = [...idsBlock[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const lightTokens = tokensTs.match(/light:\s*\{([\s\S]*?)\n\s{2}\},/);
  const baseAccent = lightTokens?.[1].match(/\baccent:\s*"(#[0-9A-Fa-f]{6})"/)?.[1];
  if (!baseAccent) throw new Error('base light accent not found in tokens.ts');
  const themesBody = themesTs.slice(themesTs.indexOf('export const THEMES'));
  return ids.map((id) => {
    const keyRe = new RegExp(`\\n\\s{2}(?:"${id}"|${id.replace(/-/g, '\\-')}):\\s*\\{`);
    const at = themesBody.search(keyRe);
    let accent = baseAccent;
    if (at >= 0) {
      const block = themesBody.slice(at, at + 2000);
      const light = block.match(/light:\s*\{([^}]*)\}/);
      const found = light?.[1].match(/\baccent:\s*"(#[0-9A-Fa-f]{6})"/)?.[1];
      if (found) accent = found;
    }
    return { id, key: `icon-${id}`, accent };
  });
}

// ---------------------------------------------------------------------------
// Rasteriser: RGBA buffer + anti-aliased capsule via a signed distance field

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function canvas(w, h, fill = [0, 0, 0, 0]) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) px.set(fill, i * 4);
  return { w, h, px };
}

function blend(c, x, y, rgb, alpha) {
  if (alpha <= 0) return;
  const i = (y * c.w + x) * 4;
  const a0 = c.px[i + 3] / 255;
  const a = alpha + a0 * (1 - alpha);
  for (let k = 0; k < 3; k++) {
    c.px[i + k] = a > 0 ? Math.round((rgb[k] * alpha + c.px[i + k] * a0 * (1 - alpha)) / a) : 0;
  }
  c.px[i + 3] = Math.round(a * 255);
}

/** Diagonal capsule centred at (cx, cy): total length `len`, radius `r`, two-tone halves. */
function drawCapsule(c, { cx, cy, len, r, light, dark, divider }) {
  const half = len / 2 - r;
  const ux = Math.SQRT1_2;
  const uy = -Math.SQRT1_2; // bottom-left → top-right
  const ax = cx - ux * half;
  const ay = cy - uy * half;
  const minX = Math.max(0, Math.floor(cx - len / 2 - 2));
  const maxX = Math.min(c.w - 1, Math.ceil(cx + len / 2 + 2));
  const minY = Math.max(0, Math.floor(cy - len / 2 - 2));
  const maxY = Math.min(c.h - 1, Math.ceil(cy + len / 2 + 2));
  const dividerHalf = divider / 2;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - ax;
      const py = y + 0.5 - ay;
      const t = Math.max(0, Math.min(2 * half, px * ux + py * uy));
      const dx = px - ux * t;
      const dy = py - uy * t;
      const d = Math.hypot(dx, dy) - r;
      const coverage = Math.max(0, Math.min(1, 0.5 - d));
      if (coverage <= 0) continue;
      const along = px * ux + py * uy - half; // signed distance from the capsule centre along its axis
      const lineCov = Math.max(0, Math.min(1, dividerHalf + 0.5 - Math.abs(along)));
      const base = along < 0 ? light : dark;
      blend(c, x, y, base, coverage);
      if (lineCov > 0 && divider > 0) blend(c, x, y, mix(dark, [0, 0, 0], 0.18), coverage * lineCov);
    }
  }
}

function roundedRect(c, { x0, y0, x1, y1, radius, rgb }) {
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
      const qx = Math.max(x0 + radius - (x + 0.5), 0, x + 0.5 - (x1 - radius));
      const qy = Math.max(y0 + radius - (y + 0.5), 0, y + 0.5 - (y1 - radius));
      const d = Math.hypot(qx, qy) - radius;
      blend(c, x, y, rgb, Math.max(0, Math.min(1, 0.5 - d)));
    }
  }
}

function ring(c, { cx, cy, r, width, rgb, from = 0, to = 1 }) {
  for (let y = Math.floor(cy - r - width); y <= cy + r + width; y++) {
    for (let x = Math.floor(cx - r - width); x <= cx + r + width; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.abs(Math.hypot(dx, dy) - r) - width / 2;
      const angle = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1; // 0 at 12 o'clock, clockwise
      if (angle < from || angle > to) continue;
      blend(c, x, y, rgb, Math.max(0, Math.min(1, 0.5 - d)));
    }
  }
}

// ---------------------------------------------------------------------------
// PNG encoding

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePngFallback({ w, h, px }, opaque) {
  const channels = opaque ? 3 : 4;
  const raw = Buffer.alloc((w * channels + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * channels + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = row + 1 + x * channels;
      raw[d] = px[s];
      raw[d + 1] = px[s + 1];
      raw[d + 2] = px[s + 2];
      if (!opaque) raw[d + 3] = px[s + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // RGB / RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function loadSharp() {
  try {
    const require = createRequire(join(appRoot, 'package.json'));
    return require('sharp');
  } catch {
    return null;
  }
}

const sharp = loadSharp();

async function writePng(path, c, { opaque = false } = {}) {
  mkdirSync(dirname(path), { recursive: true });
  if (sharp) {
    let img = sharp(c.px, { raw: { width: c.w, height: c.h, channels: 4 } });
    if (opaque) img = img.removeAlpha();
    await img.png({ compressionLevel: 9 }).toFile(path);
  } else {
    writeFileSync(path, encodePngFallback(c, opaque));
  }
}

// ---------------------------------------------------------------------------

const WHITE = [255, 255, 255];

async function main() {
  const themes = readThemes();
  for (const t of themes) {
    const accent = hexToRgb(t.accent);
    const capsuleColors = { light: WHITE, dark: mix(WHITE, accent, 0.18) };

    const full = canvas(SIZE, SIZE, [...accent, 255]);
    drawCapsule(full, { cx: SIZE / 2, cy: SIZE / 2, len: SIZE * 0.66, r: SIZE * 0.135, divider: SIZE * 0.014, ...capsuleColors });
    await writePng(join(iconsDir, `${t.key}.png`), full, { opaque: true });

    // Adaptive icons show the central 66/108 of the canvas: keep the capsule well inside it.
    const fg = canvas(SIZE, SIZE);
    drawCapsule(fg, { cx: SIZE / 2, cy: SIZE / 2, len: SIZE * 0.44, r: SIZE * 0.09, divider: SIZE * 0.01, ...capsuleColors });
    await writePng(join(iconsDir, `${t.key}-foreground.png`), fg);

    await writePng(join(iconsDir, `${t.key}-background.png`), canvas(SIZE, SIZE, [...accent, 255]), { opaque: true });
    console.log(`${t.key.padEnd(26)} ${t.accent}`);
  }

  const mono = canvas(SIZE, SIZE);
  drawCapsule(mono, { cx: SIZE / 2, cy: SIZE / 2, len: SIZE * 0.44, r: SIZE * 0.09, divider: 0, light: WHITE, dark: WHITE });
  await writePng(join(iconsDir, 'icon-monochrome.png'), mono);

  // Widget picker preview (2×2): card, ring, capsule.
  const base = themes.find((t) => t.id === 'default') ?? themes[0];
  const accent = hexToRgb(base.accent);
  const P = 440;
  const preview = canvas(P, P);
  roundedRect(preview, { x0: 0, y0: 0, x1: P, y1: P, radius: 48, rgb: WHITE });
  ring(preview, { cx: P - 86, cy: 86, r: 46, width: 14, rgb: hexToRgb('#EBF0F1') });
  ring(preview, { cx: P - 86, cy: 86, r: 46, width: 14, rgb: accent, from: 0, to: 0.62 });
  drawCapsule(preview, { cx: 96, cy: 300, len: 120, r: 24, divider: 3, light: accent, dark: mix(accent, WHITE, 0.35) });
  roundedRect(preview, { x0: 170, y0: 270, x1: 400, y1: 300, radius: 15, rgb: hexToRgb('#1C2430') });
  roundedRect(preview, { x0: 170, y0: 318, x1: 320, y1: 340, radius: 11, rgb: hexToRgb('#0B6E67') });
  await writePng(join(previewDir, 'next-dose-2x2.png'), preview);

  console.log(`\n${themes.length} icon sets written to assets/icons (${sharp ? 'sharp' : 'built-in PNG encoder'}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
