"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import { SheetPicture } from "../desk";
import type { Cells } from "../engine";
import { DASH, INK, PAPER, PAPER_2, PERF, POSTAL, RULE } from "../palette";
import type { BoardView, EditorProps } from "../views";

const SIZE = 25, COLS = 5;

/** The sheet to build on: tap a square to add or take off a stamp, or drag across squares to do several. */
function SheetEditor({ cells, onChange, disabled }: EditorProps) {
  const grid = React.useRef<HTMLDivElement>(null);
  const paint = React.useRef<number | null>(null);
  const setCell = (i: number, v: number) =>
    onChange((prev) => {
      if (prev[i] === v) return prev;
      const next = [...prev];
      next[i] = v;
      return next;
    });
  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    return el && el.parentElement === grid.current ? Number(el.dataset.cell) : null;
  };

  return (
    <Box
      ref={grid}
      role="group"
      aria-label="Stamp sheet"
      onPointerDown={(e) => {
        const i = cellAt(e.clientX, e.clientY);
        if (disabled || i === null) return;
        e.preventDefault();
        paint.current = cells[i] ? 0 : 1;
        setCell(i, paint.current);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (paint.current === null) return;
        const i = cellAt(e.clientX, e.clientY);
        if (i !== null) setCell(i, paint.current);
      }}
      onPointerUp={() => (paint.current = null)}
      onPointerCancel={() => (paint.current = null)}
      sx={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gap: "6px", width: "100%", maxWidth: 300, aspectRatio: "1", p: "10px", bgcolor: PAPER_2, borderRadius: "3px", touchAction: "none", userSelect: "none" }}
    >
      {cells.map((v, i) => (
        <Box
          key={i}
          component="button"
          type="button"
          data-cell={i}
          disabled={disabled}
          aria-pressed={!!v}
          aria-label={`Row ${Math.floor(i / COLS) + 1}, column ${(i % COLS) + 1}`}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            setCell(i, v ? 0 : 1);
          }}
          sx={{
            position: "relative",
            minWidth: 0,
            p: 0,
            cursor: disabled ? "default" : "pointer",
            borderRadius: "2px",
            border: v ? `1.5px solid ${POSTAL}` : `1.5px dashed ${DASH}`,
            bgcolor: v ? POSTAL : PAPER,
            "&::after": v ? { content: '""', position: "absolute", inset: "4px", border: `2px dotted ${PERF}`, borderRadius: "1px" } : undefined,
            "&:focus-visible": { outline: `2px solid ${INK}`, outlineOffset: "2px" },
          }}
        />
      ))}
    </Box>
  );
}

function SheetThumb({ cells }: { cells: Cells }) {
  return (
    <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: "1px", width: 54, aspectRatio: "1", p: "3px", bgcolor: PAPER_2, border: `1px solid ${RULE}` }}>
      {cells.map((v, i) => (
        <Box key={i} sx={{ bgcolor: v ? POSTAL : PAPER }} />
      ))}
    </Box>
  );
}

export const SHEET_VIEW: BoardView = {
  empty: () => new Array(SIZE).fill(0),
  Editor: SheetEditor,
  Thumb: SheetThumb,
  Picture: SheetPicture,
  describe: (cells) => {
    const n = cells.filter(Boolean).length;
    return `Stamp sheet with ${n} stamp${n === 1 ? "" : "s"}`;
  },
  howTo: "Tap squares to place stamps, or drag across several. Tap a stamp again to take it off.",
  submitLabel: "Submit sheet",
};
