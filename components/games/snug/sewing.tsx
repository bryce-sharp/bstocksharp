// The opening every board plays: the binding and linen settle down, then the yarn's own end runs around the edge and
// sews the binding's stitches in one at a time, its newest stitches loose and wavy until they settle taut behind it,
// while the patches drop in. Leaving a day pulls the stitches back out first. Tried in the opening lab.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BINDING_INSET, U, bindingStitches, bindingThread } from "./parts";
import { insetCellLoops } from "./stitches";
import type { Puzzle } from "./generator";

/** Opening the game. */
export const OPEN_MS = 1700;
/** Switching to another day. */
export const SWITCH_MS = 1100;
/** Pulling the old board's stitches out, before a switch. */
export const UNSEW_MS = 880;
/** Room after the last stitch for the patches to finish landing. */
export const SETTLE_MS = 600;
/** Each stitch settles taut over this many stitches behind the yarn's end. */
const SNAKE = 3;

export type SewDir = "in" | "out";

/** The board's own animation while it is sewn in or out; `pace` stretches every step, for the lab's slow motion. */
export const boardSewStyle = (dir: SewDir, ms: number, pace = 1): CSSProperties =>
  dir === "in" ? { animation: `snugLay ${320 * pace}ms ease-out both`, transformOrigin: "center" } : { animation: `snugFadeOut ${260 * pace}ms ease ${ms - 220 * pace}ms forwards` };

/** The `index`th patch's animation: dropping in while the edge is sewn, or lifting off before it is pulled out. */
export const pieceSewStyle = (dir: SewDir, index: number, pace = 1): CSSProperties =>
  dir === "in"
    ? { animation: `snugDrop ${400 * pace}ms cubic-bezier(.3, 1.4, .5, 1) ${(250 + index * 75) * pace}ms both` }
    : { animation: `snugUnpick ${380 * pace}ms ease-in ${index * 35 * pace}ms both` };

type P = [number, number];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const fmt = (n: number) => n.toFixed(2);

type Stitch = { pts: P[]; cum: number[]; len: number; s0: number; s1: number; holes: [string, string]; out: P };

/** The board's binding stitches, each placed along the loop they follow, starting from the top-left stitch. */
function bindingGeometry(puzzle: Puzzle) {
  const loop = insetCellLoops(puzzle.board, U, BINDING_INSET)[0]!;
  const paths = bindingStitches(puzzle.board, puzzle.cols, puzzle.rows);
  const pts: P[] = [...loop.map((p) => [p[0], p[1]] as P), [loop[0]![0], loop[0]![1]]];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = cum[cum.length - 1]!;
  const wrap = (s: number) => ((s % total) + total) % total;
  const onLoop = (s: number): P => {
    const w = wrap(s);
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1]! < w) i++;
    const t = (w - cum[i]!) / (cum[i + 1]! - cum[i]! || 1);
    return [pts[i]![0] + (pts[i + 1]![0] - pts[i]![0]) * t, pts[i]![1] + (pts[i + 1]![1] - pts[i]![1]) * t];
  };
  // Heading from a short chord, so the yarn's end turns smoothly around corners instead of snapping.
  const headingOn = (s: number) => {
    const a = onLoop(s - 1.6);
    const b = onLoop(s + 1.6);
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  };
  const project = (p: P) => {
    let best = Infinity;
    let at = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy || 1;
      const t = clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2);
      const d = Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
      if (d < best) {
        best = d;
        at = cum[i]! + t * Math.sqrt(l2);
      }
    }
    return at;
  };
  const holes = paths.holes.split("M").filter(Boolean).map((h) => `M${h}`);
  const stitches: Stitch[] = paths.thread
    .split("M")
    .filter(Boolean)
    .map((sub, k) => {
      const sp = sub.split("L").map((xy) => xy.trim().split(/\s+/).map(Number) as P);
      const sc = [0];
      for (let i = 1; i < sp.length; i++) sc.push(sc[i - 1]! + Math.hypot(sp[i]![0] - sp[i - 1]![0], sp[i]![1] - sp[i - 1]![1]));
      const len = sc[sc.length - 1]!;
      const s0 = project(sp[0]!);
      const h = headingOn(s0 + len / 2);
      // Loops run clockwise, so this normal points out of the board.
      return { pts: sp, cum: sc, len, s0, s1: s0 + len, holes: [holes[2 * k] ?? "", holes[2 * k + 1] ?? ""], out: [Math.sin(h), -Math.cos(h)] };
    });
  // Every lap starts at the board's top-left stitch, wherever the outline itself happens to begin.
  const first = stitches.reduce((a, b) => (b.pts[0]![0] + b.pts[0]![1] < a.pts[0]![0] + a.pts[0]![1] ? b : a));
  const origin = first.s0 - 0.01;
  const laps = stitches.map((st) => ({ ...st, s0: wrap(st.s0 - origin), s1: wrap(st.s0 - origin) + st.len })).sort((a, b) => a.s0 - b.s0);
  return {
    stitches: laps,
    point: (s: number) => onLoop(s + origin),
    heading: (s: number) => headingOn(s + origin),
    /** How far around the lap a point (in board units) sits, from the top-left stitch. */
    locate: (p: P) => wrap(project(p) - origin),
    step: total / laps.length,
    start: laps[0]!.s0,
    end: laps[laps.length - 1]!.s1,
  };
}
type Geometry = ReturnType<typeof bindingGeometry>;

/** A point `q` units along a stitch. */
function along(st: Stitch, q: number): P {
  for (let i = 1; i < st.pts.length; i++) {
    if (st.cum[i]! >= q) {
      const a = st.pts[i - 1]!;
      const b = st.pts[i]!;
      const t = (q - st.cum[i - 1]!) / (st.cum[i]! - st.cum[i - 1]! || 1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
  }
  return st.pts[st.pts.length - 1]!;
}

/** The first `q` units of a stitch, as a path. */
function prefix(st: Stitch, q: number): string {
  if (q >= st.len) return `M${st.pts.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}`;
  let d = `M${fmt(st.pts[0]![0])} ${fmt(st.pts[0]![1])}`;
  for (let i = 1; i < st.pts.length; i++) {
    if (st.cum[i]! >= q) {
      const [x, y] = along(st, q);
      return `${d}L${fmt(x)} ${fmt(y)}`;
    }
    d += `L${fmt(st.pts[i]![0])} ${fmt(st.pts[i]![1])}`;
  }
  return d;
}

/** Where the yarn's end is and how each stitch lies at progress `u` (0 to 1) of a sew in or out. */
function frame(g: Geometry, u: number, dir: SewDir) {
  const out = dir === "out";
  const from = g.start - 0.3;
  // Sewing in runs on past the last stitch until it has settled taut.
  const to = g.end + (out ? 0.5 : SNAKE * g.step);
  let head = from + (to - from) * (out ? 1 - easeInOut(u) : easeInOut(u));
  // A hand's rhythm: the yarn eases at each stitch instead of running at one speed.
  if (!out) {
    const f = (head - g.start) / g.step;
    head = g.start + (f - 0.07 * Math.sin(2 * Math.PI * f)) * g.step;
  }
  const shown = g.stitches.map((st, k) => {
    const q = Math.max(0, Math.min(st.len, head - st.s0));
    const forming = q > 0 && q < st.len;
    if (out) return { q, bow: forming ? 1.2 : 0, lift: forming ? 0.6 : 0 };
    // The newest stitches ride loose, bowing out and in by turns, and settle taut over the next few stitches.
    const slack = q >= st.len ? clamp01(1 - (head - st.s1) / (SNAKE * g.step)) : 1;
    return { q, bow: slack * 1.5 * (k % 2 ? 1 : -0.7), lift: slack * 0.7 };
  });
  // The yarn's end shows only while it is above the cloth, popping up out of each hole and shrinking as it dives in.
  const over = g.stitches.find((st) => head >= st.s0 && head <= st.s1);
  const end = over
    ? { at: g.point(head), angle: g.heading(head) + (out ? Math.PI : 0), scale: (1 + 0.45 * clamp01(1 - (head - over.s0) / 0.9)) * clamp01((over.s1 - head) / 0.35 + 0.25) }
    : null;
  return { shown, end };
}

/**
 * The binding stitches being sewn in or out, over a `BoardSvg` given `sewing` (which hides its own stitches meanwhile).
 * It sits where that board does and has the same size; `freeze` holds one moment, for the lab.
 */
export function Sewing({
  puzzle,
  cell,
  pad,
  left,
  top,
  dir,
  ms,
  onDone,
  freeze,
  perfect = false,
}: {
  puzzle: Puzzle;
  cell: number;
  pad: number;
  left: number;
  top: number;
  dir: SewDir;
  ms: number;
  onDone: () => void;
  freeze?: number;
  /** A board filled perfectly is stitched in gold, so the sewing uses gold too. */
  perfect?: boolean;
}) {
  const g = useMemo(() => bindingGeometry(puzzle), [puzzle]);
  const [u, setU] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (freeze !== undefined) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const v = clamp01((now - t0) / ms);
      setU(v);
      if (v < 1) raf = requestAnimationFrame(tick);
      else done.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, freeze]);
  const f = frame(g, freeze ?? u, dir);
  const padU = pad * U;
  const thread = bindingThread(perfect);
  return (
    <svg
      width={(puzzle.cols + 2 * pad) * cell}
      height={(puzzle.rows + 2 * pad) * cell}
      viewBox={`${-padU} ${-padU} ${puzzle.cols * U + 2 * padU} ${puzzle.rows * U + 2 * padU}`}
      style={{ position: "absolute", left, top, overflow: "visible", pointerEvents: "none", zIndex: 20 }}
      aria-hidden
    >
      <defs>
        <filter id="snug-sew-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>
      {g.stitches.map((st, k) => {
        const s = f.shown[k]!;
        if (s.q <= 0) return null;
        // A slack stitch bows like loose yarn; one that turns a corner lifts outward instead.
        const straight = st.pts.length === 2;
        const a = st.pts[0]!;
        const b = along(st, s.q);
        const bow = s.bow * (s.q / st.len);
        const d =
          straight && bow !== 0
            ? `M${fmt(a[0])} ${fmt(a[1])}Q${fmt((a[0] + b[0]) / 2 + st.out[0] * bow)} ${fmt((a[1] + b[1]) / 2 + st.out[1] * bow)} ${fmt(b[0])} ${fmt(b[1])}`
            : prefix(st, s.q);
        const lift = straight ? 0 : bow * 0.5;
        return (
          <g key={k} transform={lift ? `translate(${fmt(st.out[0] * lift)} ${fmt(st.out[1] * lift)})` : undefined}>
            <path d={st.holes[0]} fill="rgba(60,32,20,.45)" />
            {s.q >= st.len && <path d={st.holes[1]} fill="rgba(60,32,20,.45)" />}
            <path
              d={d}
              fill="none"
              stroke="rgba(40,20,10,.35)"
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(${fmt(0.18 + s.lift * 0.6)} ${fmt(0.28 + s.lift * 0.9)})`}
            />
            <path d={d} fill="none" stroke={thread} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {f.end && (
        // The yarn's free end: a rounded tip with a few loose fibers ahead of it.
        <g transform={`translate(${fmt(f.end.at[0])} ${fmt(f.end.at[1])}) rotate(${fmt((f.end.angle * 180) / Math.PI)}) scale(${fmt(f.end.scale)})`}>
          <circle r={0.62} cx={0.18} cy={0.3} fill="rgba(40,20,10,.35)" filter="url(#snug-sew-soft)" />
          <path d="M0.35 -0.22L1.25 -0.6M0.5 0L1.45 0.04M0.35 0.22L1.2 0.55" stroke={thread} strokeWidth={0.16} strokeLinecap="round" />
          <circle r={0.6} fill={thread} stroke="#d9cdb4" strokeWidth={0.1} />
        </g>
      )}
    </svg>
  );
}

/** A finish's pull: a wave runs around the lap and pulls each stitch taut (gold on a perfect board), as slowly as the game's opening. */
export const WIN_PULL_MS = OPEN_MS;
/** How long a finish waits for the basket to start folding away before the pull begins. */
export const WIN_DELAY_MS = 300;

/**
 * When, in ms after the pull starts, the wave reaches each placed patch, so the patches can puff up in the same
 * order. Patches still in the basket get no delay.
 */
export function pullDelays(puzzle: Puzzle, pieces: { cells: readonly (readonly [number, number])[]; at: { x: number; y: number } | null }[], pullMs = WIN_PULL_MS) {
  const g = bindingGeometry(puzzle);
  const span = g.end - g.start || 1;
  return pieces.map((p) => {
    if (!p.at) return null;
    const cx = p.cells.reduce((n, [x]) => n + x, 0) / p.cells.length + 0.5;
    const cy = p.cells.reduce((n, [, y]) => n + y, 0) / p.cells.length + 0.5;
    return clamp01((g.locate([(p.at.x + cx) * U, (p.at.y + cy) * U]) - g.start) / span) * pullMs;
  });
}

/**
 * A finish over a `BoardSvg` given `sewing` with `dir: "win"`: after `delay` ms, a wave runs around the lap and each
 * stitch bows loose, then snaps taut in the board's final thread (gold when perfect), with a glint leading the wave on
 * a perfect board. `freeze` (0 to 1) holds one moment.
 */
export function Finishing({
  puzzle,
  cell,
  pad,
  left,
  top,
  perfect,
  delay,
  pullMs = WIN_PULL_MS,
  onDone,
  freeze,
}: {
  puzzle: Puzzle;
  cell: number;
  pad: number;
  left: number;
  top: number;
  perfect: boolean;
  delay: number;
  pullMs?: number;
  onDone: () => void;
  freeze?: number;
}) {
  const g = useMemo(() => bindingGeometry(puzzle), [puzzle]);
  const total = delay + pullMs;
  const [elapsed, setElapsed] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (freeze !== undefined) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(total, now - t0);
      setElapsed(t);
      if (t < total) raf = requestAnimationFrame(tick);
      else done.current();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, freeze]);
  const t = freeze !== undefined ? freeze * total : elapsed;
  const final = bindingThread(perfect);
  // The wave runs a little past the last stitch, so the last ones finish snapping taut.
  const reach = 2 * g.step;
  const wave = g.start + (g.end + reach - g.start) * easeInOut(clamp01((t - delay) / pullMs));
  const padU = pad * U;
  return (
    <svg
      width={(puzzle.cols + 2 * pad) * cell}
      height={(puzzle.rows + 2 * pad) * cell}
      viewBox={`${-padU} ${-padU} ${puzzle.cols * U + 2 * padU} ${puzzle.rows * U + 2 * padU}`}
      style={{ position: "absolute", left, top, overflow: "visible", pointerEvents: "none", zIndex: 20 }}
      aria-hidden
    >
      <defs>
        <radialGradient id="snug-glint">
          <stop offset="0" stopColor="#fff8d6" stopOpacity={0.95} />
          <stop offset="0.45" stopColor="#f6c445" stopOpacity={0.55} />
          <stop offset="1" stopColor="#f6c445" stopOpacity={0} />
        </radialGradient>
      </defs>
      {g.stitches.map((st, k) => {
        // Each stitch bows loose as the wave reaches it, then snaps taut in its final thread.
        const local = clamp01((wave - st.s0) / reach);
        const bow = Math.sin(Math.PI * local) * 1.6;
        const color = local >= 0.55 ? final : bindingThread(false);
        const straight = st.pts.length === 2;
        const a = st.pts[0]!;
        const b = st.pts[st.pts.length - 1]!;
        const d =
          straight && bow > 0.01
            ? `M${fmt(a[0])} ${fmt(a[1])}Q${fmt((a[0] + b[0]) / 2 + st.out[0] * bow)} ${fmt((a[1] + b[1]) / 2 + st.out[1] * bow)} ${fmt(b[0])} ${fmt(b[1])}`
            : prefix(st, st.len);
        const lift = straight ? 0 : bow * 0.5;
        return (
          <g key={k} transform={lift ? `translate(${fmt(st.out[0] * lift)} ${fmt(st.out[1] * lift)})` : undefined}>
            <path d={st.holes[0]} fill="rgba(60,32,20,.45)" />
            <path d={st.holes[1]} fill="rgba(60,32,20,.45)" />
            <path
              d={d}
              fill="none"
              stroke="rgba(40,20,10,.35)"
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`translate(${fmt(0.18 + bow * 0.35)} ${fmt(0.28 + bow * 0.5)})`}
            />
            <path d={d} fill="none" stroke={color} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {perfect && wave > g.start && wave < g.end + reach && (
        <circle cx={g.point(wave)[0]} cy={g.point(wave)[1]} r={3.2} fill="url(#snug-glint)" />
      )}
    </svg>
  );
}
