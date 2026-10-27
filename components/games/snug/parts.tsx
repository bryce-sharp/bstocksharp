// Visual building blocks shared by the Snug game and its art sheet.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GlobalStyles } from "@mui/material";
import { formatDuration } from "../daily";
import { makeRng } from "../daily";
import { SHAPES, bounds, outlinePath, rotateCW, type Cell } from "./pieces";
import { StitchBorder, Stitching, insetCellLoops, stitchLoops } from "./stitches";
import { BINDING, LINEN, THREAD, YARNS, quiltBackground } from "./quilt";
import type { Stats } from "./records";

/** SVG units per grid cell. */
export const U = 10;
export const INK = "#4a2c22";
export const FONT = "var(--snug-font-body), system-ui, sans-serif";
export const SCRIPT = "var(--snug-font-script), cursive";

export type Spot = { x: number; y: number };

export interface PieceState {
  id: string;
  cells: Cell[];
  color: number;
  at: Spot | null;
  /** On the quilt but not fitting after a turn: it hovers and covers nothing. */
  loose?: boolean;
}

export interface Attempt {
  gaps: number;
  timeMs: number;
  pieces: PieceState[];
  /** Hints used; older runs saved only `hinted`, which counts as one. */
  hints?: number;
  hinted?: boolean;
  /** The puzzle version it was played on (see version.ts). */
  v?: number;
}

/** A finished run's score, as the result card and share line describe it. */
export type RunSummary = { gaps: number; timeMs: number; hints?: number; hinted?: boolean };

export const hintsUsed = (r: Pick<RunSummary, "hints" | "hinted">) => r.hints ?? (r.hinted ? 1 : 0);

/** Thread color for hole marks and pieces that do not fit. */
export const RED_THREAD = "#c0392b";
export const GOLD_THREAD = "#f6c445";

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const panelStyle: CSSProperties = {
  position: "relative",
  maxWidth: 1080,
  margin: "0 auto",
  padding: "24px clamp(12px, 3vw, 32px) 28px",
  borderRadius: 22,
  background: `repeating-linear-gradient(0deg, rgba(160,130,90,.07) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(160,130,90,.07) 0 1px, transparent 1px 3px), ${LINEN}`,
  boxShadow: "0 18px 50px rgba(30,15,8,.55), 0 2px 0 rgba(255,255,255,.4) inset",
};

/** Thread color for stitching on linen. */
export const RUST_THREAD = "#a35a42";

/** The sewn edge inside a linen panel; place it as the panel's first child. */
export function PanelStitches({ seed }: { seed: string }) {
  return <StitchBorder inset={11} radius={14} color={RUST_THREAD} width={2.4} stitch={8} gap={5} seed={seed} />;
}

export function KnitDefs() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
      <defs>
        {YARNS.map((y, i) => (
          <pattern key={y.name} id={`snug-knit-${i}`} width={5} height={4.4} patternUnits="userSpaceOnUse">
            <rect width={5} height={4.4} fill={y.dark} />
            <ellipse cx={1.35} cy={2.2} rx={1.12} ry={2.15} transform="rotate(-30 1.35 2.2)" fill={y.base} />
            <ellipse cx={3.65} cy={2.2} rx={1.12} ry={2.15} transform="rotate(30 3.65 2.2)" fill={y.base} />
            <ellipse cx={1.05} cy={1.6} rx={0.36} ry={0.85} transform="rotate(-30 1.05 1.6)" fill={y.light} opacity={0.8} />
            <ellipse cx={3.95} cy={1.6} rx={0.36} ry={0.85} transform="rotate(30 3.95 1.6)" fill={y.light} opacity={0.8} />
          </pattern>
        ))}
        <pattern id="snug-linen" width={2} height={2} patternUnits="userSpaceOnUse">
          <rect width={2} height={2} fill={LINEN} />
          <path d="M0 .5H2M.5 0V2" stroke="#d6c4a2" strokeWidth={0.25} />
        </pattern>
      </defs>
    </svg>
  );
}

export function PatchSvg({
  piece,
  cell,
  interactive,
  loose = false,
  hinted = false,
  onDown,
}: {
  piece: PieceState;
  cell: number;
  interactive: boolean;
  loose?: boolean;
  /** A hinted patch still in the spot the hint gave it: stitched in gold. */
  hinted?: boolean;
  onDown: (e: ReactPointerEvent, cellIndex: number) => void;
}) {
  const { w, h } = bounds(piece.cells);
  const path = outlinePath(piece.cells, U);
  const yarn = YARNS[piece.color]!;
  const stitches = useMemo(
    () => stitchLoops(insetCellLoops(piece.cells, U, 2), makeRng(`patch:${piece.id}`), { stitch: 2.1, gap: 1.3, wobble: 0.22, hole: 0.3 }),
    [piece.cells, piece.id],
  );
  const clip = `snug-clip-${piece.id}`;
  return (
    <svg width={w * cell} height={h * cell} viewBox={`0 0 ${w * U} ${h * U}`} style={{
        display: "block",
        overflow: "visible",
        // Chrome ignores touch-action on inner SVG shapes, so the outer svg stops touch drags from scrolling the page.
        touchAction: interactive ? "none" : undefined,
        animation: loose ? "snugHover 1.8s ease-in-out infinite" : undefined,
      }}
    >
      <defs>
        <clipPath id={clip}>
          <path d={path} />
        </clipPath>
      </defs>
      <path d={path} fill={`url(#snug-knit-${piece.color})`} />
      {/* The edge stays inside the patch's own squares, so neighbors meet at a clean seam. */}
      <g clipPath={`url(#${clip})`}>
        {loose && <path d={path} fill={RED_THREAD} opacity={0.3} />}
        <path d={path} fill="none" stroke={yarn.dark} strokeWidth={2.2} />
      </g>
      <Stitching paths={stitches} width={0.88} color={loose ? RED_THREAD : hinted ? GOLD_THREAD : THREAD} />
      {piece.cells.map(([x, y], i) => (
        <rect
          key={i}
          x={x * U}
          y={y * U}
          width={U}
          height={U}
          fill="transparent"
          style={{ pointerEvents: interactive ? "all" : "none", cursor: "grab", touchAction: "none" }}
          onPointerDown={(e) => onDown(e, i)}
          onContextMenu={(e) => e.preventDefault()}
        />
      ))}
    </svg>
  );
}

export function Stat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        minWidth: compact ? 64 : 84,
        padding: compact ? "5px 10px" : "6px 14px",
        borderRadius: 12,
        background: "rgba(123,59,46,.08)",
        textAlign: "center",
      }}
    >
      <StitchBorder inset={4.5} radius={8} color={RUST_THREAD} width={1.7} stitch={5} gap={3.5} seed={`stat:${label}`} />
      <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", opacity: 0.65 }}>{label}</div>
      <div style={{ fontSize: compact ? 18 : 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  primary,
  disabled,
  small,
  tight,
  label,
  announce,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
  small?: boolean;
  /** Less side padding, for rows that must fit a phone's width. */
  tight?: boolean;
  /** Accessible name and tooltip, for buttons that show only an icon. */
  label?: string;
  /** Just unlocked: pops in with rings of gold thread, so it gets noticed. */
  announce?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={announce ? "snug-announce" : undefined}
      style={{
        position: "relative",
        fontFamily: FONT,
        fontSize: small ? 14 : 15,
        fontWeight: 500,
        padding: small ? (tight ? "8px 10px" : "8px 13px") : "9px 18px",
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        color: primary ? THREAD : INK,
        background: primary ? BINDING : "rgba(123,59,46,.1)",
        boxShadow: primary ? "0 3px 0 #4f2219" : "none",
      }}
    >
      <StitchBorder
        inset={5}
        radius={14}
        color={primary ? THREAD : RUST_THREAD}
        width={1.6}
        stitch={5}
        gap={3.5}
        seed={`btn:${typeof children === "string" ? children : "button"}`}
      />
      {children}
    </button>
  );
}

export function ResultCard(props: {
  number: number;
  result: RunSummary;
  recorded: Attempt | null;
  isReplay: boolean;
  shareLine: string;
  /** Link included with the shared result, shown under it. */
  shareUrl?: string;
  /** Label for the share button; defaults to Copy / Copied. */
  shareLabel?: string;
  copied: boolean;
  describe: (r: RunSummary) => string;
  onCopy: () => void;
  onReveal: () => void;
  onShowMine: () => void;
  onPlayAgain: () => void;
  onClose: () => void;
  /** Card center in the play area, in px; defaults to the middle. */
  center?: { x: number; y: number };
  /** Shows the card as a compact sheet pinned to the bottom of the screen (phones). */
  sheet?: boolean;
  note?: string;
  /** The quilt silhouette that goes out with the share line. */
  shareGrid?: string;
  stats: Stats;
  moreGames: MoreGamesLink;
  /** Where a signed-out player signs in or makes an account, to save across devices. */
  saveHref?: string;
}) {
  const { result, recorded, isReplay, center, sheet = false } = props;
  const perfect = result.gaps === 0;
  // Its own height, so a card centered on the basket never rises above the play area onto the header.
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        position: sheet ? "fixed" : "absolute",
        left: center ? center.x : "50%",
        top: sheet ? "auto" : center ? Math.max(center.y, height / 2) : "50%",
        bottom: sheet ? 10 : "auto",
        transform: sheet ? "translate(-50%,0)" : "translate(-50%,-50%)",
        animation: `${sheet ? "snugPopTop" : "snugPop"} 260ms ease-out`,
        zIndex: 80,
        width: sheet ? "min(420px, calc(100vw - 20px))" : "min(420px, calc(100% - 16px))",
        padding: sheet ? "18px 16px 14px" : "26px 24px 22px",
        borderRadius: 20,
        background: LINEN,
        boxShadow: "0 24px 60px rgba(30,15,8,.5)",
        textAlign: "center",
      }}
    >
      <StitchBorder inset={10} radius={13} color={RUST_THREAD} width={2.2} stitch={7} gap={4.5} seed="result-card" />
      <CloseButton onClick={props.onClose} />
      <div style={{ fontFamily: SCRIPT, fontSize: sheet ? 36 : 46, lineHeight: 1, color: perfect ? "#2e8f83" : BINDING, fontWeight: 700 }}>
        {perfect ? "Perfectly snug!" : `${plural(result.gaps, "hole")} left`}
      </div>
      <div style={{ fontSize: 15, marginTop: 8 }}>
        Snug No. {props.number} &middot; {formatDuration(result.timeMs)}
        {hintsUsed(result) > 0 && <> &middot; {plural(hintsUsed(result), "hint")}</>}
      </div>
      {props.note && <div style={{ fontSize: 13, marginTop: 10, opacity: 0.8 }}>{props.note}</div>}
      {isReplay && recorded && (
        <div style={{ fontSize: 13, marginTop: 10, opacity: 0.8 }}>
          This replay was not scored. Your recorded result: {props.describe(recorded)}.
        </div>
      )}
      {props.shareLine && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, padding: "8px 8px 8px 14px", borderRadius: 12, background: "rgba(123,59,46,.08)" }}>
          <span style={{ flex: 1, fontSize: 14, textAlign: "left" }}>
            {props.shareLine}
            {props.shareGrid && (
              <span
                aria-hidden
                style={{
                  display: "block",
                  whiteSpace: "pre",
                  fontFamily: "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif",
                  fontSize: sheet ? 10 : 12,
                  lineHeight: 1.1,
                  margin: "6px 0 2px",
                }}
              >
                {props.shareGrid}
              </span>
            )}
            {props.shareUrl && <span style={{ display: "block", fontSize: 12, opacity: 0.6, marginTop: 2 }}>{props.shareUrl.replace(/^https?:\/\//, "")}</span>}
          </span>
          <Btn onClick={props.onCopy}>{props.shareLabel ?? (props.copied ? "Copied" : "Copy")}</Btn>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 18 }}>
        {!perfect && (
          <Btn small={sheet} onClick={props.onReveal}>
            Show a perfect fill
          </Btn>
        )}
        <Btn small={sheet} onClick={props.onShowMine}>
          Look at my quilt
        </Btn>
        <Btn small={sheet} primary onClick={props.onPlayAgain}>
          Play again (unscored)
        </Btn>
      </div>
      <StatsRow stats={props.stats} compact={sheet} />
      {props.saveHref && (
        <div style={{ fontSize: 13, marginTop: 12 }}>
          <a href={props.saveHref} style={{ color: BINDING, fontWeight: 500 }}>
            Sign in or create an account
          </a>{" "}
          to keep your quilts on every device.
        </div>
      )}
      <div style={{ fontSize: 12, marginTop: 12, opacity: 0.6 }}>A new quilt arrives at midnight.</div>
      <a
        href={props.moreGames.href}
        target={props.moreGames.newTab ? "_blank" : undefined}
        rel={props.moreGames.newTab ? "noopener" : undefined}
        style={{ display: "inline-block", marginTop: 8, fontSize: 14, fontWeight: 500, color: BINDING }}
      >
        More games by Bryce
      </a>
    </div>
  );
}

/** Paints the date's patchwork quilt behind the whole page while mounted. */
export function QuiltBackdrop({ dateKey }: { dateKey: string }) {
  const quilt = useMemo(() => quiltBackground(dateKey), [dateKey]);
  return (
    <GlobalStyles
      styles={{
        html: { overscrollBehavior: "none" },
        body: {
          background: `radial-gradient(ellipse at 50% 40%, rgba(45,25,15,0) 35%, rgba(45,25,15,.55) 100%) fixed, ${quilt} repeat fixed #8a6a55 !important`,
          // No rubber-band bounce or pull-to-refresh while playing; those dragged the whole page under a finger.
          overscrollBehavior: "none",
        },
        "@keyframes snugShimmer": { "0%, 100%": { opacity: 1, filter: "brightness(1)" }, "50%": { opacity: 0.85, filter: "brightness(1.35)" } },
        ".snug-gold": { animation: "snugShimmer 1.3s ease-in-out infinite" },
        // Scrollbars as sewing: a running stitch for the track and a striped yarn pill for the thumb.
        ".snug-scroll::-webkit-scrollbar": { width: 14 },
        ".snug-scroll::-webkit-scrollbar-track": {
          // Starts below the card's close button.
          margin: "46px 0 10px",
          background: "repeating-linear-gradient(to bottom, rgba(163,90,66,.55) 0 6px, transparent 6px 11px) center / 2px 100% no-repeat",
        },
        ".snug-scroll::-webkit-scrollbar-thumb": {
          borderRadius: 999,
          border: "3px solid transparent",
          backgroundClip: "padding-box",
          backgroundColor: BINDING,
          backgroundImage: "repeating-linear-gradient(135deg, rgba(255,246,230,.28) 0 2px, transparent 2px 5px)",
          boxShadow: `inset 0 0 0 1px ${BINDING}`,
        },
        ".snug-scroll::-webkit-scrollbar-thumb:hover": { backgroundColor: "#93493a" },
        // Firefox has no scrollbar parts, only colors; Chrome would drop the parts above if it saw these.
        "@supports (-moz-appearance: none)": { ".snug-scroll": { scrollbarWidth: "thin", scrollbarColor: `${BINDING} transparent` } },
        "@keyframes snugHover": { "0%, 100%": { transform: "translateY(-4px)" }, "50%": { transform: "translateY(-8px)" } },
        "@keyframes snugPopIn": { "0%": { transform: "scale(.92)", opacity: 0 }, "100%": { transform: "scale(1)", opacity: 1 } },
        "@keyframes snugFadeIn": { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        "@keyframes snugPopTop": {
          "0%": { transform: "translate(-50%,4%) scale(.92)", opacity: 0 },
          "100%": { transform: "translate(-50%,0) scale(1)", opacity: 1 },
        },
        "@keyframes snugPop": {
          "0%": { transform: "translate(-50%,-46%) scale(.92)", opacity: 0 },
          "100%": { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
        },
        // A help button that just unlocked pops in and sends out two rings of gold thread.
        "@keyframes snugAnnounce": {
          "0%": { transform: "scale(.6)", opacity: 0 },
          "70%": { transform: "scale(1.12)", opacity: 1 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        "@keyframes snugAnnounceRing": {
          "0%": { boxShadow: "0 0 0 0 rgba(246,196,69,.95)" },
          "100%": { boxShadow: "0 0 0 14px rgba(246,196,69,0)" },
        },
        ".snug-announce": { animation: "snugAnnounce 450ms ease-out, snugAnnounceRing 1s ease-out 450ms 2" },
        // The marked spare lifts out of the basket and wiggles before it greys.
        "@keyframes snugSpareLift": {
          "0%, 100%": { transform: "translateY(0) rotate(0)" },
          "20%": { transform: "translateY(-14%) rotate(-6deg)" },
          "35%": { transform: "translateY(-14%) rotate(6deg)" },
          "50%": { transform: "translateY(-14%) rotate(-4deg)" },
          "70%": { transform: "translateY(0) rotate(0)" },
        },
        ".snug-spare-lift": { animation: "snugSpareLift 1.1s ease-in-out", transformOrigin: "50% 100%" },
        // Its paper tag swings on and stays.
        "@keyframes snugTag": {
          "0%": { transform: "translate(-50%, -140%) rotate(-30deg)", opacity: 0 },
          "60%": { transform: "translate(-50%, -96%) rotate(8deg)", opacity: 1 },
          "100%": { transform: "translate(-50%, -100%) rotate(-4deg)", opacity: 1 },
        },
        ".snug-tag-swing": { animation: "snugTag 700ms ease-out both" },
        "@media (prefers-reduced-motion: reduce)": {
          ".snug-announce, .snug-spare-lift, .snug-tag-swing": { animation: "none" },
        },
      }}
    />
  );
}

/** The linen quilt top with its stitched binding, an optional drop preview, and hole marks. */
export function BoardSvg({
  board,
  cols,
  rows,
  cell,
  pad,
  style,
  ghost = null,
  holes = [],
  perfect = false,
}: {
  board: Cell[];
  cols: number;
  rows: number;
  cell: number;
  pad: number;
  style?: CSSProperties;
  ghost?: { cells: Cell[]; color: number } | null;
  holes?: Cell[];
  perfect?: boolean;
}) {
  const path = useMemo(() => outlinePath(board, U), [board]);
  // Loose basting stitches marking each cell of the quilt top.
  const basting = useMemo(() => {
    const rng = makeRng(`basting:${cols}x${rows}:${board.length}`);
    return board
      .map(([x, y]) => stitchLoops(insetCellLoops([[x, y]], U, 0.7), rng, { stitch: 1.1, gap: 0.75, wobble: 0.1, hole: 0 }).thread)
      .join("");
  }, [board, cols, rows]);
  const binding = useMemo(
    () => stitchLoops(insetCellLoops(board, U, -1.75), makeRng(`binding:${cols}x${rows}:${board.length}`), { stitch: 2.4, gap: 1.4, wobble: 0.22, hole: 0.32 }),
    [board, cols, rows],
  );
  const padU = pad * U;
  return (
    <svg
      style={{ overflow: "visible", ...style }}
      width={(cols + 2 * pad) * cell}
      height={(rows + 2 * pad) * cell}
      viewBox={`${-padU} ${-padU} ${cols * U + 2 * padU} ${rows * U + 2 * padU}`}
    >
      <path d={path} fill="none" stroke={BINDING} strokeWidth={7} strokeLinejoin="round" style={{ filter: "drop-shadow(0 1.5px 1.5px rgba(0,0,0,.35))" }} />

      <path d={path} fill="none" stroke={BINDING} strokeWidth={2.2} strokeLinejoin="round" />
      <path d={path} fill="url(#snug-linen)" />
      <Stitching paths={binding} width={1} color={perfect ? GOLD_THREAD : THREAD} className={perfect ? "snug-gold" : undefined} />
      <path d={basting} fill="none" stroke="#bf9e76" strokeWidth={0.42} strokeLinecap="round" opacity={0.85} />
      {ghost && (
        <path
          d={outlinePath(ghost.cells, U)}
          fill={YARNS[ghost.color]!.base}
          fillOpacity={0.28}
          stroke={YARNS[ghost.color]!.dark}
          strokeWidth={0.8}
          strokeDasharray="2 1.4"
        />
      )}
      {holes.map(([x, y]) => {
        // A small cross-stitch: two short stitches, the top one laid over the bottom, with needle holes at the ends.
        const [a, b] = [3.7, 6.3];
        const under = `M${x * U + a} ${y * U + a}L${x * U + b} ${y * U + b}`;
        const over = `M${x * U + b} ${y * U + a}L${x * U + a} ${y * U + b}`;
        return (
          <g key={`hole-${x},${y}`} strokeLinecap="round">
            <path d={under + over} stroke="rgba(60,25,12,.22)" strokeWidth={1} transform="translate(0 .35)" />
            <path d={under} stroke="#a8322a" strokeWidth={0.75} />
            <path d={over} stroke={RED_THREAD} strokeWidth={0.75} />
            {[
              [a, a],
              [b, b],
              [b, a],
              [a, b],
            ].map(([dx, dy]) => (
              <circle key={`${dx}${dy}`} cx={x * U + dx!} cy={y * U + dy!} r={0.22} fill="#6b4a36" opacity={0.45} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function MiniPatch({ shape, color, cell = 14, turned = 0 }: { shape: string; color: number; cell?: number; turned?: number }) {
  let cells = SHAPES[shape]!;
  for (let i = 0; i < turned; i++) cells = rotateCW(cells);
  return <PatchSvg piece={{ id: `howto-${shape}-${turned}`, cells, color, at: null }} cell={cell} interactive={false} onDown={() => {}} />;
}

function Arrow({ curve = false }: { curve?: boolean }) {
  return (
    <svg width={30} height={24} viewBox="0 0 30 24" style={{ flexShrink: 0 }}>
      <path d={curve ? "M6 18 A9 9 0 1 1 22 16" : "M3 12 H23"} fill="none" stroke={RUST_THREAD} strokeWidth={2.4} strokeLinecap="round" strokeDasharray="4 3" />
      <path d={curve ? "M17 13 L22.5 16.5 L24 10" : "M18 6 L25 12 L18 18"} fill="none" stroke={RUST_THREAD} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ flex: "1 1 120px", display: "grid", justifyItems: "center", gap: 8, padding: "12px 8px 10px", borderRadius: 14, background: "rgba(123,59,46,.07)" }}>
      <div style={{ height: 52, display: "flex", alignItems: "center", gap: 4 }}>{children}</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
    </div>
  );
}

const MINI_BOARD: Cell[] = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];
const MINI_CELL = 16;

/** A tiny 3 by 2 quilt with patches placed in board cells, optionally showing holes or a perfect fill. */
function MiniQuilt({ pieces, holes = [], perfect = false }: { pieces: { cells: Cell[]; color: number }[]; holes?: Cell[]; perfect?: boolean }) {
  const pad = 0.45 * MINI_CELL;
  return (
    <div style={{ position: "relative" }}>
      <BoardSvg board={MINI_BOARD} cols={3} rows={2} cell={MINI_CELL} pad={0.45} holes={holes} perfect={perfect} />
      {pieces.map((pc, i) => {
        const x = Math.min(...pc.cells.map((c) => c[0]));
        const y = Math.min(...pc.cells.map((c) => c[1]));
        const cells = pc.cells.map(([cx, cy]) => [cx - x, cy - y] as Cell);
        return (
          <div key={i} style={{ position: "absolute", left: pad + x * MINI_CELL, top: pad + y * MINI_CELL }}>
            <PatchSvg piece={{ id: `mini-${perfect ? "full" : "gap"}-${i}`, cells, color: pc.color, at: null }} cell={MINI_CELL} interactive={false} onDown={() => {}} />
          </div>
        );
      })}
    </div>
  );
}

/** A round stitched X in a card's top-right corner; it sits outside the scrolling content so it is always visible. */
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      title="Close"
      onClick={onClick}
      style={{
        position: "absolute",
        top: 18,
        right: 18,
        zIndex: 2,
        width: 34,
        height: 34,
        borderRadius: 999,
        border: "none",
        background: LINEN,
        boxShadow: "0 2px 6px rgba(60,30,15,.25)",
        color: INK,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
      }}
    >
      <StitchBorder inset={3.5} radius={14} color={RUST_THREAD} width={1.3} stitch={3.5} gap={2.6} seed="close" />
      <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden>
        <path d="M2 2L12 12M12 2L2 12" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** A stitched linen card over a dimmed page, closed by its X, Esc, or a tap outside. */
export function StitchedModal({ label, onClose, width = 480, children }: { label: string; onClose: () => void; width?: number; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1300, display: "grid", placeItems: "center", padding: 12, background: "rgba(40,22,14,.5)", animation: "snugFadeIn 200ms ease-out" }}
    >
      <div
        role="dialog"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          display: "flex",
          width: `min(${width}px, 100%)`,
          maxHeight: "calc(100dvh - 24px)",
          padding: 15,
          borderRadius: 20,
          background: LINEN,
          boxShadow: "0 24px 60px rgba(30,15,8,.5)",
          animation: "snugPopIn 260ms ease-out",
          fontFamily: FONT,
          color: INK,
        }}
      >
        <StitchBorder inset={10} radius={13} color={RUST_THREAD} width={2.2} stitch={7} gap={4.5} seed={label} />
        <CloseButton onClick={onClose} />
        {/* Content scrolls inside the stitched edge so the seam stays put. */}
        <div className="snug-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 8px 6px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** The rules, shown as a stitched card over a dimmed page. */
export function HowToPlay({ onClose, touch, spares }: { onClose: () => void; touch: boolean; spares: number }) {
  const section = (heading: string, body: ReactNode) => (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 15 }}>{heading}</div>
      <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>{body}</div>
    </div>
  );
  return (
    <StitchedModal label="How to play" onClose={onClose}>
        <div style={{ fontFamily: SCRIPT, fontSize: 44, lineHeight: 1, color: BINDING, fontWeight: 700, textAlign: "center" }}>How to play</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <Step title="Drag a patch in">
            <MiniPatch shape="T4" color={5} />
            <Arrow />
            <BoardSvg board={[[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]} cols={3} rows={2} cell={14} pad={0.45} />
          </Step>
          <Step title={touch ? "Tap to turn" : "Tap, Space, R, or E to turn"}>
            <MiniPatch shape="L4" color={1} />
            <Arrow curve />
            <MiniPatch shape="L4" color={1} turned={1} />
          </Step>
          <Step title="Leave no holes">
            <MiniQuilt
              pieces={[
                { cells: [[0, 0], [1, 0], [0, 1]], color: 3 },
                { cells: [[2, 0], [2, 1]], color: 8 },
              ]}
              holes={[[1, 1]]}
            />
            <Arrow />
            <MiniQuilt
              pieces={[
                { cells: [[0, 0], [1, 0], [0, 1]], color: 3 },
                { cells: [[2, 0], [2, 1], [1, 1]], color: 0 },
              ]}
              perfect
            />
          </Step>
        </div>
        {section("Fill the quilt", "Every square of today's quilt can be filled exactly with patches from the basket.")}
        {section(
          "Watch for spares",
          `You will not need every patch: ${spares === 1 ? "1 is a spare" : `${spares} are spares`} left over in the intended fill. Working out which is part of the puzzle, but any fill with no holes is perfect, even one that uses a spare.`,
        )}
        {section(
          "Move and turn",
          <>
            Drag a patch onto the quilt and it snaps into place.{" "}
            {touch
              ? "Tap a patch to turn it, or use the turn buttons under the quilt to turn it either way."
              : "Tap it, or press Space, R, or E (even mid-drag), to turn it; Q or Shift+R turns it back."}{" "}
            Patches turn but never flip. Turn a placed patch where it no longer fits and it hovers in red thread until you turn or move it again. Undo
            takes back your last move{touch ? "" : " (Ctrl+Z or Cmd+Z)"}.
          </>,
        )}
        {!touch &&
          section("Keyboard", "Press Tab to pick a patch, move it with the arrow keys, press Enter to stitch it down, and Esc to put it back.")}
        {section("Scoring", "Fewer holes is better, and time breaks ties. The clock starts with your first patch. A perfect fill finishes on its own; otherwise press Tie it off.")}
        {section("Stuck?", "After 3 minutes you can mark a spare for free: it gets a spare tag and turns grey, and you can still use it. After 5 minutes you can use a hint, and after 10 minutes a second one. Each stitches a patch into its spot in the intended fill in gold thread; you can still move it, and your result notes how many hints you used.")}
        {section(
          "One quilt a day",
          "Your first finish each day is your recorded result, and your best run on every day is kept too. Replays and past quilts are not scored. Tap the date to open the calendar and jump to any day. A new quilt arrives at midnight: gentle on Monday, trickier through the week, toughest on Sunday.",
        )}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <Btn primary onClick={onClose}>
            Start stitching
          </Btn>
        </div>
    </StitchedModal>
  );
}

/** Where the credit links: Bryce's games gallery, in a new tab when Snug is framed by another site. */
export type MoreGamesLink = { href: string; newTab: boolean };

function StatsRow({ stats, compact }: { stats: Stats; compact: boolean }) {
  const pct = stats.played ? Math.round((stats.perfect / stats.played) * 100) : 0;
  const items: [string, string][] = [
    ["Played", String(stats.played)],
    ["Perfect", `${pct}%`],
    ["Streak", String(stats.streak)],
    ["Best", String(stats.bestStreak)],
  ];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: compact ? 14 : 20, marginTop: 16 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ minWidth: 44 }}>
          <div style={{ fontSize: compact ? 20 : 24, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</div>
          <div style={{ fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase", opacity: 0.6 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/** A maker's label sewn into the panel's bottom edge, the way quilters sign their work. */
export function QuiltLabel({ link }: { link: MoreGamesLink }) {
  return (
    <a
      href={link.href}
      target={link.newTab ? "_blank" : undefined}
      rel={link.newTab ? "noopener" : undefined}
      title="More games by Bryce"
      style={{
        position: "absolute",
        right: 34,
        bottom: -15,
        zIndex: 2,
        display: "block",
        padding: "7px 16px 6px",
        borderRadius: 4,
        transform: "rotate(-2.5deg)",
        background: "#fffaf0",
        boxShadow: "0 3px 8px rgba(30,15,8,.35)",
        color: INK,
        textDecoration: "none",
        textAlign: "center",
        lineHeight: 1.05,
      }}
    >
      <StitchBorder inset={3.5} radius={2} color={RUST_THREAD} width={1.2} stitch={3.5} gap={2.5} seed="maker-label" />
      <span style={{ display: "block", fontFamily: SCRIPT, fontSize: 19, fontWeight: 700, color: BINDING }}>Sewn by Bryce</span>
      <span style={{ display: "block", fontSize: 10, letterSpacing: 0.6, opacity: 0.7 }}>bstocksharp.dev</span>
    </a>
  );
}
