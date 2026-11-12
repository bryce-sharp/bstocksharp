"use client";

// A dev lab for the animations a board plays (`sewing.tsx`), on a sample far-future week so nothing spoils: the
// opening (open today, or switch days with the arrows) and the finish, as the game plays them. Slow motion and a
// freeze slider help to look closely.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { formatLongDate } from "../daily";
import { generatePuzzle, type Puzzle } from "./generator";
import { bounds, cellKey, type Cell } from "./pieces";
import { BINDING, LINEN, YARNS } from "./quilt";
import { Basket } from "./basket";
import { packTray } from "./Snug";
import { Finishing, OPEN_MS, SETTLE_MS, SWITCH_MS, UNSEW_MS, Sewing, WIN_DELAY_MS, WIN_PULL_MS, boardSewStyle, pieceSewStyle, pullDelays, type SewDir } from "./sewing";
import { SNUG_FONTS } from "./fonts";
import { BoardSvg, Btn, FONT, INK, KnitDefs, PanelStitches, PatchSvg, QuiltBackdrop, SCRIPT, panelStyle, plural, type PieceState } from "./parts";

/** A far-future week, Monday to Sunday, so every level shows up. */
const WEEK = ["2029-01-01", "2029-01-02", "2029-01-03", "2029-01-04", "2029-01-05", "2029-01-06", "2029-01-07"];
const PAD = 0.45;
const TRAY = 9.5;
const SCALE = 0.6;
const MAX_CELL = 44;
/** Slow motion stretches every step this many times. */
const SLOW = 4;
/** A finish with holes leaves this many patches in the basket. */
const LEFT_OUT = 2;

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
    boardW: bw * cell,
    origin: { x: left + PAD * cell, y: boardY + PAD * cell },
    tray: { x: trayX, y: trayY, w: TRAY * cell, h: pack.h * cell },
    slots: pack.slots.map((s) => ({ x: trayX + s.x * cell, y: trayY + s.y * cell, size: s.size * cell })),
  };
}

/**
 * The day's patches: in the basket, or stitched into the solution when `finished`. `leaveOut` keeps that many of the
 * solution's patches in the basket, for a finish with holes.
 */
function pieceStates(puzzle: Puzzle, finished: boolean, leaveOut = 0): PieceState[] {
  const kept = new Set(Object.keys(puzzle.solution).slice(0, Math.max(0, Object.keys(puzzle.solution).length - leaveOut)));
  return puzzle.pieces.map((p) => {
    const sol = finished && kept.has(p.id) ? puzzle.solution[p.id] : undefined;
    return { id: p.id, cells: sol?.cells ?? p.cells, color: p.color, at: sol ? { x: sol.x, y: sol.y } : null };
  });
}

/** The board's squares no patch covers, top row first. */
function holesIn(puzzle: Puzzle, pieces: PieceState[]): Cell[] {
  const filled = new Set(pieces.flatMap((p) => (p.at ? p.cells.map(([x, y]) => cellKey(x + p.at!.x, y + p.at!.y)) : [])));
  return puzzle.board.filter(([x, y]) => !filled.has(cellKey(x, y))).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
      <span style={{ fontSize: 13, fontWeight: 600, minWidth: 96 }}>{label}</span>
      {children}
    </div>
  );
}

/** One sew in or out; `n` counts them, so each starts fresh, and `next` is the day a sew out leads to. */
type Phase = { dir: SewDir; ms: number; n: number; next?: number };
export function OpeningLab() {
  const week = useMemo(() => WEEK.map((d) => generatePuzzle(d, YARNS.length)), []);
  const [ref, width] = useWidth();
  const [slow, setSlow] = useState(false);
  const pace = slow ? SLOW : 1;
  // Holds the sewing or the finish at one moment (0 to 100), to look at a single frame.
  const [freeze, setFreeze] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase | null>({ dir: "in", ms: OPEN_MS, n: 0 });
  // Each sew in or finish remounts the board, so its animations start over.
  const [run, setRun] = useState(0);
  const settle = useRef(0);
  const cardTimer = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(settle.current);
      window.clearTimeout(cardTimer.current);
    },
    [],
  );
  // Whether the basket folds away at a finish, to compare with it staying.
  const [fold, setFold] = useState(true);
  const [perfectRun, setPerfectRun] = useState(true);
  // The board shown finished: `playing` while its finish runs, then it rests finished with its card.
  const [won, setWon] = useState<{ perfect: boolean; playing: boolean } | null>(null);
  const [card, setCard] = useState(false);

  const start = (p: Omit<Phase, "n">) => {
    window.clearTimeout(settle.current);
    window.clearTimeout(cardTimer.current);
    setWon(null);
    setCard(false);
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
  const finish = () => {
    window.clearTimeout(settle.current);
    window.clearTimeout(cardTimer.current);
    setPhase(null);
    setCard(false);
    setRun((n) => n + 1);
    setWon({ perfect: perfectRun, playing: true });
  };
  const finishDone = () => {
    setWon((w) => w && { ...w, playing: false });
    setCard(true);
  };

  const puzzle = week[index]!;
  const l = dayLayout(puzzle, width);
  // Past days show a mix of finished quilts and fresh ones, as in the game; a finish shows the solved board.
  const pieces = useMemo(
    () => (won ? pieceStates(puzzle, true, won.perfect ? 0 : LEFT_OUT) : pieceStates(puzzle, index % 3 !== 2)),
    [puzzle, index, won],
  );
  const holes = won ? holesIn(puzzle, pieces) : [];
  const sewing = won ? (won.playing || freeze !== null ? { dir: "win" as const, ms: 0 } : null) : freeze !== null ? { dir: "in" as const, ms: SWITCH_MS } : phase && { dir: phase.dir, ms: phase.ms * pace };
  // A frozen frame holds everything at rest except the sewing itself.
  const moving = freeze === null && !won && phase ? { dir: phase.dir, ms: phase.ms * pace } : null;
  const winDelay = WIN_DELAY_MS * pace;
  const delays = useMemo(() => pullDelays(puzzle, pieces, WIN_PULL_MS * pace), [puzzle, pieces, pace]);
  const folding = !!won && fold;
  // As in the game: the card sits where the basket was, and once it is closed the quilt slides to the middle.
  const slide = folding && !won.playing && !card ? (width - l.boardW) / 2 - l.boardX : 0;

  const patch = (p: PieceState, i: number) => {
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
    const anim: CSSProperties | undefined = moving
      ? pieceSewStyle(moving.dir, i, pace)
      : won?.playing && p.at
        ? { animation: `snugPuff ${420 * pace}ms ease-out ${winDelay + (delays[i] ?? 0)}ms both`, transformOrigin: "center" }
        : undefined;
    return (
      <div key={p.id} style={box}>
        <div style={anim}>
          <PatchSvg piece={p} cell={l.cell} interactive={false} onDown={noop} />
        </div>
      </div>
    );
  };

  return (
    <div className={SNUG_FONTS} style={{ fontFamily: FONT, color: INK, display: "grid", gap: 24 }}>
      <KnitDefs />
      <QuiltBackdrop dateKey={puzzle.dateKey} />
      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed="opening-lab" />
        <h1 style={{ fontFamily: SCRIPT, fontSize: 44, margin: 0, color: BINDING }}>Opening and win lab</h1>
        <p style={{ fontSize: 13.5, opacity: 0.75, margin: "4px 0 4px" }}>
          The opening the game plays: the yarn&apos;s own end sews the edge in while the patches drop in ({OPEN_MS / 1000} s when the game opens; switching days pulls
          the old stitches out, then takes {SWITCH_MS / 1000} s). Below it, the finish: the stitches are pulled taut (gold when perfect) as slowly as the opening, the patches puff, holes pop in one at a time, and the card comes once it is done. Sample puzzles only; nothing here is a real day.
        </p>
        <Row label="Opening">
          <Btn primary onClick={open}>
            {"▶ Open today"}
          </Btn>
          <span style={{ fontSize: 13, opacity: 0.7 }}>or use the arrows on the quilt to switch days.</span>
        </Row>
        <Row label="Finish">
          <Btn small primary={perfectRun} onClick={() => setPerfectRun(true)}>
            Perfect
          </Btn>
          <Btn small primary={!perfectRun} onClick={() => setPerfectRun(false)}>
            {`With ${LEFT_OUT} patches left out`}
          </Btn>
          <Btn primary onClick={finish}>
            {"▶ Finish"}
          </Btn>
        </Row>
        <Row label="Basket">
          <Btn small primary={fold} onClick={() => setFold(true)}>
            Folds away at a finish
          </Btn>
          <Btn small primary={!fold} onClick={() => setFold(false)}>
            Stays
          </Btn>
        </Row>
        <Row label="Look closely">
          <Btn small primary={slow} onClick={() => setSlow(!slow)}>
            Slow motion
          </Btn>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={freeze !== null} onChange={(e) => setFreeze(e.target.checked ? 40 : null)} />
            Freeze at
            <input type="range" min={0} max={100} value={freeze ?? 40} disabled={freeze === null} onChange={(e) => setFreeze(Number(e.target.value))} aria-label="Freeze at" />
            {freeze !== null && `${freeze}%`}
          </label>
        </Row>
      </section>
      <section style={{ ...panelStyle, width: "100%" }}>
        <PanelStitches seed={`panel:${puzzle.dateKey}`} />
        <Header dateKey={puzzle.dateKey} level={puzzle.level?.name} onPrev={() => go(-1)} onNext={() => go(1)} />
        <div ref={ref} style={{ height: l.height, transition: "height 400ms ease" }}>
          {width > 0 && (
            <div key={`${index}-${run}`} style={{ position: "relative", height: l.height }}>
              <Basket
                style={{
                  left: l.tray.x - 8,
                  top: l.tray.y - 8,
                  width: l.tray.w + 16,
                  height: l.tray.h + 16,
                  animation: folding ? `snugFoldAway ${450 * pace}ms ease-in forwards` : undefined,
                }}
              />
              <div style={{ position: "absolute", inset: 0, animation: folding ? `snugFoldAway ${450 * pace}ms ease-in forwards` : undefined }}>
                {pieces.map((p, i) => (p.at ? null : patch(p, i)))}
              </div>
              {/* The quilt itself: on a finish with the basket folding away, it slides to the middle. */}
              <div style={{ position: "absolute", inset: 0, transform: `translateX(${slide}px)`, transition: `transform ${520 * pace}ms cubic-bezier(.3, .8, .3, 1)` }}>
                <BoardSvg
                  board={puzzle.board}
                  cols={puzzle.cols}
                  rows={puzzle.rows}
                  cell={l.cell}
                  pad={PAD}
                  style={{ position: "absolute", left: l.boardX, top: l.boardY, ...(moving && boardSewStyle(moving.dir, moving.ms, pace)) }}
                  sewing={sewing ?? undefined}
                  perfect={!!won?.perfect}
                  holes={holes}
                  holesStagger={won?.playing ? { start: winDelay, every: 90 * pace } : undefined}
                />
                {pieces.map((p, i) => (p.at ? patch(p, i) : null))}
                {won ? (
                  (won.playing || freeze !== null) && (
                    <Finishing
                      puzzle={puzzle}
                      cell={l.cell}
                      pad={PAD}
                      left={l.boardX}
                      top={l.boardY}
                      perfect={won.perfect}
                      delay={winDelay}
                      pullMs={WIN_PULL_MS * pace}
                      onDone={finishDone}
                      freeze={freeze !== null ? freeze / 100 : undefined}
                    />
                  )
                ) : freeze !== null ? (
                  <Sewing puzzle={puzzle} cell={l.cell} pad={PAD} left={l.boardX} top={l.boardY} dir="in" ms={SWITCH_MS} onDone={noop} freeze={freeze / 100} />
                ) : (
                  phase && <Sewing key={phase.n} puzzle={puzzle} cell={l.cell} pad={PAD} left={l.boardX} top={l.boardY} dir={phase.dir} ms={phase.ms * pace} onDone={finished} />
                )}
              </div>
              {won && card && (
                // A stand-in for the result card, to show when it arrives.
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 60,
                    width: Math.min(300, width * 0.4),
                    padding: "22px 18px",
                    textAlign: "center",
                    borderRadius: 18,
                    background: LINEN,
                    boxShadow: "0 18px 40px rgba(30,15,8,.45)",
                    animation: "snugPopIn 260ms ease-out both",
                  }}
                >
                  <PanelStitches seed="lab-card" />
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setCard(false)}
                    style={{ position: "absolute", top: 8, right: 10, border: 0, background: "none", fontSize: 20, color: BINDING, cursor: "pointer" }}
                  >
                    ×
                  </button>
                  <div style={{ fontFamily: SCRIPT, fontSize: 34, color: won.perfect ? "#2f8a7e" : BINDING, fontWeight: 700 }}>
                    {won.perfect ? "Perfectly snug!" : `${plural(holes.length, "hole")} left`}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>The result card arrives here.</div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
