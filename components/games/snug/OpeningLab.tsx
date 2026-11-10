"use client";

// A dev lab for the opening every board plays (`sewing.tsx`), on a sample far-future week so nothing spoils: open today,
// switch days with the arrows, slow it down, or freeze one moment.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { formatLongDate } from "../daily";
import { generatePuzzle, type Puzzle } from "./generator";
import { bounds } from "./pieces";
import { BINDING, YARNS } from "./quilt";
import { Basket } from "./basket";
import { packTray } from "./Snug";
import { OPEN_MS, SETTLE_MS, SWITCH_MS, UNSEW_MS, Sewing, boardSewStyle, pieceSewStyle, type SewDir } from "./sewing";
import { SNUG_FONTS } from "./fonts";
import { BoardSvg, Btn, FONT, INK, KnitDefs, PanelStitches, PatchSvg, QuiltBackdrop, SCRIPT, panelStyle, type PieceState } from "./parts";

/** A far-future week, Monday to Sunday, so every level shows up. */
const WEEK = ["2029-01-01", "2029-01-02", "2029-01-03", "2029-01-04", "2029-01-05", "2029-01-06", "2029-01-07"];
const PAD = 0.45;
const TRAY = 9.5;
const SCALE = 0.6;
const MAX_CELL = 44;
/** Slow motion stretches every step this many times. */
const SLOW = 4;

/** The width of whichever element the returned ref is on, re-measured when that element is replaced. */
function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

/** Where the board, the basket and its slots sit, side by side. */
function dayLayout(puzzle: Puzzle, width: number) {
  const bw = puzzle.cols + 2 * PAD;
  const bh = puzzle.rows + 2 * PAD;
  const longest = puzzle.pieces.map((p) => Math.max(bounds(p.cells).w, bounds(p.cells).h));
  const pack = packTray(longest.map((m) => m * SCALE + 0.7), TRAY);
  const cell = Math.max(14, Math.min(MAX_CELL, Math.floor(width / (bw + 1 + TRAY))));
  const height = Math.max(bh, pack.h) * cell;
  const left = Math.max(0, (width - (bw * cell + cell + TRAY * cell)) / 2);
  const boardY = (height - bh * cell) / 2;
  const trayX = left + bw * cell + cell;
  const trayY = (height - pack.h * cell) / 2;
  return {
    cell,
    height,
    boardX: left,
    boardY,
    origin: { x: left + PAD * cell, y: boardY + PAD * cell },
    tray: { x: trayX, y: trayY, w: TRAY * cell, h: pack.h * cell },
    slots: pack.slots.map((s) => ({ x: trayX + s.x * cell, y: trayY + s.y * cell, size: s.size * cell })),
  };
}

/** The day's patches, stitched into the solution when `finished`, else waiting in the basket. */
function pieceStates(puzzle: Puzzle, finished: boolean): PieceState[] {
  return puzzle.pieces.map((p) => {
    const sol = finished ? puzzle.solution[p.id] : undefined;
    return { id: p.id, cells: sol?.cells ?? p.cells, color: p.color, at: sol ? { x: sol.x, y: sol.y } : null };
  });
}

const noop = () => {};

function Header({ dateKey, level, onPrev, onNext }: { dateKey: string; level?: string; onPrev: () => void; onNext: () => void }) {
  const arrow = (label: string, text: string, onClick: () => void) => (
    <button type="button" aria-label={label} onClick={onClick} style={{ border: 0, background: "rgba(123,59,46,.1)", color: BINDING, borderRadius: 999, width: 26, height: 26, cursor: "pointer", fontSize: 16 }}>
      {text}
    </button>
  );
  return (
    <header style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: SCRIPT, fontSize: 56, lineHeight: 0.9, color: BINDING, fontWeight: 700 }}>Snug</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, marginTop: 4 }}>
        {arrow("Previous quilt", "‹", onPrev)}
        <span style={{ opacity: 0.75 }}>
          {formatLongDate(dateKey)}
          {level && <> &middot; {level}</>}
        </span>
        {arrow("Next quilt", "›", onNext)}
      </div>
    </header>
  );
}

/** One sew in or out; `n` counts them, so each starts fresh, and `next` is the day a sew out leads to. */
type Phase = { dir: SewDir; ms: number; n: number; next?: number };

export function OpeningLab() {
  const week = useMemo(() => WEEK.map((d) => generatePuzzle(d, YARNS.length)), []);
  const [ref, width] = useWidth();
  const [slow, setSlow] = useState(false);
  const pace = slow ? SLOW : 1;
  // Holds the sewing at one moment of a sew in (0 to 100), to look at a single frame.
  const [freeze, setFreeze] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase | null>({ dir: "in", ms: OPEN_MS, n: 0 });
  // Each sew in remounts the board, so its settling down and the patches' drops start over.
  const [run, setRun] = useState(0);
  const settle = useRef(0);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  const start = (p: Omit<Phase, "n">) => {
    window.clearTimeout(settle.current);
    if (p.dir === "in") setRun((n) => n + 1);
    setPhase((old) => ({ ...p, n: (old?.n ?? 0) + 1 }));
  };
  const open = () => start({ dir: "in", ms: OPEN_MS });
  const go = (step: number) => start({ dir: "out", ms: UNSEW_MS, next: (index + step + week.length) % week.length });
  const finished = () => {
    if (!phase) return;
    if (phase.dir === "out") {
      setIndex(phase.next ?? index);
      start({ dir: "in", ms: SWITCH_MS });
    } else settle.current = window.setTimeout(() => setPhase(null), SETTLE_MS * pace);
  };

  const puzzle = week[index]!;
  const l = dayLayout(puzzle, width);
  // Past days show a mix of finished quilts and fresh ones, as in the game.
  const pieces = useMemo(() => pieceStates(puzzle, index % 3 !== 2), [puzzle, index]);
  const sewing = freeze !== null ? { dir: "in" as const, ms: SWITCH_MS } : phase && { dir: phase.dir, ms: phase.ms * pace };
  // A frozen frame holds everything at rest except the sewing itself.
  const moving = freeze === null && sewing;

  return (
    <div className={SNUG_FONTS} style={{ fontFamily: FONT, color: INK, display: "grid", gap: 24 }}>
      <KnitDefs />
      <QuiltBackdrop dateKey={puzzle.dateKey} />
      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed="opening-lab" />
        <h1 style={{ fontFamily: SCRIPT, fontSize: 44, margin: 0, color: BINDING }}>Opening lab</h1>
        <p style={{ fontSize: 13.5, opacity: 0.75, margin: "4px 0 4px" }}>
          The opening the game plays. The binding and linen settle down, then the yarn&apos;s own end runs around the edge and sews the stitches in, its newest
          stitches loose and wavy until they settle taut, while the patches drop in. Opening takes {OPEN_MS / 1000} s; switching days first pulls the old stitches
          out, then takes {SWITCH_MS / 1000} s. Sample puzzles only; nothing here is a real day.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
          <Btn primary onClick={open}>
            {"▶ Open today"}
          </Btn>
          <Btn small primary={slow} onClick={() => setSlow(!slow)}>
            Slow motion
          </Btn>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={freeze !== null} onChange={(e) => setFreeze(e.target.checked ? 40 : null)} />
            Freeze at
            <input type="range" min={0} max={100} value={freeze ?? 40} disabled={freeze === null} onChange={(e) => setFreeze(Number(e.target.value))} aria-label="Freeze at" />
            {freeze !== null && `${freeze}%`}
          </label>
          <span style={{ fontSize: 13, opacity: 0.7 }}>or use the arrows on the quilt to switch days.</span>
        </div>
      </section>
      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed={`panel:${puzzle.dateKey}`} />
        <Header dateKey={puzzle.dateKey} level={puzzle.level?.name} onPrev={() => go(-1)} onNext={() => go(1)} />
        <div ref={ref} style={{ height: l.height, transition: "height 400ms ease" }}>
          {width > 0 && (
            <div key={`${index}-${run}`} style={{ position: "relative", height: l.height }}>
              <Basket style={{ left: l.tray.x - 8, top: l.tray.y - 8, width: l.tray.w + 16, height: l.tray.h + 16 }} />
              <BoardSvg
                board={puzzle.board}
                cols={puzzle.cols}
                rows={puzzle.rows}
                cell={l.cell}
                pad={PAD}
                style={{ position: "absolute", left: l.boardX, top: l.boardY, ...(moving && boardSewStyle(moving.dir, moving.ms, pace)) }}
                sewing={sewing ?? undefined}
              />
              {pieces.map((p, i) => {
                const { w, h } = bounds(p.cells);
                const slot = l.slots[i]!;
                const s = p.at ? 1 : SCALE;
                const x = p.at ? l.origin.x + p.at.x * l.cell : slot.x + (slot.size - w * l.cell * s) / 2;
                const y = p.at ? l.origin.y + p.at.y * l.cell : slot.y + (slot.size - h * l.cell * s) / 2;
                const box: CSSProperties = {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  transformOrigin: "0 0",
                  transform: `translate(${x}px, ${y}px) scale(${s})`,
                  zIndex: p.at ? 10 : 5,
                  filter: p.at ? undefined : "drop-shadow(0 2px 2px rgba(40,20,10,.35))",
                };
                return (
                  <div key={p.id} style={box}>
                    <div style={moving ? pieceSewStyle(moving.dir, i, pace) : undefined}>
                      <PatchSvg piece={p} cell={l.cell} interactive={false} onDown={noop} />
                    </div>
                  </div>
                );
              })}
              {freeze !== null ? (
                <Sewing puzzle={puzzle} cell={l.cell} pad={PAD} left={l.boardX} top={l.boardY} dir="in" ms={SWITCH_MS} onDone={noop} freeze={freeze / 100} />
              ) : (
                phase && <Sewing key={phase.n} puzzle={puzzle} cell={l.cell} pad={PAD} left={l.boardX} top={l.boardY} dir={phase.dir} ms={phase.ms * pace} onDone={finished} />
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
