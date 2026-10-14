// Hand-sewn running stitches: uneven twisted-yarn stitches with needle holes, along cell outlines or around HTML boxes.

import { useEffect, useMemo, useRef, useState } from "react";
import { makeRng, type Rng } from "../daily";
import { outlineLoops, type Cell } from "./pieces";

type P = [number, number];

export interface StitchPaths {
  thread: string;
  holes: string;
}

export interface StitchOpts {
  stitch: number;
  gap: number;
  /** How far each stitch end may wander off the line. */
  wobble: number;
  hole: number;
}

/** Cell outlines moved inward by `inset` (negative moves outward), scaled by `unit`. */
export function insetCellLoops(cells: readonly Cell[], unit: number, inset: number): P[][] {
  return outlineLoops(cells).map((loop) =>
    loop.map((p, i) => {
      const a = loop[(i - 1 + loop.length) % loop.length]!;
      const b = loop[(i + 1) % loop.length]!;
      // Loops run clockwise, so (-dy, dx) of each edge points into the shape.
      const n1: P = [-Math.sign(p[1] - a[1]), Math.sign(p[0] - a[0])];
      const n2: P = [-Math.sign(b[1] - p[1]), Math.sign(b[0] - p[0])];
      return [p[0] * unit + (n1[0] + n2[0]) * inset, p[1] * unit + (n1[1] + n2[1]) * inset];
    }),
  );
}

/** A clockwise rounded rectangle, `inset` in from a w by h box. */
export function roundedRectLoop(w: number, h: number, inset: number, radius: number): P[] {
  const x0 = inset;
  const y0 = inset;
  const x1 = w - inset;
  const y1 = h - inset;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  const corners: [number, number, number][] = [
    [x1 - r, y0 + r, -Math.PI / 2],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, Math.PI / 2],
    [x0 + r, y0 + r, Math.PI],
  ];
  const pts: P[] = [];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + (i / 5) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

const fmt = (n: number) => n.toFixed(2);

/** Evenly spaced, slightly irregular stitches around each closed loop. */
export function stitchLoops(loops: P[][], rng: Rng, o: StitchOpts): StitchPaths {
  let thread = "";
  let holes = "";
  const hole = (x: number, y: number) => {
    const r = o.hole;
    holes += `M${fmt(x - r)} ${fmt(y)}a${r} ${r} 0 1 0 ${fmt(2 * r)} 0a${r} ${r} 0 1 0 ${fmt(-2 * r)} 0`;
  };
  for (const loop of loops) {
    if (loop.length < 2) continue;
    // Two laps so a stitch can run past the starting corner.
    const pts: P[] = [...loop, ...loop, loop[0]!];
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
    const total = cum[loop.length]!;
    if (total <= 0) continue;
    const at = (s: number): { p: P; i: number } => {
      let i = 0;
      while (i < cum.length - 2 && cum[i + 1]! < s) i++;
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const seg = cum[i + 1]! - cum[i]! || 1;
      const t = (s - cum[i]!) / seg;
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], i };
    };
    const normal = (i: number): P => {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
    };
    const count = Math.max(3, Math.round(total / (o.stitch + o.gap)));
    const step = total / count;
    for (let k = 0; k < count; k++) {
      const s0 = k * step + o.gap * 0.5 + (rng.next() - 0.5) * o.gap * 0.4;
      const len = Math.min(step - o.gap * 0.45, o.stitch * (0.82 + rng.next() * 0.36));
      const s1 = s0 + len;
      const start = at(s0);
      const end = at(s1);
      const wob = (i: number, p: P): P => {
        const n = normal(i);
        const w = (rng.next() - 0.5) * 2 * o.wobble;
        return [p[0] + n[0] * w, p[1] + n[1] * w];
      };
      const line: P[] = [wob(start.i, start.p)];
      for (let j = start.i + 1; j <= end.i; j++) line.push(pts[j]!);
      line.push(wob(end.i, end.p));
      thread += "M" + line.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L");
      const first = line[0]!;
      const second = line[1]!;
      const last = line[line.length - 1]!;
      const prev = line[line.length - 2]!;
      const ext = o.hole * 1.4;
      const d0 = Math.hypot(first[0] - second[0], first[1] - second[1]) || 1;
      const d1 = Math.hypot(last[0] - prev[0], last[1] - prev[1]) || 1;
      hole(first[0] + ((first[0] - second[0]) / d0) * ext, first[1] + ((first[1] - second[1]) / d0) * ext);
      hole(last[0] + ((last[0] - prev[0]) / d1) * ext, last[1] + ((last[1] - prev[1]) / d1) * ext);
    }
  }
  return { thread, holes };
}

/** Draws stitch paths as thread over a soft shadow, with needle holes at each end. */
export function Stitching({ paths, width, color, className }: { paths: StitchPaths; width: number; color: string; className?: string }) {
  return (
    <g className={className} style={{ pointerEvents: "none" }}>
      <path d={paths.holes} fill="rgba(60,32,20,.45)" />
      <path
        d={paths.thread}
        fill="none"
        stroke="rgba(40,20,10,.35)"
        strokeWidth={width * 1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${width * 0.18} ${width * 0.28})`}
      />
      <path d={paths.thread} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Stitches around the inside of its positioned parent, like a sewn edge on a fabric panel. */
export function StitchBorder({
  inset,
  radius,
  color,
  width = 2,
  stitch = 7,
  gap = 5,
  seed,
}: {
  inset: number;
  radius: number;
  color: string;
  width?: number;
  stitch?: number;
  gap?: number;
  seed: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<[number, number] | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry!.contentRect;
      setSize((s) => (s && Math.abs(s[0] - w) < 0.5 && Math.abs(s[1] - h) < 0.5 ? s : [w, h]));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const paths = useMemo(
    () =>
      size && size[0] > inset * 2 && size[1] > inset * 2
        ? stitchLoops([roundedRectLoop(size[0], size[1], inset, radius)], makeRng(`stitch:${seed}`), { stitch, gap, wobble: width * 0.3, hole: width * 0.3 })
        : null,
    [size, inset, radius, seed, stitch, gap, width],
  );
  return (
    <svg ref={ref} aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "hidden" }}>
      {paths && <Stitching paths={paths} width={width} color={color} />}
    </svg>
  );
}
