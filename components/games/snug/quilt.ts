// Yarn colors for the pieces and the date-seeded patchwork quilt drawn behind the page.

import { makeRng, type Rng } from "../daily";
import { roundedRectLoop, stitchLoops } from "./stitches";

export interface Yarn {
  name: string;
  base: string;
  light: string;
  dark: string;
}

function mix(hex: string, target: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (target - c) * amount));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const yarn = (name: string, base: string): Yarn => ({ name, base, light: mix(base, 255, 0.35), dark: mix(base, 0, 0.38) });

export const YARNS: Yarn[] = [
  yarn("tomato", "#d9574f"),
  yarn("tangerine", "#ec8a3a"),
  yarn("mustard", "#e2b03e"),
  yarn("moss", "#7ea54e"),
  yarn("teal", "#2e8f83"),
  yarn("sky", "#58a6d4"),
  yarn("denim", "#40609e"),
  yarn("lavender", "#9a7fc6"),
  yarn("berry", "#b04f86"),
  yarn("blush", "#e9939f"),
  yarn("cocoa", "#8a5a3c"),
];

export const THREAD = "#fff6e6";
export const LINEN = "#f4ead6";
export const BINDING = "#7b3b2e";

export const FABRICS = ["#c98a7e", "#d9a84e", "#8fa77d", "#5b7a99", "#e8dcc2", "#b5653f", "#4f8a86", "#7f5d7c", "#e6cf8f", "#9c4d3e", "#a8b8c8"];
const PATCH = 120;
const GRID = 6;

type Draw = (rng: Rng, a: string, b: string) => string;

export const FABRIC_STYLES = ["Polka dots", "Gingham", "Stripes", "Half-square triangles", "Nine-patch", "Florals", "Plaid"];

const patchStyles: Draw[] = [
  // Polka dots.
  (rng, a, b) => {
    let s = `<rect width="${PATCH}" height="${PATCH}" fill="${a}"/>`;
    const r = 3 + rng.int(3);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) s += `<circle cx="${x * 22 + (y % 2) * 11 + 5}" cy="${y * 22 + 10}" r="${r}" fill="${b}"/>`;
    return s;
  },
  // Gingham.
  (_rng, a, b) => {
    let s = `<rect width="${PATCH}" height="${PATCH}" fill="${b}"/>`;
    for (let i = 0; i < 6; i++) {
      s += `<rect x="${i * 22}" width="11" height="${PATCH}" fill="${a}" opacity=".55"/>`;
      s += `<rect y="${i * 22}" width="${PATCH}" height="11" fill="${a}" opacity=".55"/>`;
    }
    return s;
  },
  // Diagonal stripes.
  (_rng, a, b) => {
    let s = `<rect width="${PATCH}" height="${PATCH}" fill="${a}"/>`;
    for (let i = -PATCH; i < PATCH * 2; i += 18) s += `<line x1="${i}" y1="0" x2="${i + PATCH}" y2="${PATCH}" stroke="${b}" stroke-width="6"/>`;
    return s;
  },
  // Half-square triangles.
  (rng, a, b) => {
    const flip = rng.next() < 0.5;
    return `<rect width="${PATCH}" height="${PATCH}" fill="${a}"/><path d="${flip ? `M0 0H${PATCH}V${PATCH}Z` : `M0 0V${PATCH}H${PATCH}Z`}" fill="${b}"/>`;
  },
  // Nine-patch.
  (_rng, a, b) => {
    let s = "";
    const t = PATCH / 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) s += `<rect x="${x * t}" y="${y * t}" width="${t}" height="${t}" fill="${(x + y) % 2 ? b : a}"/>`;
    return s;
  },
  // Tiny florals.
  (rng, a, b) => {
    let s = `<rect width="${PATCH}" height="${PATCH}" fill="${a}"/>`;
    for (let i = 0; i < 7; i++) {
      const cx = 12 + rng.int(PATCH - 24);
      const cy = 12 + rng.int(PATCH - 24);
      for (let p = 0; p < 5; p++) {
        const ang = (p / 5) * Math.PI * 2;
        s += `<circle cx="${(cx + Math.cos(ang) * 5).toFixed(1)}" cy="${(cy + Math.sin(ang) * 5).toFixed(1)}" r="3.6" fill="${b}"/>`;
      }
      s += `<circle cx="${cx}" cy="${cy}" r="2.4" fill="${THREAD}"/>`;
    }
    return s;
  },
  // Plaid.
  (_rng, a, b) => {
    let s = `<rect width="${PATCH}" height="${PATCH}" fill="${a}"/>`;
    for (const [pos, w] of [[14, 16], [54, 6], [78, 16], [104, 4]] as const) {
      s += `<rect x="${pos}" width="${w}" height="${PATCH}" fill="${b}" opacity=".5"/>`;
      s += `<rect y="${pos}" width="${PATCH}" height="${w}" fill="${b}" opacity=".5"/>`;
    }
    return s;
  },
];

const PUFF_DEFS =
  `<defs><radialGradient id="puff" cx=".45" cy=".4" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".16"/>` +
  `<stop offset=".65" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs>`;

function patchSvg(rng: Rng, style: number, a: string, b: string): string {
  return (
    patchStyles[style]!(rng, a, b) +
    `<rect width="${PATCH}" height="${PATCH}" fill="url(#puff)"/>` +
    patchStitches(`${style}:${a}:${b}`) +
    `<rect x=".5" y=".5" width="${PATCH - 1}" height="${PATCH - 1}" fill="none" stroke="#3a2418" stroke-opacity=".35" stroke-width="1.5"/>`
  );
}

/** A hand-sewn running stitch around the inside of a patch. */
function patchStitches(seed: string): string {
  const s = stitchLoops([roundedRectLoop(PATCH, PATCH, 7, 3)], makeRng(`quilt-stitch:${seed}`), { stitch: 6.5, gap: 4.5, wobble: 0.5, hole: 0.7 });
  return (
    `<path d="${s.holes}" fill="rgba(50,25,15,.35)"/>` +
    `<path d="${s.thread}" fill="none" stroke="rgba(40,20,10,.35)" stroke-width="2.4" stroke-linecap="round" transform="translate(.4 .6)"/>` +
    `<path d="${s.thread}" fill="none" stroke="${THREAD}" stroke-opacity=".85" stroke-width="1.8" stroke-linecap="round"/>`
  );
}

const toDataUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** One quilt patch on its own, for the art sheet. */
export function fabricSwatch(style: number, a: string, b: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PATCH}" height="${PATCH}">${PUFF_DEFS}${patchSvg(makeRng(`swatch:${style}`), style, a, b)}</svg>`;
  return toDataUrl(svg);
}

/** A tileable patchwork quilt as an SVG data URL; the patches change with the date. */
export function quiltBackground(dateKey: string): string {
  const rng = makeRng(`snug-quilt:${dateKey}`);
  const size = PATCH * GRID;
  let body = "";
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const a = rng.pick(FABRICS);
      let b = rng.pick(FABRICS);
      while (b === a) b = rng.pick(FABRICS);
      body += `<svg x="${x * PATCH}" y="${y * PATCH}" width="${PATCH}" height="${PATCH}">${patchSvg(rng, rng.int(patchStyles.length), a, b)}</svg>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${PUFF_DEFS}${body}</svg>`;
  return toDataUrl(svg);
}
