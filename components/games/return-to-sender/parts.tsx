"use client";

// Shared pieces of Return to Sender's pages: the clerk's rubber stamp, a paper panel with an airmail edge, and the
// card that holds one item in the log, the inspection and the lab.

import * as React from "react";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import { DISPLAY, TYPE } from "./fonts";
import { AIRMAIL, APPROVED, INK, MUTED, PAPER, POSTAL, RETURNED, RULE, STAMP_WASH } from "./palette";

/** For a GlobalStyles element: the big stamp thumps down onto the item. */
export const STAMP_KEYFRAMES = {
  "@keyframes rtsThunk": {
    from: { transform: "rotate(-7deg) scale(1.6)", opacity: 0 },
    to: { transform: "rotate(-7deg) scale(1)", opacity: 1 },
  },
};

export function Stamp({ ok, big }: { ok: boolean; big?: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-block",
        fontFamily: DISPLAY,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        color: ok ? APPROVED : RETURNED,
        border: `${big ? 5 : 2}px solid currentColor`,
        borderRadius: "4px",
        fontSize: big ? { xs: 22, sm: 28 } : 11,
        px: big ? 1.75 : 0.75,
        py: big ? 1 : 0.5,
        transform: "rotate(-7deg)",
        bgcolor: big ? STAMP_WASH : "transparent",
        animation: big ? "rtsThunk 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.3)" : "none",
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      {ok ? "Approved" : big ? "Return to sender" : "Returned"}
    </Box>
  );
}

export function PaperPanel({ children, sx }: { children: React.ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box sx={[{ bgcolor: PAPER, color: INK, borderRadius: "6px", overflow: "hidden", boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)" }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box aria-hidden sx={{ height: 10, background: AIRMAIL }} />
      {children}
    </Box>
  );
}

/** One item as a small card; a button when `onClick` is given. */
export function DocCard({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <Box
      component={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={label}
      sx={{
        width: "100%",
        display: "grid",
        gap: 1,
        justifyItems: "center",
        alignContent: "start",
        p: "10px 6px 8px",
        bgcolor: PAPER,
        color: "inherit",
        font: "inherit",
        border: `1px solid ${active ? POSTAL : RULE}`,
        boxShadow: active ? `0 0 0 1px ${POSTAL}` : "none",
        borderRadius: "3px",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {children}
    </Box>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <Box component="span" sx={{ fontFamily: TYPE, fontSize: 10, lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED }}>
      {children}
    </Box>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <Box component="p" sx={{ m: 0, fontFamily: TYPE, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>
      {children}
    </Box>
  );
}
