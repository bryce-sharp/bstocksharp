import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { addDays, formatDuration, formatLongDate, formatShortDate, loadAttempt, puzzleNumber, saveAttempt, todayKey } from "../daily";
import { generatePuzzle } from "./generator";
import { bounds, cellKey, rotateCCW, rotateCW, shapeKey, type Cell } from "./pieces";
import { BINDING, LINEN, YARNS } from "./quilt";
import { StitchBorder } from "./stitches";
import { QuiltCalendar } from "./calendar";
import { GAME, loadBest, playerStats, saveBest } from "./records";
import { quiltGrid } from "./share";
import { SNUG_FONTS } from "./fonts";
import { Basket } from "./basket";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import { BoardSvg, Btn, FONT, HowToPlay, INK, KnitDefs, PanelStitches, PatchSvg, QuiltBackdrop, QuiltLabel, RUST_THREAD, ResultCard, SCRIPT, Stat, panelStyle, plural, type Attempt, type MoreGamesLink, type PieceState, type Spot } from "./parts";

const HOW_TO_SEEN = "snug.howToSeen";
/** Backdated a week so there are past quilts to play from day one. */
const LAUNCH_DATE = "2026-10-01";
const MAX_CELL = 54;
const MIN_CELL = 18;
/** Room below the play area for the buttons, the panel's bottom padding, and the maker's label. */
const FOOTER_H = 112;
/** Room around the board for its binding, in cells. */
const BOARD_PAD = 0.45;
/** Side-by-side is kept whenever pieces stay at least this many pixels per square. */
const SIDE_MIN_CELL = 30;
/** Below this, a stacked layout lets the header scroll away to keep pieces usable. */
const STACK_MIN_CELL = 28;

interface Slot {
  x: number;
  y: number;
  size: number;
}

/** Packs square basket slots (sizes in cells) into centered rows `widthCells` wide. */
function packTray(sizes: number[], widthCells: number): { slots: Slot[]; w: number; h: number } {
  const slots: Slot[] = [];
  let row: number[] = [];
  let y = 0;
  let maxW = 0;
  const flush = () => {
    const rowW = row.reduce((a, i) => a + sizes[i]!, 0);
    const rowH = Math.max(...row.map((i) => sizes[i]!));
    let x = (widthCells - rowW) / 2;
    for (const i of row) {
      slots[i] = { x, y: y + (rowH - sizes[i]!) / 2, size: sizes[i]! };
      x += sizes[i]!;
    }
    maxW = Math.max(maxW, rowW);
    y += rowH;
    row = [];
  };
  let used = 0;
  sizes.forEach((size, i) => {
    if (row.length && used + size > widthCells) {
      flush();
      used = 0;
    }
    row.push(i);
    used += size;
  });
  if (row.length) flush();
  return { slots, w: maxW, h: y };
}

/** Today's unfinished scored game, saved as it goes so leaving and returning cannot reset the clock. */
interface Progress {
  pieces: PieceState[];
  elapsedMs: number;
  started: boolean;
  /** The piece the one-time hint placed, so a reload cannot earn a second hint. */
  hintId?: string | null;
}

/** Active play time before the one-time hint becomes available. */
const HINT_AFTER_MS = 5 * 60_000;

const progressKey = (dateKey: string) => `${GAME}.progress.${dateKey}`;

function loadProgress(dateKey: string): Progress | null {
  try {
    const raw = localStorage.getItem(progressKey(dateKey));
    return raw ? (JSON.parse(raw) as Progress) : null;
  } catch {
    return null;
  }
}

function saveProgress(dateKey: string, progress: Progress | null) {
  try {
    if (progress) localStorage.setItem(progressKey(dateKey), JSON.stringify(progress));
    else localStorage.removeItem(progressKey(dateKey));
  } catch {
    // Storage can be blocked; progress then only lasts while the page is open.
  }
}

interface Drag {
  id: string;
  /** Index of the held cell, which stays under the pointer through rotations. */
  grab: number;
  fx: number;
  fy: number;
  sx: number;
  sy: number;
  px: number;
  py: number;
  /** Pixels the piece floats above the pointer; set for touch so a finger does not hide it. */
  lift: number;
  moved: boolean;
}

/** A patch moved with the keyboard: it hovers over the quilt at `at` until Enter stitches it down. */
interface Carry {
  id: string;
  at: Spot;
}

const SITE = "https://www.bstocksharp.dev";
const UNDO_LIMIT = 100;
const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const shift = (cells: readonly Cell[], s: Spot) => cells.map(([x, y]) => [x + s.x, y + s.y] as Cell);

/** `shareUrl` is the link players share; it defaults to this site's Snug page. */
export function Snug({ shareUrl }: { shareUrl?: string }) {
  const [today, setToday] = useState(() => todayKey());
  const [dateKey, setDateKey] = useState(today);
  // A tab left open past midnight learns the new date within a minute, or as soon as it is looked at again.
  useEffect(() => {
    const check = () => setToday(todayKey());
    const t = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  const moreGames = useMemo<MoreGamesLink>(
    () => (window.self !== window.top ? { href: `${SITE}/games`, newTab: true } : { href: "/games", newTab: false }),
    [],
  );
  return (
    <div className={SNUG_FONTS}>
      <SnugDay
        key={dateKey}
        dateKey={dateKey}
        today={today}
        onPickDate={setDateKey}
        shareUrl={shareUrl ?? `${window.location.origin}/games/snug`}
        moreGames={moreGames}
      />
    </div>
  );
}

/** One day's quilt. Only today's first finish is scored; every finish updates that day's best run. */
function SnugDay({
  dateKey,
  today,
  onPickDate,
  shareUrl,
  moreGames,
}: {
  dateKey: string;
  today: string;
  onPickDate: (key: string) => void;
  shareUrl: string;
  moreGames: MoreGamesLink;
}) {
  // Scoring follows the date this quilt was opened on, so a game running past midnight stays scored.
  const [openedOn] = useState(today);
  const isArchive = dateKey < openedOn;
  const newQuilt = today > openedOn && dateKey === openedOn;
  const puzzle = useMemo(() => generatePuzzle(dateKey, YARNS.length), [dateKey]);
  const number = puzzleNumber(dateKey, LAUNCH_DATE);
  const boardSet = useMemo(() => new Set(puzzle.board.map(([x, y]) => cellKey(x, y))), [puzzle]);
  // A finished first run is shown on any day, including past ones; only unplayed past days are fresh practice.
  const initial = useMemo(() => loadAttempt<Attempt>(GAME, dateKey), [dateKey]);
  const bestInit = useMemo(() => loadBest(dateKey), [dateKey]);
  // Opens finished on the scored run; a past day you only practiced opens on your best practice run.
  const shown = initial ?? (isArchive ? bestInit : null);
  // Any unfinished first run (today's scored game or a past day's practice) is saved as it goes and restored.
  const progress = useMemo(() => (shown ? null : loadProgress(dateKey)), [dateKey, shown]);
  const freshPieces = useCallback(
    (): PieceState[] => puzzle.pieces.map((p) => ({ id: p.id, cells: p.cells, color: p.color, at: null })),
    [puzzle],
  );

  const [recorded, setRecorded] = useState<Attempt | null>(initial);
  const [pieces, setPieces] = useState<PieceState[]>(() => shown?.pieces ?? progress?.pieces ?? freshPieces());
  const [phase, setPhase] = useState<"playing" | "done">(shown ? "done" : "playing");
  const [result, setResult] = useState<{ gaps: number; timeMs: number; hinted?: boolean } | null>(shown);
  const [bestRun, setBestRun] = useState<Attempt | null>(bestInit);
  const [showCalendar, setShowCalendar] = useState(false);
  const [isReplay, setIsReplay] = useState(false);
  const [showCard, setShowCard] = useState(!!shown);
  const [revealing, setRevealing] = useState(false);
  // The quilt you finished with: the recorded run when returning later, or this session's latest replay.
  const [finalPieces, setFinalPieces] = useState<PieceState[] | null>(shown?.pieces ?? null);
  const [confirming, setConfirming] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [carry, setCarry] = useState<Carry | null>(null);
  const carryRef = useRef(carry);
  carryRef.current = carry;
  /** Read aloud by screen readers after each move. */
  const [said, setSaid] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHowTo, setShowHowTo] = useState(() => {
    try {
      return !shown && !localStorage.getItem(HOW_TO_SEEN);
    } catch {
      return false;
    }
  });
  const closeHowTo = useCallback(() => {
    setShowHowTo(false);
    try {
      localStorage.setItem(HOW_TO_SEEN, "1");
    } catch {
      // Private browsing can block storage; the guide just shows again next time.
    }
  }, []);
  const modalOpen = showHowTo || showCalendar;
  const modalRef = useRef(modalOpen);
  modalRef.current = modalOpen;
  // Ticks the visible clock; the value itself is read from `clock`.
  const [, setNow] = useState(() => Date.now());
  const [width, setWidth] = useState(0);
  const [viewH, setViewH] = useState(() => window.innerHeight);
  const coarsePointer = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);
  /** The play area's distance from the top of the page, including any site header above the game. */
  const [topY, setTopY] = useState(200);
  const dragRef = useRef<Drag | null>(null);
  const lastGrab = useRef(0);
  // Active time only: `base` is time already played, `since` marks when the current running stretch began.
  const clock = useRef({ base: progress?.elapsedMs ?? 0, since: null as number | null, started: progress?.started ?? false });
  // Only today's scored game comes back covered; practice picks up where it left off.
  const [paused, setPaused] = useState(!!progress?.started && !isArchive);
  const [hintId, setHintId] = useState<string | null>(progress?.hintId ?? null);
  const hintRef = useRef(hintId);
  hintRef.current = hintId;
  const playRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = playRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setWidth(r.width);
      setTopY(r.top + window.scrollY);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The header grows when fonts load, which moves the play area down.
    if (topRef.current) ro.observe(topRef.current);
    // A site header sliding in or out moves the play area; re-lay out once it settles, not on every frame.
    let settle = 0;
    const page = new ResizeObserver(() => {
      window.clearTimeout(settle);
      settle = window.setTimeout(measure, 150);
    });
    page.observe(document.body);
    let lastWidth = window.innerWidth;
    const onResize = () => {
      // Phone browsers change the height as the address bar hides and shows while scrolling; re-laying out then
      // resizes the game mid-drag. On touch screens only a width change (rotation) re-lays out.
      if (coarsePointer && window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      setViewH(window.innerHeight);
      measure();
    };
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      page.disconnect();
      window.clearTimeout(settle);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Touches that start anywhere in the play area never scroll the page, even when they miss a piece.
  useEffect(() => {
    const el = playRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, []);

  // Each piece's basket slot is sized by its longest side, so turning a piece never reflows the basket.
  const longest = useMemo(() => puzzle.pieces.map((p) => Math.max(bounds(p.cells).w, bounds(p.cells).h)), [puzzle]);

  // Prefers the basket beside the board; stacks it underneath only when the side layout would make pieces too small.
  const layout = useMemo(() => {
    const bw = puzzle.cols + 2 * BOARD_PAD;
    const bh = puzzle.rows + 2 * BOARD_PAD;
    const availW = Math.max(200, width - 8);
    const room = viewH - topY - FOOTER_H;

    const trySide = (cell: number) => {
      const scale = 0.6;
      const sizes = longest.map((m) => m * scale + 0.7);
      for (const trayCells of [11, 9.5, 8, 6.5]) {
        if ((bw + 1 + trayCells) * cell > availW) continue;
        const pack = packTray(sizes, trayCells);
        if (Math.max(bh, pack.h) * cell <= room) return { scale, trayCells, pack };
      }
      return null;
    };
    const tryStack = (cell: number, height: number) => {
      const scale = 0.45;
      const trayCells = Math.min(availW / cell, Math.max(bw, 12));
      if (bw * cell > availW) return null;
      const pack = packTray(longest.map((m) => m * scale + 0.55), trayCells);
      return (bh + 0.5 + pack.h) * cell <= height ? { scale, trayCells, pack } : null;
    };

    let side = true;
    let cell = MAX_CELL;
    let pick = null as ReturnType<typeof trySide>;
    for (; cell >= SIDE_MIN_CELL && !(pick = trySide(cell)); cell--);
    if (!pick) {
      side = false;
      for (cell = MAX_CELL; cell >= STACK_MIN_CELL && !(pick = tryStack(cell, room)); cell--);
      if (!pick) for (cell = MAX_CELL; cell > MIN_CELL && !(pick = tryStack(cell, viewH - FOOTER_H - 16)); cell--);
      pick ??= tryStack(MIN_CELL, Infinity)!;
    }
    const { scale, trayCells, pack } = pick!;
    const areaW = bw * cell;
    const areaH = bh * cell;
    const trayW = trayCells * cell;
    const trayH = pack.h * cell;
    const gap = side ? cell : cell / 2;
    const totalW = side ? areaW + gap + trayW : Math.max(areaW, trayW);
    const left = Math.max(0, (width - totalW) / 2);
    const height = side ? Math.max(areaH, trayH) : areaH + gap + trayH;
    const areaX = side ? left : left + (totalW - areaW) / 2;
    const areaY = side ? (height - areaH) / 2 : 0;
    const tray = side
      ? { x: left + areaW + gap, y: (height - trayH) / 2, w: trayW, h: trayH }
      : { x: left + (totalW - trayW) / 2, y: areaH + gap, w: trayW, h: trayH };
    return {
      side,
      cell,
      trayScale: scale,
      slots: pack.slots.map((sl) => ({ x: tray.x + sl.x * cell, y: tray.y + sl.y * cell, size: sl.size * cell })),
      board: { x: areaX + BOARD_PAD * cell, y: areaY + BOARD_PAD * cell },
      tray,
      height,
    };
  }, [width, viewH, topY, puzzle, longest]);

  const latest = useRef({ pieces, layout });
  latest.current = { pieces, layout };

  // Undo keeps whole snapshots of the board; the hint and finishing clear it, since neither can be taken back.
  const history = useRef<PieceState[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const commit = useCallback((next: PieceState[]) => {
    history.current.push(latest.current.pieces);
    if (history.current.length > UNDO_LIMIT) history.current.shift();
    setUndoCount(history.current.length);
    setPieces(next);
  }, []);
  const clearHistory = () => {
    history.current = [];
    setUndoCount(0);
  };
  const holesIn = (all: PieceState[]) => puzzle.board.length - all.reduce((n, p) => n + (p.at && !p.loose ? p.cells.length : 0), 0);

  const fits = useCallback(
    (cells: readonly Cell[], at: Spot, id: string, all: PieceState[]) => {
      const taken = new Set<string>();
      for (const p of all) if (p.id !== id && p.at && !p.loose) for (const [x, y] of shift(p.cells, p.at)) taken.add(cellKey(x, y));
      return shift(cells, at).every(([x, y]) => boardSet.has(cellKey(x, y)) && !taken.has(cellKey(x, y)));
    },
    [boardSet],
  );

  const snapFor = useCallback(
    (d: Drag, all: PieceState[]): Spot | null => {
      const p = all.find((q) => q.id === d.id);
      if (!p) return null;
      const { cell, board } = latest.current.layout;
      const [cx, cy] = p.cells[d.grab]!;
      const spot = {
        x: Math.round((d.px - (cx + d.fx) * cell - board.x) / cell),
        y: Math.round((d.py - d.lift - (cy + d.fy) * cell - board.y) / cell),
      };
      return fits(p.cells, spot, p.id, all) ? spot : null;
    },
    [fits],
  );

  /** Turns a piece; a placed piece pivots on `anchor` and hovers loose if it no longer fits. */
  const transformPiece = useCallback(
    (id: string, fn: (cells: readonly Cell[]) => Cell[], anchor: number) => {
      if (id === hintRef.current) return;
      commit(
        latest.current.pieces.map((p) => {
          if (p.id !== id) return p;
          const cells = fn(p.cells);
          if (!p.at || dragRef.current?.moved || carryRef.current?.id === id) return { ...p, cells };
          // A shape that looks the same after turning stays put instead of pivoting off its spot.
          const at =
            shapeKey(cells) === shapeKey(p.cells)
              ? p.at
              : { x: p.at.x + p.cells[anchor]![0] - cells[anchor]![0], y: p.at.y + p.cells[anchor]![1] - cells[anchor]![1] };
          return { ...p, cells, at, loose: !fits(cells, at, id, latest.current.pieces) };
        }),
      );
      if (dragRef.current?.id === id) {
        dragRef.current = { ...dragRef.current, fx: 0.5, fy: 0.5 };
        setDrag(dragRef.current);
      }
    },
    [fits, commit],
  );

  /** Puts a patch at `spot` on the quilt, or back in the basket when `spot` is null. */
  const placeAt = useCallback(
    (id: string, spot: Spot | null) => {
      const all = latest.current.pieces;
      const p = all.find((q) => q.id === id);
      if (!p) return;
      const same = spot ? !!p.at && !p.loose && p.at.x === spot.x && p.at.y === spot.y : !p.at;
      if (same) return;
      if (spot && !clock.current.started) {
        clock.current.started = true;
        clock.current.since = Date.now();
      }
      const next = all.map((q) => (q.id === id ? { ...q, at: spot, loose: false } : q));
      commit(next);
      setSaid(spot ? `Stitched down. ${plural(holesIn(next), "hole")} left.` : "Back in the basket.");
    },
    // holesIn only reads the puzzle, which never changes for this day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit],
  );

  const undo = () => {
    const prev = history.current.pop();
    if (!prev) return;
    setUndoCount(history.current.length);
    setPieces(prev);
    setCarry(null);
    setSaid("Undone.");
  };

  const piecePos = (p: PieceState, index: number) => {
    const { cell, board, slots } = layout;
    if (drag?.moved && drag.id === p.id) {
      const [cx, cy] = p.cells[drag.grab]!;
      return { x: drag.px - (cx + drag.fx) * cell, y: drag.py - drag.lift - (cy + drag.fy) * cell, s: 1 };
    }
    const at = carry?.id === p.id ? carry.at : p.at;
    if (at) return { x: board.x + at.x * cell, y: board.y + at.y * cell, s: 1 };
    const { w, h } = bounds(p.cells);
    const slot = slots[index]!;
    return {
      x: slot.x + (slot.size - w * cell * layout.trayScale) / 2,
      y: slot.y + (slot.size - h * cell * layout.trayScale) / 2,
      s: layout.trayScale,
    };
  };

  const pointerIn = (e: { clientX: number; clientY: number }) => {
    const r = playRef.current!.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };

  const onPieceDown = (e: ReactPointerEvent, p: PieceState, index: number, grab: number) => {
    if (phase !== "playing" || e.button !== 0 || p.id === hintId) return;
    e.preventDefault();
    const { px, py } = pointerIn(e);
    const pos = piecePos(p, index);
    const size = layout.cell * pos.s;
    const d: Drag = {
      id: p.id,
      grab,
      fx: clamp((px - pos.x) / size - p.cells[grab]![0], 0, 1),
      fy: clamp((py - pos.y) / size - p.cells[grab]![1], 0, 1),
      sx: px,
      sy: py,
      px,
      py,
      lift: e.pointerType === "touch" ? layout.cell * 1.2 : 0,
      moved: false,
    };
    dragRef.current = d;
    lastGrab.current = grab;
    setCarry(null);
    setDrag(d);
    setSelected(p.id);
    setConfirming(false);
  };

  /** A press anywhere in a basket slot picks up that slot's piece by its nearest square. */
  const onSlotDown = (e: ReactPointerEvent, p: PieceState, index: number) => {
    const { px, py } = pointerIn(e);
    const pos = piecePos(p, index);
    const size = layout.cell * pos.s;
    const lx = (px - pos.x) / size;
    const ly = (py - pos.y) / size;
    let grab = 0;
    let best = Infinity;
    p.cells.forEach(([cx, cy], i) => {
      const d = (cx + 0.5 - lx) ** 2 + (cy + 0.5 - ly) ** 2;
      if (d < best) {
        best = d;
        grab = i;
      }
    });
    onPieceDown(e, p, index, grab);
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const { px, py } = pointerIn(e);
      const next = { ...d, px, py, moved: d.moved || Math.hypot(px - d.sx, py - d.sy) > 5 };
      dragRef.current = next;
      setDrag(next);
    };
    const up = () => {
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!d) return;
      if (!d.moved) {
        transformPiece(d.id, rotateCW, d.grab);
        return;
      }
      placeAt(d.id, snapFor(d, latest.current.pieces));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [dragging, snapFor, transformPiece, placeAt]);

  const undoRef = useRef(undo);
  undoRef.current = undo;
  useEffect(() => {
    const ARROWS: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
    const onKey = (e: KeyboardEvent) => {
      if (phase !== "playing" || paused || modalRef.current) return;
      const key = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && key === "z" && !e.shiftKey) {
        if (dragRef.current) return;
        e.preventDefault();
        undoRef.current();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const id = dragRef.current?.id ?? carryRef.current?.id ?? selected;
      if (!id || id === hintRef.current) return;
      const anchor = dragRef.current?.grab ?? lastGrab.current;
      const turn = key === "q" || (key === "r" && e.shiftKey) ? rotateCCW : key === " " || key === "r" || key === "e" ? rotateCW : null;
      if (turn) {
        // Stops Space from scrolling the page or clicking a focused button.
        e.preventDefault();
        if (!e.repeat) transformPiece(id, turn, anchor);
        return;
      }
      if (dragRef.current) return;
      // Arrows, Enter, and Esc act only from a patch or the page itself, so buttons keep their own keys.
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && target !== document.body && !target.closest("[data-piece]")) return;
      const p = latest.current.pieces.find((q) => q.id === id);
      if (!p) return;
      const carried = carryRef.current?.id === id ? carryRef.current : null;
      const delta = ARROWS[key];
      if (delta) {
        e.preventDefault();
        const { w, h } = bounds(p.cells);
        const from = carried?.at ?? p.at ?? { x: Math.floor((puzzle.cols - w) / 2), y: Math.floor((puzzle.rows - h) / 2) };
        // The first arrow picks the patch up where it is; later ones move it a square at a time.
        const at = carried ? { x: clamp(from.x + delta[0], 0, puzzle.cols - w), y: clamp(from.y + delta[1], 0, puzzle.rows - h) } : from;
        setCarry({ id, at });
        return;
      }
      if (key === "enter" && carried) {
        e.preventDefault();
        if (fits(p.cells, carried.at, id, latest.current.pieces)) {
          placeAt(id, carried.at);
          setCarry(null);
        } else {
          setSaid("That patch does not fit there.");
        }
        return;
      }
      if (key === "escape" && carried) {
        e.preventDefault();
        setCarry(null);
        return;
      }
      if ((key === "backspace" || key === "delete") && p.at) {
        e.preventDefault();
        setCarry(null);
        placeAt(id, null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, paused, selected, transformPiece, placeAt, fits, puzzle]);

  const liftedId = drag?.moved ? drag.id : (carry?.id ?? null);
  const covered = pieces.reduce((n, p) => n + (p.at && !p.loose && p.id !== liftedId ? p.cells.length : 0), 0);
  const gaps = puzzle.board.length - covered;

  const scored = !isArchive && !isReplay && !initial;
  // Replays are throwaway; every other unfinished run is saved so leaving and returning keeps the clock and board.
  const saved = !isReplay && !shown;
  const clockMs = () => clock.current.base + (clock.current.since === null ? 0 : Date.now() - clock.current.since);
  const stopClock = useCallback(() => {
    const c = clock.current;
    if (c.since !== null) {
      c.base += Date.now() - c.since;
      c.since = null;
    }
  }, []);
  const runClock = useCallback(() => {
    const c = clock.current;
    if (c.started && c.since === null) c.since = Date.now();
  }, []);

  const live = useRef({ scored, saved, phase, pieces, hintId });
  live.current = { scored, saved, phase, pieces, hintId };
  const persist = useCallback(() => {
    const { saved: isSaved, phase: ph, pieces: ps } = live.current;
    if (!isSaved || ph !== "playing") return;
    const c = clock.current;
    saveProgress(dateKey, {
      pieces: ps,
      elapsedMs: c.base + (c.since === null ? 0 : Date.now() - c.since),
      started: c.started,
      hintId: live.current.hintId,
    });
  }, [dateKey]);

  useEffect(persist, [pieces, hintId, persist]);

  // Leaving the tab, switching days, or closing the page stops the clock and saves; the scored game comes back covered.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        stopClock();
        persist();
        if (live.current.scored && live.current.phase === "playing" && clock.current.started) setPaused(true);
      } else if (!live.current.scored && !modalRef.current) runClock();
    };
    const onPageHide = () => {
      stopClock();
      persist();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      stopClock();
      persist();
    };
  }, [persist, runClock, stopClock]);

  // Reading the rules or the calendar never costs time; on mount this also resumes a restored practice game.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  useEffect(() => {
    if (modalOpen) {
      stopClock();
      persist();
    } else if (!pausedRef.current) {
      runClock();
    }
  }, [modalOpen, persist, runClock, stopClock]);

  const resume = () => {
    setPaused(false);
    runClock();
  };

  const finish = useCallback(() => {
    stopClock();
    const timeMs = clock.current.base;
    if (saved) saveProgress(dateKey, null);
    const settledPieces = pieces.map((p) => (p.loose ? { ...p, at: null, loose: false } : p));
    setPieces(settledPieces);
    setCarry(null);
    history.current = [];
    setUndoCount(0);
    setSaid(gaps === 0 ? "Perfectly snug!" : `Tied off with ${plural(gaps, "hole")}.`);
    setFinalPieces(settledPieces);
    setResult({ gaps, timeMs, hinted: !!hintId });
    setPhase("done");
    setConfirming(false);
    setSelected(null);
    setBestRun(saveBest(dateKey, { gaps, timeMs, pieces: settledPieces, hinted: !!hintId }));
    if (!isReplay && !isArchive) {
      const attempt: Attempt = { gaps, timeMs, pieces: settledPieces, hinted: !!hintId };
      if (saveAttempt(GAME, dateKey, attempt)) setRecorded(attempt);
    }
    window.setTimeout(() => setShowCard(true), gaps === 0 ? 1500 : 250);
  }, [gaps, isReplay, isArchive, pieces, dateKey, saved, stopClock, hintId]);

  useEffect(() => {
    if (phase === "playing" && !dragging && gaps === 0) finish();
  }, [phase, dragging, gaps, finish]);

  useEffect(() => {
    if (phase !== "playing") return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [phase]);

  const playAgain = () => {
    setPieces(freshPieces());
    clearHistory();
    setCarry(null);
    setPhase("playing");
    setIsReplay(true);
    setResult(null);
    setShowCard(false);
    setRevealing(false);
    setCopied(false);
    setSelected(null);
    clock.current = { base: 0, since: null, started: false };
    setPaused(false);
    setHintId(null);
  };

  /** Places one solution patch where it belongs, moving anything in its way back to the basket. */
  const applyHint = () => {
    if (hintId) return;
    const placed = (p: PieceState) => (p.at && !p.loose ? new Set(shift(p.cells, p.at).map(([x, y]) => cellKey(x, y))) : null);
    const target = (id: string) => {
      const s = puzzle.solution[id]!;
      return new Set(shift(s.cells, { x: s.x, y: s.y }).map(([x, y]) => cellKey(x, y)));
    };
    const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));
    const occupied = pieces.map(placed);
    const satisfied = (id: string) => occupied.some((o) => o && same(o, target(id)));
    const ids = Object.keys(puzzle.solution).filter((id) => !satisfied(id));
    // Prefer a patch still in the basket, then the one whose spot disturbs the fewest placed patches, then the biggest.
    const cost = (id: string) => {
      const t = target(id);
      const inWay = occupied.filter((o, i) => o && pieces[i]!.id !== id && [...o].some((k) => t.has(k))).length;
      const onBoard = pieces.find((p) => p.id === id)?.at ? 1 : 0;
      return onBoard * 100 + inWay * 10 - t.size;
    };
    const pick = ids.sort((a, b) => cost(a) - cost(b))[0];
    if (!pick) return;
    const t = target(pick);
    const sol = puzzle.solution[pick]!;
    clearHistory();
    setCarry(null);
    setPieces((all) =>
      all.map((p) => {
        if (p.id === pick) return { ...p, cells: sol.cells, at: { x: sol.x, y: sol.y }, loose: false };
        const o = placed(p);
        return o && [...o].some((k) => t.has(k)) ? { ...p, at: null, loose: false } : p;
      }),
    );
    setHintId(pick);
    setSelected(null);
  };

  const reveal = () => {
    setPieces((all) =>
      all.map((p) => {
        const s = puzzle.solution[p.id];
        return s ? { ...p, cells: s.cells, at: { x: s.x, y: s.y }, loose: false } : { ...p, at: null, loose: false };
      }),
    );
    setRevealing(true);
    setShowCard(false);
  };

  const showMine = () => {
    if (finalPieces) setPieces(finalPieces);
    setRevealing(false);
    setShowCard(false);
  };

  const elapsed = phase === "playing" ? clockMs() : (result?.timeMs ?? 0);
  const describe = (r: { gaps: number; timeMs: number; hinted?: boolean }) =>
    `${r.gaps === 0 ? "perfectly snug" : plural(r.gaps, "hole")} in ${formatDuration(r.timeMs)}${r.hinted ? " with a hint" : ""}`;
  const shareLine = recorded ? `Snug #${number}: ${describe(recorded)}` : "";
  const shareGrid = useMemo(
    () => (recorded ? quiltGrid(puzzle.board, puzzle.cols, puzzle.rows, recorded.pieces) : ""),
    [recorded, puzzle],
  );
  // Stats read storage, which a new recorded run changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => playerStats(LAUNCH_DATE, today), [today, recorded]);
  const movingId = drag?.moved ? drag.id : carry?.id;
  const ghostPiece = movingId ? pieces.find((p) => p.id === movingId) : undefined;
  const ghost = drag?.moved
    ? snapFor(drag, pieces)
    : carry && ghostPiece && fits(ghostPiece.cells, carry.at, carry.id, pieces)
      ? carry.at
      : null;
  const perfect = phase === "done" && gaps === 0 && !revealing;
  const { cell, board, tray } = layout;
  const filled = new Set<string>();
  for (const p of pieces) if (p.at && !p.loose && p.id !== liftedId) for (const [x, y] of shift(p.cells, p.at)) filled.add(cellKey(x, y));

  const compact = width > 0 && width < 560;
  /** Half the result card's width, so it can be kept inside the panel. */
  const cardHalf = Math.min(420, width - 16) / 2;
  const sameRun = (a: { gaps: number; timeMs: number } | null, b: { gaps: number; timeMs: number } | null) =>
    !!a && !!b && a.gaps === b.gaps && a.timeMs === b.timeMs;
  const cardNote = [
    isArchive && !recorded ? "Past quilts are practice, so they are not scored." : "",
    bestRun && !sameRun(bestRun, result) && !sameRun(bestRun, recorded) ? `Your best: ${describe(bestRun)}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const canHint = phase === "playing" && !paused && !hintId && clock.current.started && elapsed >= HINT_AFTER_MS;
  const canNativeShare = coarsePointer && typeof navigator.share === "function";
  const copyShare = () => {
    if (canNativeShare) {
      navigator.share({ text: `${shareLine}\n${shareGrid}`, url: shareUrl }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(`${shareLine}\n${shareGrid}\n${shareUrl}`).then(() => setCopied(true), () => setCopied(false));
  };

  return (
    <div style={{ fontFamily: FONT, color: INK, width: "100%", userSelect: "none" }}>
      <QuiltBackdrop dateKey={dateKey} />
      <KnitDefs />
      {showHowTo && <HowToPlay onClose={closeHowTo} touch={coarsePointer} spares={puzzle.spares} />}
      <div aria-live="polite" style={visuallyHidden}>
        {said}
      </div>
      {showCalendar && (
        <QuiltCalendar
          current={dateKey}
          today={today}
          launch={LAUNCH_DATE}
          onClose={() => setShowCalendar(false)}
          onPick={(key) => {
            setShowCalendar(false);
            onPickDate(key);
          }}
        />
      )}

      <div style={panelStyle}>
        <PanelStitches seed={`panel:${dateKey}`} />
        <div ref={topRef}>
        {(() => {
          const title = <div style={{ fontFamily: SCRIPT, fontSize: compact ? 42 : 64, lineHeight: 0.9, color: BINDING, fontWeight: 700 }}>Snug</div>;
          const dateNav = (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: compact ? 12.5 : 14, marginTop: compact ? 0 : 4, whiteSpace: "nowrap" }}>
              <DayArrow label="Previous quilt" disabled={dateKey <= LAUNCH_DATE} onClick={() => onPickDate(addDays(dateKey, -1))}>
                &lsaquo;
              </DayArrow>
              <button
                type="button"
                onClick={() => setShowCalendar(true)}
                title="Open the quilt calendar"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, border: 0, background: "none", padding: "2px 4px", borderRadius: 6, fontFamily: "inherit", fontSize: "inherit", color: "inherit", cursor: "pointer" }}
              >
                <span style={{ opacity: 0.75 }}>
                  No. {number} &middot; {compact ? formatShortDate(dateKey) : formatLongDate(dateKey)}
                  {puzzle.level && <> &middot; {puzzle.level.name}</>}
                </span>
                <CalendarMonthOutlinedIcon sx={{ fontSize: compact ? 14 : 15, color: RUST_THREAD }} />
              </button>
              <DayArrow label="Next quilt" disabled={dateKey >= today} onClick={() => onPickDate(addDays(dateKey, 1))}>
                &rsaquo;
              </DayArrow>
              {isArchive && (
                <DayArrow label="Back to today" disabled={false} onClick={() => onPickDate(today)}>
                  &raquo;
                </DayArrow>
              )}
            </div>
          );
          const help = (
            <>
              <Btn small onClick={() => setShowHowTo(true)} label={compact ? "How to play" : undefined}>
                {compact ? "?" : "How to play"}
              </Btn>
              {newQuilt && (
                <Btn small primary onClick={() => onPickDate(today)}>
                  New quilt
                </Btn>
              )}
            </>
          );
          const stats = (
            <div style={{ display: "flex", gap: compact ? 6 : 8, alignItems: "center" }}>
              <Stat label="Holes" value={String(gaps)} compact={compact} />
              <Stat label="Time" value={formatDuration(elapsed)} compact={compact} />
            </div>
          );
          // Phones get two tight rows: title, help, and stats, then the date arrows across the full width.
          return compact ? (
            <header style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", rowGap: 6, columnGap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {title}
                {help}
              </div>
              {stats}
              <div style={{ gridColumn: "1 / -1" }}>{dateNav}</div>
            </header>
          ) : (
            <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <div>
                {title}
                {dateNav}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {help}
                {stats}
              </div>
            </header>
          );
        })()}
        <div style={{ height: compact ? 10 : 16 }} />
        </div>

        <div ref={playRef} style={{ position: "relative", width: "100%", height: width ? layout.height : 420, touchAction: "none" }}>
          {width > 0 && (
            <>
              <Basket style={{ left: tray.x - 8, top: tray.y - 8, width: tray.w + 16, height: tray.h + 16 }} />

              <BoardSvg
                board={puzzle.board}
                cols={puzzle.cols}
                rows={puzzle.rows}
                cell={cell}
                pad={BOARD_PAD}
                style={{ position: "absolute", left: board.x - BOARD_PAD * cell, top: board.y - BOARD_PAD * cell }}
                ghost={ghost && ghostPiece ? { cells: shift(ghostPiece.cells, ghost), color: ghostPiece.color } : null}
                holes={phase === "done" && !revealing ? puzzle.board.filter(([x, y]) => !filled.has(cellKey(x, y))) : []}
                perfect={perfect}
              />

              {phase === "playing" &&
                pieces.map((p, index) => {
                  if (p.at || (drag?.moved && drag.id === p.id)) return null;
                  const slot = layout.slots[index]!;
                  return (
                    <div
                      key={`hit-${p.id}`}
                      onPointerDown={(e) => onSlotDown(e, p, index)}
                      style={{ position: "absolute", left: slot.x, top: slot.y, width: slot.size, height: slot.size, zIndex: 4, cursor: "grab", touchAction: "none" }}
                    />
                  );
                })}
              {pieces.map((p, index) => {
                const pos = piecePos(p, index);
                const { w, h } = bounds(p.cells);
                const dragged = !!drag?.moved && drag.id === p.id;
                const lifted = dragged || carry?.id === p.id;
                const movable = phase === "playing" && !paused && p.id !== hintId;
                return (
                  <div
                    key={p.id}
                    data-piece={p.id}
                    tabIndex={movable ? 0 : -1}
                    role={movable ? "button" : undefined}
                    aria-label={`Patch ${index + 1} of ${pieces.length}, ${p.cells.length} squares, ${p.at && !p.loose ? "on the quilt" : "in the basket"}`}
                    onFocus={() => movable && setSelected(p.id)}
                    style={{
                      outline: "none",
                      position: "absolute",
                      left: 0,
                      top: 0,
                      width: w * cell,
                      height: h * cell,
                      transformOrigin: "0 0",
                      transform: `translate(${pos.x}px, ${pos.y}px) scale(${pos.s})`,
                      transition: dragged ? "none" : "transform 220ms cubic-bezier(.2,.9,.3,1.15)",
                      zIndex: lifted ? 50 : p.loose ? 30 : p.at ? 10 : 5,
                      pointerEvents: "none",
                      filter: [
                        selected === p.id && phase === "playing" && !dragged ? "drop-shadow(0 0 2px #fff) drop-shadow(0 0 1.5px #fff)" : "",
                        lifted || p.loose ? "drop-shadow(0 12px 10px rgba(40,20,10,.4))" : "drop-shadow(0 2px 2px rgba(40,20,10,.35))",
                      ].join(" "),
                    }}
                  >
                    <PatchSvg
                      piece={p}
                      cell={cell}
                      interactive={phase === "playing"}
                      loose={p.loose && !lifted}
                      hinted={p.id === hintId && phase === "playing"}
                      onDown={(e, i) => onPieceDown(e, p, index, i)}
                    />
                  </div>
                );
              })}

              {paused && phase === "playing" && (
                <div
                  style={{
                    position: "absolute",
                    inset: -12,
                    zIndex: 95,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 18,
                    background: `repeating-linear-gradient(45deg, rgba(160,130,90,.08) 0 6px, transparent 6px 12px), ${LINEN}`,
                    boxShadow: "inset 0 2px 12px rgba(80,45,20,.2)",
                  }}
                >
                  <StitchBorder inset={9} radius={12} color={RUST_THREAD} width={2.2} stitch={7} gap={4.5} seed="paused" />
                  <div style={{ textAlign: "center", padding: 20, maxWidth: 360 }}>
                    <div style={{ fontFamily: SCRIPT, fontSize: 52, lineHeight: 1, color: BINDING, fontWeight: 700 }}>Paused</div>
                    <p style={{ fontSize: 15, margin: "10px 0 18px", lineHeight: 1.5 }}>
                      Your clock stopped at {formatDuration(clockMs())}. Today&apos;s quilt stays covered until you pick it back up.
                    </p>
                    <Btn primary onClick={resume}>
                      Resume
                    </Btn>
                  </div>
                </div>
              )}

              {showCard && result && (
                <ResultCard
                  number={number}
                  result={result}
                  recorded={recorded}
                  isReplay={isReplay}
                  note={cardNote || undefined}
                  shareLine={shareLine}
                  shareGrid={shareGrid}
                  shareUrl={shareUrl}
                  stats={stats}
                  moreGames={moreGames}
                  shareLabel={canNativeShare ? "Share" : undefined}
                  copied={copied}
                  describe={describe}
                  onCopy={copyShare}
                  onReveal={reveal}
                  onShowMine={showMine}
                  onPlayAgain={playAgain}
                  onClose={() => setShowCard(false)}
                  center={layout.side ? { x: clamp(tray.x + tray.w / 2, cardHalf, width - cardHalf), y: tray.y + tray.h / 2 } : undefined}
                  sheet={!layout.side}
                />
              )}
            </>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20, alignItems: "center" }}>
          {phase === "playing" ? (
            <>
              <Btn small={compact} disabled={undoCount === 0 || paused} onClick={undo}>
                Undo
              </Btn>
              <Btn small={compact} label="Turn back" disabled={!selected || paused} onClick={() => selected && transformPiece(selected, rotateCCW, lastGrab.current)}>
                <TurnIcon back />
              </Btn>
              <Btn small={compact} label="Turn" disabled={!selected || paused} onClick={() => selected && transformPiece(selected, rotateCW, lastGrab.current)}>
                <TurnIcon />
              </Btn>
              <Btn
                small={compact}
                disabled={paused || covered === 0}
                onClick={() => {
                  setCarry(null);
                  commit(pieces.map((p) => (p.id === hintId ? p : { ...p, at: null, loose: false })));
                }}
              >
                {compact ? "Empty" : "Empty the quilt"}
              </Btn>
              <span style={{ flex: 1 }} />
              {canHint && (
                <Btn small={compact} onClick={applyHint}>
                  {compact ? "Hint" : "Use your hint"}
                </Btn>
              )}
              {(isReplay || isArchive) && (
                <span style={{ fontSize: 13, opacity: 0.7 }}>{isArchive ? "Past quilt, not scored" : "Replay, not scored"}</span>
              )}
              {confirming ? (
                <>
                  <span style={{ fontSize: 14 }}>Tie it off with {plural(gaps, "hole")}?</span>
                  <Btn small={compact} onClick={() => setConfirming(false)}>Keep going</Btn>
                  <Btn small={compact} primary onClick={finish}>Tie it off</Btn>
                </>
              ) : (
                <Btn small={compact} primary disabled={covered === 0 || paused} onClick={() => setConfirming(true)}>Tie it off</Btn>
              )}
            </>
          ) : (
            <>
              {!compact && <span style={{ fontSize: 14, opacity: 0.8 }}>{revealing ? "Showing one perfect fill." : "Showing your quilt."}</span>}
              <span style={{ flex: 1 }} />
              {revealing ? (
                <Btn small={compact} onClick={showMine}>
                  {compact ? "My quilt" : "Show my quilt"}
                </Btn>
              ) : (
                result &&
                result.gaps > 0 && (
                  <Btn small={compact} onClick={reveal}>
                    {compact ? "Perfect fill" : "Show a perfect fill"}
                  </Btn>
                )
              )}
              {!showCard && (
                <Btn small={compact} onClick={() => setShowCard(true)}>
                  {compact ? "Result" : "View result"}
                </Btn>
              )}
              <Btn small={compact} primary onClick={playAgain}>
                {compact ? "Play again" : "Play again (unscored)"}
              </Btn>
            </>
          )}
        </div>
        <QuiltLabel link={moreGames} />
      </div>
    </div>
  );
}

/** A circular arrow for the turn buttons; `back` mirrors it to turn the other way. */
function TurnIcon({ back = false }: { back?: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden style={{ display: "block", transform: back ? "scaleX(-1)" : undefined }}>
      <path d="M8 3A5 5 0 1 1 3 8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M1 8.8L3 6.5L5 8.8" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DayArrow({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "none",
        fontFamily: FONT,
        fontSize: 20,
        lineHeight: 1,
        color: INK,
        background: "rgba(123,59,46,.1)",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.3 : 1,
      }}
    >
      <StitchBorder inset={3.5} radius={10} color={RUST_THREAD} width={1.3} stitch={3.5} gap={2.6} seed={`arrow:${label}`} />
      {children}
    </button>
  );
}
