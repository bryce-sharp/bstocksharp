"use client";

// The desk and its objects: surfaces, the hanging sign, desk calendar, handbook binder, service bell, testing
// clipboard, and the trays that hold the log piles.

import * as React from "react";
import Box from "@mui/material/Box";
import type { Cells } from "./engine";
import { DISPLAY, TYPE } from "./fonts";
import { DASH, INK, MUTED, PAPER, PAPER_2, PERF, POSTAL, RETURNED, RULE } from "./palette";
import { Stamp } from "./parts";

const LEATHER = "#5a3a26";

export const SURFACES = [
  {
    id: "wood",
    name: "Oak desk",
    background: "repeating-linear-gradient(92deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 9px), repeating-linear-gradient(88deg, rgba(0,0,0,0.07) 0 1px, transparent 1px 23px), linear-gradient(180deg, #7a5536, #5c3f28)",
  },
  {
    id: "blotter",
    name: "Green blotter",
    background: `linear-gradient(135deg, ${LEATHER} 0 12%, transparent 12% 88%, ${LEATHER} 88%), linear-gradient(45deg, ${LEATHER} 0 12%, transparent 12% 88%, ${LEATHER} 88%), radial-gradient(ellipse at 50% 40%, #3d5e4a, #2b4436)`,
  },
  {
    id: "counter",
    name: "Linoleum counter",
    background: "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.07) 0 1px, transparent 1.5px) 0 0 / 9px 9px, radial-gradient(circle at 70% 60%, rgba(255,255,255,0.08) 0 1px, transparent 1.5px) 0 0 / 13px 13px, #b9b19c",
  },
] as const;
export type SurfaceId = (typeof SURFACES)[number]["id"];
export const surface = (id: SurfaceId) => SURFACES.find((s) => s.id === id)!.background;

/** A stamp sheet drawn at any size, the same way the counter draws it. */
export function SheetPicture({ cells, size = 200 }: { cells: Cells; size?: number }) {
  return (
    <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: `${Math.max(1, Math.round(size / 40))}px`, width: size, aspectRatio: "1", p: `${Math.max(2, Math.round(size / 22))}px`, bgcolor: PAPER_2, borderRadius: "3px", boxShadow: "0 6px 14px rgba(0,0,0,0.25)" }}>
      {cells.map((v, i) => (
        <Box
          key={i}
          sx={{
            position: "relative",
            borderRadius: "2px",
            border: v ? `1.5px solid ${POSTAL}` : `1.5px dashed ${DASH}`,
            bgcolor: v ? POSTAL : PAPER,
            "&::after": v && size >= 90 ? { content: '""', position: "absolute", inset: "16%", border: `2px dotted ${PERF}` } : undefined,
          }}
        />
      ))}
    </Box>
  );
}

const CHAINS = { position: "relative", width: "58%", height: 20, borderLeft: "2px solid #9a948a", borderRight: "2px solid #9a948a" } as const;

export type SignStyle = "enamel" | "wood" | "brass";
export const SIGN_STYLES: { style: SignStyle; name: string }[] = [
  { style: "enamel", name: "Blue enamel" },
  { style: "wood", name: "Painted wood" },
  { style: "brass", name: "Brass plate" },
];

export function HangingSign({ style, number, small }: { style: SignStyle; number: number; small?: boolean }) {
  const look = {
    enamel: { bgcolor: "#1f3a6e", color: PAPER, borderRadius: "10px", boxShadow: `inset 0 0 0 3px #1f3a6e, inset 0 0 0 5px ${PAPER}, 0 6px 12px rgba(0,0,0,0.35)` },
    wood: { background: "linear-gradient(180deg, #8a5f3c, #6b4a30)", color: "#f6e7c8", borderRadius: "4px", textShadow: "0 1px 0 rgba(0,0,0,0.4)", boxShadow: "0 6px 12px rgba(0,0,0,0.35)" },
    brass: { background: "linear-gradient(160deg, #e6c873, #b38c35 60%, #d8b75e)", color: "#3a2a12", borderRadius: "6px", textShadow: "0 1px 0 rgba(255,255,255,0.45)", boxShadow: "0 6px 12px rgba(0,0,0,0.35)" },
  }[style];
  return (
    <Box sx={{ display: "grid", justifyItems: "center" }}>
      <Box aria-hidden sx={CHAINS} />
      <Box sx={{ ...look, textAlign: "center", px: small ? 1.5 : 3.5, py: small ? 0.6 : 1.25 }}>
        <Box sx={{ fontFamily: DISPLAY, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1, fontSize: small ? 16 : 28, whiteSpace: "nowrap" }}>Return to Sender</Box>
        <Box sx={{ fontFamily: TYPE, fontWeight: 700, fontSize: small ? 10 : 12, letterSpacing: "0.12em", textTransform: "uppercase", mt: 0.5, opacity: 0.85 }}>Regulation No. {number}</Box>
      </Box>
    </Box>
  );
}

interface CalendarProps {
  dateKey?: string;
  arrows?: boolean;
  small?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}

/** The desk calendar; with `arrows`, it steps between days. */
export function DeskCalendar({ dateKey = "2026-10-24", arrows, small, onPrev, onNext, canPrev = true, canNext = true }: CalendarProps) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.getDate();
  const arrow = { fontFamily: TYPE, fontSize: 18, lineHeight: 1, color: PAPER, bgcolor: "rgba(0,0,0,0.3)", border: 0, borderRadius: "50%", width: small ? 26 : 30, height: small ? 26 : 30, cursor: "pointer", "&:disabled": { opacity: 0.3, cursor: "default" } } as const;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      {arrows && (
        <Box component="button" type="button" aria-label="Previous day" onClick={onPrev} disabled={!canPrev} sx={arrow}>
          ‹
        </Box>
      )}
      <Box sx={{ width: small ? 54 : 72, bgcolor: PAPER, borderRadius: "6px", overflow: "hidden", textAlign: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
        <Box sx={{ bgcolor: RETURNED, color: PAPER, fontFamily: TYPE, fontWeight: 700, fontSize: small ? 10 : 12, py: 0.4, letterSpacing: "0.12em", textTransform: "uppercase" }}>{month}</Box>
        <Box sx={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: small ? 24 : 32, lineHeight: 1.1, color: INK }}>{day}</Box>
        <Box sx={{ fontFamily: TYPE, fontSize: small ? 9 : 10, color: MUTED, pb: 0.5, textTransform: "uppercase" }}>{weekday}</Box>
      </Box>
      {arrows && (
        <Box component="button" type="button" aria-label="Next day" onClick={onNext} disabled={!canNext} sx={arrow}>
          ›
        </Box>
      )}
    </Box>
  );
}

export function Handbook({ small }: { small?: boolean }) {
  const w = small ? 58 : 88;
  return (
    <Box role="img" aria-label="Employee handbook" sx={{ position: "relative", width: w, height: w * 1.25, borderRadius: "3px 6px 6px 3px", background: "linear-gradient(90deg, #4e1b17 0 14%, #7a2a24 14%)", boxShadow: "0 6px 12px rgba(0,0,0,0.35)", display: "grid", placeItems: "center" }}>
      <Box aria-hidden sx={{ position: "absolute", left: "4%", top: "16%", bottom: "16%", width: w * 0.06, display: "grid", alignContent: "space-between" }}>
        {[0, 1, 2].map((n) => (
          <Box key={n} sx={{ width: w * 0.06, height: w * 0.06, borderRadius: "50%", bgcolor: "#c9c2b0" }} />
        ))}
      </Box>
      <Box sx={{ ml: "14%", width: "68%", bgcolor: PAPER, borderRadius: "2px", py: 0.5, px: 0.25, textAlign: "center", fontFamily: TYPE, fontSize: small ? 8 : 10, lineHeight: 1.2, color: INK, textTransform: "uppercase", letterSpacing: small ? 0 : "0.04em", overflowWrap: "anywhere" }}>
        {small ? "Handbook" : "Employee handbook"}
      </Box>
    </Box>
  );
}

export type BellState = "ready" | "locked" | "used";

/** The service bell: ring it for a hint. `plaque` stands it on a small wooden plate with a label, so it has a home. */
export function ServiceBell({ state, rung = 0, small, plaque }: { state: BellState; rung?: number; small?: boolean; plaque?: string }) {
  const bell = <BellDrawing state={state} rung={rung} small={small} />;
  if (!plaque) return bell;
  return (
    <Box sx={{ display: "grid", justifyItems: "center", gap: 0.25 }}>
      {bell}
      <Box sx={{ background: "linear-gradient(180deg, #8a5f3c, #6b4a30)", color: "#f6e7c8", fontFamily: TYPE, fontSize: small ? 10 : 12, px: 1, py: 0.4, borderRadius: "3px", boxShadow: "0 2px 4px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>{plaque}</Box>
    </Box>
  );
}

function BellDrawing({ state, rung, small }: { state: BellState; rung: number; small?: boolean }) {
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const w = small ? 52 : 80;
  return (
    <Box sx={{ position: "relative", width: w, opacity: state === "locked" ? 0.45 : 1, filter: state === "locked" ? "grayscale(1)" : "none" }}>
      <svg viewBox="0 0 80 64" width={w} height={w * 0.8} role="img" aria-label={state === "locked" ? "Service bell, rings after your first submission" : `Service bell, ${2 - rung} of 2 rings left`}>
        <defs>
          <linearGradient id={`${id}-brass`} x1="0" x2="1">
            <stop offset="0" stopColor="#8f6c22" />
            <stop offset="0.4" stopColor="#f0d27a" />
            <stop offset="1" stopColor="#9c7a2c" />
          </linearGradient>
        </defs>
        <ellipse cx="40" cy="58" rx="34" ry="5" fill="rgba(0,0,0,0.35)" />
        <rect x="8" y="47" width="64" height="9" rx="3" fill="#3a2a1c" />
        <path d="M 14 48 A 26 26 0 0 1 66 48 Z" fill={`url(#${id}-brass)`} />
        <path d="M 22 40 A 18 18 0 0 1 34 27" stroke="rgba(255,255,255,0.6)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="37" y="15" width="6" height="8" rx="2" fill="#a8842f" />
        <ellipse cx="40" cy="14" rx="6" ry="3" fill="#e2c15f" />
      </svg>
      {state === "used" && (
        <Box sx={{ position: "absolute", right: -6, top: -4, bgcolor: INK, color: PAPER, fontFamily: TYPE, fontWeight: 700, fontSize: 10, borderRadius: "10px", px: 0.75, py: 0.25 }}>{rung} of 2</Box>
      )}
    </Box>
  );
}

/** The testing-phase board picker, as a clipboard. */
export function TestingClipboard({ board = "Stamp sheet", onClick }: { board?: string; onClick?: (e: React.MouseEvent<HTMLElement>) => void }) {
  return (
    <Box sx={{ position: "relative", display: "inline-grid", pt: 1 }}>
      <Box aria-hidden sx={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", width: 46, height: 14, borderRadius: "4px", bgcolor: "#59606b", boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)" }} />
      <Box component="button" type="button" onClick={onClick} aria-label={`Testing options. Board: ${board}`} aria-haspopup="menu" sx={{ bgcolor: PAPER, border: `6px solid #8a6a45`, borderRadius: "6px", px: 1.5, pt: 1.25, pb: 0.75, fontFamily: TYPE, color: INK, textAlign: "left", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.3)" }}>
        <Box sx={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Testing</Box>
        <Box sx={{ fontSize: 13, fontWeight: 700 }}>{board} ▾</Box>
      </Box>
    </Box>
  );
}

/** A tray holding one log pile; `fanned` lays the items out instead of stacking them. `mini` is for phones. */
export function Tray({ ok, items, Thumb, fanned, small, mini }: { ok: boolean; items: Cells[]; Thumb: React.ComponentType<{ cells: Cells }>; fanned?: boolean; small?: boolean; mini?: boolean }) {
  const shown = fanned ? items : items.slice(-4);
  const width = mini ? 92 : small ? 112 : 150;
  const height = mini ? 80 : small ? 104 : 132;
  return (
    <Box sx={{ display: "grid", gap: 0.75, justifyItems: "center" }}>
      <Box sx={{ position: "relative", width: fanned ? "100%" : width, minHeight: fanned ? 0 : height, p: 1, borderRadius: "6px", background: "linear-gradient(180deg, #3d4048, #2f3238)", boxShadow: "inset 0 3px 0 rgba(255,255,255,0.08), inset 0 -6px 10px rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.3)" }}>
        {fanned ? (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(66px, 1fr))", gap: 0.75 }}>
            {shown.map((cells, i) => (
              <Box key={i} sx={{ bgcolor: PAPER, borderRadius: "2px", p: 0.5, display: "grid", placeItems: "center" }}>
                <Thumb cells={cells} />
              </Box>
            ))}
          </Box>
        ) : (
          shown.map((cells, i) => (
            <Box key={i} sx={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%, -50%) translate(${(i % 2 ? 1 : -1) * (shown.length - 1 - i) * 3}px, ${(shown.length - 1 - i) * -3}px) rotate(${[-6, 4, -2, 3][i % 4]}deg)`, bgcolor: PAPER, borderRadius: "2px", p: 0.5, boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
              <Thumb cells={cells} />
            </Box>
          ))
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, bgcolor: PAPER, borderRadius: "3px", px: 1, py: 0.5, boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
        <Stamp ok={ok} />
        <Box sx={{ fontFamily: TYPE, fontSize: 13, fontWeight: 700, color: INK }}>{items.length}</Box>
      </Box>
    </Box>
  );
}

export const PAPER_CARD = { bgcolor: PAPER, color: INK, borderRadius: "4px", border: `1px solid ${RULE}`, boxShadow: "0 8px 18px rgba(0,0,0,0.3)" } as const;
