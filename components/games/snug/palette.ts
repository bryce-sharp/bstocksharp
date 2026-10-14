// Snug's colors with no React in sight, so server routes (icons, the app setting) can use them too.

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
  yarn("coral", "#ec7b67"),
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
