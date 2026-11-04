"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ListAltIcon from "@mui/icons-material/ListAlt";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { useWakeLock } from "@/components/shared/useWakeLock";
import { formatClock, scaleIngredient, stepTimers, type RecipeIngredient, type RecipeStep } from "@/lib/recipes";
import { skinScope, skinSx } from "./RecipesSkin";
import { color, plaidBand, radius } from "./tokens";

type Timer = { id: number; label: string; step: number; endsAt: number; done: boolean };

/** A timer starting now; made outside render so rendering stays pure. */
const newTimer = (id: number, label: string, step: number, seconds: number): Timer => ({ id, label, step, endsAt: Date.now() + seconds * 1000, done: false });

/** The next step says it happens alongside this one: "Meanwhile, ..." or "While it bakes, ...". */
const MEANWHILE = /^\s*(meanwhile|while)\b/i;

/** Three short beeps and a buzz; the context is made on a tap so phones allow sound. */
function beep(ctx: AudioContext | null) {
  try {
    if (ctx) {
      for (const at of [0, 0.35, 0.7]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + at);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + at);
        osc.stop(ctx.currentTime + at + 0.3);
      }
    }
  } catch {
    // No sound: the timer still turns to done on screen.
  }
  navigator.vibrate?.([200, 100, 200]);
}

function IngredientChecklist({
  ingredients,
  factor,
  got,
  toggle,
}: {
  ingredients: RecipeIngredient[];
  factor: number;
  got: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <Box>
      {ingredients.map((ing, i) => {
        const heading = ing.group && ing.group !== ingredients[i - 1]?.group ? ing.group : null;
        const on = got.has(ing.id);
        return (
          <React.Fragment key={ing.id}>
            {heading && (
              <Typography sx={{ color: color.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 12, fontWeight: 700, mt: 1.5, mb: 0.5 }}>{heading}</Typography>
            )}
            <ButtonBase
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(ing.id)}
              sx={{ display: "flex", justifyContent: "flex-start", gap: 1.25, width: "100%", textAlign: "left", font: "inherit", fontSize: 17, lineHeight: 1.45, py: 0.875, px: 1, mx: -1, borderRadius: 2, color: on ? color.muted : color.ink, "&:hover": { bgcolor: color.highlight } }}
            >
              <Box aria-hidden sx={{ flex: "none", width: 20, height: 20, mt: "2px", borderRadius: "6px", border: `1.5px solid ${on ? color.accent : color.muted}`, bgcolor: on ? color.accent : "transparent", color: color.onAccent, fontSize: 14, lineHeight: "17px", textAlign: "center" }}>
                {on ? "✓" : ""}
              </Box>
              <Box component="span" sx={{ textDecoration: on ? "line-through" : "none" }}>
                {scaleIngredient(ing.text, factor)}
              </Box>
            </ButtonBase>
          </React.Fragment>
        );
      })}
    </Box>
  );
}

/**
 * Cooking one recipe, full screen: a read-through first, then one big step at a time with Up next, timers that
 * keep running across steps, and the screen kept on. Done cooking hands back to the page to log it.
 */
export default function CookMode({
  title,
  ingredients,
  steps,
  factor,
  amountLabel,
  onClose,
  onDone,
}: {
  title: string;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  factor: number;
  amountLabel: string;
  onClose: () => void;
  onDone: () => void;
}) {
  // -1 is the read-through; 0 and up are the steps.
  const [at, setAt] = React.useState(-1);
  const [panel, setPanel] = React.useState(false);
  const [got, setGot] = React.useState<Set<string>>(() => new Set());
  const [timers, setTimers] = React.useState<Timer[]>([]);
  const [now, setNow] = React.useState(0);
  const nextId = React.useRef(1);
  const audio = React.useRef<AudioContext | null>(null);
  const wake = useWakeLock(true);

  const last = steps.length - 1;
  const step = at >= 0 ? steps[at] : undefined;
  const next = at >= 0 ? steps[at + 1] : undefined;
  const found = step ? stepTimers(step.text) : [];
  const waits = !!next && found.length > 0 && MEANWHILE.test(next.text);

  const toggle = (id: string) =>
    setGot((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const go = React.useCallback((by: number) => setAt((i) => Math.min(last, Math.max(-1, i + by))), [last]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const running = timers.some((t) => !t.done);
  React.useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setTimers((ts) => {
        if (!ts.some((x) => !x.done && x.endsAt <= t)) return ts;
        beep(audio.current);
        return ts.map((x) => (!x.done && x.endsAt <= t ? { ...x, done: true } : x));
      });
    }, 250);
    return () => window.clearInterval(tick);
  }, [running]);

  const startTimer = (label: string, seconds: number) => {
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {
      audio.current = null;
    }
    const timer = newTimer(nextId.current++, label, at, seconds);
    setNow(timer.endsAt - seconds * 1000);
    setTimers((ts) => [...ts, timer]);
  };

  const leave = () => {
    if (running && !window.confirm("Timers are still running. Leave cook mode?")) return;
    onClose();
  };

  const bigButton = { py: 1.75, fontSize: 16, borderRadius: `${radius.base}px` } as const;

  return (
    <Dialog fullScreen open onClose={leave} className={skinScope.className} style={skinScope.style} sx={skinSx} aria-label={`Cooking ${title}`}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: color.surface, color: color.ink }}>
        <Box aria-hidden sx={{ height: 10, flex: "none", background: plaidBand() }} />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, md: 3 }, py: 1.25, borderBottom: `1px solid ${color.rule}` }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2" noWrap sx={{ fontSize: 19 }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: color.muted, fontSize: 13 }}>
              {amountLabel} · {wake === "on" ? "Screen stays on" : wake === "unavailable" ? "Screen may sleep" : "Keeping the screen on…"}
            </Typography>
          </Box>
          {at >= 0 && (
            <Button startIcon={<ListAltIcon />} variant={panel ? "contained" : "outlined"} onClick={() => setPanel((p) => !p)} aria-pressed={panel}>
              Ingredients
            </Button>
          )}
          <IconButton aria-label="Leave cook mode" onClick={leave}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={{ height: 4, flex: "none", bgcolor: color.rule }}>
          <Box sx={{ height: 4, width: `${((at + 1) / steps.length) * 100}%`, bgcolor: color.accent, transition: "width .2s" }} />
        </Box>

        <Box sx={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
          {at >= 0 && panel && (
            <Box
              component="aside"
              aria-label="Ingredients"
              sx={{ width: { xs: "100%", md: 360 }, flex: "none", position: { xs: "absolute", md: "static" }, inset: 0, zIndex: 2, overflowY: "auto", p: 2.5, bgcolor: color.surface, borderRight: { md: `1px solid ${color.rule}` } }}
            >
              <IngredientChecklist ingredients={ingredients} factor={factor} got={got} toggle={toggle} />
            </Box>
          )}

          <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", px: { xs: 2.5, md: 8 }, py: { xs: 3, md: 5 } }}>
            {at === -1 ? (
              <Box sx={{ maxWidth: 1000, mx: "auto" }}>
                <Typography variant="h4" component="h3" sx={{ mb: 0.5 }}>
                  Before you start
                </Typography>
                <Typography sx={{ color: color.muted, mb: 3 }}>Read it through once, and get the ingredients out.</Typography>
                <Box sx={{ display: "grid", gap: { xs: 3, md: 5 }, gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 1.4fr" }, alignItems: "start" }}>
                  <Box>
                    <Typography variant="h6" component="h4" sx={{ mb: 1 }}>
                      Get these out
                    </Typography>
                    {ingredients.length ? <IngredientChecklist ingredients={ingredients} factor={factor} got={got} toggle={toggle} /> : <Typography sx={{ color: color.muted }}>No ingredients listed.</Typography>}
                  </Box>
                  <Box>
                    <Typography variant="h6" component="h4" sx={{ mb: 1 }}>
                      The steps
                    </Typography>
                    <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
                      {steps.map((s, i) => (
                        <Box component="li" key={s.id} sx={{ display: "flex", gap: 1.5, py: 0.75, fontSize: 16, lineHeight: 1.5 }}>
                          <Box aria-hidden sx={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, color: color.accent, fontSize: 19, minWidth: 24 }}>
                            {i + 1}
                          </Box>
                          <span>{s.text}</span>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>
            ) : (
              step && (
                <Box sx={{ maxWidth: 900, mx: "auto", minHeight: "100%", display: "flex", flexDirection: "column", gap: 2.5 }}>
                  <Typography sx={{ fontSize: 12.5, letterSpacing: 1.5, textTransform: "uppercase", color: color.muted, fontWeight: 700 }}>
                    Step {at + 1} of {steps.length}
                  </Typography>
                  <Typography aria-live="polite" sx={{ fontSize: { xs: 26, md: 38 }, lineHeight: 1.35, fontWeight: 600, whiteSpace: "pre-line" }}>
                    {step.text}
                  </Typography>
                  {found.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {found.map((f, i) => (
                        <Button key={`${f.label}-${i}`} variant="outlined" size="large" startIcon={<TimerOutlinedIcon />} onClick={() => startTimer(f.label, f.seconds)} sx={{ borderRadius: 999, bgcolor: color.surface }}>
                          Start {formatClock(f.seconds)} timer
                        </Button>
                      ))}
                    </Box>
                  )}
                  {next && (
                    <Box sx={{ mt: "auto", p: 1.75, borderRadius: `${radius.base}px`, border: `1.5px dashed ${waits ? color.second : color.rule}` }}>
                      <Typography sx={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700, color: waits ? color.second : color.muted }}>
                        {waits ? "Up next, while this one waits" : "Up next"}
                      </Typography>
                      <Typography sx={{ color: color.muted, fontSize: 16, mt: 0.5 }}>{next.text}</Typography>
                    </Box>
                  )}
                </Box>
              )
            )}
          </Box>
        </Box>

        {timers.length > 0 && (
          <Box role="region" aria-label="Timers" sx={{ display: "flex", flexWrap: "wrap", gap: 1, px: 2, py: 1.25, borderTop: `1px solid ${color.rule}`, bgcolor: color.page }}>
            {timers.map((t) => (
              <Box
                key={t.id}
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  pl: 1.25,
                  pr: 0.25,
                  py: 0.25,
                  borderRadius: 999,
                  border: `1.5px solid ${t.done ? color.second : color.accent}`,
                  bgcolor: t.done ? color.highlight : color.surface,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 700,
                  fontSize: 15,
                  "@keyframes rkPulse": { "50%": { boxShadow: `0 0 0 6px ${color.highlight}` } },
                  animation: t.done ? "rkPulse 1.2s ease-in-out infinite" : "none",
                  "@media (prefers-reduced-motion: reduce)": { animation: "none" },
                }}
              >
                <TimerOutlinedIcon sx={{ fontSize: 18, color: t.done ? color.second : color.accent }} />
                <ButtonBase onClick={() => setAt(t.step)} sx={{ font: "inherit", borderRadius: 1 }} aria-label={`Go to step ${t.step + 1}`}>
                  Step {t.step + 1} · {t.done ? "Done!" : formatClock((t.endsAt - now) / 1000)}
                </ButtonBase>
                <IconButton size="small" aria-label={t.done ? "Dismiss timer" : "Cancel timer"} onClick={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 1.5, p: 2, borderTop: `1px solid ${color.rule}` }}>
          {at === -1 ? (
            <Button variant="contained" size="large" fullWidth onClick={() => go(1)} disabled={steps.length === 0} sx={bigButton}>
              {steps.length ? "Start cooking" : "No steps to cook"}
            </Button>
          ) : (
            <>
              <Button variant="outlined" size="large" startIcon={<ChevronLeftIcon />} onClick={() => go(-1)} sx={{ ...bigButton, flex: 1 }}>
                {at === 0 ? "Read-through" : "Back"}
              </Button>
              {at < last ? (
                <Button variant="contained" size="large" endIcon={<ChevronRightIcon />} onClick={() => go(1)} sx={{ ...bigButton, flex: 2 }}>
                  Next step
                </Button>
              ) : (
                <Button variant="contained" size="large" onClick={onDone} sx={{ ...bigButton, flex: 2 }}>
                  Done cooking
                </Button>
              )}
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
