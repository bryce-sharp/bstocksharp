"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import GlobalStyles from "@mui/material/GlobalStyles";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { SxProps, Theme } from "@mui/material/styles";
import { addDays, puzzleNumber, todayKey } from "../daily";
import { BOARD_IDS, BOARDS, findRegulation } from "./boards";
import { DeskCalendar, Handbook, HangingSign, PAPER_CARD, ServiceBell, TestingClipboard, Tray, surface } from "./desk";
import { BAG_SIZE, itemKey, type BagItem, type BoardId, type Cells, type Item, type Puzzle } from "./engine";
import { RTS_FONTS, TYPE, DISPLAY } from "./fonts";
import { HowToPlay, PaperDialog } from "./handbook";
import { loadDay } from "./load";
import { AIRMAIL, APPROVED, DASH, INK, MUTED, ON_DARK, ON_DARK_MUTED, PAPER, POSTAL, RETURNED } from "./palette";
import { Heading, Memo, Squares, Timesheet } from "./paperwork";
import { DocCard, STAMP_KEYFRAMES, Stamp, Tag } from "./parts";
import { approves, hintPair, inspectionBag } from "./puzzle";
import { LAUNCH_DATE, clearProgress, howToSeen, loadProgress, loadResult, loadTestBoard, markHowToSeen, resetDay, saveProgress, saveResult, saveTestBoard, type Entry, type Progress, type Result } from "./records";
import { PUZZLE_VERSION, type DayPuzzles } from "./schedule";
import { INK_DELAY, InkDefs, InkStamp, PRESS_KEYFRAMES, StampOver, stampDateLine } from "./stamp";
import { VIEWS } from "./views";

const SHARE_URL = "https://bstocksharp.dev/games/return-to-sender";
const HINTS_PER_DAY = 2;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const visuallyHidden = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

const DESK_KEYFRAMES = {
  "@keyframes rtsSlideIn": { from: { transform: "translateY(-28px) rotate(-3deg)", opacity: 0 }, to: { transform: "none", opacity: 1 } },
  "@keyframes rtsPrint": { from: { transform: "translateY(-36px)", opacity: 0 }, to: { transform: "none", opacity: 1 } },
  "@keyframes rtsLamp": { from: { opacity: 0 }, to: { opacity: 1 } },
};

const LOOKS = {
  plain: { fontFamily: TYPE, fontSize: 15, lineHeight: 1.1, px: 2, py: 1.2, borderRadius: "5px", cursor: "pointer", border: `1px solid ${DASH}`, bgcolor: PAPER, color: INK },
  primary: { fontFamily: TYPE, fontSize: 15, lineHeight: 1.1, px: 2, py: 1.2, borderRadius: "5px", cursor: "pointer", border: `1px solid ${POSTAL}`, bgcolor: POSTAL, color: "#fff" },
  shift: { fontFamily: TYPE, fontSize: 15, lineHeight: 1.1, px: 2, py: 1.2, borderRadius: "5px", cursor: "pointer", border: `1px solid ${RETURNED}`, bgcolor: RETURNED, color: "#fff" },
  link: { fontFamily: TYPE, fontSize: 13, p: 0.5, border: 0, bgcolor: "transparent", color: MUTED, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "3px" },
} as const;

type BtnProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color"> & { look?: keyof typeof LOOKS; sx?: SxProps<Theme> };

function Btn({ look = "plain", sx, ...rest }: BtnProps) {
  return (
    <Box
      component="button"
      type="button"
      {...rest}
      sx={[LOOKS[look], { whiteSpace: "nowrap", "&:disabled": { opacity: 0.45, cursor: "default" }, "&:focus-visible": { outline: `2px solid ${POSTAL}`, outlineOffset: "2px" } }, ...(Array.isArray(sx) ? sx : [sx])]}
    />
  );
}

/** The post office desk. While testing, the clipboard picks the board and the calendar steps through past days. */
export function ReturnToSender() {
  const [today] = React.useState(todayKey);
  const [dateKey, setDateKey] = React.useState(today);
  const [board, setBoard] = React.useState<BoardId>(loadTestBoard);
  const [day, setDay] = React.useState<{ key: string; data: DayPuzzles } | "error" | null>(null);
  const [resets, setResets] = React.useState(0);
  const [menu, setMenu] = React.useState<HTMLElement | null>(null);
  const [howTo, setHowTo] = React.useState(() => !howToSeen());
  const phone = useMediaQuery("(max-width:899.95px)");

  React.useEffect(() => {
    let live = true;
    loadDay(dateKey).then(
      (data) => live && setDay({ key: dateKey, data }),
      () => live && setDay("error"),
    );
    return () => {
      live = false;
    };
  }, [dateKey]);

  const loaded = day && day !== "error" && day.key === dateKey ? day.data : null;
  const puzzle = loaded?.puzzles[board];
  const number = puzzleNumber(dateKey, LAUNCH_DATE);
  const status = day === "error" ? "The mail could not be loaded. Check your connection, then reload the page." : !loaded ? "Sorting the mail..." : !puzzle ? `There is no ${BOARDS[board].name} today.` : "";
  const openMenu = (e: React.MouseEvent<HTMLElement>) => setMenu(e.currentTarget);

  return (
    <Box className={RTS_FONTS} sx={{ position: "relative", background: surface("wood"), color: ON_DARK, borderRadius: "10px", px: { xs: 1.25, sm: 2, md: 3 }, pt: { xs: 0.5, md: 1 }, pb: { xs: 12, md: 3 }, display: "grid", gap: { xs: 1.25, md: 2.5 }, alignContent: "start", boxShadow: "inset 0 0 60px rgba(0,0,0,0.45)", minHeight: { md: 640 } }}>
      <GlobalStyles styles={{ ...STAMP_KEYFRAMES, ...PRESS_KEYFRAMES, ...DESK_KEYFRAMES }} />
      <InkDefs />
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "start", gap: 1 }}>
        <Box sx={{ justifySelf: "start", pt: { xs: 1, md: 1.5 } }}>
          <DeskCalendar dateKey={dateKey} small={phone} arrows onPrev={() => setDateKey(addDays(dateKey, -1))} onNext={() => setDateKey(addDays(dateKey, 1))} canPrev={dateKey > LAUNCH_DATE} canNext={dateKey < today} />
        </Box>
        <HangingSign style="enamel" number={number} small={phone} />
        <Box sx={{ justifySelf: "end", display: "flex", gap: 2, alignItems: "start", pt: { xs: 1, md: 1.5 } }}>
          {!phone && <TestingClipboard board={BOARDS[board].name} onClick={openMenu} />}
          <Box component="button" type="button" aria-label="Open the employee handbook: how to play" onClick={() => setHowTo(true)} sx={{ border: 0, p: 0, bgcolor: "transparent", cursor: "pointer" }}>
            <Handbook small />
          </Box>
        </Box>
      </Box>
      {phone && (
        <Box component="button" type="button" onClick={openMenu} aria-haspopup="menu" sx={{ justifySelf: "center", fontFamily: TYPE, fontSize: 12, color: INK, bgcolor: PAPER, border: "3px solid #8a6a45", borderRadius: "5px", px: 1, py: 0.25, cursor: "pointer" }}>
          Testing · {BOARDS[board].name} ▾
        </Box>
      )}
      {puzzle ? (
        <Desk key={`${dateKey}:${board}:${resets}`} puzzle={puzzle} dateKey={dateKey} board={board} number={number} practiceDay={dateKey !== today} phone={phone} />
      ) : (
        <Box component="p" aria-live="polite" sx={{ m: 0, py: 8, textAlign: "center", fontFamily: TYPE, color: ON_DARK }}>
          {status}
        </Box>
      )}
      <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
        {BOARD_IDS.map((b) => (
          <MenuItem
            key={b}
            selected={b === board}
            onClick={() => {
              setBoard(b);
              saveTestBoard(b);
              setMenu(null);
            }}
          >
            {BOARDS[b].name}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          disabled={dateKey !== today}
          onClick={() => {
            resetDay(today, board);
            setResets((r) => r + 1);
            setMenu(null);
          }}
        >
          Reset today&apos;s puzzle
        </MenuItem>
      </Menu>
      <HowToPlay
        open={howTo}
        onClose={() => {
          setHowTo(false);
          markHowToSeen();
        }}
        boardName={BOARDS[board].name}
        boardHowTo={VIEWS[board].howTo}
      />
    </Box>
  );
}

type Mode = "build" | "shift" | "timesheet" | "solved";
type DialogName = "shift" | "giveUp" | "hint" | "approved" | "returned" | null;
interface Shown {
  follows: boolean;
  repeat: boolean;
  /** Counts presses, so the same stamp lands again on the next submit. */
  n: number;
}

/** One board's puzzle for the day: the desk, the trays and bell, the shift, the timesheet and the memo. */
function Desk({ puzzle, dateKey, board, number, practiceDay, phone }: { puzzle: Puzzle; dateKey: string; board: BoardId; number: number; practiceDay: boolean; phone: boolean }) {
  const view = VIEWS[board];
  const part = puzzle.parts.find((p) => p.board === board)!;
  const regulationText = findRegulation(part)?.regulation.text ?? part.regulation;
  const dateLine = stampDateLine(number, dateKey);
  const examples = puzzle.examples.filter((e) => e.board === board);

  const [initial] = React.useState(() => {
    if (practiceDay) return { result: null as Result | null, progress: null as Progress | null };
    const result = loadResult(dateKey, board);
    return { result, progress: result ? null : loadProgress(dateKey, board) };
  });
  const [saved, setSaved] = React.useState<Result | null>(initial.result);
  const [practice, setPractice] = React.useState(practiceDay);
  const [practiceResult, setPracticeResult] = React.useState<Result | null>(null);
  const [entries, setEntries] = React.useState<Entry[]>(initial.result?.submitted ?? initial.progress?.submitted ?? []);
  const [tries, setTries] = React.useState(initial.progress?.tries ?? initial.result?.tries ?? 0);
  // A shift left underway comes back exactly: its bag is rebuilt from the same try and the same trays.
  const [shift, setShift] = React.useState<{ bag: BagItem[]; answers: boolean[] } | null>(() => {
    const p = initial.progress;
    if (!p?.shift) return null;
    return { bag: inspectionBag(puzzle, p.tries, [...examples, ...p.submitted].map(itemKey)), answers: p.shift.answers };
  });
  const [mode, setMode] = React.useState<Mode>(initial.result ? "solved" : shift ? "shift" : "build");
  const [lastRight, setLastRight] = React.useState(0);
  const [cells, setCells] = React.useState<Cells>(view.empty);
  const [shown, setShown] = React.useState<Shown | null>(null);
  const [landing, setLanding] = React.useState<{ ok: boolean; n: number } | null>(null);
  const [flashKey, setFlashKey] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<DialogName>(null);
  const [hintNote, setHintNote] = React.useState<Entry[]>([]);
  const [coarse] = React.useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [copied, setCopied] = React.useState(false);
  const presses = React.useRef(0);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => {
    const t = timer;
    return () => clearTimeout(t.current);
  }, []);

  const log: Entry[] = [...examples, ...entries];
  const submissions = entries.filter((e) => !e.hint);
  const hintsUsed = entries.filter((e) => e.hint).length / 2;
  const result = practice ? practiceResult : saved;
  const live = mode === "shift" || mode === "timesheet";

  // Only the scored first run of today is kept; past days and replays are practice.
  const keep = (nextEntries: Entry[], nextTries: number, nextShift?: { answers: boolean[] }) => {
    if (!practice) saveProgress(dateKey, board, { version: PUZZLE_VERSION, submitted: nextEntries, tries: nextTries, ...(nextShift ? { shift: nextShift } : {}) });
  };
  const thump = () => {
    if (typeof navigator.vibrate === "function") setTimeout(() => navigator.vibrate(18), INK_DELAY);
  };

  const edit = (update: (prev: Cells) => Cells) => {
    setCells(update);
    setShown(null);
  };

  const submit = () => {
    const item: Item = { board, cells };
    const key = itemKey(item);
    const found = log.find((e) => itemKey(e) === key);
    presses.current += 1;
    if (found) setShown({ follows: found.follows, repeat: true, n: presses.current });
    else {
      const follows = approves(puzzle, item);
      const next = [...entries, { ...item, follows }];
      setEntries(next);
      keep(next, tries);
      setShown({ follows, repeat: false, n: presses.current });
    }
    setFlashKey(key);
    thump();
  };

  const bringBack = (entry: Entry) => {
    setCells([...entry.cells]);
    setShown(null);
    setFlashKey(itemKey(entry));
    setDialog(null);
  };

  const ring = () => {
    if (!submissions.length || hintsUsed >= HINTS_PER_DAY) return;
    const pair = hintPair(puzzle, board, hintsUsed, log.map(itemKey));
    if (!pair) return;
    const added = pair.map((p) => ({ ...p, hint: true }));
    const next = [...entries, ...added];
    setEntries(next);
    keep(next, tries);
    setHintNote(added);
    setDialog("hint");
  };

  const startShift = () => {
    setShift({ bag: inspectionBag(puzzle, tries, log.map(itemKey)), answers: [] });
    setMode("shift");
    setDialog(null);
    keep(entries, tries, { answers: [] });
  };

  const makeResult = (nextTries: number, gaveUp: boolean): Result => ({
    version: PUZZLE_VERSION,
    submissions: submissions.length,
    tries: nextTries,
    history: submissions.map((s) => s.follows),
    submitted: entries,
    hints: hintsUsed,
    ...(gaveUp ? { gaveUp } : {}),
  });

  const finish = (done: Result) => {
    if (practice) setPracticeResult(done);
    else {
      saveResult(dateKey, board, done);
      clearProgress(dateKey, board);
      setSaved(done);
    }
  };

  function finishShift(bag: BagItem[], answers: boolean[]) {
    const right = bag.filter((item, i) => answers[i] === item.truth).length;
    const nextTries = tries + 1;
    setTries(nextTries);
    setLastRight(right);
    setShift(null);
    if (right === bag.length) finish(makeResult(nextTries, false));
    else keep(entries, nextTries);
    setMode("timesheet");
  }

  const answer = (approve: boolean) => {
    if (!shift || landing) return;
    const answers = [...shift.answers, approve];
    const bag = shift.bag;
    setShift({ bag, answers });
    presses.current += 1;
    setLanding({ ok: approve, n: presses.current });
    thump();
    keep(entries, tries, { answers });
    timer.current = setTimeout(() => {
      setLanding(null);
      if (answers.length === bag.length) finishShift(bag, answers);
    }, 900);
  };

  const giveUp = () => {
    finish(makeResult(tries, true));
    setDialog(null);
    setMode("solved");
  };

  const playAgain = () => {
    setPractice(true);
    setPracticeResult(null);
    setEntries([]);
    setTries(0);
    setShift(null);
    setCells(view.empty());
    setShown(null);
    setFlashKey(null);
    setMode("build");
  };

  const approvedPile = log.filter((e) => e.follows);
  const returnedPile = log.filter((e) => !e.follows);
  const bellLabel = !submissions.length ? "Hint after one try" : hintsUsed >= HINTS_PER_DAY ? "No rings left" : hintsUsed ? "1 ring left" : phone ? "Hint" : "Ring for a hint";

  const bell = (
    <Box
      component="button"
      type="button"
      onClick={ring}
      disabled={!submissions.length || hintsUsed >= HINTS_PER_DAY}
      aria-label={`Service bell: ${bellLabel}`}
      sx={{ border: 0, p: 0, bgcolor: "transparent", color: "inherit", cursor: "pointer", "&:disabled": { cursor: "default" }, "&:focus-visible": { outline: `2px solid ${PAPER}`, outlineOffset: "4px", borderRadius: "6px" } }}
    >
      <ServiceBell state={!submissions.length ? "locked" : hintsUsed ? "used" : "ready"} rung={hintsUsed} small plaque={bellLabel} />
    </Box>
  );

  const trays = (
    <Box sx={{ display: "flex", gap: { xs: 1.5, md: 2.5 }, alignItems: "end", justifyContent: "center" }}>
      {(["approved", "returned"] as const).map((pile) => {
        const items = pile === "approved" ? approvedPile : returnedPile;
        return (
          <Box
            key={pile}
            component="button"
            type="button"
            onClick={() => setDialog(pile)}
            aria-label={`${pile === "approved" ? "Approved" : "Returned"} tray, ${plural(items.length, "item")}. Open it.`}
            sx={{ border: 0, p: 0, bgcolor: "transparent", color: ON_DARK, cursor: "pointer", "&:focus-visible": { outline: `2px solid ${PAPER}`, outlineOffset: "4px", borderRadius: "6px" } }}
          >
            <Tray ok={pile === "approved"} items={items.map((e) => e.cells)} Thumb={view.Thumb} mini={phone} />
          </Box>
        );
      })}
      {phone && bell}
    </Box>
  );

  const giveUpLink = (
    <Btn look="link" onClick={() => setDialog("giveUp")} sx={{ color: phone ? ON_DARK_MUTED : MUTED }}>
      Ask head office for the memo
    </Btn>
  );

  const counter = (
    <Box sx={{ ...PAPER_CARD, overflow: "hidden" }}>
      <Box aria-hidden sx={{ height: 10, background: AIRMAIL }} />
      <Box sx={{ p: { xs: 1.25, sm: 2.5 }, display: "grid", gap: { xs: 1, md: 2 }, justifyItems: "center" }}>
        <Box sx={{ justifySelf: "stretch", display: "flex", justifyContent: "space-between", gap: 1, fontFamily: TYPE, fontSize: 13, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <span>
            {BOARDS[board].name}
            {practice ? " · Practice" : ""}
          </span>
          <span>{plural(submissions.length, "submission")}</span>
        </Box>
        {/* On short phones the sheet shrinks so the trays and the action bar still fit without scrolling. */}
        <Box sx={{ position: "relative", width: "100%", maxWidth: { xs: "min(300px, calc(100svh - 420px))", md: 300 } }}>
          <view.Editor cells={cells} onChange={edit} />
          {shown && (
            <StampOver run={shown.n}>
              <InkStamp ok={shown.follows} kind="dated-soft" wash size={0.85} dateLine={dateLine} />
            </StampOver>
          )}
          {shown?.repeat && (
            <Box sx={{ position: "absolute", left: "50%", bottom: 10, transform: "translateX(-50%)", fontFamily: TYPE, fontSize: 12, color: INK, bgcolor: PAPER, px: 0.75, py: 0.25, borderRadius: "3px", pointerEvents: "none" }}>Already submitted</Box>
          )}
          <Box aria-live="polite" sx={visuallyHidden}>
            {shown ? `${shown.follows ? "Approved" : "Returned to sender"}${shown.repeat ? ", already submitted" : ""}` : ""}
          </Box>
        </Box>
        {!phone && (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Btn look="primary" onClick={submit}>
              {view.submitLabel}
            </Btn>
            <Btn onClick={() => edit(() => view.empty())}>Clear</Btn>
          </Box>
        )}
        {!phone && giveUpLink}
      </Box>
    </Box>
  );

  const index = shift ? (landing ? shift.answers.length - 1 : shift.answers.length) : 0;
  const current = shift?.bag[index];
  const shiftView = shift && current && (
    <Box sx={{ position: "relative", zIndex: 1201, display: "grid", gap: 2, justifyItems: "center", py: { xs: 1, md: 3 } }}>
      <Box sx={{ fontFamily: TYPE, fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase", color: ON_DARK }}>
        Item {index + 1} of {shift.bag.length}
      </Box>
      <Box sx={{ position: "relative" }}>
        <Box key={index} sx={{ animation: "rtsSlideIn 0.35s ease-out both" }}>
          <view.Picture cells={current.cells} size={phone ? 250 : 290} />
        </Box>
        {landing && (
          <StampOver run={landing.n}>
            <InkStamp ok={landing.ok} kind="dated-soft" wash size={0.85} dateLine={dateLine} />
          </StampOver>
        )}
      </Box>
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <StampButton ok onClick={() => answer(true)} disabled={!!landing} />
        <StampButton ok={false} onClick={() => answer(false)} disabled={!!landing} />
      </Box>
      <Box sx={{ fontFamily: TYPE, fontSize: 13, color: ON_DARK_MUTED, textAlign: "center" }}>Shift {tries + 1}. You stay until the bag is sorted.</Box>
    </Box>
  );

  const timesheet = (
    <Box sx={{ position: "relative", zIndex: 1201, display: "grid", gap: 2.5, justifyItems: "center", py: { xs: 1, md: 3 } }}>
      <Box sx={{ animation: "rtsPrint 0.6s ease-out both" }}>
        <Timesheet number={number} shift={tries} right={lastRight} submissions={submissions.length} hints={hintsUsed} history={submissions.map((s) => s.follows)} dateLine={dateLine} />
      </Box>
      {lastRight === BAG_SIZE ? (
        <Btn look="primary" onClick={() => setMode("solved")}>
          Collect the memo
        </Btn>
      ) : (
        <Btn look="primary" onClick={() => setMode("build")}>
          Back to the desk
        </Btn>
      )}
    </Box>
  );

  const summary = result
    ? result.gaveUp
      ? `Not solved: you asked head office after ${plural(result.submissions, "submission")}${result.hints ? ` and ${plural(result.hints, "hint")}` : ""}.`
      : `Perfect on shift ${result.tries}, with ${plural(result.submissions, "submission")}${result.hints ? ` and ${plural(result.hints, "hint")}` : ""}.`
    : "";
  const shareLine = result ? `${BOARDS[board].name} · ${result.gaveUp ? "Asked head office" : `Perfect on shift ${result.tries}`} · ${plural(result.submissions, "submission")}${result.hints ? ` · ${plural(result.hints, "hint")}` : ""}` : "";
  const shareText = [`Return to Sender No. ${number}`, shareLine, result?.history.map((ok) => (ok ? "■" : "□")).join(""), SHARE_URL].filter(Boolean).join("\n");
  const share = () => {
    // The link goes at the end of one text, never as a separate url, so share targets keep the whole message.
    if (coarse && typeof navigator.share === "function") {
      navigator.share({ text: shareText }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(shareText).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  const memo = result && (
    <Box sx={{ width: "100%", maxWidth: 480, justifySelf: "center" }}>
      <Memo number={number} regulationText={regulationText} summary={practice ? `Practice run, not saved. ${summary}` : summary}>
        {!practice && (
          <Box sx={{ display: "grid", gap: 1, p: "10px 12px", border: `1px dashed ${DASH}`, borderRadius: "4px", fontSize: 13 }}>
            <span>
              Return to Sender No. {number} · {shareLine}
            </span>
            <Squares history={result.history} />
          </Box>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {!practice && (
            <Btn look="primary" onClick={share}>
              {coarse ? "Share result" : copied ? "Copied" : "Copy result"}
            </Btn>
          )}
          <Btn onClick={playAgain}>Play again for practice</Btn>
        </Box>
      </Memo>
    </Box>
  );

  const pile = dialog === "approved" || dialog === "returned" ? dialog : null;
  const pileItems = [...(pile === "approved" ? approvedPile : returnedPile)].reverse();

  return (
    <>
      {live && (
        <Box
          aria-hidden
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            // The lamp's circle of light around the item; smaller on phones so the dark still shows on a narrow screen.
            background: {
              xs: "radial-gradient(circle at 50% 38%, rgba(255, 236, 190, 0.12) 0 150px, rgba(8, 10, 14, 0.9) 300px)",
              md: "radial-gradient(circle at 50% 42%, rgba(255, 236, 190, 0.12) 0 180px, rgba(8, 10, 14, 0.88) 420px)",
            },
            animation: "rtsLamp 0.5s ease-out both",
          }}
        />
      )}

      {mode === "build" && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 360px" }, gap: { xs: 1.5, md: 3 }, alignItems: "start" }}>
          {counter}
          <Box sx={{ display: "grid", gap: { xs: 1.5, md: 2.5 }, justifyItems: "center", pt: { md: 2 } }}>
            {trays}
            {!phone && (
              <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
                {bell}
                <Btn look="shift" onClick={() => setDialog("shift")}>
                  Start shift
                </Btn>
              </Box>
            )}
            {phone && giveUpLink}
          </Box>
        </Box>
      )}
      {mode === "shift" && shiftView}
      {mode === "timesheet" && timesheet}
      {mode === "solved" && memo}

      {phone && mode === "build" && (
        <Box sx={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1100, display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 1, px: "max(12px, env(safe-area-inset-left, 0px))", pt: 1.25, pb: "calc(10px + env(safe-area-inset-bottom, 0px))", bgcolor: "rgba(20, 22, 26, 0.95)", boxShadow: "0 -6px 18px rgba(0,0,0,0.35)" }}>
          <Btn onClick={() => edit(() => view.empty())}>Clear</Btn>
          <Btn look="primary" onClick={submit}>
            {view.submitLabel}
          </Btn>
          <Btn look="shift" onClick={() => setDialog("shift")}>
            Shift
          </Btn>
        </Box>
      )}

      <PaperDialog open={dialog === "shift"} onClose={() => setDialog(null)} labelledBy="rts-shift">
        <Heading id="rts-shift">Start your shift?</Heading>
        <Box component="p" sx={{ m: 0 }}>
          Your shift is {BAG_SIZE} items, one at a time. Once it starts, you stay until the bag is sorted. The timesheet says how many you sorted right, never which.
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Btn look="shift" onClick={startShift}>
            Start shift
          </Btn>
          <Btn onClick={() => setDialog(null)}>Not yet</Btn>
        </Box>
      </PaperDialog>

      <PaperDialog open={dialog === "giveUp"} onClose={() => setDialog(null)} labelledBy="rts-give-up">
        <Heading id="rts-give-up">Ask head office?</Heading>
        <Box component="p" sx={{ m: 0 }}>
          Head office will send the memo with today&apos;s regulation. The day counts as played, not solved.
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Btn look="shift" onClick={giveUp}>
            Ask head office
          </Btn>
          <Btn onClick={() => setDialog(null)}>Keep working</Btn>
        </Box>
      </PaperDialog>

      <PaperDialog open={dialog === "hint"} onClose={() => setDialog(null)} labelledBy="rts-hint">
        <Box sx={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>Supervisor&apos;s note</Box>
        <Heading id="rts-hint">Look closely at these two</Heading>
        <Box component="p" sx={{ m: 0 }}>
          They differ by one small change. One was approved and one returned. Both are in your trays now.
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
          {hintNote.map((e) => (
            <DocCard key={itemKey(e)} label={`${view.describe(e.cells)}. ${e.follows ? "Approved" : "Returned"}.`}>
              <view.Picture cells={e.cells} size={phone ? 110 : 150} />
              <Stamp ok={e.follows} />
            </DocCard>
          ))}
        </Box>
        <Btn look="primary" onClick={() => setDialog(null)} sx={{ justifySelf: "start" }}>
          Back to the desk
        </Btn>
      </PaperDialog>

      <PaperDialog open={!!pile} onClose={() => setDialog(null)} labelledBy="rts-pile">
        <Box sx={{ display: "flex", gap: 1 }}>
          {(["approved", "returned"] as const).map((p) => (
            <Btn key={p} look={pile === p ? "primary" : "plain"} onClick={() => setDialog(p)} aria-pressed={pile === p}>
              {p === "approved" ? `Approved · ${approvedPile.length}` : `Returned · ${returnedPile.length}`}
            </Btn>
          ))}
        </Box>
        <Heading id="rts-pile">{pile === "approved" ? "Approved pile" : "Returned pile"}</Heading>
        {pileItems.length ? (
          <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1 }}>
            {pileItems.map((e) => (
              <li key={itemKey(e)}>
                <DocCard
                  label={`${e.hint ? "Hint. " : examples.includes(e) ? "Example. " : ""}${view.describe(e.cells)}.${mode === "build" ? " Bring it back to the desk." : ""}`}
                  active={itemKey(e) === flashKey}
                  onClick={mode === "build" ? () => bringBack(e) : undefined}
                >
                  <view.Thumb cells={e.cells} />
                  {e.hint ? <Tag>Hint</Tag> : examples.includes(e) ? <Tag>Example</Tag> : null}
                </DocCard>
              </li>
            ))}
          </Box>
        ) : (
          <Box component="p" sx={{ m: 0, color: MUTED }}>
            Nothing here yet.
          </Box>
        )}
        <Box component="p" sx={{ m: 0, fontSize: 13, color: MUTED }}>
          Newest first.{mode === "build" ? " Tap an item to bring it back to the desk." : ""}
        </Box>
      </PaperDialog>
    </>
  );
}

function StampButton({ ok, onClick, disabled }: { ok: boolean; onClick: () => void; disabled: boolean }) {
  const color = ok ? APPROVED : RETURNED;
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      sx={{ fontFamily: DISPLAY, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: { xs: 17, md: 19 }, color, bgcolor: PAPER, border: `3px solid ${color}`, borderRadius: "6px", px: 2.25, py: 1.25, cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,0.35)", "&:active": { transform: "translateY(2px)", boxShadow: "0 2px 0 rgba(0,0,0,0.35)" }, "&:disabled": { opacity: 0.6, cursor: "default" }, "&:focus-visible": { outline: `2px solid ${PAPER}`, outlineOffset: "3px" } }}
    >
      {ok ? "Approve" : "Return"}
    </Box>
  );
}
