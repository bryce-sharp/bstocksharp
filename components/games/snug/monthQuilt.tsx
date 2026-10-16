// The month as one quilt: each day you finished drawn in its place with your own patches, and, once the month is
// done, the days you missed as plain linen so the outline shows. Also the month's score, its reveal and its picture.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Puzzle } from "./generator";
import { addDays, loadAttempt, weekday } from "../daily";
import { cellKey, outlineLoops, outlinePath, type Cell } from "./pieces";
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
}

/** The month's served days with this browser's runs for each. */
export function quiltDays(month: MonthDays): QuiltDay[] {
  return month.days.map((d) => {
    const scored = loadAttempt<Attempt>(GAME, d.dateKey);
    const best = loadBest(d.dateKey);
    return { ...d, pieces: (scored ?? best)?.pieces, scoredGaps: scored?.gaps, bestGaps: best?.gaps };
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

/** One day drawn on its own board: your patches, small crosses on holes, plain linen when missed. */
function DayDrawing({ day }: { day: QuiltDay }) {
  const p = day.puzzle;
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
    </>
  );
}

/**
 * The month quilt. With `shape` (a finished month) every day shows, missed days as linen; without it only finished
 * days show, so the outline stays a surprise. Unassembled, the days sit in their calendar squares; setting
 * `assembled` flies them into the quilt. `onSelect` makes days tappable, dimming all but the `selected` one.
 */
export function MonthQuiltView({
  monthKey,
  days,
  shape,
  assembled,
  maxWidth,
  selected,
  onSelect,
}: {
  monthKey: string;
  days: QuiltDay[];
  shape?: MonthShape;
  assembled: boolean;
  maxWidth: number;
  selected?: string | null;
  onSelect?: (dateKey: string | null) => void;
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
              transition: `transform 1100ms cubic-bezier(.3,.9,.3,1) ${assembled ? index * 40 : 0}ms, opacity 300ms`,
              opacity: selected && selected !== d.dateKey ? 0.35 : 1,
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
  ctx.fillText(monthName(monthKey), W / 2, 210);

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
    ctx.setLineDash([]);
  }

  ctx.fillStyle = BINDING;
  ctx.font = `600 44px ${fonts.body}`;
  ctx.fillText(`${(score.onTheDay + score.later).toLocaleString()} of ${score.squares.toLocaleString()} squares`, W / 2, 1185);
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

/** How long the days sit in their calendar squares before they fly. */
const HOLD_MS = 900;

/** The end-of-month reveal: the month's days sit in their calendar squares, then fly together into the quilt. */
export function MonthReveal({ monthKey, onClose }: { monthKey: string; onClose: () => void }) {
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
  const score = useMemo(() => monthScore(days), [days]);

  const [play, setPlay] = useState(0);
  const [assembled, setAssembled] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!month) return;
    const fly = window.setTimeout(() => setAssembled(true), HOLD_MS);
    const done = window.setTimeout(() => setSettled(true), HOLD_MS + 1100 + days.length * 40 + 200);
    return () => {
      window.clearTimeout(fly);
      window.clearTimeout(done);
    };
  }, [month, days.length, play]);
  const replay = () => {
    setAssembled(false);
    setSettled(false);
    setPlay((n) => n + 1);
  };

  const bodyRef = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState("");
  const share = async () => {
    if (!month?.shape || !bodyRef.current) return;
    setNote("");
    try {
      const fonts = await canvasFonts(bodyRef.current);
      const picture = drawMonthPicture(monthKey, days, month.shape, score, fonts);
      if ((await shareMonthPicture(picture, monthKey, `My ${monthName(monthKey)} quilt on Snug`)) === "downloaded") setNote("Picture saved");
    } catch (err) {
      // Closing the share sheet is not a failure.
      if ((err as Error).name !== "AbortError") setNote("Could not make the picture");
    }
  };

  return (
    <StitchedModal label={`${monthName(monthKey)} quilt`} onClose={onClose} width={560}>
      <div ref={bodyRef}>
        <div style={{ fontFamily: SCRIPT, fontSize: 40, lineHeight: 1, color: BINDING, fontWeight: 700, textAlign: "center" }}>{monthName(monthKey)}</div>
        <div style={{ textAlign: "center", fontSize: 13.5, opacity: 0.75, margin: "6px 0 16px" }}>
          {settled ? "Your month, stitched into one quilt" : "Every day of the month, coming together"}
        </div>
        {month ? (
          <MonthQuiltView monthKey={monthKey} days={days} shape={month.shape} assembled={assembled} maxWidth={500} />
        ) : (
          <div style={{ minHeight: 240, display: "grid", placeItems: "center", fontFamily: SCRIPT, fontSize: 26, color: BINDING }}>Gathering your days…</div>
        )}
        <div style={{ marginTop: 18, opacity: settled ? 1 : 0, transition: "opacity 500ms ease", pointerEvents: settled ? "auto" : "none" }}>
          <MonthScoreView score={score} />
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16 }}>
            <Btn primary onClick={share}>
              Share picture
            </Btn>
            <Btn onClick={replay}>Play again</Btn>
          </div>
          <div aria-live="polite" style={{ textAlign: "center", fontSize: 13, minHeight: 18, marginTop: 8, opacity: 0.75 }}>
            {note}
          </div>
        </div>
      </div>
    </StitchedModal>
  );
}
