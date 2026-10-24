"use client";

// Every look being considered for Return to Sender on one page, numbered so each option can be picked by name
// ("4b"). The sample puzzle is made up for this page, so nothing here spoils a real day.

import * as React from "react";
import Box from "@mui/material/Box";
import GlobalStyles from "@mui/material/GlobalStyles";
import { makeRng } from "../../daily";
import { SHEET } from "../boards/sheet";
import { DISPLAY, RTS_FONTS, TYPE } from "../fonts";
import { AIRMAIL, APPROVED, DASH, DESK, INK, MUTED, ON_DARK, ON_DARK_MUTED, PAPER, POSTAL, RETURNED, RULE } from "../palette";
import { STAMP_KEYFRAMES, Stamp } from "../parts";
import { VIEWS } from "../views";
import { ART_FONTS, STAMP_FACES, TYPEWRITERS } from "./fonts";
import { INK_KINDS, StampLanding } from "./inks";
import { InkDefs, InkStamp, PRESS_KEYFRAMES } from "../stamp";
import { DeskCalendar, Handbook, HangingSign, PAPER_CARD, SIGN_STYLES, SURFACES, ServiceBell, SheetPicture, TestingClipboard, Tray, surface } from "../desk";

const Thumb = VIEWS.sheet.Thumb;
const SAMPLE_RULE = SHEET.regulations.find((r) => r.id === "sheet.center")!;
const SAMPLE = (() => {
  const rng = makeRng("return-to-sender:art");
  return Array.from({ length: 9 }, (_, i) => {
    const cells = i % 2 ? SAMPLE_RULE.make(rng) : SHEET.random(rng);
    return { cells, ok: SAMPLE_RULE.test(cells) };
  });
})();
const APPROVED_PILE = SAMPLE.filter((s) => s.ok).map((s) => s.cells);
const RETURNED_PILE = SAMPLE.filter((s) => !s.ok).map((s) => s.cells);
const ON_COUNTER = APPROVED_PILE[0] ?? SAMPLE[0]!.cells;
const HISTORY = SAMPLE.map((s) => s.ok);
const NUMBER = 23;

const button = { fontFamily: TYPE, fontWeight: 700, fontSize: 14, px: 2, py: 1.1, borderRadius: "5px", cursor: "pointer", border: `1px solid ${DASH}`, bgcolor: PAPER, color: INK } as const;
const primary = { ...button, bgcolor: POSTAL, borderColor: POSTAL, color: "#fff" } as const;

export function ArtSheet() {
  return (
    <Box className={`${RTS_FONTS} ${ART_FONTS}`} sx={{ bgcolor: DESK, color: ON_DARK, borderRadius: "10px", p: { xs: 1.5, sm: 2.5, md: 4 }, display: "grid", gap: 6 }}>
      <GlobalStyles styles={{ ...STAMP_KEYFRAMES, ...PRESS_KEYFRAMES }} />
      <InkDefs />
      <Box sx={{ display: "grid", gap: 1, maxWidth: 760 }}>
        <Box component="h1" sx={{ m: 0, fontFamily: DISPLAY, fontWeight: 700, textTransform: "uppercase", fontSize: { xs: 36, sm: 52 }, lineHeight: 1 }}>
          Return to Sender art sheet
        </Box>
        <Box component="p" sx={{ m: 0, color: ON_DARK_MUTED }}>
          Every look we are considering, on one page. Sections are numbered and options lettered, so you can pick by name, for example &quot;4b&quot; or &quot;10a&quot;. The sample puzzle is made up for this page, so nothing here spoils a real day.
        </Box>
      </Box>

      <Box sx={{ ...PAPER_CARD, p: { xs: 2, sm: 2.5 }, display: "grid", gap: 1, maxWidth: 760 }}>
        <Box sx={{ fontFamily: TYPE, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Picked so far</Box>
        <Box component="ul" sx={{ m: 0, pl: 2.25, display: "grid", gap: 0.5, fontSize: 14 }}>
          <li>1b Special Elite for the clerk&apos;s typewriter, now used across the game.</li>
          <li>2a Oswald on the stamps.</li>
          <li>3e The dated stamp with softer ink, now the game&apos;s stamp.</li>
          <li>4a The stamp only, with no arm shadow.</li>
          <li>5a Oak desk, and 6a the blue enamel sign.</li>
          <li>The bell now sits on a plaque beside the trays (7e, 9 and 10b).</li>
          <li>10b Two trays on phones, and 13b the postcard.</li>
        </Box>
      </Box>

      <Section n={1} title="Typewriter faces" note="The clerk's voice: memos, labels and the timesheet.">
        <Options>
          {TYPEWRITERS.map((face, i) => (
            <Option key={face.name} id={`1${letter(i)}`} name={face.name} note={face.note}>
              <Box sx={{ ...PAPER_CARD, p: 2, display: "grid", gap: 1, fontFamily: face.family }}>
                <Box sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>Head office · Memo</Box>
                <Box sx={{ fontSize: 20, fontWeight: 700 }}>Regulation No. {NUMBER}</Box>
                <Box sx={{ fontSize: 16, lineHeight: 1.45 }}>The center square has a stamp.</Box>
                <Box sx={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>Closed with 7 submissions. Perfect on shift 2. Head office regrets nothing.</Box>
              </Box>
            </Option>
          ))}
        </Options>
      </Section>

      <Section n={2} title="Stamp faces" note="The letters on the rubber stamp, shown with inked edges.">
        <Options>
          {STAMP_FACES.map((face, i) => (
            <Option key={face.name} id={`2${letter(i)}`} name={face.name} note={face.note}>
              <Box sx={{ ...PAPER_CARD, p: 3, display: "grid", gap: 3, justifyItems: "center", overflow: "hidden" }}>
                <InkStamp ok kind="inked" face={face.family} size={0.72} />
                <InkStamp ok={false} kind="inked" face={face.family} size={0.72} />
              </Box>
            </Option>
          ))}
        </Options>
      </Section>

      <Section n={3} title="Ink styles" note="How the ink sits on the paper.">
        <Options>
          {INK_KINDS.map((ink, i) => (
            <Option key={ink.kind} id={`3${letter(i)}`} name={ink.name} note={ink.note}>
              <Box sx={{ ...PAPER_CARD, p: 3, minHeight: 230, display: "grid", gap: 3, justifyItems: "center", alignContent: "center", overflow: "hidden" }}>
                <InkStamp ok kind={ink.kind} size={ink.kind === "postmark" ? 0.7 : 0.72} />
                <InkStamp ok={false} kind={ink.kind} size={ink.kind === "postmark" ? 0.7 : 0.72} />
              </Box>
            </Option>
          ))}
        </Options>
      </Section>

      <Section n={4} title="The stamp landing" note="Tap Stamp it to replay. On Android phones the stamp also gives a short vibration; iPhone Safari does not support web vibration.">
        <Options>
          <Option id="4a" name="Stamp only" note="The rubber stamp comes down, presses, and lifts away, leaving the ink.">
            <StampLanding ok kind="inked" face={DISPLAY} arm={false}>
              <SheetPicture cells={ON_COUNTER} size={170} />
            </StampLanding>
          </Option>
          <Option id="4b" name="Stamp with an arm's shadow" note="The same, with the soft shadow of an arm reaching in from the corner.">
            <StampLanding ok={false} kind="inked" face={DISPLAY} arm>
              <SheetPicture cells={RETURNED_PILE[0] ?? ON_COUNTER} size={170} />
            </StampLanding>
          </Option>
        </Options>
      </Section>

      <Section n={5} title="Desk surfaces" note="What the whole game sits on.">
        <Options>
          {SURFACES.map((s, i) => (
            <Option key={s.id} id={`5${letter(i)}`} name={s.name}>
              <Box sx={{ background: s.background, borderRadius: "8px", height: 220, display: "grid", placeItems: "center", boxShadow: "inset 0 0 40px rgba(0,0,0,0.35)" }}>
                <SheetPicture cells={ON_COUNTER} size={130} />
              </Box>
            </Option>
          ))}
        </Options>
      </Section>

      <Section n={6} title="Hanging signs" note="The name and the day's regulation number, in place of a plain header.">
        <Options>
          {SIGN_STYLES.map((s, i) => (
            <Option key={s.style} id={`6${letter(i)}`} name={s.name}>
              <Box sx={{ background: surface("wood"), borderRadius: "8px", pb: 3 }}>
                <HangingSign style={s.style} number={NUMBER} />
              </Box>
            </Option>
          ))}
        </Options>
      </Section>

      <Section n={7} title="Desk objects" note="Each one does a job. If an object hides an action, it becomes a plain button instead.">
        <Options>
          <Option id="7a" name="Desk calendar" note="The date. While testing, the arrows step through past days for practice.">
            <ObjectStage>
              <DeskCalendar arrows />
            </ObjectStage>
          </Option>
          <Option id="7b" name="Employee handbook" note="How to play, and the first-day training taught by the clerk.">
            <ObjectStage>
              <Handbook />
            </ObjectStage>
          </Option>
          <Option id="7c" name="Service bell" note="Hints: ready, one ring used, and locked until your first submission.">
            <ObjectStage>
              <Box sx={{ display: "flex", gap: 2.5, alignItems: "end" }}>
                <ServiceBell state="ready" />
                <ServiceBell state="used" rung={1} />
                <ServiceBell state="locked" />
              </Box>
            </ObjectStage>
          </Option>
          <Option id="7d" name="Testing clipboard" note="The testing-phase board picker. It goes away once every board feels good.">
            <ObjectStage>
              <TestingClipboard />
            </ObjectStage>
          </Option>
          <Option id="7e" name="Bell on a plaque" note="The bell gets a home: a small wooden plate that says what it does, and how many rings are left once one is used.">
            <ObjectStage>
              <Box sx={{ display: "flex", gap: 2.5, alignItems: "end" }}>
                <ServiceBell state="ready" plaque="Ring for a hint" />
                <ServiceBell state="used" rung={1} plaque="1 ring left" />
              </Box>
            </ObjectStage>
          </Option>
        </Options>
      </Section>

      <Section n={8} title="Log piles" note="Your submissions, sorted into two trays, newest on top. Tap a tray to spread its items out.">
        <LogPiles />
      </Section>

      <Section n={9} title="The desk on a computer" note="Everything together on a wide screen: the counter on the left, the trays on the right.">
        <DeskComposition />
      </Section>

      <Section n={10} title="Phone layouts" note="Three ways to show the log on a phone. In each, the playable area fits without scrolling. Tap the log controls to open them.">
        <Options wide>
          <Option id="10a" name="Last two and a log button" note="Your two newest submissions under the sheet, and a button that opens the full log.">
            <PhoneFrame>
              <PhoneDesk variant="last-two" />
            </PhoneFrame>
          </Option>
          <Option id="10b" name="Two trays" note="Small Approved and Returned trays under the sheet; tap one to open that pile.">
            <PhoneFrame>
              <PhoneDesk variant="trays" />
            </PhoneFrame>
          </Option>
          <Option id="10c" name="Pull-up drawer" note="A drawer peeks above the action bar; tap it to slide the log up.">
            <PhoneFrame>
              <PhoneDesk variant="drawer" />
            </PhoneFrame>
          </Option>
        </Options>
      </Section>

      <Section n={11} title="Your shift" note="Start, sort 8 items one at a time under the lamp, then the timesheet prints. A failed shift shows only how many were right.">
        <Options>
          <Option id="11a" name="Start your shift">
            <ShiftStage>
              <Box sx={{ ...PAPER_CARD, p: 2, display: "grid", gap: 1.25, maxWidth: 230 }}>
                <Box sx={{ fontFamily: TYPE, fontWeight: 700, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>Notice</Box>
                <Box sx={{ fontFamily: TYPE, fontSize: 14, lineHeight: 1.5 }}>Your shift is 8 items. Once it starts, you stay until the bag is sorted.</Box>
                <Box sx={{ display: "flex", gap: 1, "& > button": { whiteSpace: "nowrap", px: 1.5 } }}>
                  <Box component="button" type="button" sx={primary}>Start shift</Box>
                  <Box component="button" type="button" sx={button}>Not yet</Box>
                </Box>
              </Box>
            </ShiftStage>
          </Option>
          <Option id="11b" name="Live: one item at a time" note="The desk dims to a lamp's circle of light.">
            <ShiftStage live>
              <Box sx={{ display: "grid", gap: 1.5, justifyItems: "center" }}>
                <Box sx={{ fontFamily: TYPE, fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", color: ON_DARK }}>Item 3 of 8</Box>
                <SheetPicture cells={SAMPLE[4]!.cells} size={150} />
                <Box sx={{ display: "flex", gap: 1 }}>
                  <StampButton ok />
                  <StampButton ok={false} />
                </Box>
              </Box>
            </ShiftStage>
          </Option>
          <Option id="11c" name="Timesheet: not quite">
            <ShiftStage>
              <Timesheet shift={1} right={6} />
            </ShiftStage>
          </Option>
          <Option id="11d" name="Timesheet: perfect shift">
            <ShiftStage>
              <Timesheet shift={2} right={8} />
            </ShiftStage>
          </Option>
        </Options>
      </Section>

      <Section n={12} title="Head office memo" note="Closes the day and reveals the regulation.">
        <Box sx={{ maxWidth: 420 }}>
          <Memo />
        </Box>
      </Section>

      <Section n={13} title="Share picture" note="What a phone sends when you share. Both keep the regulation a secret.">
        <Options>
          <Option id="13a" name="Timesheet slip">
            <SharePicture>
              <Box sx={{ position: "relative", transform: "rotate(-2deg)" }}>
                <Timesheet shift={2} right={8} compact />
              </Box>
            </SharePicture>
          </Option>
          <Option id="13b" name="Postcard">
            <SharePicture>
              <Postcard />
            </SharePicture>
          </Option>
        </Options>
      </Section>
    </Box>
  );
}

const letter = (i: number) => "abcdefgh"[i]!;

function Section({ n, title, note, children }: { n: number; title: string; note?: string; children: React.ReactNode }) {
  return (
    <Box component="section" sx={{ display: "grid", gap: 2.5 }}>
      <Box sx={{ display: "grid", gap: 0.5, borderTop: `1px dashed ${ON_DARK_MUTED}`, pt: 2.5 }}>
        <Box component="h2" sx={{ m: 0, fontFamily: DISPLAY, fontWeight: 700, fontSize: { xs: 24, sm: 30 }, textTransform: "uppercase", letterSpacing: "0.02em", lineHeight: 1 }}>
          <Box component="span" sx={{ color: ON_DARK_MUTED, mr: 1.25 }}>
            {n}
          </Box>
          {title}
        </Box>
        {note && (
          <Box component="p" sx={{ m: 0, color: ON_DARK_MUTED, maxWidth: 720, fontSize: 14, lineHeight: 1.5 }}>
            {note}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
}

function Options({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <Box sx={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${wide ? 290 : 240}px, 1fr))`, gap: 3, alignItems: "start" }}>{children}</Box>;
}

const PICKED = new Set(["1b", "2a", "3e", "4a", "5a", "6a", "10b", "13b"]);

function Option({ id, name, note, children }: { id: string; name: string; note?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 1.25, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, flexWrap: "wrap" }}>
        <Box sx={{ fontFamily: TYPE, fontSize: 13, bgcolor: PAPER, color: INK, borderRadius: "4px", px: 0.75, py: 0.25 }}>{id}</Box>
        <Box sx={{ fontWeight: 600, fontSize: 15 }}>{name}</Box>
        {PICKED.has(id) && <Box sx={{ fontFamily: TYPE, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: PAPER, bgcolor: APPROVED, borderRadius: "3px", px: 0.75, py: 0.25 }}>Picked</Box>}
      </Box>
      {children}
      {note && (
        <Box component="p" sx={{ m: 0, color: ON_DARK_MUTED, fontSize: 13, lineHeight: 1.5 }}>
          {note}
        </Box>
      )}
    </Box>
  );
}

function ObjectStage({ children }: { children: React.ReactNode }) {
  return <Box sx={{ background: surface("wood"), borderRadius: "8px", minHeight: 170, display: "grid", placeItems: "center", p: 2 }}>{children}</Box>;
}

function LogPiles() {
  const [open, setOpen] = React.useState<"approved" | "returned" | null>(null);
  return (
    <Box sx={{ background: surface("wood"), borderRadius: "8px", p: 3, display: "grid", gap: 3 }}>
      <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", justifyContent: "center" }}>
        {(["approved", "returned"] as const).map((pile) => (
          <Box key={pile} component="button" type="button" onClick={() => setOpen(open === pile ? null : pile)} aria-expanded={open === pile} sx={{ border: 0, bgcolor: "transparent", color: ON_DARK, cursor: "pointer", p: 0 }}>
            <Tray ok={pile === "approved"} items={pile === "approved" ? APPROVED_PILE : RETURNED_PILE} Thumb={Thumb} />
          </Box>
        ))}
      </Box>
      {open && (
        <Box sx={{ display: "grid", gap: 1 }}>
          <Box sx={{ fontFamily: TYPE, fontWeight: 700, fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>{open === "approved" ? "Approved pile" : "Returned pile"}, newest first</Box>
          <Tray ok={open === "approved"} items={[...(open === "approved" ? APPROVED_PILE : RETURNED_PILE)].reverse()} Thumb={Thumb} fanned />
        </Box>
      )}
    </Box>
  );
}

function DeskComposition() {
  return (
    <Box sx={{ background: surface("wood"), borderRadius: "10px", p: { xs: 2, md: 3 }, display: "grid", gap: 2.5, boxShadow: "inset 0 0 60px rgba(0,0,0,0.4)" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr auto 1fr" }, alignItems: "start", gap: 2 }}>
        <Box sx={{ justifySelf: { xs: "center", sm: "start" } }}>
          <DeskCalendar arrows />
        </Box>
        <HangingSign style="enamel" number={NUMBER} />
        <Box sx={{ justifySelf: { xs: "center", sm: "end" }, display: "flex", gap: 2, alignItems: "start" }}>
          <TestingClipboard />
          <Handbook small />
        </Box>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 340px" }, gap: 3, alignItems: "start" }}>
        <Box sx={{ ...PAPER_CARD, overflow: "hidden" }}>
          <Box aria-hidden sx={{ height: 10, background: AIRMAIL }} />
          <Box sx={{ p: 3, display: "grid", gap: 2, justifyItems: "center" }}>
            <Box sx={{ justifySelf: "start", fontFamily: TYPE, fontWeight: 700, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED }}>Stamp sheet · 7 submissions</Box>
            <Box sx={{ position: "relative" }}>
              <SheetPicture cells={ON_COUNTER} size={300} />
              <Box sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
                <InkStamp ok kind="inked" wash />
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
              <Box component="button" type="button" sx={primary}>Submit sheet</Box>
              <Box component="button" type="button" sx={button}>Clear</Box>
            </Box>
          </Box>
        </Box>
        <Box sx={{ display: "grid", gap: 2.5, justifyItems: "center" }}>
          <Box sx={{ display: "flex", gap: 2 }}>
            <Tray ok items={APPROVED_PILE} Thumb={Thumb} small />
            <Tray ok={false} items={RETURNED_PILE} Thumb={Thumb} small />
          </Box>
          <Box sx={{ display: "flex", gap: 2.5, alignItems: "center" }}>
            <ServiceBell state="ready" small plaque="Ring for a hint" />
            <Box component="button" type="button" sx={{ ...primary, bgcolor: RETURNED, borderColor: RETURNED }}>Start shift</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** A phone-sized screen (375 by 720) drawn at 72 percent. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const scale = 0.72;
  return (
    <Box sx={{ width: 375 * scale + 16, height: 720 * scale + 16, p: "8px", borderRadius: "34px", bgcolor: "#0d0f12", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", justifySelf: "center" }}>
      <Box sx={{ width: 375 * scale, height: 720 * scale, borderRadius: "26px", overflow: "hidden", position: "relative" }}>
        <Box sx={{ width: 375, height: 720, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }}>{children}</Box>
      </Box>
    </Box>
  );
}

function PhoneDesk({ variant }: { variant: "last-two" | "trays" | "drawer" }) {
  const [sheet, setSheet] = React.useState<"both" | "approved" | "returned" | null>(null);
  const newest = SAMPLE.slice(-2).reverse();
  return (
    <Box sx={{ position: "relative", height: "100%", background: surface("wood"), color: ON_DARK, display: "grid", gridTemplateRows: "auto 1fr auto", overflow: "hidden" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "start", px: 1.5, pt: 1 }}>
        <DeskCalendar small />
        <HangingSign style="enamel" number={NUMBER} small />
        <Box sx={{ justifySelf: "end", pt: 1 }}>
          <Handbook small />
        </Box>
      </Box>
      <Box sx={{ display: "grid", alignContent: "start", justifyItems: "center", gap: 1.5, pt: 1.5 }}>
        <Box sx={{ position: "relative" }}>
          <SheetPicture cells={ON_COUNTER} size={290} />
          {variant !== "trays" && (
            <Box sx={{ position: "absolute", right: -14, bottom: -18 }}>
              <ServiceBell state="ready" small />
            </Box>
          )}
        </Box>
        {variant === "last-two" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            {newest.map((s, i) => (
              <Box key={i} sx={{ bgcolor: PAPER, borderRadius: "3px", p: 0.75, display: "grid", justifyItems: "center", gap: 0.5 }}>
                <Thumb cells={s.cells} />
                <Stamp ok={s.ok} />
              </Box>
            ))}
            <Box component="button" type="button" onClick={() => setSheet("both")} sx={{ ...button, py: 2 }}>
              Log · {SAMPLE.length}
            </Box>
          </Box>
        )}
        {variant === "trays" && (
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "end" }}>
            {(["approved", "returned"] as const).map((pile) => (
              <Box key={pile} component="button" type="button" onClick={() => setSheet(pile)} sx={{ border: 0, bgcolor: "transparent", color: ON_DARK, p: 0, cursor: "pointer" }}>
                <Tray ok={pile === "approved"} items={pile === "approved" ? APPROVED_PILE : RETURNED_PILE} Thumb={Thumb} small />
              </Box>
            ))}
            <ServiceBell state="ready" small plaque="Hint" />
          </Box>
        )}
      </Box>
      {variant === "drawer" && (
        <Box component="button" type="button" onClick={() => setSheet("both")} sx={{ position: "absolute", left: 12, right: 12, bottom: 78, bgcolor: PAPER, color: INK, border: 0, borderRadius: "14px 14px 0 0", p: 1.25, display: "grid", gap: 0.75, justifyItems: "center", cursor: "pointer", boxShadow: "0 -4px 14px rgba(0,0,0,0.3)" }}>
          <Box aria-hidden sx={{ width: 44, height: 5, borderRadius: 3, bgcolor: RULE }} />
          <Box sx={{ fontFamily: TYPE, fontWeight: 700, fontSize: 13 }}>
            Log · {APPROVED_PILE.length} approved · {RETURNED_PILE.length} returned
          </Box>
        </Box>
      )}
      <Box sx={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 1, p: 1.5, bgcolor: "rgba(20, 22, 26, 0.92)" }}>
        <Box component="button" type="button" sx={button}>Clear</Box>
        <Box component="button" type="button" sx={{ ...primary, fontSize: 16 }}>Submit sheet</Box>
        <Box component="button" type="button" sx={{ ...primary, bgcolor: RETURNED, borderColor: RETURNED }}>Shift</Box>
      </Box>
      {sheet && (
        <Box sx={{ position: "absolute", inset: "30% 0 0 0", bgcolor: PAPER, color: INK, borderRadius: "16px 16px 0 0", p: 2, display: "grid", gridTemplateRows: "auto 1fr", gap: 1.5, boxShadow: "0 -10px 30px rgba(0,0,0,0.5)" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box sx={{ fontFamily: TYPE, fontWeight: 700, fontSize: 13, letterSpacing: "0.1em", textTransform: "uppercase" }}>{sheet === "both" ? "Submission log" : sheet === "approved" ? "Approved pile" : "Returned pile"}</Box>
            <Box component="button" type="button" onClick={() => setSheet(null)} sx={button}>Close</Box>
          </Box>
          <Box sx={{ overflow: "auto", display: "grid", gridTemplateColumns: sheet === "both" ? "1fr 1fr" : "1fr", gap: 1.5, alignContent: "start" }}>
            {(sheet === "both" ? (["approved", "returned"] as const) : [sheet]).map((pile) => (
              <Box key={pile} sx={{ display: "grid", gap: 1, alignContent: "start" }}>
                <Stamp ok={pile === "approved"} />
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))", gap: 1 }}>
                  {[...(pile === "approved" ? APPROVED_PILE : RETURNED_PILE)].reverse().map((cells, i) => (
                    <Box key={i} sx={{ border: `1px solid ${RULE}`, borderRadius: "3px", p: 0.5, display: "grid", placeItems: "center" }}>
                      <Thumb cells={cells} />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function ShiftStage({ live, children }: { live?: boolean; children: React.ReactNode }) {
  return (
    <Box sx={{ position: "relative", background: surface("wood"), borderRadius: "8px", minHeight: 330, display: "grid", placeItems: "center", p: 2, overflow: "hidden" }}>
      {live && <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(255, 236, 190, 0.18) 0 24%, rgba(10, 12, 16, 0.78) 58%)" }} />}
      <Box sx={{ position: "relative" }}>{children}</Box>
    </Box>
  );
}

function StampButton({ ok }: { ok: boolean }) {
  const color = ok ? APPROVED : RETURNED;
  return (
    <Box component="button" type="button" sx={{ fontFamily: DISPLAY, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 15, color, bgcolor: PAPER, border: `3px solid ${color}`, borderRadius: "6px", px: 1.5, py: 1, cursor: "pointer", boxShadow: "0 4px 0 rgba(0,0,0,0.35)" }}>
      {ok ? "Approve" : "Return"}
    </Box>
  );
}

/** A torn-off bottom edge for receipts. */
const TORN = `polygon(0 0, 100% 0, 100% calc(100% - 8px), ${Array.from({ length: 20 }, (_, i) => `${100 - (i + 0.5) * 5}% ${i % 2 ? "calc(100% - 8px)" : "100%"}`).join(", ")}, 0 calc(100% - 8px))`;

function Timesheet({ shift, right, compact }: { shift: number; right: number; compact?: boolean }) {
  const perfect = right === 8;
  const row = { display: "flex", justifyContent: "space-between", gap: 2 } as const;
  return (
    <Box sx={{ position: "relative", width: compact ? 200 : 220, bgcolor: "#fbf8f1", color: INK, fontFamily: TYPE, fontSize: 13, p: "16px 16px 26px", clipPath: TORN, display: "grid", gap: 0.75, boxShadow: "0 8px 16px rgba(0,0,0,0.35)" }}>
      <Box sx={{ textAlign: "center", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>Timesheet</Box>
      <Box sx={{ textAlign: "center", fontSize: 11, color: MUTED }}>Return to Sender · No. {NUMBER}</Box>
      <Box sx={{ borderTop: `1px dashed ${DASH}`, my: 0.5 }} />
      <Box sx={row}><span>Shift</span><span>{shift}</span></Box>
      <Box sx={row}><span>Sorted right</span><span>{right} of 8</span></Box>
      <Box sx={row}><span>Submissions</span><span>7</span></Box>
      <Box sx={row}><span>Hints</span><span>none</span></Box>
      <Box sx={{ borderTop: `1px dashed ${DASH}`, my: 0.5 }} />
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "3px", justifyContent: "center" }}>
        {HISTORY.map((ok, i) => (
          <Box key={i} sx={{ width: 11, height: 11, borderRadius: "2px", boxSizing: "border-box", ...(ok ? { bgcolor: APPROVED } : { border: `2px solid ${RETURNED}` }) }} />
        ))}
      </Box>
      <Box sx={{ textAlign: "center", fontWeight: 700, mt: 0.5, mb: perfect ? 5 : 0 }}>{perfect ? "Perfect shift" : "Back to the desk"}</Box>
      {perfect && (
        <Box sx={{ position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)", opacity: 0.92 }}>
          <InkStamp ok kind="inked" size={0.62} wash />
        </Box>
      )}
    </Box>
  );
}

function Memo() {
  return (
    <Box sx={{ ...PAPER_CARD, overflow: "hidden" }}>
      <Box aria-hidden sx={{ height: 10, background: AIRMAIL }} />
      <Box sx={{ p: "18px 20px", display: "grid", gap: 1.25, fontFamily: TYPE }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>
          <span>Head office</span>
          <span>Memo</span>
        </Box>
        <Box sx={{ fontSize: 13, color: MUTED }}>Department of Regulations · Re: Regulation No. {NUMBER}</Box>
        <Box sx={{ fontSize: 18, fontWeight: 700, lineHeight: 1.45 }}>The center square has a stamp.</Box>
        <Box sx={{ fontSize: 13, lineHeight: 1.5 }}>Perfect on shift 2, with 7 submissions. Your diligence has been noted in a file nobody will read.</Box>
        <Box sx={{ fontSize: 13, fontStyle: "italic", color: MUTED }}>Signed, the Postmaster</Box>
      </Box>
    </Box>
  );
}

function SharePicture({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ width: "100%", maxWidth: 320, aspectRatio: "1", background: surface("wood"), borderRadius: "6px", display: "grid", placeItems: "center", overflow: "hidden", boxShadow: "inset 0 0 50px rgba(0,0,0,0.4)" }}>{children}</Box>
  );
}

function Postcard() {
  return (
    <Box sx={{ position: "relative", width: 270, height: 180, bgcolor: "#fbf8f1", color: INK, borderRadius: "4px", transform: "rotate(-3deg)", boxShadow: "0 10px 20px rgba(0,0,0,0.4)", display: "grid", gridTemplateColumns: "1fr 96px", gap: 1.5, p: 1.5 }}>
      <Box sx={{ display: "grid", alignContent: "start", gap: 0.75, fontFamily: TYPE, fontSize: 12, lineHeight: 1.35, borderRight: `1px solid ${RULE}`, pr: 1.25 }}>
        <Box sx={{ fontFamily: DISPLAY, fontWeight: 700, fontSize: 18, textTransform: "uppercase", lineHeight: 1 }}>Greetings from the post office</Box>
        <span>Regulation No. {NUMBER}</span>
        <span>Perfect on shift 2</span>
        <span>7 submissions</span>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
          {HISTORY.map((ok, i) => (
            <Box key={i} sx={{ width: 9, height: 9, borderRadius: "2px", boxSizing: "border-box", ...(ok ? { bgcolor: APPROVED } : { border: `2px solid ${RETURNED}` }) }} />
          ))}
        </Box>
      </Box>
      <Box sx={{ position: "relative", display: "grid", alignContent: "start", justifyItems: "end" }}>
        <Box sx={{ p: "5px", bgcolor: PAPER, border: `2px dotted ${DASH}` }}>
          <SheetPicture cells={ON_COUNTER} size={64} />
        </Box>
        <Box sx={{ position: "absolute", right: 12, top: 34 }}>
          <InkStamp ok kind="postmark" size={0.45} />
        </Box>
      </Box>
    </Box>
  );
}
