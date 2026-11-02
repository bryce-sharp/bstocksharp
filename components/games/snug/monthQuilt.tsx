// The month as one quilt: each day you finished drawn in its place with your own patches, and, once the month is
// done, the days you missed as plain linen so the outline shows. Also the month's score, its reveal and its picture.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Puzzle } from "./generator";
import { addDays, loadAttempt, weekday } from "../daily";
import { cellKey, outlineLoops, outlinePath, type Cell } from "./pieces";
import { insetCellLoops } from "./stitches";
import { BINDING, LINEN, YARNS } from "./quilt";
import { Btn, FONT, RED_THREAD, SCRIPT, StitchedModal, type Attempt, type PieceState } from "./parts";
import { GAME, loadBest } from "./records";
import { lastDayOf, loadMonth, type MonthDays, type MonthShape } from "./puzzles";
import { canvasFile, canvasFonts } from "./share";

export interface QuiltDay {
  dateKey: string;
  puzzle: Puzzle;
  offset: { x: number; y: number };
  /** The quilt to draw: the scored run, else the best later run; absent when the day was never finished. */
  pieces?: PieceState[];
  scoredGaps?: number;
  bestGaps?: number;
  /** Finished only after its day: drawn with the later thread. */
  late?: boolean;
}

/** The month's served days with this browser's runs for each. */
export function quiltDays(month: MonthDays): QuiltDay[] {
  return month.days.map((d) => {
    const scored = loadAttempt<Attempt>(GAME, d.dateKey);
    const best = loadBest(d.dateKey);
    // A day bettered after its date shows the better run, stitched as finished later; the scored run keeps the on-the-day count.
    const improved = !!best && (!scored || best.gaps < scored.gaps);
    return { ...d, pieces: (improved ? best : scored)?.pieces, scoredGaps: scored?.gaps, bestGaps: best?.gaps, late: improved };
  });
}

export interface MonthScore {
  squares: number;
  onTheDay: number;
  later: number;
  missed: number;
  perfectDays: number;
  daysPlayed: number;
  days: number;
}

/** Squares filled on the day (scored runs), filled later (practice beyond the scored run), and missed. */
export function monthScore(days: QuiltDay[]): MonthScore {
  let squares = 0;
  let onTheDay = 0;
  let later = 0;
  let perfectDays = 0;
  let daysPlayed = 0;
  for (const d of days) {
    const size = d.puzzle.board.length;
    squares += size;
    const scored = d.scoredGaps === undefined ? 0 : size - d.scoredGaps;
    const best = d.bestGaps === undefined ? 0 : size - d.bestGaps;
    onTheDay += scored;
    later += Math.max(0, best - scored);
    if (d.scoredGaps === 0) perfectDays++;
    if (d.scoredGaps !== undefined || d.bestGaps !== undefined) daysPlayed++;
  }
  return { squares, onTheDay, later, missed: squares - onTheDay - later, perfectDays, daysPlayed, days: days.length };
}

const placed = (pieces: PieceState[] | undefined) => (pieces ?? []).filter((p) => p.at && !p.loose);
const MISSED_FILL = "#efe3cc";
/** The thread a day finished after its date is stitched with: a pale running stitch just inside its edge. */
export const LATE_THREAD = "#fbf3df";
const LATE_INSET = 0.3;
/** Deeper than the parts' bright GOLD_THREAD, so a perfect month's outline reads on linen. */
const QUILT_GOLD = "#c79a2e";
export const GOLD_TEXT = "#a67a12";

const insetPath = (cells: readonly Cell[], d: number) =>
  insetCellLoops(cells, 1, d)
    .map((loop) => `M${loop.map(([x, y]) => `${x} ${y}`).join("L")}Z`)
    .join("");

/** The first day with squares still to stitch: missed, or tied off with holes. */
export const firstUnfinished = (days: QuiltDay[]) => days.find((d) => !d.pieces || (d.bestGaps ?? d.scoredGaps ?? 0) > 0);

/** "a pumpkin", "an apple": the month's picture, named. */
export const pictureName = (outline: string) => `${/^[aeiou]/.test(outline) ? "an" : "a"} ${outline}`;

/** How a finished month ends: every square on its day, every square by now, or squares still to stitch. */
export type MonthEnding = "perfect" | "complete" | "unfinished";
export const monthEnding = (score: MonthScore): MonthEnding =>
  score.onTheDay === score.squares ? "perfect" : score.missed === 0 ? "complete" : "unfinished";

/** One day drawn on its own board: your patches, small crosses on holes, plain linen when missed. */
function DayDrawing({ day }: { day: QuiltDay }) {
  const p = day.puzzle;
  const late = day.late && day.pieces;
  const filled = new Set<string>();
  for (const pc of placed(day.pieces)) for (const [x, y] of pc.cells) filled.add(cellKey(x + pc.at!.x, y + pc.at!.y));
  const holes = day.pieces ? p.board.filter(([x, y]) => !filled.has(cellKey(x, y))) : [];
  return (
    <>
      <path d={outlinePath(p.board, 1)} fill={day.pieces ? LINEN : MISSED_FILL} />
      {placed(day.pieces).map((pc) => (
        <path
          key={pc.id}
          d={outlinePath(pc.cells.map(([x, y]) => [x + pc.at!.x, y + pc.at!.y] as Cell), 1)}
          fill={YARNS[pc.color]!.base}
          stroke={YARNS[pc.color]!.dark}
          strokeWidth={0.07}
          strokeLinejoin="round"
        />
      ))}
      {holes.map(([x, y]) => (
        <path key={`h${x},${y}`} d={`M${x + 0.3} ${y + 0.3}L${x + 0.7} ${y + 0.7}M${x + 0.7} ${y + 0.3}L${x + 0.3} ${y + 0.7}`} stroke={RED_THREAD} strokeWidth={0.09} strokeLinecap="round" />
      ))}
      <path
        d={outlinePath(p.board, 1)}
        fill="none"
        stroke={BINDING}
        strokeWidth={day.pieces ? 0.22 : 0.12}
        strokeDasharray={day.pieces ? undefined : "0.35 0.25"}
        strokeLinejoin="round"
      />
      {late && (
        <path d={insetPath(p.board, LATE_INSET)} fill="none" stroke={LATE_THREAD} strokeWidth={0.16} strokeDasharray="0.34 0.26" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </>
  );
}

/**
 * The month quilt. With `shape` (a finished month) every day shows, missed days as linen; without it only finished
 * days show, so the outline stays a surprise. Unassembled, the days sit in their calendar squares; setting
 * `assembled` flies them into the quilt. `onSelect` makes days tappable, dimming all but the `selected` one.
 * `missedHidden` keeps missed days invisible (they fade in when it turns off), and `border` stitches the month's
 * outline around the assembled quilt; `gold` then turns it gold, for a perfect month.
 */
export function MonthQuiltView({
  monthKey,
  days,
  shape,
  assembled,
  maxWidth,
  selected,
  onSelect,
  missedHidden,
  hiddenDay,
  border,
}: {
  monthKey: string;
  days: QuiltDay[];
  shape?: MonthShape;
  assembled: boolean;
  maxWidth: number;
  selected?: string | null;
  onSelect?: (dateKey: string | null) => void;
  missedHidden?: boolean;
  /** A day kept out of sight, to fade it in. */
  hiddenDay?: string | null;
  border?: { drawn: boolean; gold?: boolean };
}) {
  const shown = shape ? days : days.filter((d) => d.pieces);
  // The modal's padding and stitched edge take about 72px of a narrow screen; measured before the first paint so the
  // days never start out flying from a wider layout.
  const fit = () => Math.min(maxWidth, window.innerWidth - 72);
  const [width, setWidth] = useState(fit);
  useEffect(() => {
    const measure = () => setWidth(Math.min(maxWidth, window.innerWidth - 72));
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [maxWidth]);
  if (!shown.length) return null;

  // The quilt's box: the whole month's once it is done, else just the finished days.
  const box =
    shape ??
    (() => {
      const xs = shown.flatMap((d) => [d.offset.x, d.offset.x + d.puzzle.cols]);
      const ys = shown.flatMap((d) => [d.offset.y, d.offset.y + d.puzzle.rows]);
      return { minX: Math.min(...xs), minY: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    })();
  const cell = Math.max(4, Math.min(16, Math.floor(width / Math.max(box.width, 1))));
  const quiltW = box.width * cell;
  const quiltH = box.height * cell;
  const firstDay = weekday(`${monthKey}-01`);
  const slot = Math.floor(Math.max(quiltW, Math.min(width, 7 * 8 * cell)) / 7);
  const weeks = Math.ceil((firstDay + days.length) / 7);
  const outerW = Math.max(quiltW, 7 * slot);
  const monthOutline =
    border && shape ? outlinePath(days.flatMap((d) => d.puzzle.board.map(([x, y]) => [x + d.offset.x - box.minX, y + d.offset.y - box.minY] as Cell)), 1) : null;

  return (
    <div style={{ position: "relative", width: outerW, height: assembled ? quiltH : weeks * slot, margin: "0 auto", transition: "height 900ms ease" }}>
      {shown.map((d) => {
        const p = d.puzzle;
        const index = days.indexOf(d);
        const n = firstDay + index;
        const scale = (slot * 0.84) / (Math.max(p.cols, p.rows) * cell);
        const home = [(d.offset.x - box.minX) * cell + (outerW - quiltW) / 2, (d.offset.y - box.minY) * cell];
        const cal = [(n % 7) * slot + (slot - p.cols * cell * scale) / 2, Math.floor(n / 7) * slot + (slot - p.rows * cell * scale) / 2];
        const [x, y, s] = assembled ? [home[0]!, home[1]!, 1] : [cal[0]!, cal[1]!, scale];
        return (
          <svg
            key={d.dateKey}
            width={p.cols * cell}
            height={p.rows * cell}
            viewBox={`0 0 ${p.cols} ${p.rows}`}
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              overflow: "visible",
              pointerEvents: "none",
              transformOrigin: "0 0",
              transform: `translate(${x}px, ${y}px) scale(${s})`,
              transition: `transform 1100ms cubic-bezier(.3,.9,.3,1) ${assembled ? index * 40 : 0}ms, opacity ${(missedHidden === false && !d.pieces) || hiddenDay !== undefined ? "900ms" : "300ms"}`,
              opacity: (!d.pieces && missedHidden) || d.dateKey === hiddenDay ? 0 : selected && selected !== d.dateKey ? 0.35 : 1,
            }}
          >
            {onSelect ? (
              // Days' boxes overlap, so only a day's own squares take taps, not the empty corners of its box.
              <g onClick={() => onSelect(selected === d.dateKey ? null : d.dateKey)} style={{ pointerEvents: "visiblePainted", cursor: "pointer" }}>
                <DayDrawing day={d} />
              </g>
            ) : (
              <DayDrawing day={d} />
            )}
            <text
              x={p.cols / 2}
              y={p.rows / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={2.2 / scale}
              fill={LINEN}
              stroke={BINDING}
              strokeWidth={0.45 / scale}
              paintOrder="stroke"
              fontFamily={FONT}
              fontWeight={600}
              style={{ opacity: assembled ? 0 : 1, transition: "opacity 400ms ease" }}
            >
              {Number(d.dateKey.slice(8))}
            </text>
          </svg>
        );
      })}
      {monthOutline && border && (
        <svg
          width={quiltW}
          height={quiltH}
          viewBox={`0 0 ${box.width} ${box.height}`}
          aria-hidden
          style={{ position: "absolute", left: (outerW - quiltW) / 2, top: 0, overflow: "visible", pointerEvents: "none", opacity: assembled ? 1 : 0 }}
        >
          <path
            d={monthOutline}
            fill="none"
            stroke={QUILT_GOLD}
            strokeWidth={0.9}
            strokeLinejoin="round"
            style={{ opacity: border.gold ? 0.45 : 0, transition: "opacity 900ms ease" }}
          />
          <path
            d={monthOutline}
            pathLength={1}
            fill="none"
            stroke={border.gold ? QUILT_GOLD : BINDING}
            strokeWidth={border.gold ? 0.42 : 0.34}
            strokeLinejoin="round"
            strokeDasharray="1 1"
            style={{ strokeDashoffset: border.drawn ? 0 : 1, transition: "stroke-dashoffset 2200ms ease-in-out, stroke 900ms ease, stroke-width 900ms ease" }}
          />
        </svg>
      )}
    </div>
  );
}

export const monthName = (monthKey: string) =>
  new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

/** A picture of the finished month quilt with its score, for sharing; 1080 by 1350, like a phone photo. */
export function drawMonthPicture(monthKey: string, days: QuiltDay[], shape: MonthShape, score: MonthScore, fonts: { script: string; body: string }): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = LINEN;
  ctx.fillRect(0, 0, W, H);

  // A stitched border, like the game's panels.
  ctx.strokeStyle = "#a35a42";
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 14]);
  ctx.strokeRect(34, 34, W - 68, H - 68);
  ctx.setLineDash([]);

  ctx.fillStyle = BINDING;
  ctx.textAlign = "center";
  ctx.font = `700 96px ${fonts.script}`;
  ctx.fillText("Snug", W / 2, 150);
  ctx.font = `500 40px ${fonts.body}`;
  ctx.fillText(`${monthName(monthKey)} · my ${shape.outline}`, W / 2, 210);
  const perfect = monthEnding(score) === "perfect";

  const area = { x: 90, y: 260, w: W - 180, h: 860 };
  const cell = Math.floor(Math.min(area.w / shape.width, area.h / shape.height));
  const ox = area.x + (area.w - shape.width * cell) / 2 - shape.minX * cell;
  const oy = area.y + (area.h - shape.height * cell) / 2 - shape.minY * cell;
  const trace = (cells: readonly Cell[], dx: number, dy: number) => {
    ctx.beginPath();
    for (const loop of outlineLoops(cells)) {
      loop.forEach(([x, y], i) => (i ? ctx.lineTo(ox + (x + dx) * cell, oy + (y + dy) * cell) : ctx.moveTo(ox + (x + dx) * cell, oy + (y + dy) * cell)));
      ctx.closePath();
    }
  };
  for (const d of days) {
    const { x: dx, y: dy } = d.offset;
    trace(d.puzzle.board, dx, dy);
    ctx.fillStyle = d.pieces ? LINEN : MISSED_FILL;
    ctx.fill();
    const filled = new Set<string>();
    for (const pc of placed(d.pieces)) {
      for (const [x, y] of pc.cells) filled.add(cellKey(x + pc.at!.x, y + pc.at!.y));
      trace(
        pc.cells.map(([x, y]) => [x + pc.at!.x, y + pc.at!.y] as Cell),
        dx,
        dy,
      );
      ctx.fillStyle = YARNS[pc.color]!.base;
      ctx.fill();
      ctx.strokeStyle = YARNS[pc.color]!.dark;
      ctx.lineWidth = Math.max(1, cell * 0.07);
      ctx.stroke();
    }
    if (d.pieces) {
      ctx.strokeStyle = RED_THREAD;
      ctx.lineWidth = Math.max(1, cell * 0.09);
      for (const [x, y] of d.puzzle.board) {
        if (filled.has(cellKey(x, y))) continue;
        const [px, py] = [ox + (x + dx) * cell, oy + (y + dy) * cell];
        ctx.beginPath();
        ctx.moveTo(px + cell * 0.3, py + cell * 0.3);
        ctx.lineTo(px + cell * 0.7, py + cell * 0.7);
        ctx.moveTo(px + cell * 0.7, py + cell * 0.3);
        ctx.lineTo(px + cell * 0.3, py + cell * 0.7);
        ctx.stroke();
      }
    }
    trace(d.puzzle.board, dx, dy);
    ctx.strokeStyle = BINDING;
    ctx.lineWidth = Math.max(1.5, cell * (d.pieces ? 0.22 : 0.1));
    ctx.setLineDash(d.pieces ? [] : [cell * 0.35, cell * 0.25]);
    ctx.stroke();
    if (d.late && d.pieces) {
      ctx.beginPath();
      for (const loop of insetCellLoops(d.puzzle.board, 1, LATE_INSET)) {
        loop.forEach(([x, y], i) => (i ? ctx.lineTo(ox + (x + dx) * cell, oy + (y + dy) * cell) : ctx.moveTo(ox + (x + dx) * cell, oy + (y + dy) * cell)));
        ctx.closePath();
      }
      ctx.strokeStyle = LATE_THREAD;
      ctx.lineWidth = Math.max(1, cell * 0.16);
      ctx.lineCap = "round";
      ctx.setLineDash([cell * 0.34, cell * 0.26]);
      ctx.stroke();
      ctx.lineCap = "butt";
    }
    ctx.setLineDash([]);
  }
  // The month's outline around it all, gold for a perfect month.
  trace(days.flatMap((d) => d.puzzle.board.map(([x, y]) => [x + d.offset.x, y + d.offset.y] as Cell)), 0, 0);
  ctx.lineJoin = "round";
  if (perfect) {
    ctx.strokeStyle = "rgba(199,154,46,0.45)";
    ctx.lineWidth = cell * 0.9;
    ctx.stroke();
  }
  ctx.strokeStyle = perfect ? QUILT_GOLD : BINDING;
  ctx.lineWidth = Math.max(2, cell * (perfect ? 0.42 : 0.34));
  ctx.stroke();

  ctx.fillStyle = perfect ? GOLD_TEXT : BINDING;
  ctx.font = `600 44px ${fonts.body}`;
  ctx.fillText(
    perfect ? "A perfect month" : `${(score.onTheDay + score.later).toLocaleString()} of ${score.squares.toLocaleString()} squares`,
    W / 2,
    1185,
  );
  ctx.fillStyle = BINDING;
  ctx.font = `400 30px ${fonts.body}`;
  ctx.fillText(`${score.perfectDays} perfect ${score.perfectDays === 1 ? "day" : "days"} · ${score.daysPlayed} of ${score.days} days played`, W / 2, 1235);
  ctx.globalAlpha = 0.7;
  ctx.font = `400 26px ${fonts.body}`;
  ctx.fillText("bstocksharp.dev/games/snug", W / 2, 1290);
  ctx.globalAlpha = 1;
  return canvas;
}

/** Shares the picture through the phone's share sheet where it can take files; elsewhere downloads it. */
export async function shareMonthPicture(canvas: HTMLCanvasElement, monthKey: string, text: string): Promise<"shared" | "downloaded"> {
  const file = await canvasFile(canvas, `snug-${monthKey}.png`);
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], text });
    return "shared";
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

/** The month before `today`'s, written "YYYY-MM". */
export function previousMonth(today: string): string {
  const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const revealedKey = (monthKey: string) => `snug.revealed.${monthKey}`;

/** Last month, when its reveal has not played on this device and at least one of its days was finished. */
export function revealDue(today: string, launch: string): string | null {
  const month = previousMonth(today);
  if (month < launch.slice(0, 7)) return null;
  try {
    if (localStorage.getItem(revealedKey(month))) return null;
  } catch {
    return null;
  }
  for (let k = `${month}-01`; k <= lastDayOf(month); k = addDays(k, 1)) if (loadAttempt(GAME, k) || loadBest(k)) return month;
  return null;
}

function markRevealed(monthKey: string) {
  try {
    localStorage.setItem(revealedKey(monthKey), "1");
  } catch {
    // Blocked storage only means the reveal may play again.
  }
}

function Tally({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div style={{ minWidth: 76, textAlign: "center" }}>
      <div style={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", opacity: 0.65 }}>{label}</div>
    </div>
  );
}

/** The month's score: squares filled on the day, later, and missed, plus perfect days. */
export function MonthScoreView({ score }: { score: MonthScore }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 600 }}>
        {(score.onTheDay + score.later).toLocaleString()} of {score.squares.toLocaleString()} squares
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 6px", marginTop: 10 }}>
        <Tally label="On the day" value={score.onTheDay.toLocaleString()} />
        <Tally label="Later" value={score.later.toLocaleString()} />
        <Tally label="Missed" value={score.missed.toLocaleString()} color={score.missed ? RED_THREAD : undefined} />
        <Tally label="Perfect days" value={score.perfectDays} />
      </div>
    </div>
  );
}

const dayName = (dateKey: string) => new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" });

/** The month's closing line: a gold perfect month, a complete quilt, or the squares still to stitch. */
export function EndingBanner({ score, outline }: { score: MonthScore; outline: string }) {
  const ending = monthEnding(score);
  const gold = ending === "perfect";
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 15,
        fontWeight: 600,
        padding: "8px 12px",
        borderRadius: 10,
        border: `2px dashed ${gold ? QUILT_GOLD : BINDING}`,
        background: gold ? "rgba(199,154,46,0.12)" : "rgba(122,74,52,0.06)",
        color: gold ? "#8a6410" : undefined,
      }}
    >
      {ending === "perfect"
        ? "A perfect month: every square stitched on its day"
        : ending === "complete"
          ? `Quilt complete! ${score.later.toLocaleString()} squares caught up later`
          : `${score.missed.toLocaleString()} squares left. Stitch them any time to finish your ${outline}.`}
    </div>
  );
}

/** When each step of the reveal starts (ms): stitch the outline, show the missed days, name the picture, the ending. */
const REVEAL_AT = [600, 2900, 3700, 4300];
/** A month just completed: the last day fades in, the outline stitches shut, the picture's name, the ending. */
const COMPLETE_AT = [500, 1500, 3900, 4500];

/** True when every square of a month that has its outline is filled, on the day or later. */
export async function monthComplete(monthKey: string): Promise<boolean> {
  const month = await loadMonth(monthKey, lastDayOf(monthKey));
  return !!month.shape && monthScore(quiltDays(month)).missed === 0;
}

/**
 * The end-of-month reveal: your quilt as you left it, the month's outline stitched around it (turning gold for a
 * perfect month), the missed days as linen, the picture's name, then the score. `onStitch` opens a missed day.
 * With `completedDay`, the day that just finished the month fades in first and the outline stitches shut around it.
 */
export function RevealSequence({
  monthKey,
  days,
  shape,
  onShare,
  onStitch,
  note,
  completedDay,
}: {
  monthKey: string;
  days: QuiltDay[];
  shape: MonthShape;
  onShare: () => void;
  onStitch?: (dateKey: string) => void;
  note?: string;
  completedDay?: string;
}) {
  const score = useMemo(() => monthScore(days), [days]);
  const perfect = monthEnding(score) === "perfect";
  const firstMissed = firstUnfinished(days);
  const [play, setPlay] = useState(0);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const timers = (completedDay ? COMPLETE_AT : REVEAL_AT).map((ms, i) => window.setTimeout(() => setStage(i + 1), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [play, completedDay]);
  const shown = (from: number) => ({ opacity: stage >= from ? 1 : 0, transition: "opacity 600ms ease", pointerEvents: stage >= from ? ("auto" as const) : ("none" as const) });

  return (
    <div>
      <div style={{ fontFamily: SCRIPT, fontSize: 40, lineHeight: 1, color: BINDING, fontWeight: 700, textAlign: "center" }}>{monthName(monthKey)}</div>
      <div style={{ textAlign: "center", fontSize: 13.5, opacity: 0.75, margin: "6px 0 16px" }}>
        {completedDay ? (stage < 2 ? "Your last square, stitched in" : "Every square in its place") : stage < 2 ? "Your month, as you stitched it" : "Every day in its place"}
      </div>
      <MonthQuiltView
        key={play}
        monthKey={monthKey}
        days={days}
        shape={shape}
        assembled
        maxWidth={500}
        missedHidden={stage < 2}
        hiddenDay={completedDay ? (stage < 1 ? completedDay : null) : undefined}
        border={{ drawn: stage >= (completedDay ? 2 : 1), gold: perfect && stage >= 2 }}
      />
      <div style={{ ...shown(3), textAlign: "center", fontFamily: SCRIPT, fontSize: 34, color: perfect ? GOLD_TEXT : BINDING, marginTop: 14 }}>
        It was {pictureName(shape.outline)}!
      </div>
      <div style={{ ...shown(4), marginTop: 10 }}>
        <EndingBanner score={score} outline={shape.outline} />
        <div style={{ marginTop: 12 }}>
          <MonthScoreView score={score} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 16 }}>
          {firstMissed && onStitch && (
            <Btn primary onClick={() => onStitch(firstMissed.dateKey)}>
              Stitch {dayName(firstMissed.dateKey)}
            </Btn>
          )}
          <Btn primary={!(firstMissed && onStitch)} onClick={onShare}>
            Share picture
          </Btn>
          <Btn
            onClick={() => {
              setStage(0);
              setPlay((n) => n + 1);
            }}
          >
            Play again
          </Btn>
        </div>
        <div aria-live="polite" style={{ textAlign: "center", fontSize: 13, minHeight: 18, marginTop: 8, opacity: 0.75 }}>
          {note}
        </div>
      </div>
    </div>
  );
}

/**
 * The end-of-month reveal in its modal, for the month just over; `onStitch` closes it and opens a missed day.
 * With `completedDay`, it celebrates the past month that day just finished.
 */
export function MonthReveal({
  monthKey,
  onClose,
  onStitch,
  completedDay,
}: {
  monthKey: string;
  onClose: () => void;
  onStitch?: (dateKey: string) => void;
  completedDay?: string;
}) {
  const [month, setMonth] = useState<MonthDays | null>(null);
  useEffect(() => {
    let live = true;
    loadMonth(monthKey, lastDayOf(monthKey))
      .then((m) => {
        if (!live) return;
        if (!m.shape) return onClose();
        markRevealed(monthKey);
        setMonth(m);
      })
      .catch(() => live && onClose());
    return () => {
      live = false;
    };
  }, [monthKey, onClose]);
  const days = useMemo(() => (month ? quiltDays(month) : []), [month]);

  const bodyRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const share = async () => {
    if (!month?.shape || !bodyRef.current) return;
    setNote("");
    try {
      const fonts = await canvasFonts(bodyRef.current);
      const picture = drawMonthPicture(monthKey, days, month.shape, monthScore(days), fonts);
      if ((await shareMonthPicture(picture, monthKey, `My ${monthName(monthKey)} quilt on Snug`)) === "downloaded") setNote("Picture saved");
    } catch (err) {
      // Closing the share sheet is not a failure.
      if ((err as Error).name !== "AbortError") setNote("Could not make the picture");
    }
  };

  return (
    <StitchedModal label={`${monthName(monthKey)} quilt`} onClose={onClose} width={560}>
      <div ref={bodyRef}>
        {month?.shape ? (
          <RevealSequence
            monthKey={monthKey}
            days={days}
            shape={month.shape}
            onShare={share}
            onStitch={
              onStitch &&
              ((key) => {
                onClose();
                onStitch(key);
              })
            }
            note={note}
            completedDay={completedDay}
          />
        ) : (
          <div style={{ minHeight: 240, display: "grid", placeItems: "center", fontFamily: SCRIPT, fontSize: 26, color: BINDING }}>Gathering your days…</div>
        )}
      </div>
    </StitchedModal>
  );
}
