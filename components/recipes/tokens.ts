// RECIPES DESIGN TOKENS: the Sage & Butter look (docs/recipes/plan.md), in the shape of app/tokens.ts so it can
// grow into per-section themes. Nothing in components/recipes should hardcode a color, font or radius.

export const color = {
  page: "#f6f2e4",
  surface: "#fffdf6",
  ink: "#2f3a30",
  muted: "#687266",
  accent: "#5c7c59",
  accentDeep: "#4a6648",
  onAccent: "#ffffff",
  second: "#a27a12",
  highlight: "#fcefc0",
  star: "#e0a821",
  rule: "#e3e3cf",
  panelRule: "#e4e4d0",
} as const;

export const font = {
  display: "var(--rk-lora), Georgia, serif",
  body: "var(--rk-nunito), system-ui, sans-serif",
} as const;

export const radius = { base: 12 } as const;

export const shadow = { panel: "0 8px 22px rgba(70,75,40,.08)" } as const;

const SAGE = "92,124,89";
const BUTTER = "232,181,42";

/** Sage gingham, standing in for a photo until recipes have them. */
export const gingham = (size = 9) =>
  `repeating-linear-gradient(0deg, rgba(${SAGE},.5) 0 ${size}px, transparent ${size}px ${size * 2}px), repeating-linear-gradient(90deg, rgba(${SAGE},.5) 0 ${size}px, transparent ${size}px ${size * 2}px), ${color.surface}`;

/** The sage and butter plaid band across the top of the section. */
export const plaidBand = (size = 7) =>
  `repeating-linear-gradient(0deg, rgba(${SAGE},.42) 0 ${size}px, transparent ${size}px ${size * 2}px), repeating-linear-gradient(90deg, rgba(${BUTTER},.5) 0 ${size}px, transparent ${size}px ${size * 2}px), ${color.surface}`;
