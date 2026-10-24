"use client";

// The office's paperwork: the timesheet that prints after a shift, the head office memo that closes the day, and the
// row of squares that stands for your submissions in shares.

import * as React from "react";
import Box from "@mui/material/Box";
import { DISPLAY, TYPE } from "./fonts";
import { AIRMAIL, APPROVED, DASH, INK, MUTED, RETURNED, RULE } from "./palette";
import { PAPER_CARD } from "./desk";
import { InkStamp } from "./stamp";

/** A torn-off bottom edge for receipts. */
const TORN = `polygon(0 0, 100% 0, 100% calc(100% - 8px), ${Array.from({ length: 20 }, (_, i) => `${100 - (i + 0.5) * 5}% ${i % 2 ? "calc(100% - 8px)" : "100%"}`).join(", ")}, 0 calc(100% - 8px))`;

/** One square per submission: filled for approved, hollow for returned, so it reads without color. */
export function Squares({ history, size = 11 }: { history: boolean[]; size?: number }) {
  return (
    <Box role="img" aria-label={`${history.filter(Boolean).length} approved, ${history.filter((ok) => !ok).length} returned`} sx={{ display: "flex", flexWrap: "wrap", gap: "3px", justifyContent: "center" }}>
      {history.map((ok, i) => (
        <Box key={i} sx={{ width: size, height: size, borderRadius: "2px", boxSizing: "border-box", ...(ok ? { bgcolor: APPROVED } : { border: `2px solid ${RETURNED}` }) }} />
      ))}
    </Box>
  );
}

export interface TimesheetProps {
  number: number;
  shift: number;
  right: number;
  total?: number;
  submissions: number;
  hints: number;
  history: boolean[];
  dateLine?: string;
  compact?: boolean;
}

/** Prints after a shift: how many items were sorted right, never which ones. */
export function Timesheet({ number, shift, right, total = 8, submissions, hints, history, dateLine, compact }: TimesheetProps) {
  const perfect = right === total;
  const row = { display: "flex", justifyContent: "space-between", gap: 2 } as const;
  return (
    <Box sx={{ position: "relative", width: compact ? 200 : 240, bgcolor: "#fbf8f1", color: INK, fontFamily: TYPE, fontSize: 14, p: "16px 18px 26px", clipPath: TORN, display: "grid", gap: 0.75, boxShadow: "0 8px 16px rgba(0,0,0,0.35)" }}>
      <Box sx={{ textAlign: "center", letterSpacing: "0.16em", textTransform: "uppercase" }}>Timesheet</Box>
      <Box sx={{ textAlign: "center", fontSize: 12, color: MUTED }}>Return to Sender · No. {number}</Box>
      <Box sx={{ borderTop: `1px dashed ${DASH}`, my: 0.5 }} />
      <Box sx={row}>
        <span>Shift</span>
        <span>{shift}</span>
      </Box>
      <Box sx={row}>
        <span>Sorted right</span>
        <span>
          {right} of {total}
        </span>
      </Box>
      <Box sx={row}>
        <span>Submissions</span>
        <span>{submissions}</span>
      </Box>
      <Box sx={row}>
        <span>Hints</span>
        <span>{hints || "none"}</span>
      </Box>
      <Box sx={{ borderTop: `1px dashed ${DASH}`, my: 0.5 }} />
      <Squares history={history} />
      <Box sx={{ textAlign: "center", mt: 0.5, mb: perfect ? 5 : 0 }}>{perfect ? "Perfect shift" : "Back to the desk"}</Box>
      {perfect && (
        <Box sx={{ position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)", opacity: 0.92 }}>
          <InkStamp ok kind="dated-soft" size={0.6} wash dateLine={dateLine} />
        </Box>
      )}
    </Box>
  );
}

/** Head office's memo: closes the day and reveals the regulation. */
export function Memo({ number, regulationText, summary, children }: { number: number; regulationText: string; summary: string; children?: React.ReactNode }) {
  return (
    <Box sx={{ ...PAPER_CARD, overflow: "hidden" }}>
      <Box aria-hidden sx={{ height: 10, background: AIRMAIL }} />
      <Box sx={{ p: "18px 20px", display: "grid", gap: 1.25, fontFamily: TYPE }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
          <span>Head office</span>
          <span>Memo</span>
        </Box>
        <Box sx={{ fontSize: 13, color: MUTED }}>Department of Regulations · Re: Regulation No. {number}</Box>
        <Box component="h2" sx={{ m: 0, fontFamily: TYPE, fontSize: 19, fontWeight: 400, lineHeight: 1.45, color: INK }}>
          {regulationText}
        </Box>
        <Box sx={{ fontSize: 14, lineHeight: 1.5 }}>{summary}</Box>
        <Box sx={{ fontSize: 13, color: MUTED, borderTop: `1px dashed ${RULE}`, pt: 1 }}>Your diligence has been noted in a file nobody will read. Signed, the Postmaster.</Box>
        {children}
      </Box>
    </Box>
  );
}

/** A small heading in the stamp's letters, for dialogs and cards. */
export function Heading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <Box component="h2" id={id} sx={{ m: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: "0.02em", color: INK }}>
      {children}
    </Box>
  );
}
