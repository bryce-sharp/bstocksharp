"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import GlobalStyles from "@mui/material/GlobalStyles";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { formatLongDate, puzzleNumber, todayKey } from "../daily";
import { BOARD_IDS, BOARDS, findRegulation } from "./boards";
import { BAG_SIZE, itemKey, type BagItem, type BoardId, type Cells, type Item, type Puzzle, type Sample } from "./engine";
import { DISPLAY, RTS_FONTS, TYPE } from "./fonts";
import { loadDay } from "./load";
import { AIRMAIL, APPROVED, DASH, DESK, INK, MUTED, ON_DARK, ON_DARK_MUTED, PAPER, POSTAL, RETURNED, RULE } from "./palette";
import { DocCard, Kicker, PaperPanel, STAMP_KEYFRAMES, Stamp, Tag } from "./parts";
import { approves, inspectionBag } from "./puzzle";
import { LAUNCH_DATE, clearProgress, loadProgress, loadResult, loadTestBoard, saveProgress, saveResult, saveTestBoard, type Result } from "./records";
import { PUZZLE_VERSION, type DayPuzzles } from "./schedule";
import { VIEWS } from "./views";

const SHARE_URL = "https://bstocksharp.dev/games/return-to-sender";
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const primaryButton = { bgcolor: POSTAL, color: "#fff", fontWeight: 600, textTransform: "none", boxShadow: "none", "&:hover": { bgcolor: "#213f80", boxShadow: "none" } } as const;
const plainButton = { color: INK, border: `1px solid ${DASH}`, fontWeight: 600, textTransform: "none", "&:hover": { borderColor: INK, bgcolor: "transparent" } } as const;
const smallText = { m: 0, fontSize: 13, lineHeight: 1.5, color: MUTED } as const;

/** Today's mail: while testing, a picker chooses which board's puzzle to play. */
export function ReturnToSender() {
  const [dateKey] = React.useState(todayKey);
  const [board, setBoard] = React.useState<BoardId>(loadTestBoard);
  const [day, setDay] = React.useState<DayPuzzles | "error" | null>(null);

  React.useEffect(() => {
    let live = true;
    loadDay(dateKey).then(
      (d) => live && setDay(d),
      () => live && setDay("error"),
    );
    return () => {
      live = false;
    };
  }, [dateKey]);

  const puzzle = day && day !== "error" ? day.puzzles[board] : undefined;
  const number = puzzleNumber(dateKey, LAUNCH_DATE);
  const status = day === "error" ? "Today's mail could not be loaded. Check your connection, then reload the page." : !day ? "Sorting today's mail..." : !puzzle ? `There is no ${BOARDS[board].name} puzzle today.` : "";

  return (
    <Box className={RTS_FONTS} sx={{ bgcolor: DESK, color: ON_DARK, borderRadius: "10px", p: { xs: 1.5, sm: 2.5, md: 3 }, display: "grid", gap: 2.5 }}>
      <GlobalStyles styles={STAMP_KEYFRAMES} />
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Box component="p" sx={{ m: 0, fontFamily: TYPE, fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: ON_DARK_MUTED }}>
            No. {number} · {formatLongDate(dateKey)}
          </Box>
          <Box component="h1" sx={{ m: 0, fontFamily: DISPLAY, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 0.95, fontSize: { xs: 40, sm: 56 } }}>
            Return to Sender
          </Box>
        </Box>
        <TextField
          select
          size="small"
          label="Board (testing)"
          value={board}
          onChange={(e) => {
            const next = e.target.value as BoardId;
            setBoard(next);
            saveTestBoard(next);
          }}
          sx={{
            minWidth: 200,
            "& .MuiInputBase-root": { color: ON_DARK, fontFamily: TYPE },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: ON_DARK_MUTED },
            "& .MuiInputLabel-root, & .MuiInputLabel-root.Mui-focused": { color: ON_DARK_MUTED },
            "& .MuiSvgIcon-root": { color: ON_DARK },
          }}
        >
          {BOARD_IDS.map((b) => (
            <MenuItem key={b} value={b}>
              {BOARDS[b].name}
            </MenuItem>
          ))}
        </TextField>
      </Box>
      <Box component="p" sx={{ m: 0, fontSize: 13, color: ON_DARK_MUTED }}>
        Testing build: every board has a puzzle each day, and results are saved on this device only.
      </Box>
      {puzzle ? (
        <Counter key={`${dateKey}:${board}`} puzzle={puzzle} dateKey={dateKey} board={board} number={number} />
      ) : (
        <Box component="p" aria-live="polite" sx={{ m: 0, py: 6, textAlign: "center", fontFamily: TYPE, color: ON_DARK_MUTED }}>
          {status}
        </Box>
      )}
    </Box>
  );
}

type Mode = "build" | "exam" | "solved";
interface Shown {
  follows: boolean;
  repeat: boolean;
  /** Counts stamps, so the same result thumps down again on the next submit. */
  n: number;
}

/** One board's puzzle for the day: build and submit items, keep the log, then pass an inspection. */
function Counter({ puzzle, dateKey, board, number }: { puzzle: Puzzle; dateKey: string; board: BoardId; number: number }) {
  const view = VIEWS[board];
  const part = puzzle.parts.find((p) => p.board === board)!;
  const regulationText = findRegulation(part)?.regulation.text ?? part.regulation;
  const [initial] = React.useState(() => {
    const result = loadResult(dateKey, board);
    return { result, progress: result ? null : loadProgress(dateKey, board) };
  });
  const [saved, setSaved] = React.useState<Result | null>(initial.result);
  const [practice, setPractice] = React.useState<Result | null>(null);
  const [replay, setReplay] = React.useState(false);
  const [submitted, setSubmitted] = React.useState<Sample[]>(initial.result?.submitted ?? initial.progress?.submitted ?? []);
  const [tries, setTries] = React.useState(initial.progress?.tries ?? 0);
  const [mode, setMode] = React.useState<Mode>(initial.result ? "solved" : "build");
  const [cells, setCells] = React.useState<Cells>(view.empty);
  const [shown, setShown] = React.useState<Shown | null>(null);
  const [flashKey, setFlashKey] = React.useState<string | null>(null);
  const [bag, setBag] = React.useState<BagItem[]>([]);
  const [answers, setAnswers] = React.useState<(boolean | null)[]>([]);
  const [checked, setChecked] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const stamps = React.useRef(0);

  const examples = puzzle.examples.filter((e) => e.board === board);
  const log = [...examples, ...submitted];
  const result = replay ? practice : saved;
  // Only the scored first run is kept; a replay is practice.
  const keep = (nextSubmitted: Sample[], nextTries: number) => {
    if (!replay) saveProgress(dateKey, board, { version: PUZZLE_VERSION, submitted: nextSubmitted, tries: nextTries });
  };

  const edit = (update: (prev: Cells) => Cells) => {
    setCells(update);
    setShown(null);
  };

  const submit = () => {
    const item: Item = { board, cells };
    const key = itemKey(item);
    const found = log.find((e) => itemKey(e) === key);
    stamps.current += 1;
    if (found) setShown({ follows: found.follows, repeat: true, n: stamps.current });
    else {
      const follows = approves(puzzle, item);
      const next = [...submitted, { ...item, follows }];
      setSubmitted(next);
      keep(next, tries);
      setShown({ follows, repeat: false, n: stamps.current });
    }
    setFlashKey(key);
  };

  const bringBack = (entry: Sample) => {
    setCells([...entry.cells]);
    setShown(null);
    setFlashKey(itemKey(entry));
  };

  const inspect = () => {
    const next = inspectionBag(puzzle, tries, log.map(itemKey));
    setBag(next);
    setAnswers(next.map(() => null));
    setChecked(false);
    setMessage("");
    setMode("exam");
  };

  const file = () => {
    const nextTries = tries + 1;
    setTries(nextTries);
    const wrong = bag.filter((item, n) => answers[n] !== item.truth).length;
    if (wrong) {
      setChecked(true);
      setMessage(`${wrong} of ${bag.length} are filed wrong. Make a few more submissions, then ask for a new inspection.`);
      keep(submitted, nextTries);
      return;
    }
    const done: Result = { version: PUZZLE_VERSION, submissions: submitted.length, tries: nextTries, history: submitted.map((s) => s.follows), submitted };
    if (replay) setPractice(done);
    else {
      saveResult(dateKey, board, done);
      clearProgress(dateKey, board);
      setSaved(done);
    }
    setMode("solved");
  };

  const backToCounter = () => {
    setMode("build");
    setBag([]);
    setChecked(false);
    setMessage("");
  };

  const playAgain = () => {
    setReplay(true);
    setPractice(null);
    setSubmitted([]);
    setTries(0);
    setCells(view.empty());
    setShown(null);
    setFlashKey(null);
    setMode("build");
  };

  return (
    <PaperPanel>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) 320px" }, gap: { xs: 3, md: 3.5 }, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: "grid", gap: 2, alignContent: "start", minWidth: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 1.5 }}>
            <Box sx={{ display: "grid", gap: 0.75 }}>
              <Kicker>
                Regulation No. {number}
                {replay ? " · Practice" : ""}
              </Kicker>
              <Box component="h2" sx={{ m: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 32, lineHeight: 1, textTransform: "uppercase" }}>
                {BOARDS[board].name}
              </Box>
            </Box>
            <Box sx={{ fontFamily: TYPE, fontSize: 13, color: MUTED }}>
              Submissions
              <Box component="b" sx={{ fontSize: 22, color: INK, ml: 0.75 }}>
                {submitted.length}
              </Box>
            </Box>
          </Box>

          {mode === "build" && (
            <>
              <Box component="p" sx={{ ...smallText, fontSize: 14 }}>
                {view.howTo} Then submit it to the clerk.
              </Box>
              <Box sx={{ position: "relative", width: "100%", maxWidth: 300 }}>
                <view.Editor cells={cells} onChange={edit} />
                {shown && (
                  <Box key={shown.n} aria-live="polite" sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, pointerEvents: "none" }}>
                    <Stamp ok={shown.follows} big />
                    {shown.repeat && (
                      <Box component="span" sx={{ fontFamily: TYPE, fontSize: 12, bgcolor: PAPER, px: 0.75, py: 0.25, borderRadius: "3px" }}>
                        Already submitted
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Button variant="contained" onClick={submit} sx={primaryButton}>
                  {view.submitLabel}
                </Button>
                <Button onClick={() => edit(() => view.empty())} sx={plainButton}>
                  Clear
                </Button>
              </Box>
            </>
          )}

          {mode === "exam" && (
            <Box sx={{ display: "grid", gap: 2 }}>
              <Box component="p" sx={{ ...smallText, fontSize: 14 }}>
                Inspection: approve or return each item in this mail bag. All {bag.length} right closes the puzzle.
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
                {bag.map((item, n) => (
                  <DocCard key={itemKey(item)} label={`Item ${n + 1}: ${view.describe(item.cells)}`}>
                    <view.Thumb cells={item.cells} />
                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px", width: "100%" }}>
                      {[true, false].map((approve) => (
                        <SortButton
                          key={String(approve)}
                          approve={approve}
                          on={answers[n] === approve}
                          disabled={checked}
                          onClick={() => setAnswers((a) => a.map((x, j) => (j === n ? approve : x)))}
                        />
                      ))}
                    </Box>
                  </DocCard>
                ))}
              </Box>
              <Box component="p" aria-live="polite" sx={{ m: 0, minHeight: "1.5em", color: RETURNED, fontWeight: 500 }}>
                {message}
              </Box>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Button variant="contained" onClick={file} disabled={checked || answers.some((a) => a === null)} sx={primaryButton}>
                  File the inspection
                </Button>
                <Button onClick={backToCounter} sx={plainButton}>
                  Back to the counter
                </Button>
              </Box>
            </Box>
          )}

          {mode === "solved" && result && (
            <Memo number={number} board={board} regulationText={regulationText} result={result} practice={replay} onPlayAgain={playAgain} />
          )}
        </Box>

        <Box sx={{ display: "grid", gap: 2, alignContent: "start", minWidth: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Kicker>Submission log</Kicker>
            <Button variant="contained" onClick={inspect} disabled={mode !== "build"} sx={primaryButton}>
              Request inspection
            </Button>
          </Box>
          <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 1, maxHeight: 380, overflow: "auto" }}>
            {[...log].reverse().map((entry, i) => {
              const key = itemKey(entry);
              const example = log.length - 1 - i < examples.length;
              return (
                <li key={key}>
                  <DocCard
                    label={`${example ? "Example. " : ""}${view.describe(entry.cells)}. ${entry.follows ? "Approved" : "Returned"}.${mode === "build" ? " Bring it back to the counter." : ""}`}
                    active={key === flashKey}
                    onClick={mode === "build" ? () => bringBack(entry) : undefined}
                  >
                    <view.Thumb cells={entry.cells} />
                    <Stamp ok={entry.follows} />
                    {example && <Tag>Example</Tag>}
                  </DocCard>
                </li>
              );
            })}
          </Box>
          <Box component="p" sx={smallText}>
            Newest first. Tap an item to bring it back to the counter.
          </Box>
          <Box component="ul" sx={{ m: 0, pl: 2.25, display: "grid", gap: 0.75, fontSize: 14 }}>
            <li>Build an item and submit it. The clerk stamps it Approved or Return to sender, by today&apos;s secret regulation.</li>
            <li>When you think you know the regulation, request an inspection: approve or return {BAG_SIZE} new items. All right closes the puzzle.</li>
            <li>A wrong inspection sends you back to the counter. Your score is how many items you submitted.</li>
          </Box>
        </Box>
      </Box>
    </PaperPanel>
  );
}

function SortButton({ approve, on, disabled, onClick }: { approve: boolean; on: boolean; disabled: boolean; onClick: () => void }) {
  const color = approve ? APPROVED : RETURNED;
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      sx={{
        fontFamily: TYPE,
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        py: 1,
        px: 0.25,
        borderRadius: "3px",
        cursor: disabled ? "default" : "pointer",
        border: `1px solid ${on ? color : RULE}`,
        color: on ? color : MUTED,
        bgcolor: on ? `${color}1f` : "transparent",
      }}
    >
      {approve ? "Approve" : "Return"}
    </Box>
  );
}

/** The head office memo that closes a puzzle: the regulation, the score, and the share line. */
function Memo({ number, board, regulationText, result, practice, onPlayAgain }: { number: number; board: BoardId; regulationText: string; result: Result; practice: boolean; onPlayAgain: () => void }) {
  const [coarse] = React.useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [copied, setCopied] = React.useState(false);
  const squares = result.history.map((ok) => (ok ? "■" : "□")).join("");
  const text = [`Return to Sender No. ${number}`, `${BOARDS[board].name}: closed with ${plural(result.submissions, "submission")}`, squares, SHARE_URL].filter(Boolean).join("\n");
  // The link goes at the end of one text, never as a separate url, so share targets keep the whole message.
  const share = () => {
    if (coarse && typeof navigator.share === "function") {
      navigator.share({ text }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };

  return (
    <Box sx={{ border: `1px solid ${RULE}`, borderRadius: "4px", overflow: "hidden", bgcolor: PAPER }}>
      <Box aria-hidden sx={{ height: 10, background: AIRMAIL }} />
      <Box sx={{ display: "grid", gap: 1.25, p: "16px 18px" }}>
        <Kicker>Head office · Memo</Kicker>
        <Box component="h3" sx={{ m: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: 26, lineHeight: 1, textTransform: "uppercase" }}>
          Regulation No. {number}
        </Box>
        <Box component="p" sx={{ m: 0, fontFamily: TYPE, fontWeight: 700, fontSize: 17, lineHeight: 1.45 }}>
          {regulationText}
        </Box>
        <Box component="p" sx={smallText}>
          {practice ? `Practice run: ${plural(result.submissions, "submission")}, not scored.` : `Closed with ${plural(result.submissions, "submission")}. Inspection passed on try ${result.tries}.`}
        </Box>
        {!practice && (
          <Box sx={{ display: "grid", gap: 1, p: "10px 12px", border: `1px dashed ${DASH}`, borderRadius: "4px", fontFamily: TYPE, fontSize: 13 }}>
            <span>
              Return to Sender No. {number} · {plural(result.submissions, "submission")}
            </span>
            <Box role="img" aria-label={`${result.history.filter(Boolean).length} approved, ${result.history.filter((ok) => !ok).length} returned`} sx={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
              {result.history.map((ok, i) => (
                <Box key={i} sx={{ width: 12, height: 12, borderRadius: "2px", boxSizing: "border-box", ...(ok ? { bgcolor: APPROVED } : { border: `2px solid ${RETURNED}` }) }} />
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {!practice && (
            <Button variant="contained" onClick={share} sx={primaryButton}>
              {coarse ? "Share result" : copied ? "Copied" : "Copy result"}
            </Button>
          )}
          <Button onClick={onPlayAgain} sx={plainButton}>
            Play again for practice
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
