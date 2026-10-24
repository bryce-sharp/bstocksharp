"use client";

// Stamp options for the art sheet: the list of ink styles and the stamp landing demo.

import * as React from "react";
import Box from "@mui/material/Box";
import { TYPE } from "../fonts";
import { INK_DELAY, InkStamp, RubberStamp, type InkKind } from "../stamp";

export const INK_KINDS: { kind: InkKind; name: string; note: string }[] = [
  { kind: "clean", name: "Clean", note: "Crisp lines." },
  { kind: "inked", name: "Inked", note: "Rough edges and gaps, as if pressed by hand." },
  { kind: "dated", name: "Dated", note: "A double border with the regulation number and date, like an office stamp." },
  { kind: "postmark", name: "Postmark", note: "Round, with the words around the edge, like a cancellation mark." },
  { kind: "dated-soft", name: "Dated, softer ink", note: "Dated with toned-down roughness and a bigger, bolder date line. Picked, and now the game's stamp." },
  { kind: "inked-soft", name: "Inked, softer", note: "Inked with toned-down roughness: gentler edges and light patches instead of gaps." },
];

/** A piece of paper the stamp lands on; tap Stamp it to replay. */
export function StampLanding({ ok, kind, face, arm, children }: { ok: boolean; kind: InkKind; face: string; arm: boolean; children: React.ReactNode }) {
  const [run, setRun] = React.useState(0);
  return (
    <Box sx={{ display: "grid", gap: 1.5, justifyItems: "center" }}>
      <Box sx={{ position: "relative", display: "grid", placeItems: "center", width: 260, height: 220, overflow: "hidden" }}>
        {children}
        {run > 0 && (
          <React.Fragment key={run}>
            {arm && (
              <Box aria-hidden sx={{ position: "absolute", right: -30, top: -40, width: 200, height: 90, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(0,0,0,0.85), transparent 70%)", filter: "blur(10px)", animation: "rtsArm 0.62s ease-in-out both" }} />
            )}
            <Box sx={{ position: "absolute", left: "50%", top: "50%", animation: `rtsInk 0.18s ease-out ${INK_DELAY}ms both` }}>
              <InkStamp ok={ok} kind={kind} face={face} size={kind === "postmark" ? 0.8 : 0.9} wash />
            </Box>
            <Box aria-hidden sx={{ position: "absolute", left: "50%", top: "50%", animation: "rtsPress 0.62s cubic-bezier(0.3, 0.7, 0.4, 1) both" }}>
              <RubberStamp />
            </Box>
          </React.Fragment>
        )}
      </Box>
      <Box
        component="button"
        type="button"
        onClick={() => {
          setRun((r) => r + 1);
          if (typeof navigator.vibrate === "function") setTimeout(() => navigator.vibrate(18), INK_DELAY);
        }}
        sx={{ fontFamily: TYPE, fontSize: 13, px: 2, py: 1, borderRadius: "5px", border: "1px solid currentColor", bgcolor: "transparent", color: "inherit", cursor: "pointer" }}
      >
        Stamp it
      </Box>
    </Box>
  );
}
