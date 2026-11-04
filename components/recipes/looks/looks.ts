// The look directions for the Recipes section: each is a full set of tokens the lab's screens draw with.

import type { CSSProperties } from "react";

export type Look = {
  id: string;
  name: string;
  /** What the section could be called in this look. */
  appName: string;
  feel: string;
  fonts: { display: string; body: string; detail: string; names: string };
  color: {
    page: string;
    surface: string;
    ink: string;
    muted: string;
    accent: string;
    onAccent: string;
    /** The accent for text, when the accent itself is too light to read on the surface. */
    accentText?: string;
    second: string;
    rule: string;
    highlight: string;
    star: string;
  };
  radius: number;
  /** The page's background, texture included. */
  pageBackground: string;
  /** Extra style on cards and panels. */
  panel: CSSProperties;
  /** The picture area on a card, since recipes have no photos yet. */
  picture: (hue: string) => string;
  /** Heading treatment. */
  heading: CSSProperties;
  /** Ingredient lines' font: some looks set them like a typed card. */
  lineFont: string;
  /** A decorative strip across the header and the top of cook mode. */
  band?: string;
  /** A strip of tape across the top of each card. */
  tape?: string;
  /** A strip across the top edge of each card. */
  cardTop?: string;
  /** Buttons with a solid offset shadow, like a sticker. */
  chunky?: string;
  dark?: boolean;
};

/** Gingham: two crossing see-through stripes, darker where they overlap. */
const gingham = (rgb: string, size: number, base = "#ffffff") =>
  `repeating-linear-gradient(0deg, rgba(${rgb},.5) 0 ${size}px, transparent ${size}px ${size * 2}px), repeating-linear-gradient(90deg, rgba(${rgb},.5) 0 ${size}px, transparent ${size}px ${size * 2}px), ${base}`;

/** Plaid: one color's stripes across, another's down. */
const plaid = (across: string, down: string, size: number, base: string) =>
  `repeating-linear-gradient(0deg, rgba(${across},.42) 0 ${size}px, transparent ${size}px ${size * 2}px), repeating-linear-gradient(90deg, rgba(${down},.5) 0 ${size}px, transparent ${size}px ${size * 2}px), ${base}`;

/** An index card: a margin rule in `margin` and pale blue lines. */
const ruledCard = (margin: string): CSSProperties => ({
  backgroundImage: `linear-gradient(90deg, transparent 38px, rgba(${margin},.55) 38px, rgba(${margin},.55) 40px, transparent 40px), repeating-linear-gradient(transparent 0 27px, rgba(47,111,176,.22) 27px 28px)`,
  paddingLeft: 52,
});

export const LOOKS: Look[] = [
  {
    id: "cottage",
    name: "Cottage",
    appName: "Recipe Box",
    feel: "A cottage kitchen: sage gingham, oat linen, a gentle italic serif for titles, clay as the second color.",
    fonts: { display: "var(--rk-lora), serif", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Lora italic, Nunito" },
    color: { page: "#f4f1e8", surface: "#fffdf8", ink: "#2f3a30", muted: "#687266", accent: "#5c7c59", onAccent: "#ffffff", second: "#b06f48", rule: "#dfe5d8", highlight: "#e4edda", star: "#c69437" },
    radius: 12,
    pageBackground: "#f4f1e8",
    panel: { border: "1px solid #e1e6da", boxShadow: "0 8px 22px rgba(60,75,55,.08)" },
    picture: () => gingham("92,124,89", 9, "#fffdf8"),
    heading: { fontWeight: 600, fontStyle: "italic", letterSpacing: "-0.01em" },
    lineFont: "var(--rk-nunito), sans-serif",
    band: gingham("92,124,89", 7),
  },
  {
    id: "buttercup",
    name: "Buttercup",
    appName: "Kitchen",
    feel: "A sunny 1960s kitchen: butter-yellow gingham, cornflower blue, warm white, a rounded hand-lettered print.",
    fonts: { display: "var(--rk-itim), cursive", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Itim, Nunito" },
    color: { page: "#fffbea", surface: "#ffffff", ink: "#3b3322", muted: "#776d55", accent: "#e8b52a", onAccent: "#3b3322", accentText: "#946b0c", second: "#4f7fa3", rule: "#f1e4b8", highlight: "#fff0b8", star: "#e0a821" },
    radius: 14,
    pageBackground: "#fffbea",
    panel: { border: "1.5px solid #f1e4b8", boxShadow: "0 8px 20px rgba(150,120,30,.08)" },
    picture: () => gingham("232,181,42", 9),
    heading: { fontWeight: 400, letterSpacing: 0 },
    lineFont: "var(--rk-nunito), sans-serif",
    band: gingham("232,181,42", 7),
  },
  {
    id: "sagebutter",
    name: "Sage & Butter",
    appName: "Recipe Box",
    feel: "Cottage with Buttercup's sunshine: sage buttons and gingham, butter-yellow highlights, a sage and butter plaid band.",
    fonts: { display: "var(--rk-lora), serif", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Lora italic, Nunito" },
    color: { page: "#f6f2e4", surface: "#fffdf6", ink: "#2f3a30", muted: "#687266", accent: "#5c7c59", onAccent: "#ffffff", second: "#a27a12", rule: "#e3e3cf", highlight: "#fcefc0", star: "#e0a821" },
    radius: 12,
    pageBackground: "#f6f2e4",
    panel: { border: "1px solid #e4e4d0", boxShadow: "0 8px 22px rgba(70,75,40,.08)" },
    picture: () => gingham("92,124,89", 9, "#fffdf6"),
    heading: { fontWeight: 600, fontStyle: "italic", letterSpacing: "-0.01em" },
    lineFont: "var(--rk-nunito), sans-serif",
    band: plaid("92,124,89", "232,181,42", 7, "#fffdf6"),
  },
  {
    id: "buttersage",
    name: "Butter & Sage",
    appName: "Kitchen",
    feel: "Buttercup with Cottage's calm: yellow gingham and buttons, sage as the second color, soft sage highlights.",
    fonts: { display: "var(--rk-itim), cursive", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Itim, Nunito" },
    color: { page: "#fffbea", surface: "#ffffff", ink: "#3b3322", muted: "#776d55", accent: "#e8b52a", onAccent: "#3b3322", accentText: "#946b0c", second: "#5c7c59", rule: "#efe5c2", highlight: "#e5eedb", star: "#e0a821" },
    radius: 14,
    pageBackground: "#fffbea",
    panel: { border: "1.5px solid #efe5c2", boxShadow: "0 8px 20px rgba(150,120,30,.08)" },
    picture: () => gingham("232,181,42", 9),
    heading: { fontWeight: 400, letterSpacing: 0 },
    lineFont: "var(--rk-nunito), sans-serif",
    band: gingham("92,124,89", 7),
    cardTop: gingham("92,124,89", 5),
  },
  {
    id: "gardenplaid",
    name: "Garden Plaid",
    appName: "Recipe Box",
    feel: "Both at once, woven together: a soft sage and butter plaid for pictures and edges, cream cards, Cottage's italic titles.",
    fonts: { display: "var(--rk-lora), serif", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Lora italic, Nunito" },
    color: { page: "#fbf7e8", surface: "#fffef9", ink: "#33392c", muted: "#6c705f", accent: "#5c7c59", onAccent: "#ffffff", second: "#a27a12", rule: "#e8e4cc", highlight: "#f8eec4", star: "#e0a821" },
    radius: 14,
    pageBackground: "#fbf7e8",
    panel: { border: "1px solid #e8e4cc", boxShadow: "0 8px 20px rgba(90,90,40,.07)" },
    picture: () => plaid("92,124,89", "232,181,42", 9, "#fffef9"),
    heading: { fontWeight: 600, fontStyle: "italic", letterSpacing: "-0.01em" },
    lineFont: "var(--rk-nunito), sans-serif",
    band: plaid("92,124,89", "232,181,42", 6, "#fffef9"),
    cardTop: plaid("92,124,89", "232,181,42", 4, "#fffef9"),
  },
  {
    id: "box",
    name: "Recipe Box",
    appName: "Recipe Box",
    feel: "Grandma's index cards: ruled lines, a red margin rule, handwritten titles and typed ingredients.",
    fonts: { display: "var(--rk-kalam), cursive", body: "var(--rk-courier), monospace", detail: "var(--rk-courier), monospace", names: "Kalam, Courier Prime" },
    color: { page: "#e7dcc6", surface: "#fffdf6", ink: "#2b2622", muted: "#6c6257", accent: "#b83a2e", onAccent: "#fffdf6", second: "#2f6fb0", rule: "#9fb7d6", highlight: "#fff0a0", star: "#c98a12" },
    radius: 4,
    pageBackground: "#e7dcc6 radial-gradient(rgba(90,70,40,.08) 1px, transparent 1px) 0 0 / 6px 6px",
    panel: { ...ruledCard("184,58,46"), boxShadow: "0 1px 0 rgba(0,0,0,.05), 0 8px 18px rgba(70,50,20,.18)" },
    picture: (hue) => `repeating-linear-gradient(45deg, ${hue}22 0 8px, transparent 8px 16px), #f6efdc`,
    heading: { fontWeight: 700, letterSpacing: 0 },
    lineFont: "var(--rk-courier), monospace",
  },
  {
    id: "picnic",
    name: "Picnic",
    appName: "Picnic",
    feel: "A red gingham tablecloth: soft rounded type, cream plates for cards, a leafy green second color.",
    fonts: { display: "var(--rk-baloo), sans-serif", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Baloo 2, Nunito" },
    color: { page: "#fffaf2", surface: "#ffffff", ink: "#3a2a24", muted: "#7a675d", accent: "#d6403a", onAccent: "#ffffff", second: "#4f8a3c", rule: "#efd9cf", highlight: "#ffe4dc", star: "#e8a317" },
    radius: 18,
    pageBackground: "#fffaf2",
    panel: { border: "1px solid #f0dcd3", boxShadow: "0 2px 0 #f0dcd3, 0 12px 24px rgba(120,50,30,.08)" },
    picture: () => gingham("214,64,58", 10),
    heading: { fontWeight: 800, letterSpacing: "-0.01em" },
    lineFont: "var(--rk-nunito), sans-serif",
    band: gingham("214,64,58", 8),
  },
  {
    id: "farmhouse",
    name: "Farmhouse",
    appName: "Recipe Box",
    feel: "Recipe Box's index cards in a country kitchen: blue gingham tops, kraft paper, a friendlier hand.",
    fonts: { display: "var(--rk-patrick), cursive", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Patrick Hand, Nunito" },
    color: { page: "#e9dfcc", surface: "#fffdf7", ink: "#26313d", muted: "#5f6b78", accent: "#2f64a3", onAccent: "#ffffff", second: "#b8573a", rule: "#c9d6e6", highlight: "#e1ecfa", star: "#d39b1d" },
    radius: 6,
    pageBackground: "#e9dfcc radial-gradient(rgba(90,70,40,.07) 1px, transparent 1px) 0 0 / 5px 5px",
    panel: { ...ruledCard("47,100,163"), boxShadow: "0 8px 18px rgba(70,50,20,.16)" },
    picture: () => gingham("47,100,163", 9, "#fffdf7"),
    heading: { fontWeight: 400, letterSpacing: 0 },
    lineFont: "var(--rk-nunito), sans-serif",
    band: gingham("47,100,163", 7),
    cardTop: gingham("47,100,163", 5),
  },
  {
    id: "towel",
    name: "Tea Towel",
    appName: "Kitchen",
    feel: "A striped kitchen towel: red and blue pinstripes on linen, a soft handwritten print, nothing else going on.",
    fonts: { display: "var(--rk-mali), cursive", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Mali, Nunito" },
    color: { page: "#f3eee4", surface: "#fffdf9", ink: "#33292a", muted: "#746767", accent: "#c0453d", onAccent: "#ffffff", second: "#3b6b8c", rule: "#eadfd3", highlight: "#fbe5df", star: "#d0972a" },
    radius: 8,
    pageBackground: "linear-gradient(rgba(120,100,80,.05) 1px, transparent 1px) 0 0 / 4px 4px, #f3eee4 linear-gradient(90deg, rgba(120,100,80,.05) 1px, transparent 1px) 0 0 / 4px 4px",
    panel: { boxShadow: "0 1px 0 #eadfd3, 0 8px 20px rgba(80,60,40,.08)" },
    picture: () => `linear-gradient(transparent 42%, #c0453d 42% 47%, transparent 47% 50%, #3b6b8c 50% 53%, transparent 53% 56%, #c0453d 56% 61%, transparent 61%), #f7f1e6`,
    heading: { fontWeight: 600, letterSpacing: 0 },
    lineFont: "var(--rk-nunito), sans-serif",
    band: "linear-gradient(#fffdf9 0 3px, #c0453d 3px 6px, #fffdf9 6px 8px, #3b6b8c 8px 10px, #fffdf9 10px 12px, #c0453d 12px 15px, #fffdf9 15px)",
    cardTop: "linear-gradient(#fffdf9 0 2px, #c0453d 2px 4px, #fffdf9 4px 5px, #3b6b8c 5px 6px, #fffdf9 6px 7px, #c0453d 7px 9px, #fffdf9 9px)",
  },
  {
    id: "berry",
    name: "Berry Patch",
    appName: "Recipe Box",
    feel: "Strawberry season: tiny pink gingham, leaf green, round friendly type, light and sweet.",
    fonts: { display: "var(--rk-gaegu), cursive", body: "var(--rk-quicksand), sans-serif", detail: "var(--rk-quicksand), sans-serif", names: "Gaegu, Quicksand" },
    color: { page: "#fff7f6", surface: "#ffffff", ink: "#4a2e33", muted: "#86656b", accent: "#d9587a", onAccent: "#ffffff", second: "#5f9a64", rule: "#f5dbe1", highlight: "#fde3ea", star: "#ef9f35" },
    radius: 16,
    pageBackground: "#fff7f6",
    panel: { border: "1.5px solid #f5dbe1", boxShadow: "0 8px 20px rgba(217,88,122,.07)" },
    picture: () => gingham("217,88,122", 6),
    // Gaegu draws small for its size, so its x-height is matched to the other fonts.
    heading: { fontWeight: 700, letterSpacing: 0, fontSizeAdjust: "0.56" },
    lineFont: "var(--rk-quicksand), sans-serif",
    band: gingham("217,88,122", 5),
  },
  {
    id: "stitched",
    name: "Stitched",
    appName: "Recipe Box",
    feel: "Recipe Box with a sewn edge: each card has a running stitch just inside it, like an embroidered sampler on linen.",
    fonts: { display: "var(--rk-kalam), cursive", body: "var(--rk-nunito), sans-serif", detail: "var(--rk-nunito), sans-serif", names: "Kalam, Nunito" },
    color: { page: "#efe7da", surface: "#fffcf5", ink: "#2e2724", muted: "#6c6158", accent: "#a5463c", onAccent: "#ffffff", second: "#41698c", rule: "#e2d6c4", highlight: "#f7e8c4", star: "#c48b1f" },
    radius: 10,
    pageBackground: "linear-gradient(rgba(110,90,60,.05) 1px, transparent 1px) 0 0 / 5px 5px, #efe7da linear-gradient(90deg, rgba(110,90,60,.05) 1px, transparent 1px) 0 0 / 5px 5px",
    panel: { outline: "2px dashed rgba(165,70,60,.5)", outlineOffset: -8, boxShadow: "0 8px 20px rgba(80,60,40,.1)" },
    picture: (hue) => `repeating-linear-gradient(45deg, ${hue}1f 0 6px, transparent 6px 12px), #f8f1e3`,
    heading: { fontWeight: 700, letterSpacing: 0 },
    lineFont: "var(--rk-nunito), sans-serif",
  },
];
