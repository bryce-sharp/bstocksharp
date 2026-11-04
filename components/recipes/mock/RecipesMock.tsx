"use client";

// A clickable mockup of the Recipes section: the list, a recipe with scaling, import from a link, and cook mode.
// Sample recipes live in memory only; nothing is saved or fetched.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import RemoveIcon from "@mui/icons-material/Remove";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import { formatClock, scaleIngredient, stepTimers } from "@/lib/recipes";
import { IMPORTED, SAMPLE_RECIPES, type MockRecipe } from "./sample";

type View = { kind: "list" } | { kind: "recipe"; id: string } | { kind: "import" };

const isGroup = (line: string) => line.trim().endsWith(":");
const minutes = (n?: number) => (n ? (n >= 60 ? `${Math.floor(n / 60)} hr${n % 60 ? ` ${n % 60} min` : ""}` : `${n} min`) : null);

export function RecipesMock() {
  const [recipes, setRecipes] = useState<MockRecipe[]>(SAMPLE_RECIPES);
  const [view, setView] = useState<View>({ kind: "list" });
  const [cooking, setCooking] = useState<{ id: string; servings: number } | null>(null);
  const toggleFavorite = (id: string) => setRecipes((rs) => rs.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)));
  const open = recipes.find((r) => view.kind === "recipe" && r.id === view.id);
  const cookRecipe = recipes.find((r) => r.id === cooking?.id);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Alert severity="info" sx={{ mb: 3 }}>
        Mockup with sample recipes. Nothing is saved, and import shows a sample result.
      </Alert>
      {view.kind === "list" && (
        <RecipeList recipes={recipes} onOpen={(id) => setView({ kind: "recipe", id })} onImport={() => setView({ kind: "import" })} onFavorite={toggleFavorite} />
      )}
      {view.kind === "recipe" && open && (
        <RecipeDetail
          key={open.id}
          recipe={open}
          onBack={() => setView({ kind: "list" })}
          onFavorite={() => toggleFavorite(open.id)}
          onCook={(servings) => setCooking({ id: open.id, servings })}
        />
      )}
      {view.kind === "import" && (
        <ImportFlow
          onCancel={() => setView({ kind: "list" })}
          onSave={(r) => {
            setRecipes((rs) => [r, ...rs]);
            setView({ kind: "recipe", id: r.id });
          }}
        />
      )}
      {cookRecipe && cooking && <CookMode recipe={cookRecipe} servings={cooking.servings} onClose={() => setCooking(null)} />}
    </Container>
  );
}

function Picture({ recipe, height }: { recipe: Pick<MockRecipe, "hue" | "title">; height: number }) {
  return (
    <Box
      aria-hidden
      sx={{
        height,
        borderRadius: 2,
        display: "grid",
        placeItems: "center",
        color: "common.white",
        background: `linear-gradient(135deg, var(--chart-${recipe.hue}) 0%, color-mix(in srgb, var(--chart-${recipe.hue}) 55%, black) 100%)`,
      }}
    >
      <RestaurantMenuIcon sx={{ fontSize: height / 3, opacity: 0.85 }} />
    </Box>
  );
}

function Meta({ recipe }: { recipe: MockRecipe }) {
  const total = (recipe.prepMin ?? 0) + (recipe.cookMin ?? 0);
  return (
    <Typography variant="body2" sx={{ color: "text.secondary" }}>
      {[minutes(total), `${recipe.servings} servings`].filter(Boolean).join(" · ")}
    </Typography>
  );
}

function RecipeList({ recipes, onOpen, onImport, onFavorite }: { recipes: MockRecipe[]; onOpen: (id: string) => void; onImport: () => void; onFavorite: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(false);
  const tags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))].sort(), [recipes]);
  const q = query.trim().toLowerCase();
  const shown = recipes.filter(
    (r) =>
      (!favorites || r.favorite) &&
      (!tag || r.tags.includes(tag)) &&
      (!q || r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q))),
  );
  return (
    <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" }, mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Recipes
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<LinkIcon />} onClick={onImport}>
            Import from a link
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} disabled>
            New recipe
          </Button>
        </Stack>
      </Stack>
      <TextField
        fullWidth
        placeholder="Search recipes or ingredients"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }}
        sx={{ mb: 1.5 }}
      />
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: 3 }}>
        <Chip icon={<StarIcon />} label="Favorites" color={favorites ? "primary" : "default"} onClick={() => setFavorites((f) => !f)} />
        {tags.map((t) => (
          <Chip key={t} label={t} color={tag === t ? "primary" : "default"} variant={tag === t ? "filled" : "outlined"} onClick={() => setTag(tag === t ? null : t)} />
        ))}
      </Stack>
      {shown.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: "center", color: "text.secondary" }}>
          No recipes match.
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "repeat(3, 1fr)" } }}>
          {shown.map((r) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 1.5, cursor: "pointer", "&:hover": { borderColor: "primary.main" } }} onClick={() => onOpen(r.id)}>
              <Picture recipe={r} height={140} />
              <Stack direction="row" sx={{ alignItems: "flex-start", mt: 1.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    {r.title}
                  </Typography>
                  <Meta recipe={r} />
                </Box>
                <IconButton
                  aria-label={r.favorite ? "Remove from favorites" : "Add to favorites"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFavorite(r.id);
                  }}
                >
                  {r.favorite ? <StarIcon color="primary" /> : <StarBorderIcon />}
                </IconButton>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                {r.tags.map((t) => (
                  <Chip key={t} label={t} size="small" variant="outlined" />
                ))}
              </Stack>
            </Paper>
          ))}
        </Box>
      )}
    </>
  );
}

function Servings({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center" }} spacing={0.5}>
      <IconButton aria-label="Fewer servings" size="small" disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ fontWeight: 700, minWidth: 92, textAlign: "center" }}>{value} servings</Typography>
      <IconButton aria-label="More servings" size="small" onClick={() => onChange(value + 1)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function Ingredients({ lines, factor, checked, onCheck }: { lines: string[]; factor: number; checked: Set<number>; onCheck: (i: number) => void }) {
  return (
    <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
      {lines.map((line, i) =>
        isGroup(line) ? (
          <Typography key={i} component="li" variant="overline" sx={{ display: "block", mt: 1.5, color: "text.secondary" }}>
            {line.replace(/:$/, "")}
          </Typography>
        ) : (
          <Box component="li" key={i} sx={{ display: "flex", alignItems: "center", opacity: checked.has(i) ? 0.5 : 1 }}>
            <Checkbox size="small" checked={checked.has(i)} onChange={() => onCheck(i)} slotProps={{ input: { "aria-label": line } }} />
            <Typography variant="body1" sx={{ textDecoration: checked.has(i) ? "line-through" : "none" }}>
              {scaleIngredient(line, factor)}
            </Typography>
          </Box>
        ),
      )}
    </Box>
  );
}

function useChecks() {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setChecked((s) => {
      const next = new Set(s);
      if (!next.delete(i)) next.add(i);
      return next;
    });
  return [checked, toggle] as const;
}

function RecipeDetail({ recipe, onBack, onFavorite, onCook }: { recipe: MockRecipe; onBack: () => void; onFavorite: () => void; onCook: (servings: number) => void }) {
  const [servings, setServings] = useState(recipe.servings);
  const [checked, toggle] = useChecks();
  const factor = servings / recipe.servings;
  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
        All recipes
      </Button>
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, alignItems: "start" }}>
        <Picture recipe={recipe} height={220} />
        <Box>
          <Stack direction="row" sx={{ alignItems: "flex-start" }}>
            <Typography variant="h4" component="h1" sx={{ flex: 1 }}>
              {recipe.title}
            </Typography>
            <IconButton aria-label={recipe.favorite ? "Remove from favorites" : "Add to favorites"} onClick={onFavorite}>
              {recipe.favorite ? <StarIcon color="primary" /> : <StarBorderIcon />}
            </IconButton>
          </Stack>
          {recipe.description && <Typography sx={{ color: "text.secondary", mt: 0.5 }}>{recipe.description}</Typography>}
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2, mt: 2, color: "text.secondary" }}>
            {recipe.prepMin && <Typography variant="body2">Prep {minutes(recipe.prepMin)}</Typography>}
            {recipe.cookMin && <Typography variant="body2">Cook {minutes(recipe.cookMin)}</Typography>}
            {recipe.source && (
              <Typography variant="body2">
                From {recipe.source.url ? <a href={recipe.source.url}>{recipe.source.name}</a> : recipe.source.name}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1.5 }}>
            {recipe.tags.map((t) => (
              <Chip key={t} label={t} size="small" variant="outlined" />
            ))}
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
            <Button variant="contained" size="large" onClick={() => onCook(servings)}>
              Start cooking
            </Button>
            <Button variant="outlined" size="large" disabled>
              Edit
            </Button>
          </Stack>
        </Box>
      </Box>
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, mt: 4 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="h6">Ingredients</Typography>
            <Servings value={servings} onChange={setServings} />
          </Stack>
          {factor !== 1 && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              Scaled from {recipe.servings} servings
            </Typography>
          )}
          <Ingredients lines={recipe.ingredients} factor={factor} checked={checked} onCheck={toggle} />
        </Paper>
        <Box>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Steps
          </Typography>
          <Box component="ol" sx={{ pl: 3, m: 0, display: "grid", gap: 1.5 }}>
            {recipe.steps.map((s, i) => (
              <Typography component="li" key={i} sx={{ lineHeight: 1.6 }}>
                {s}
              </Typography>
            ))}
          </Box>
          {recipe.notes && (
            <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
              <Typography variant="overline" sx={{ color: "text.secondary" }}>
                Notes
              </Typography>
              <Typography>{recipe.notes}</Typography>
            </Paper>
          )}
        </Box>
      </Box>
    </>
  );
}

type ImportStage = "link" | "reading" | "review" | "notFound";

function ImportFlow({ onCancel, onSave }: { onCancel: () => void; onSave: (r: MockRecipe) => void }) {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<ImportStage>("link");
  const [draft, setDraft] = useState({ ...IMPORTED, ingredientsText: IMPORTED.ingredients.join("\n"), stepsText: IMPORTED.steps.join("\n") });
  const valid = /^https?:\/\/[^\s.]+\.[^\s]+$/.test(url.trim());
  const host = valid ? new URL(url.trim()).hostname.replace(/^www\./, "") : "";
  const read = () => {
    setStage("reading");
    // "not-a-recipe" in the link shows what happens when a page has no recipe data.
    window.setTimeout(() => setStage(url.includes("not-a-recipe") ? "notFound" : "review"), 1100);
  };
  const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

  return (
    <>
      <Button startIcon={<ArrowBackIcon />} onClick={onCancel} sx={{ mb: 2 }}>
        All recipes
      </Button>
      <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
        Import from a link
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 3 }}>
        Paste a recipe page. Most recipe sites describe their recipe in a standard way, so the ingredients and steps come straight in, without the life story.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          label="Recipe link"
          placeholder="https://"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setStage("link");
          }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><LinkIcon /></InputAdornment> } }}
        />
        <Button variant="contained" disabled={!valid || stage === "reading"} onClick={read} sx={{ minWidth: 140 }}>
          Read recipe
        </Button>
      </Stack>
      {stage === "reading" && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1 }}>
            Reading {host}…
          </Typography>
          <LinearProgress />
        </Box>
      )}
      {stage === "notFound" && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No recipe data on that page. You can paste the ingredients and steps below instead, or try the site&apos;s print view.
        </Alert>
      )}
      {(stage === "review" || stage === "notFound") && (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          {stage === "review" && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Found a recipe on {host}. Check it over, then save.
            </Alert>
          )}
          <Stack spacing={2}>
            <TextField label="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <Stack direction="row" spacing={2}>
              <TextField label="Servings" type="number" value={draft.servings} onChange={(e) => setDraft({ ...draft, servings: Math.max(1, Number(e.target.value) || 1) })} sx={{ width: 120 }} />
              <TextField label="Prep (min)" type="number" value={draft.prepMin ?? ""} onChange={(e) => setDraft({ ...draft, prepMin: Number(e.target.value) || undefined })} sx={{ width: 120 }} />
              <TextField label="Cook (min)" type="number" value={draft.cookMin ?? ""} onChange={(e) => setDraft({ ...draft, cookMin: Number(e.target.value) || undefined })} sx={{ width: 120 }} />
            </Stack>
            <TextField label="Ingredients, one per line" multiline minRows={6} value={draft.ingredientsText} onChange={(e) => setDraft({ ...draft, ingredientsText: e.target.value })} />
            <TextField label="Steps, one per line" multiline minRows={5} value={draft.stepsText} onChange={(e) => setDraft({ ...draft, stepsText: e.target.value })} />
            <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
              <Button onClick={onCancel}>Cancel</Button>
              <Button
                variant="contained"
                disabled={!draft.title.trim() || !lines(draft.ingredientsText).length || !lines(draft.stepsText).length}
                onClick={() =>
                  onSave({
                    id: `imported-${Date.now()}`,
                    title: draft.title.trim(),
                    description: draft.description,
                    servings: draft.servings,
                    prepMin: draft.prepMin,
                    cookMin: draft.cookMin,
                    tags: draft.tags,
                    favorite: false,
                    source: host ? { name: host, url: url.trim() } : undefined,
                    ingredients: lines(draft.ingredientsText),
                    steps: lines(draft.stepsText),
                    hue: 3,
                  })
                }
              >
                Save recipe
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </>
  );
}

const subscribeNever = () => () => {};

/** Keeps the screen on while `active`, asking again when the page comes back; "unavailable" when unsupported or refused. */
function useWakeLock(active: boolean): "on" | "off" | "unavailable" {
  const supported = useSyncExternalStore(subscribeNever, () => "wakeLock" in navigator, () => true);
  const [held, setHeld] = useState<"on" | "off" | "denied">("off");
  useEffect(() => {
    if (!active || !supported) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const acquire = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (!live) return void l.release();
          lock = l;
          setHeld("on");
          l.addEventListener("release", () => setHeld("off"));
        })
        .catch(() => setHeld("denied"));
    void acquire();
    const onVisible = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, [active, supported]);
  return !supported || held === "denied" ? "unavailable" : held;
}

type RunningTimer = { id: number; label: string; step: number; endsAt: number; done: boolean };

/** A timer starting now; read outside the component so rendering stays pure. */
const newTimer = (id: number, label: string, step: number, seconds: number): RunningTimer => ({ id, label, step, endsAt: Date.now() + seconds * 1000, done: false });

function beep() {
  try {
    const ctx = new AudioContext();
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
  } catch {
    // No audio: the timer still turns to done on screen.
  }
  navigator.vibrate?.([200, 100, 200]);
}

function CookMode({ recipe, servings, onClose }: { recipe: MockRecipe; servings: number; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [checked, toggle] = useChecks();
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const nextId = useRef(1);
  const wake = useWakeLock(true);
  const last = recipe.steps.length - 1;
  const text = recipe.steps[step]!;
  const found = stepTimers(text);

  const go = useCallback((by: number) => setStep((s) => Math.min(last, Math.max(0, s + by))), [last]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const running = timers.some((t) => !t.done);
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      setTimers((ts) => {
        if (!ts.some((x) => !x.done && x.endsAt <= t)) return ts;
        beep();
        return ts.map((x) => (!x.done && x.endsAt <= t ? { ...x, done: true } : x));
      });
    }, 250);
    return () => window.clearInterval(tick);
  }, [running]);

  const start = (label: string, seconds: number) => {
    const timer = newTimer(nextId.current++, label, step, seconds);
    setNow(timer.endsAt - seconds * 1000);
    setTimers((ts) => [...ts, timer]);
  };

  return (
    <Dialog fullScreen open onClose={onClose}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "background.default" }}>
        <Stack direction="row" sx={{ alignItems: "center", px: 2, py: 1, gap: 1, borderBottom: 1, borderColor: "divider" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
              {recipe.title}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {servings} servings &middot;{" "}
              {wake === "on" ? (
                <>
                  <LightModeOutlinedIcon sx={{ fontSize: 13, verticalAlign: "-2px" }} /> Screen stays on
                </>
              ) : wake === "unavailable" ? (
                "This browser may let the screen sleep"
              ) : (
                "Keeping the screen on…"
              )}
            </Typography>
          </Box>
          <Button startIcon={<ListAltIcon />} variant={showIngredients ? "contained" : "outlined"} onClick={() => setShowIngredients((s) => !s)}>
            Ingredients
          </Button>
          <IconButton aria-label="Leave cook mode" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <LinearProgress variant="determinate" value={((step + 1) / recipe.steps.length) * 100} />

        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {showIngredients && (
            <Box sx={{ width: { xs: "100%", md: 360 }, borderRight: { md: 1 }, borderColor: "divider", overflowY: "auto", p: 2, position: { xs: "absolute", md: "static" }, inset: { xs: "112px 0 140px 0", md: "auto" }, bgcolor: "background.paper", zIndex: 2 }}>
              <Ingredients lines={recipe.ingredients} factor={servings / recipe.servings} checked={checked} onCheck={toggle} />
            </Box>
          )}
          <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center", px: { xs: 3, md: 8 }, py: 4 }}>
            <Typography variant="overline" sx={{ color: "text.secondary" }}>
              Step {step + 1} of {recipe.steps.length}
            </Typography>
            <Typography sx={{ fontSize: { xs: 26, md: 38 }, lineHeight: 1.35, fontWeight: 500, maxWidth: 900 }}>{text}</Typography>
            {found.length > 0 && (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 3 }}>
                {found.map((f) => (
                  <Button key={f.label} variant="outlined" size="large" startIcon={<TimerOutlinedIcon />} onClick={() => start(f.label, f.seconds)}>
                    Start {formatClock(f.seconds)} timer
                  </Button>
                ))}
              </Stack>
            )}
          </Box>
        </Box>

        {timers.length > 0 && (
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, px: 2, py: 1, borderTop: 1, borderColor: "divider" }}>
            {timers.map((t) => (
              <Chip
                key={t.id}
                icon={<TimerOutlinedIcon />}
                color={t.done ? "warning" : "primary"}
                variant={t.done ? "filled" : "outlined"}
                label={`Step ${t.step + 1}: ${t.done ? "done" : formatClock((t.endsAt - now) / 1000)}`}
                onDelete={() => setTimers((ts) => ts.filter((x) => x.id !== t.id))}
                sx={{ fontVariantNumeric: "tabular-nums", fontSize: 15 }}
              />
            ))}
          </Stack>
        )}
        <Stack direction="row" spacing={2} sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
          <Button size="large" variant="outlined" startIcon={<ChevronLeftIcon />} disabled={step === 0} onClick={() => go(-1)} sx={{ flex: 1, py: 2 }}>
            Back
          </Button>
          {step < last ? (
            <Button size="large" variant="contained" endIcon={<ChevronRightIcon />} onClick={() => go(1)} sx={{ flex: 2, py: 2 }}>
              Next step
            </Button>
          ) : (
            <Button size="large" variant="contained" onClick={onClose} sx={{ flex: 2, py: 2 }}>
              Done cooking
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
