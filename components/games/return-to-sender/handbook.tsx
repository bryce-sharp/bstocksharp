"use client";

// The employee handbook: how to play, in the clerk's voice, plus the paper style the game's dialogs share.

import * as React from "react";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import { TYPE } from "./fonts";
import { AIRMAIL, DASH, INK, MUTED, PAPER, POSTAL } from "./palette";
import { Heading } from "./paperwork";

export const DIALOG_PAPER = { bgcolor: PAPER, color: INK, borderRadius: "6px", overflow: "hidden", m: { xs: 1.5, sm: 4 }, width: "100%", maxWidth: 520, backgroundImage: "none" } as const;

/** The game's dialogs: paper with an airmail edge. */
export function PaperDialog({ open, onClose, labelledBy, children }: { open: boolean; onClose: () => void; labelledBy: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} aria-labelledby={labelledBy} scroll="body" slotProps={{ paper: { sx: DIALOG_PAPER } }}>
      <Box aria-hidden sx={{ height: 10, background: AIRMAIL }} />
      <Box sx={{ p: { xs: 2.5, sm: 3.5 }, display: "grid", gap: 2, fontFamily: TYPE, fontSize: 15, lineHeight: 1.55 }}>{children}</Box>
    </Dialog>
  );
}

export function HowToPlay({ open, onClose, boardName, boardHowTo }: { open: boolean; onClose: () => void; boardName: string; boardHowTo: string }) {
  return (
    <PaperDialog open={open} onClose={onClose} labelledBy="rts-howto">
      <Box sx={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>Employee handbook</Box>
      <Heading id="rts-howto">Welcome to the counter</Heading>
      <Box component="p" sx={{ m: 0 }}>
        Every day, head office issues one secret regulation. Your job is to work out what it is.
      </Box>
      <Box component="ol" sx={{ m: 0, pl: 2.5, display: "grid", gap: 1 }}>
        <li>Build an item at the desk and submit it. The clerk stamps it Approved or Return to sender. Submitting is free, and the item stays on the desk so you can change it and try again.</li>
        <li>Approved items go in the left tray and returned items in the right. Compare them.</li>
        <li>When you think you know the regulation, start your shift: 8 new items arrive one at a time, and you stamp each one. Once a shift starts, you stay until the bag is sorted.</li>
        <li>The timesheet says how many you sorted right, never which. Sort all 8 right for a perfect shift.</li>
        <li>Stuck? After your first submission, ring the bell for a supervisor&apos;s hint. Two a day.</li>
      </Box>
      <Box sx={{ borderTop: `1px dashed ${DASH}`, pt: 1.5, display: "grid", gap: 0.5 }}>
        <Box sx={{ fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED }}>Today&apos;s mail: {boardName}</Box>
        <Box component="p" sx={{ m: 0 }}>
          {boardHowTo}
        </Box>
      </Box>
      <Box component="p" sx={{ m: 0, color: MUTED, fontSize: 14 }}>
        Head office reminds you that every regulation is fair. Your patience is not our concern.
      </Box>
      <Box component="button" type="button" onClick={onClose} sx={{ justifySelf: "start", fontFamily: TYPE, fontSize: 15, px: 2, py: 1.1, borderRadius: "5px", border: `1px solid ${POSTAL}`, bgcolor: POSTAL, color: "#fff", cursor: "pointer" }}>
        Back to the desk
      </Box>
    </PaperDialog>
  );
}
