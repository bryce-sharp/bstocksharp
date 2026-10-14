"use client";

// Month quilt lab: generates any outline on demand (on a sample month, never a real one) and shows the month as one
// quilt, every day's board as a player sees it, today's generator to compare, shape numbers, and the reveal.

import { useEffect, useMemo, useState } from "react";
import { generatePuzzle, type Puzzle } from "./generator";
import { addDays, weekday } from "../daily";
import { BINDING, YARNS } from "./quilt";
import { BoardSvg, Btn, FONT, INK, KnitDefs, QuiltBackdrop, SCRIPT, panelStyle, PanelStitches } from "./parts";
import { SNUG_FONTS } from "./fonts";
import { generateOutlineMonth, outlineFor, type Outline } from "./outline";
import { boardStats, type BoardStats } from "./boardStats";
import { MonthQuiltView, type QuiltDay } from "./monthQuilt";

const OUTLINES: Outline[] = [
  "pumpkin", "tree", "heart", "ghost", "star", "snowflake", "mitten", "shamrock", "egg", "flower", "sun", "watermelon", "apple", "leaf",
  "quilt", "hexagon", "diamond", "plus", "house", "octagon", "bowtie",
];
/** A month before launch: its quilts can never be played, so the lab spoils nothing. */
const SAMPLE_MONTH = "2025-03";

type LabDay = { dateKey: string; level: { name: string; pieces: number; spares: number }; puzzle: Puzzle; offset: { x: number; y: number } };
type LabMonth = { monthKey: string; minX: number; minY: number; width: number; height: number; squares: number; ms: number; days: LabDay[] };
type StatRow = Record<keyof BoardStats, number>;

function average(stats: BoardStats[]): StatRow {
  const keys = ["squares", "fill", "longestEdge", "straightShare", "turnsPer10"] as const;
  return Object.fromEntries(keys.map((k) => [k, +(stats.reduce((n, s) => n + s[k], 0) / stats.length).toFixed(2)])) as StatRow;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function MonthLab() {
  const [outline, setOutline] = useState<Outline>(() => outlineFor("2026-10"));
  const [reroll, setReroll] = useState(0);
  const [month, setMonth] = useState<LabMonth | null>(null);
  const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [assembled, setAssembled] = useState(true);
  const classic = useMemo(() => {
    const out: BoardStats[] = [];
    for (let k = "2029-01-01"; k < "2029-03-01"; k = addDays(k, 1)) out.push(boardStats(generatePuzzle(k, YARNS.length).board));
    return average(out);
  }, []);

  // Generating takes a few seconds, so the busy note paints first.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const started = performance.now();
      for (let seed = 0; ; seed++) {
        try {
          const q = generateOutlineMonth(SAMPLE_MONTH, outline, YARNS.length, `lab-${reroll}-${seed}`);
          setMonth({ monthKey: SAMPLE_MONTH, minX: q.minX, minY: q.minY, width: q.width, height: q.height, squares: q.squares, ms: performance.now() - started, days: q.days });
          break;
        } catch {
          // Try the next seed.
        }
      }
      setBusy(false);
    }, 30);
    return () => window.clearTimeout(t);
  }, [outline, reroll]);
  const stats = useMemo(() => (month ? average(month.days.map((d) => boardStats(d.puzzle.board))) : null), [month]);
  const pick = (next: () => void) => {
    setBusy(true);
    setSelected(null);
    next();
  };

  return (
    <div className={SNUG_FONTS} style={{ fontFamily: FONT, color: INK, display: "grid", gap: 24 }}>
      <QuiltBackdrop dateKey="2026-09-15" />
      <KnitDefs />
      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed="lab-head" />
        <h1 style={{ fontFamily: SCRIPT, fontSize: 44, margin: 0, color: BINDING }}>Month quilt lab</h1>
        <p style={{ fontSize: 14, opacity: 0.8, margin: "6px 0 14px" }}>
          Each month starts from a drawn outline, is cut into wavy-edged days, and every day is filled exactly with patches. Pick an outline to sew a sample month; these are never the real puzzles.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {OUTLINES.map((o) => (
            <Btn key={o} small primary={o === outline} onClick={() => pick(() => setOutline(o))}>
              {o}
            </Btn>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
          <Btn small onClick={() => pick(() => setReroll((n) => n + 1))}>Make another</Btn>
          <Btn small onClick={() => setAssembled((a) => !a)}>{assembled ? "Scatter to calendar" : "Play the reveal"}</Btn>
          <span style={{ fontSize: 13, opacity: 0.75 }}>
            {busy
              ? "Sewing a month…"
              : month && `${month.days.length} days · ${month.squares} squares · ${month.width} by ${month.height} · made in ${(month.ms / 1000).toFixed(1)}s`}
          </span>
        </div>
        {month && (
          <div style={{ marginTop: 16 }}>
            <MonthQuiltView
              monthKey={month.monthKey}
              days={month.days.map(solvedDay)}
              shape={{ ...month, outline }}
              assembled={assembled}
              maxWidth={1000}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        )}
      </section>

      {stats && (
        <section style={{ ...panelStyle, width: "100%" }}>
          <PanelStitches seed="lab-stats" />
          <h2 style={{ fontFamily: SCRIPT, fontSize: 36, margin: 0, color: BINDING }}>How organic are the boards?</h2>
          <p style={{ fontSize: 14, opacity: 0.8, margin: "6px 0 14px" }}>Averages over this month&apos;s days, against two months of today&apos;s generator.</p>
          <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                {["", "Squares", "Filled", "Longest straight edge", "Edge in long straight runs", "Corners per 10 edge squares"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 12px 4px 0", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([["This month's days", stats], ["Today's boards", classic]] as const).map(([label, row]) => (
                <tr key={label}>
                  <td style={{ padding: "4px 12px 4px 0", fontWeight: 600 }}>{label}</td>
                  <td>{row.squares}</td>
                  <td>{Math.round(row.fill * 100)}%</td>
                  <td>{row.longestEdge}</td>
                  <td>{Math.round(row.straightShare * 100)}%</td>
                  <td>{row.turnsPer10}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {month && (
        <section style={{ ...panelStyle, width: "100%" }}>
          <PanelStitches seed="lab-days" />
          <h2 style={{ fontFamily: SCRIPT, fontSize: 36, margin: 0, color: BINDING }}>Every day, as a player sees it</h2>
          <p style={{ fontSize: 14, opacity: 0.8, margin: "6px 0 14px" }}>Tap one to find it in the quilt.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
            {month.days.map((d) => (
              <button
                key={d.dateKey}
                type="button"
                onClick={() => setSelected(d.dateKey === selected ? null : d.dateKey)}
                style={{
                  display: "grid",
                  justifyItems: "center",
                  gap: 4,
                  padding: 10,
                  borderRadius: 12,
                  border: `2px solid ${d.dateKey === selected ? BINDING : "transparent"}`,
                  background: "rgba(123,59,46,.06)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: INK,
                }}
              >
                <BoardSvg board={d.puzzle.board} cols={d.puzzle.cols} rows={d.puzzle.rows} cell={13} pad={0.45} />
                <span style={{ fontSize: 12 }}>
                  {Number(d.dateKey.slice(8))} &middot; {d.level.name} &middot; {d.puzzle.board.length} sq
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <ClassicBoards />
    </div>
  );
}

/** A lab day as a player who finished it perfectly: the known solution laid on the board. */
function solvedDay(d: LabDay): QuiltDay {
  const pieces = Object.entries(d.puzzle.solution).map(([id, s]) => ({ id, cells: s.cells, color: d.puzzle.pieces.find((p) => p.id === id)!.color, at: { x: s.x, y: s.y } }));
  return { dateKey: d.dateKey, puzzle: d.puzzle, offset: d.offset, pieces, scoredGaps: 0 };
}

/** Today's generator, one week of far-future dates, to compare board shapes by weekday. */
function ClassicBoards() {
  const week = useMemo(() => {
    const out: Puzzle[] = [];
    for (let k = "2029-01-01", n = 0; n < 7; k = addDays(k, 1), n++) out.push(generatePuzzle(k, YARNS.length));
    return out;
  }, []);
  return (
    <section style={{ ...panelStyle, width: "100%" }}>
      <PanelStitches seed="lab-classic" />
      <h2 style={{ fontFamily: SCRIPT, fontSize: 36, margin: 0, color: BINDING }}>Today&apos;s generator, for comparison</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14, marginTop: 14 }}>
        {week.map((p) => (
          <div key={p.dateKey} style={{ display: "grid", justifyItems: "center", gap: 4, padding: 10, borderRadius: 12, background: "rgba(123,59,46,.06)" }}>
            <BoardSvg board={p.board} cols={p.cols} rows={p.rows} cell={13} pad={0.45} />
            <span style={{ fontSize: 12 }}>
              {WEEKDAY_NAMES[weekday(p.dateKey)]} &middot; {p.level?.name} &middot; {p.board.length} sq
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
