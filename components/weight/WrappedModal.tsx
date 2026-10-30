"use client";

import * as React from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type { YearSummary } from "@/lib/queries/weight";

// Fun real-world equivalents for lbs lost (ascending) — pick the biggest that fits.
const EQUIV: [number, string][] = [
  [1, "a can of soup 🥫"],
  [2, "a bag of coffee ☕"],
  [3, "a laptop 💻"],
  [4, "a brick 🧱"],
  [5, "a bag of sugar 🍬"],
  [6, "a pair of boots 🥾"],
  [7, "a bowling ball 🎳"],
  [8, "a gallon of milk 🥛"],
  [9, "a house cat 🐈"],
  [10, "a car tire 🛞"],
  [12, "a case of soda 🥤"],
  [14, "a gold bar 🪙"],
  [16, "a mid-size bag of dog food 🐕"],
  [20, "a sack of potatoes 🥔"],
  [24, "a car battery 🔋"],
  [30, "a 3-year-old 🧒"],
  [35, "a bag of cement 🏗️"],
  [40, "a beer keg 🍺"],
  [50, "a small child 🧒"],
  [60, "a Labrador 🐕"],
  [70, "ten bowling balls 🎳"],
  [90, "a baby grand piano (nearly) 🎹"],
];
function equivalent(lb: number): string | null {
  let hit: string | null = null;
  for (const [n, thing] of EQUIV) if (lb >= n) hit = thing;
  return hit;
}

type Slide = { big: string; small: string };

function buildSlides(s: YearSummary): Slide[] {
  const lost = s.totalChange;
  const eq = lost >= 1 ? equivalent(lost) : null;
  const vsLast = s.lastYearAtNow != null ? Math.round((s.lastYearAtNow - s.currentWeight) * 10) / 10 : null;

  const slides: Slide[] = [{ big: `${s.year}`, small: "Wrapped ✨" }];
  slides.push(
    lost > 0.5
      ? { big: `Down ${lost} lb`, small: "this year 🎉" }
      : lost < -0.5
        ? { big: `Up ${Math.abs(lost)} lb`, small: "— next year's the comeback 💪" }
        : { big: "Held steady", small: "rock solid 🪨" },
  );
  if (eq && lost >= 1) slides.push({ big: "That's about", small: eq });
  if (s.bestWeekDrop != null) slides.push({ big: `−${s.bestWeekDrop} lb`, small: "your biggest single week 💥" });
  slides.push({ big: `${s.low}–${s.high}`, small: "your range this year" });
  slides.push({ big: `${s.weighIns}`, small: "weigh-ins logged 📆" });
  if (vsLast != null && vsLast > 0) slides.push({ big: `${vsLast} lb`, small: "lighter than a year ago 🎯" });
  slides.push({ big: `Here's to ${s.year + 1}!`, small: "🚀" });
  return slides;
}

export default function WrappedModal({
  open,
  onClose,
  summary,
  accent,
}: {
  open: boolean;
  onClose: () => void;
  summary: YearSummary;
  accent: string;
}) {
  const slides = React.useMemo(() => buildSlides(summary), [summary]);
  const [i, setI] = React.useState(0);
  const last = i >= slides.length - 1;
  const slide = slides[Math.min(i, slides.length - 1)];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            // Opaque paper + the accent gradient as an OVERLAY (a `background`
            // shorthand to transparent would let the chart show through).
            backgroundColor: "background.paper",
            backgroundImage: `linear-gradient(160deg, ${alpha(accent, 0.2)}, transparent 70%)`,
          },
        },
        transition: { onExited: () => setI(0) }, // restart at slide 0 after it closes
      }}
    >
      <DialogContent sx={{ minHeight: 260, display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", py: 5 }}>
        <Typography variant="overline" sx={{ color: accent, fontWeight: 800, letterSpacing: "0.14em", mb: 1 }}>
          {summary.year} Wrapped
        </Typography>
        <Typography variant="h3" component="div" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
          {slide.big}
        </Typography>
        <Typography variant="h6" component="div" sx={{ color: "text.secondary", fontWeight: 400, mt: 1 }}>
          {slide.small}
        </Typography>

        {/* progress dots */}
        <Box sx={{ display: "flex", gap: 0.75, justifyContent: "center", mt: 3 }}>
          {slides.map((_, k) => (
            <Box
              key={k}
              sx={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                bgcolor: k === i ? accent : "divider",
              }}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: "space-between" }}>
        <Button onClick={() => (i > 0 ? setI(i - 1) : onClose())} color="inherit">
          {i > 0 ? "Back" : "Close"}
        </Button>
        <Button variant="contained" onClick={() => (last ? onClose() : setI(i + 1))}>
          {last ? "Done" : "Next"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
