"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { HeaderSkinContext, type HeaderSkin } from "@/components/shared/SlidingHeader";
import { lora, nunito } from "./fonts";
import { color, font, plaidBand } from "./tokens";

const channel = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

// The site theme's light scheme (the "light" class), then Sage & Butter's colors and fonts over it, so Recipes
// keeps its look in dark mode too.
const vars = {
  "--mui-palette-primary-main": color.accent,
  "--mui-palette-primary-mainChannel": channel(color.accent),
  "--mui-palette-primary-dark": color.accentDeep,
  "--mui-palette-primary-darkChannel": channel(color.accentDeep),
  "--mui-palette-primary-contrastText": color.onAccent,
  "--mui-palette-background-default": color.page,
  "--mui-palette-background-defaultChannel": channel(color.page),
  "--mui-palette-background-paper": color.surface,
  "--mui-palette-text-primary": color.ink,
  "--mui-palette-text-primaryChannel": channel(color.ink),
  "--mui-palette-text-secondary": color.muted,
  "--mui-palette-text-secondaryChannel": channel(color.muted),
  "--mui-palette-divider": color.rule,
  "--font-display": font.display,
  "--font-body": font.body,
} as React.CSSProperties;

const skin: HeaderSkin = {
  bar: {
    "& .MuiAppBar-root": {
      position: "relative",
      bgcolor: color.surface,
      color: color.ink,
      borderBottom: "none",
      pb: "8px",
      "&::after": { content: '""', position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: plaidBand() },
    },
  },
  tab: { bgcolor: color.surface, color: color.ink, borderColor: color.rule, "&:hover": { bgcolor: color.surface } },
};

/** The look's colors and fonts, for anything Recipes shows outside the section's own box, like a dialog. */
export const skinScope = { className: `light ${lora.variable} ${nunito.variable}`, style: vars };
export const skinSx = {
  color: color.ink,
  fontFamily: font.body,
  "& :is(.MuiTypography-h1, .MuiTypography-h2, .MuiTypography-h3, .MuiTypography-h4, .MuiTypography-h5, .MuiTypography-h6)": { fontStyle: "italic", fontWeight: 600, letterSpacing: "-0.01em" },
} as const;

/** Dresses the Recipes section in Sage & Butter: header band, colors, Lora italic headings and Nunito text. */
export default function RecipesSkin({ children }: { children: React.ReactNode }) {
  return (
    <HeaderSkinContext.Provider value={skin}>
      <Box className={skinScope.className} style={skinScope.style} sx={{ ...skinSx, minHeight: "100dvh", bgcolor: color.page }}>
        {children}
      </Box>
    </HeaderSkinContext.Provider>
  );
}
