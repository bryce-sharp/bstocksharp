"use client";

// The clerk's rubber stamp: the ink filters, the marks it leaves, and the wooden stamp that presses them.

import * as React from "react";
import Box from "@mui/material/Box";
import { DISPLAY, TYPE } from "./fonts";
import { APPROVED, RETURNED, STAMP_WASH } from "./palette";

export const INK_FILTER = "url(#rts-ink-rough)";
export const SOFT_INK_FILTER = "url(#rts-ink-soft)";

/**
 * Two inks, rendered once per page. Rough: ragged edges and small gaps, like a stamp pressed by hand. Soft: the same
 * idea toned down, with gentler edges and only light patches instead of gaps.
 */
export function InkDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <filter id="rts-ink-rough" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="2" seed="11" result="speck" />
        <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -2.6 0 0 0 2.15" result="holes" />
        <feComposite in="rough" in2="holes" operator="in" />
      </filter>
      <filter id="rts-ink-soft" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="warp" />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="rough" />
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="11" result="speck" />
        <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.6 0 0 0 1.75" result="holes" />
        <feComposite in="rough" in2="holes" operator="in" />
      </filter>
    </svg>
  );
}

export type InkKind = "clean" | "inked" | "dated" | "postmark" | "dated-soft" | "inked-soft";

const isDated = (kind: InkKind) => kind === "dated" || kind === "dated-soft";
const filterFor = (kind: InkKind) => (kind === "clean" ? "none" : kind.endsWith("-soft") ? SOFT_INK_FILTER : INK_FILTER);
const label = (ok: boolean) => (ok ? "Approved" : "Return to sender");

/** The date line on a dated stamp, for example "Reg. No. 23 · Oct 24 2026". */
export function stampDateLine(number: number, dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).replace(",", "");
  return `Reg. No. ${number} · ${date}`;
}

/** The mark a stamp leaves. `wash` lays a little paper under the ink so it reads on top of a busy item. */
export function InkStamp({ ok, kind, face = DISPLAY, size = 1, wash, dateLine = "Reg. No. 23 · Oct 24 2026" }: { ok: boolean; kind: InkKind; face?: string; size?: number; wash?: boolean; dateLine?: string }) {
  const color = ok ? APPROVED : RETURNED;
  if (kind === "postmark") return <Postmark ok={ok} face={face} size={size} />;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-grid",
        justifyItems: "center",
        gap: 0.5 * size,
        color,
        fontFamily: face,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        fontSize: 24 * size,
        px: 1.5 * size,
        py: 0.9 * size,
        border: isDated(kind) ? `${6 * size}px double currentColor` : `${4 * size}px solid currentColor`,
        borderRadius: `${4 * size}px`,
        transform: "rotate(-7deg)",
        bgcolor: wash ? STAMP_WASH : "transparent",
        filter: filterFor(kind),
      }}
    >
      <span>{label(ok)}</span>
      {isDated(kind) && (
        <Box component="span" sx={kind === "dated-soft" ? { fontFamily: DISPLAY, fontWeight: 600, fontSize: 13 * size, letterSpacing: "0.12em" } : { fontFamily: TYPE, fontSize: 11 * size, letterSpacing: "0.1em" }}>
          {dateLine}
        </Box>
      )}
    </Box>
  );
}

function Postmark({ ok, face, size }: { ok: boolean; face: string; size: number }) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const color = ok ? APPROVED : RETURNED;
  const px = 150 * size;
  return (
    <svg viewBox="0 0 240 160" width={px * 1.6} height={px} style={{ filter: INK_FILTER, transform: "rotate(-8deg)" }} aria-label={label(ok)} role="img">
      <defs>
        <path id={`${id}-top`} d="M 26 80 A 54 54 0 0 1 134 80" />
        <path id={`${id}-bottom`} d="M 32 80 A 48 48 0 0 0 128 80" />
      </defs>
      <g fill="none" stroke={color}>
        <circle cx="80" cy="80" r="70" strokeWidth="5" />
        <circle cx="80" cy="80" r="40" strokeWidth="2" />
        {[0, 1, 2, 3].map((n) => (
          <path key={n} d={`M 150 ${50 + n * 20} q 10 -8 20 0 t 20 0 t 20 0 t 20 0`} strokeWidth="4" />
        ))}
      </g>
      <g fill={color} style={{ fontFamily: face, fontWeight: 700, textTransform: "uppercase" }}>
        <text fontSize={ok ? 19 : 15} letterSpacing="2">
          <textPath href={`#${id}-top`} startOffset="50%" textAnchor="middle">
            {label(ok)}
          </textPath>
        </text>
        <text fontSize="11" letterSpacing="2" style={{ fontFamily: TYPE }}>
          <textPath href={`#${id}-bottom`} startOffset="50%" textAnchor="middle">
            Reg. No. 23
          </textPath>
        </text>
        <text x="80" y="78" fontSize="16" textAnchor="middle" style={{ fontFamily: TYPE }}>
          OCT 24
        </text>
        <text x="80" y="96" fontSize="13" textAnchor="middle" style={{ fontFamily: TYPE }}>
          2026
        </text>
      </g>
    </svg>
  );
}

/** For a GlobalStyles element: the rubber stamp comes down, presses and lifts away; the ink appears as it lifts. */
export const PRESS_KEYFRAMES = {
  "@keyframes rtsPress": {
    "0%": { transform: "translate(-50%, -260%) rotate(-6deg)", opacity: 0 },
    "15%": { opacity: 1 },
    "45%": { transform: "translate(-50%, -100%) rotate(0deg)" },
    "55%": { transform: "translate(-50%, -96%) scaleY(0.95)" },
    "68%": { transform: "translate(-50%, -100%)" },
    "100%": { transform: "translate(-50%, -300%) rotate(5deg)", opacity: 0 },
  },
  "@keyframes rtsInk": {
    "0%": { opacity: 0, transform: "translate(-50%, -50%) scale(1.06)" },
    "100%": { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
  },
  "@keyframes rtsArm": {
    "0%": { opacity: 0, transform: "translate(70px, -90px) rotate(-30deg)" },
    "45%": { opacity: 0.38, transform: "translate(12px, -14px) rotate(-30deg)" },
    "100%": { opacity: 0, transform: "translate(80px, -110px) rotate(-30deg)" },
  },
};
/** How long after a press starts the ink appears, in milliseconds. */
export const INK_DELAY = 300;

/** The wooden rubber stamp, seen from the side. */
export function RubberStamp() {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 120 150" width="96" height="120" aria-hidden>
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" x2="1">
          <stop offset="0" stopColor="#5c3d25" />
          <stop offset="0.45" stopColor="#9a6a42" />
          <stop offset="1" stopColor="#5c3d25" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="24" rx="24" ry="20" fill={`url(#${id}-wood)`} />
      <rect x="49" y="38" width="22" height="34" fill={`url(#${id}-wood)`} />
      <rect x="12" y="70" width="96" height="40" rx="5" fill={`url(#${id}-wood)`} />
      <rect x="8" y="108" width="104" height="13" rx="2" fill="#4a1c18" />
    </svg>
  );
}

/**
 * The stamp landing on whatever sits under it: the wooden stamp presses and lifts, leaving the mark. A new `run`
 * replays it; `run` 0 shows the mark without the press.
 */
export function StampOver({ run, children }: { run: number; children: React.ReactNode }) {
  return (
    <React.Fragment key={run}>
      <Box sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", animation: run ? `rtsInk 0.18s ease-out ${INK_DELAY}ms both` : "none", pointerEvents: "none" }}>{children}</Box>
      {run > 0 && (
        <Box aria-hidden sx={{ position: "absolute", left: "50%", top: "50%", animation: "rtsPress 0.62s cubic-bezier(0.3, 0.7, 0.4, 1) both", pointerEvents: "none", zIndex: 2 }}>
          <RubberStamp />
        </Box>
      )}
    </React.Fragment>
  );
}
