"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import GlobalStyles from "@mui/material/GlobalStyles";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { formatShortDate } from "../daily";
import { BOARD_IDS, BOARDS, findRegulation } from "./boards";
import { itemKey, type BoardId, type Puzzle } from "./engine";
import { DISPLAY, RTS_FONTS, TYPE } from "./fonts";
import { APPROVED, DASH, DESK, INK, MUTED, ON_DARK, ON_DARK_MUTED, RETURNED } from "./palette";
import { DocCard, Kicker, PaperPanel, STAMP_KEYFRAMES, Stamp, Tag } from "./parts";
import { checkPuzzle, createPuzzle, inspectionBag } from "./puzzle";
import type { MonthFile } from "./schedule";
import { VIEWS } from "./views";

const BAGS = 3;
const field = {
  minWidth: 180,
  "& .MuiInputBase-root": { color: ON_DARK, fontFamily: TYPE },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: ON_DARK_MUTED },
  "& .MuiInputLabel-root, & .MuiInputLabel-root.Mui-focused": { color: ON_DARK_MUTED },
  "& .MuiSvgIcon-root": { color: ON_DARK },
} as const;

/** A testing page: any regulation with any seed, or any scheduled day, with its examples, inspection bags and checks. */
export function Lab({ months }: { months: MonthFile[] }) {
  const [board, setBoard] = React.useState<BoardId>(BOARD_IDS[0]!);
  const [regulation, setRegulation] = React.useState(BOARDS[BOARD_IDS[0]!].regulations[0]!.id);
  const [seed, setSeed] = React.useState(1);
  const [dateKey, setDateKey] = React.useState("");
  const days = months.flatMap((m) => m.days);
  const scheduled = dateKey ? (days.find((d) => d.dateKey === dateKey)?.puzzles[board] ?? null) : null;
  const sample = React.useMemo(() => createPuzzle(`lab:${regulation}:${seed}`, [{ board, regulation }]), [board, regulation, seed]);
  const puzzle = scheduled ?? sample;

  return (
    <Box className={RTS_FONTS} sx={{ bgcolor: DESK, color: ON_DARK, borderRadius: "10px", p: { xs: 1.5, sm: 2.5, md: 3 }, display: "grid", gap: 2.5 }}>
      <GlobalStyles styles={STAMP_KEYFRAMES} />
      <Box component="h1" sx={{ m: 0, fontFamily: DISPLAY, fontWeight: 700, textTransform: "uppercase", fontSize: { xs: 32, sm: 44 }, lineHeight: 1 }}>
        Return to Sender lab
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
        <TextField
          select
          size="small"
          label="Board"
          value={board}
          onChange={(e) => {
            const next = e.target.value as BoardId;
            setBoard(next);
            setRegulation(BOARDS[next].regulations[0]!.id);
          }}
          sx={field}
        >
          {BOARD_IDS.map((b) => (
            <MenuItem key={b} value={b}>
              {BOARDS[b].name}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Scheduled day" value={dateKey} onChange={(e) => setDateKey(e.target.value)} sx={field}>
          <MenuItem value="">Any regulation and seed</MenuItem>
          {days.map((d) => (
            <MenuItem key={d.dateKey} value={d.dateKey}>
              {formatShortDate(d.dateKey)} · {d.puzzles[board]?.parts[0]?.regulation ?? "none"}
            </MenuItem>
          ))}
        </TextField>
        {!dateKey && (
          <>
            <TextField select size="small" label="Regulation" value={regulation} onChange={(e) => setRegulation(e.target.value)} sx={{ ...field, minWidth: 260 }}>
              {BOARDS[board].regulations.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.id}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ fontFamily: TYPE, fontSize: 13, color: ON_DARK_MUTED }}>Seed {seed}</Box>
            <Button onClick={() => setSeed((s) => s + 1)} sx={{ color: ON_DARK, border: `1px solid ${ON_DARK_MUTED}`, textTransform: "none" }}>
              Next seed
            </Button>
          </>
        )}
      </Box>
      {puzzle ? (
        <PuzzleDetail puzzle={puzzle} />
      ) : (
        <Box component="p" sx={{ m: 0, fontFamily: TYPE, color: ON_DARK_MUTED }}>
          {dateKey ? "That day has no puzzle for this board." : "This seed could not make examples; try the next seed."}
        </Box>
      )}
    </Box>
  );
}

function PuzzleDetail({ puzzle }: { puzzle: Puzzle }) {
  const problems = React.useMemo(() => checkPuzzle(puzzle, BAGS), [puzzle]);
  const bags = React.useMemo(() => {
    const exclude = puzzle.examples.map(itemKey);
    return Array.from({ length: BAGS }, (_, attempt) => inspectionBag(puzzle, attempt, exclude));
  }, [puzzle]);

  return (
    <PaperPanel>
      <Box sx={{ display: "grid", gap: 3, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "grid", gap: 0.75 }}>
          {puzzle.parts.map((part) => (
            <Box key={part.board} sx={{ display: "grid", gap: 0.5 }}>
              <Kicker>
                {BOARDS[part.board].name} · {part.regulation}
              </Kicker>
              <Box component="p" sx={{ m: 0, fontFamily: TYPE, fontWeight: 700, fontSize: 18 }}>
                {findRegulation(part)?.regulation.text ?? "Unknown regulation"}
              </Box>
            </Box>
          ))}
          <Box component="p" sx={{ m: 0, fontFamily: TYPE, fontSize: 12, color: MUTED, overflowWrap: "anywhere" }}>
            Seed {puzzle.seed}
          </Box>
          <Box component="p" sx={{ m: 0, fontWeight: 600, color: problems.length ? RETURNED : APPROVED }}>
            {problems.length ? `${problems.length} problems: ${problems.join("; ")}` : `Every check passes over ${BAGS} inspection bags.`}
          </Box>
        </Box>

        <Section title="Opening examples">
          {puzzle.examples.map((e) => (
            <DocCard key={itemKey(e)} label={`${VIEWS[e.board].describe(e.cells)}. ${e.follows ? "Approved" : "Returned"}.`}>
              {React.createElement(VIEWS[e.board].Thumb, { cells: e.cells })}
              <Stamp ok={e.follows} />
              <Tag>Example</Tag>
            </DocCard>
          ))}
        </Section>

        {bags.map((bag, n) => (
          <Section key={n} title={`Inspection bag ${n + 1} · ${bag.filter((b) => b.truth).length} of ${bag.length} approved`}>
            {bag.map((item) => (
              <DocCard key={itemKey(item)} label={`${VIEWS[item.board].describe(item.cells)}. ${item.truth ? "Approved" : "Returned"}.`}>
                {React.createElement(VIEWS[item.board].Thumb, { cells: item.cells })}
                <Stamp ok={item.truth} />
              </DocCard>
            ))}
          </Section>
        ))}
      </Box>
    </PaperPanel>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 1.25 }}>
      <Box component="h2" sx={{ m: 0, fontFamily: TYPE, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase", color: INK, borderBottom: `1px dashed ${DASH}`, pb: 0.75 }}>
        {title}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 1 }}>{children}</Box>
    </Box>
  );
}
