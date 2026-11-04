"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RemoveIcon from "@mui/icons-material/Remove";
import Link from "@/components/shared/AppLink";
import type { Recipe } from "@/lib/db/schema";
import type { RecipeLogEntry } from "@/lib/queries/recipes";
import type { RatingSummary } from "@/lib/recipe-ratings";
import { formatMinutes, shortDay, totalMinutes, type RecipeIngredient } from "@/lib/recipes";
import { batchesOf, formatAmount, showIngredient, showShare, showTemperatures, type UnitSystem } from "@/lib/recipe-units";
import { sharesOf, type Share } from "@/lib/recipe-links";
import { layoutTable } from "@/lib/recipe-table";
import { setRecipeUnits } from "@/app/actions/recipes";
import CookHistory from "./CookHistory";
import CookLogDialog, { type Cook } from "./CookLogDialog";
import BackLink from "./BackLink";
import CookMode from "./CookMode";
import FavoriteButton from "./FavoriteButton";
import GlanceTable from "./GlanceTable";
import { panelSx } from "./RecipeCard";
import RatingLine from "./RatingLine";
import RatingsChart from "./RatingsChart";
import RecipeLink from "./RecipeLink";
import TagChip from "./TagChip";
import UnitsSwitch from "./UnitsSwitch";
import { skinScope } from "./RecipesSkin";
import Stars from "./Stars";
import { color, font, gingham, radius, shadow } from "./tokens";

export type RecipeViewData = Recipe & { addedBy: string | null; favorite: boolean };

/** Ingredients split into their headed groups, in order. */
function grouped(ingredients: RecipeIngredient[]): { group: string | null; items: RecipeIngredient[] }[] {
  const out: { group: string | null; items: RecipeIngredient[] }[] = [];
  for (const ing of ingredients) {
    const group = ing.group ?? null;
    const last = out[out.length - 1];
    if (last && last.group === group) last.items.push(ing);
    else out.push({ group, items: [ing] });
  }
  return out;
}

/** "· 2 in step 2, 2 in step 6" under an ingredient split across steps, or "· steps 2, 6" without amounts. */
function sharesText(line: string, shares: Share[], factor: number, units: UnitSystem): string | null {
  if (!shares.some((s) => s.amount) && shares.length < 2) return null;
  if (!shares.some((s) => s.amount)) return `steps ${shares.map((s) => s.step).join(", ")}`;
  return shares.map((s) => (s.amount ? `${showShare(line, s.amount, factor, units)} in step ${s.step}` : `rest in step ${s.step}`)).join(", ");
}

type Active = { kind: "step" | "ingredient"; id: string } | null;

const visuallyHidden = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;
const sectionTitle = { fontSize: 22, mb: 1 } as const;

/** Tapping a line crosses it off, for keeping your place while cooking. */
function useChecklist() {
  const [done, setDone] = React.useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return [done, toggle] as const;
}

type LogDialog = { entry?: RecipeLogEntry; made?: number } | null;

export default function RecipeView({
  recipe,
  person,
  canFavorite,
  logs,
  ratings,
  cooks,
  defaultCook,
  today,
  units: savedUnits,
  linked,
  scale,
}: {
  recipe: RecipeViewData;
  person: string | null;
  canFavorite: boolean;
  /** The active person's units; changing them here saves them when this login may edit that person. */
  units: UnitSystem;
  logs: RecipeLogEntry[];
  ratings: RatingSummary;
  cooks: Cook[];
  defaultCook: number | null;
  today: string;
  /** Titles of the recipes its ingredient lines link to; a deleted one is missing, so its line stays text. */
  linked: Record<number, string>;
  /** The size to open at, as a multiple of the recipe's own, when another recipe links here. */
  scale: number;
}) {
  const [dialog, setDialog] = React.useState<LogDialog>(null);
  const [cooking, setCooking] = React.useState(false);
  const canLog = new Set(cooks.filter((c) => c.canLog).map((c) => c.id));
  const nameOf = new Map(logs.map((l) => [l.profileId, { name: l.person, color: l.color }]));
  // Without servings the recipe scales by batches: 1/2, 1, 1 1/2, 2. A stored 0 counts as unknown.
  const servings = recipe.servings && recipe.servings > 0 ? recipe.servings : null;
  const base = servings ?? 1;
  const stepBy = servings ? 1 : 0.5;
  const [amount, setAmount] = React.useState(() => Math.min(base * 20, Math.max(stepBy, Math.round((base * scale) / stepBy) * stepBy)));
  const factor = amount / base;
  const [units, setUnits] = React.useState(savedUnits);
  const chooseUnits = (next: UnitSystem) => {
    setUnits(next);
    if (canFavorite) setRecipeUnits(next).catch(() => {});
  };
  const [gotIngredient, toggleIngredient] = useChecklist();
  // Pointing at a step lights up the ingredients it uses, and pointing at an ingredient lights up its steps.
  const [active, setActive] = React.useState<Active>(null);
  const point = (next: Active) => ({
    onMouseEnter: () => setActive(next),
    onFocus: () => setActive(next),
    onMouseLeave: () => setActive((a) => (a?.id === next?.id ? null : a)),
    onBlur: () => setActive((a) => (a?.id === next?.id ? null : a)),
  });
  const litIngredients = new Set(active?.kind === "step" ? (recipe.steps.find((s) => s.id === active.id)?.uses ?? []).map((u) => u.ingredientId) : []);
  const litSteps = new Set(active?.kind === "ingredient" ? recipe.steps.filter((s) => s.uses?.some((u) => u.ingredientId === active.id)).map((s) => s.id) : []);
  const lit = { bgcolor: color.highlight, boxShadow: `inset 3px 0 0 ${color.accent}` } as const;
  const [doneStep, toggleStep] = useChecklist();

  const total = totalMinutes(recipe);
  const times = [
    recipe.prepMin ? `Prep ${formatMinutes(recipe.prepMin)}` : null,
    recipe.cookMin ? `Cook ${formatMinutes(recipe.cookMin)}` : null,
    total && recipe.prepMin && recipe.cookMin ? `Total ${formatMinutes(total)}` : null,
  ].filter(Boolean);

  const stepper = (
    <Box sx={{ display: "inline-flex", alignItems: "center", border: `1px solid ${color.rule}`, borderRadius: 999, bgcolor: color.surface }}>
      <IconButton size="small" aria-label="Fewer" disabled={amount <= stepBy} onClick={() => setAmount((a) => Math.max(stepBy, a - stepBy))}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography variant="body2" aria-live="polite" sx={{ minWidth: 92, textAlign: "center", fontWeight: 600 }}>
        {servings ? `${amount} ${amount === 1 ? "serving" : "servings"}` : `${formatAmount(amount)} ${amount === 1 ? "batch" : "batches"}`}
      </Typography>
      <IconButton size="small" aria-label="More" disabled={amount >= base * 20} onClick={() => setAmount((a) => a + stepBy)}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
  const unitsRow = (
    <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
      <UnitsSwitch value={units} onChange={chooseUnits} />
      {factor !== 1 && (
        <Button size="small" onClick={() => setAmount(base)} sx={{ px: 1 }}>
          Back to {servings ? `${base} servings` : "1 batch"}
        </Button>
      )}
    </Box>
  );
  const table = React.useMemo(() => layoutTable(recipe.ingredients, recipe.steps), [recipe.ingredients, recipe.steps]);
  const [glance, setGlance] = React.useState(false);
  const viewSwitch = table && (
    <ToggleButtonGroup size="small" exclusive value={glance ? "glance" : "steps"} onChange={(_, v: string | null) => v && setGlance(v === "glance")} aria-label="How to show the recipe">
      <ToggleButton value="steps" sx={{ px: 1.25, py: 0.25, fontSize: 13, textTransform: "none", borderColor: color.rule }}>
        Steps
      </ToggleButton>
      <ToggleButton value="glance" sx={{ px: 1.25, py: 0.25, fontSize: 13, textTransform: "none", borderColor: color.rule }}>
        At a glance
      </ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <BackLink />
      <Box sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: "grid", gap: { xs: 2, md: 3 }, gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 1fr) 2fr" }, alignItems: "stretch" }}>
          <Box aria-hidden sx={{ minHeight: { xs: 120, md: 200 }, borderRadius: `${radius.base - 4}px`, background: gingham() }} />
          <Box sx={{ minWidth: 0 }}>
            {(recipe.sourceName || recipe.sourceUrl) && (
              <Typography variant="body2" sx={{ color: color.muted }}>
                From{" "}
                {recipe.sourceUrl ? (
                  <Box component="a" href={recipe.sourceUrl} target="_blank" rel="noreferrer" sx={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
                    {recipe.sourceName ?? new URL(recipe.sourceUrl).hostname.replace(/^www\./, "")}
                  </Box>
                ) : (
                  recipe.sourceName
                )}
              </Typography>
            )}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
              <Typography variant="h3" component="h1" sx={{ flex: 1, fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.08, mt: 0.5, mb: 0.75 }}>
                {recipe.title}
              </Typography>
              <FavoriteButton recipeId={recipe.id} favorite={recipe.favorite} person={person} canFavorite={canFavorite} />
            </Box>
            {recipe.description && <Typography sx={{ color: color.muted, whiteSpace: "pre-line" }}>{recipe.description}</Typography>}
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 16px", mt: 1.5 }}>
              {ratings.people.length > 0 ? (
                // Each person's own rating shows on hover, or on a tap on phones.
                <Tooltip
                  enterTouchDelay={0}
                  leaveTouchDelay={4000}
                  slotProps={{ popper: { className: skinScope.className, style: skinScope.style }, tooltip: { sx: { bgcolor: color.surface, color: color.ink, border: `1px solid ${color.panelRule}`, boxShadow: shadow.panel, fontFamily: font.body, fontSize: 13, px: 1.5, py: 1 } } }}
                  title={
                    <Box component="span" sx={{ display: "grid", gap: 0.5 }}>
                      {ratings.people.map((p) => (
                        <Box component="span" key={p.profileId} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                          <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: nameOf.get(p.profileId)?.color ?? color.muted }} />
                          <Box component="span" sx={{ fontWeight: 700, flex: 1 }}>{nameOf.get(p.profileId)?.name}</Box>
                          <Stars value={p.rating} size={13} />
                          <Box component="span" sx={{ fontWeight: 700, minWidth: 24, textAlign: "right" }}>{p.rating.toFixed(1)}</Box>
                          <Box component="span" sx={{ color: color.muted }}>{p.count === 1 ? "1 rating" : `${p.count} ratings`}</Box>
                        </Box>
                      ))}
                    </Box>
                  }
                >
                  <Box component="span" tabIndex={0} sx={{ cursor: "help", borderRadius: 1, "&:focus-visible": { outline: `2px solid ${color.accent}`, outlineOffset: 2 } }}>
                    <RatingLine ratings={ratings} size={18} />
                  </Box>
                </Tooltip>
              ) : (
                <RatingLine ratings={ratings} size={18} />
              )}
              {ratings.lastCooked && (
                <Typography variant="body2" sx={{ color: color.muted }}>
                  Cooked {ratings.cooked === 1 ? "once" : `${ratings.cooked} times`} · last {shortDay(ratings.lastCooked, today)}
                </Typography>
              )}
              {times.length > 0 && (
                <Typography variant="body2" sx={{ color: color.muted }}>
                  {times.join(" · ")}
                </Typography>
              )}
              {recipe.addedBy && (
                <Typography variant="body2" sx={{ color: color.muted }}>
                  Added by {recipe.addedBy}
                </Typography>
              )}
            </Box>
            {recipe.tags.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.625, mt: 1.5 }}>
                {recipe.tags.map((t) => (
                  <TagChip key={t} label={t} href={`/recipes?tag=${encodeURIComponent(t)}`} />
                ))}
              </Box>
            )}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
              <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => setCooking(true)} disabled={recipe.steps.length === 0}>
                Start cooking
              </Button>
              <Button variant="outlined" startIcon={<RestaurantIcon />} onClick={() => setDialog({})}>
                Log a cook
              </Button>
              <Button component={Link} href={`/recipes/${recipe.id}/edit`} variant="outlined" startIcon={<EditOutlinedIcon />}>
                Edit
              </Button>
            </Box>
          </Box>
        </Box>

        {glance && table ? (
          <Box component="section" aria-labelledby="glance-title" sx={{ mt: { xs: 3, md: 4 } }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
              <Typography id="glance-title" variant="h5" component="h2" sx={{ ...sectionTitle, mb: 0, flex: 1 }}>
                At a glance
              </Typography>
              {viewSwitch}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
              {stepper}
              {unitsRow}
            </Box>
            <GlanceTable table={table} ingredients={recipe.ingredients} steps={recipe.steps} factor={factor} units={units} />
          </Box>
        ) : (
        <Box sx={{ display: "grid", gap: { xs: 3, md: 4 }, gridTemplateColumns: { xs: "1fr", md: "minmax(220px, 1fr) 2fr" }, alignItems: "start", mt: { xs: 3, md: 4 } }}>
          <Box component="section" aria-labelledby="ingredients-title">
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
              <Typography id="ingredients-title" variant="h5" component="h2" sx={{ ...sectionTitle, mb: 0, flex: 1 }}>
                Ingredients
              </Typography>
              {stepper}
            </Box>
            {unitsRow}
            {recipe.ingredients.length === 0 ? (
              <Typography sx={{ color: color.muted }}>No ingredients yet.</Typography>
            ) : (
              grouped(recipe.ingredients).map(({ group, items }, gi) => (
                <Box key={`${group ?? ""}-${gi}`} sx={{ mb: 1.5 }}>
                  {group && (
                    <Typography variant="subtitle2" component="h3" sx={{ color: color.muted, textTransform: "uppercase", letterSpacing: 1, fontSize: 12, mt: 1, mb: 0.5 }}>
                      {group}
                    </Typography>
                  )}
                  {items.map((ing) => {
                    const got = gotIngredient.has(ing.id);
                    const shares = sharesText(ing.text, sharesOf(ing.id, recipe.steps), factor, units);
                    const inner = ing.recipeId !== undefined ? linked[ing.recipeId] : undefined;
                    return (
                      <React.Fragment key={ing.id}>
                      <ButtonBase
                        role="checkbox"
                        aria-checked={got}
                        onClick={() => toggleIngredient(ing.id)}
                        {...point({ kind: "ingredient", id: ing.id })}
                        sx={{ display: "flex", justifyContent: "flex-start", gap: 1.25, width: "100%", textAlign: "left", font: "inherit", fontSize: 15.5, lineHeight: 1.45, py: 0.75, px: 1, mx: -1, borderRadius: 2, color: got ? color.muted : color.ink, "&:hover": { bgcolor: color.highlight }, ...(litIngredients.has(ing.id) ? lit : {}) }}
                      >
                        <Box aria-hidden sx={{ flex: "none", width: 18, height: 18, mt: "2px", borderRadius: "5px", border: `1.5px solid ${got ? color.accent : color.muted}`, bgcolor: got ? color.accent : "transparent", color: color.onAccent, fontSize: 13, lineHeight: "15px", textAlign: "center" }}>
                          {got ? "✓" : ""}
                        </Box>
                        <Box component="span">
                          <Box component="span" sx={{ textDecoration: got ? "line-through" : "none" }}>
                            {showIngredient(ing.text, factor, units)}
                          </Box>
                          {shares && (
                            <Box component="span" sx={{ color: color.muted, fontSize: 13.5 }}>
                              {" "}
                              · {shares}
                            </Box>
                          )}
                        </Box>
                      </ButtonBase>
                      {inner && <RecipeLink id={ing.recipeId!} title={inner} scale={batchesOf(ing.text) * factor} />}
                      </React.Fragment>
                    );
                  })}
                </Box>
              ))
            )}
          </Box>

          <Box component="section" aria-labelledby="steps-title" sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1 }}>
              <Typography id="steps-title" variant="h5" component="h2" sx={{ ...sectionTitle, mb: 0, flex: 1 }}>
                Steps
              </Typography>
              {viewSwitch}
            </Box>
            {recipe.steps.length === 0 ? (
              <Typography sx={{ color: color.muted }}>No steps yet.</Typography>
            ) : (
              <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
                {recipe.steps.map((s, i) => {
                  const done = doneStep.has(s.id);
                  return (
                    <li key={s.id}>
                      <ButtonBase
                        aria-pressed={done}
                        onClick={() => toggleStep(s.id)}
                        {...point({ kind: "step", id: s.id })}
                        sx={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: 1.5, width: "100%", textAlign: "left", font: "inherit", fontSize: 16, lineHeight: 1.55, py: 1, px: 1.25, mx: -1.25, mb: 0.25, borderRadius: 2, opacity: done ? 0.5 : 1, "&:hover": { bgcolor: color.highlight }, ...(litSteps.has(s.id) ? lit : {}) }}
                      >
                        <Box component="span" aria-hidden sx={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, color: color.accent, fontSize: 20, minWidth: 24, lineHeight: 1.25 }}>
                          {i + 1}
                        </Box>
                        <Box component="span" sx={{ whiteSpace: "pre-line" }}>
                          <Box component="span" sx={visuallyHidden}>
                            Step {i + 1}{done ? ", done" : ""}:{" "}
                          </Box>
                          {showTemperatures(s.text, units)}
                        </Box>
                      </ButtonBase>
                    </li>
                  );
                })}
              </Box>
            )}
            {recipe.notes && (
              <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: color.highlight }}>
                <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Notes
                </Typography>
                <Typography sx={{ whiteSpace: "pre-line" }}>{recipe.notes}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        )}

        <Box component="section" aria-labelledby="log-title" sx={{ mt: { xs: 3, md: 4 }, pt: { xs: 2.5, md: 3 }, borderTop: `1px solid ${color.rule}` }}>
          <Typography id="log-title" variant="h5" component="h2" sx={sectionTitle}>
            Cook log
          </Typography>
          {logs.length === 0 ? (
            <Typography sx={{ color: color.muted }}>No one has cooked this yet. Log a cook after you make it.</Typography>
          ) : (
            <>
              <RatingsChart logs={logs} />
              <CookHistory logs={logs} version={recipe.version} today={today} canEdit={(id) => canLog.has(id)} onEdit={(entry) => setDialog({ entry })} />
            </>
          )}
        </Box>
      </Box>
      {dialog && (
        <CookLogDialog
          key={dialog.entry?.id ?? "new"}
          open
          onClose={() => setDialog(null)}
          recipeId={recipe.id}
          entry={dialog.entry}
          cooks={cooks}
          defaultCook={defaultCook}
          today={today}
          servings={servings}
          made={dialog.made}
        />
      )}
      {cooking && (
        <CookMode
          title={recipe.title}
          ingredients={recipe.ingredients}
          steps={recipe.steps}
          factor={factor}
          units={units}
          linked={linked}
          amountLabel={servings ? `${amount} ${amount === 1 ? "serving" : "servings"}` : `${formatAmount(amount)} ${amount === 1 ? "batch" : "batches"}`}
          onClose={() => setCooking(false)}
          onDone={() => {
            setCooking(false);
            setDialog({ made: servings && amount !== servings ? amount : undefined });
          }}
        />
      )}
    </Container>
  );
}
