"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Link from "@/components/shared/AppLink";
import type { MealDetail, MenuDetail, RecipeChoice } from "@/lib/queries/recipes";
import { formatMinutes, recipeHref, shortDay, totalMinutes } from "@/lib/recipes";
import BackLink from "./BackLink";
import type { Cook } from "./CookLogDialog";
import { MealDialog, MenuDialog, RateMealDialog } from "./MenuDialogs";
import { panelSx } from "./RecipeCard";
import Stars from "./Stars";
import { color } from "./tokens";

const sectionTitle = { fontSize: 22, mb: 1 } as const;

function Dot({ fill }: { fill: string | null }) {
  return <Box aria-hidden sx={{ flex: "none", width: 10, height: 10, borderRadius: "50%", bgcolor: fill ?? color.muted }} />;
}

/** "Made 2 times, last Oct 18", or "Not made yet". */
export function madeLine(timesMade: number, lastMade: string | null, today: string): string {
  if (!timesMade || !lastMade) return "Not made yet";
  return `Made ${timesMade === 1 ? "once" : `${timesMade} times`}, last ${shortDay(lastMade, today)}`;
}

/** One time the menu was made: everyone's stars for the whole meal, then each recipe's stars that time. */
function MealTime({ meal, menu, today, canRate, onRate, onEdit }: { meal: MealDetail; menu: MenuDetail; today: string; canRate: boolean; onRate: () => void; onEdit: () => void }) {
  const same = meal.dishes.length === menu.dishes.length && meal.dishes.every((d, i) => d.id === menu.dishes[i]!.id);
  return (
    <Box component="li" sx={{ py: 2, borderTop: `1px solid ${color.rule}` }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography component="h3" sx={{ fontWeight: 700, fontSize: 17, flex: "1 1 auto" }}>
          {shortDay(meal.cookedOn, today)}
        </Typography>
        <Button size="small" startIcon={<StarBorderIcon />} onClick={onRate} disabled={!canRate || meal.dishes.length === 0}>
          Rate
        </Button>
        <Button size="small" startIcon={<EditOutlinedIcon />} onClick={onEdit}>
          Edit
        </Button>
      </Box>
      {!same && (
        <Typography variant="body2" sx={{ color: color.muted }}>
          Made with {meal.dishes.map((d) => d.title).join(" · ") || "recipes since deleted"}
        </Typography>
      )}
      {meal.notes && <Typography sx={{ whiteSpace: "pre-line", mt: 0.5 }}>{meal.notes}</Typography>}
      {meal.ratings.length === 0 ? (
        <Typography variant="body2" sx={{ color: color.muted, mt: 0.75 }}>
          No one has rated this time yet.
        </Typography>
      ) : (
        <Box component="ul" aria-label="The whole meal" sx={{ listStyle: "none", m: 0, p: 0, mt: 0.5 }}>
          {meal.ratings.map((r) => (
            <Box component="li" key={r.profileId} sx={{ display: "flex", gap: 1.5, py: 0.5 }}>
              <Box sx={{ mt: "6px" }}>
                <Dot fill={r.color} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 10px" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{r.person}</Typography>
                  {r.rating !== null && <Stars value={r.rating} size={14} />}
                </Box>
                {r.notes && <Typography sx={{ fontSize: 14.5, whiteSpace: "pre-line", mt: 0.25 }}>{r.notes}</Typography>}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {meal.logs.some((l) => l.rating !== null) && (
        <Box component="ul" aria-label="Each recipe this time" sx={{ listStyle: "none", m: 0, p: 0, mt: 1, display: "grid", gap: 0.5 }}>
          {meal.dishes.map((d) => {
            const logs = meal.logs.filter((l) => l.recipeId === d.id && l.rating !== null);
            if (!logs.length) return null;
            return (
              <Box component="li" key={d.id} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 16px" }}>
                <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 140 }}>
                  {d.title}
                </Typography>
                {logs.map((l) => (
                  <Box key={l.id} title={l.counted ? l.person : `${l.person}: something went wrong`} sx={{ display: "flex", alignItems: "center", gap: 0.75, opacity: l.counted ? 1 : 0.45 }}>
                    <Dot fill={l.color} />
                    <Stars value={l.rating!} size={13} />
                  </Box>
                ))}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

type Open = { kind: "menu" } | { kind: "made" } | { kind: "edit"; meal: MealDetail } | { kind: "rate"; meal: MealDetail } | null;

/** A menu: its recipes, ready to open, then each time it was made with how it went. */
export default function MenuView({ menu, recipeChoices, cooks, defaultCook, today }: { menu: MenuDetail; recipeChoices: RecipeChoice[]; cooks: Cook[]; defaultCook: number | null; today: string }) {
  const [open, setOpen] = React.useState<Open>(null);
  const canRate = cooks.some((c) => c.canLog);
  const close = () => setOpen(null);
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <BackLink href="/recipes/menus" label="All menus" />
      <Box sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 1.5 }}>
          <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
            <Typography variant="h3" component="h1" sx={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1 }}>
              {menu.name}
            </Typography>
            <Typography sx={{ color: color.muted, mt: 0.5 }}>
              {menu.dishes.length === 1 ? "1 recipe" : `${menu.dishes.length} recipes`} · {madeLine(menu.meals.length, menu.meals[0]?.cookedOn ?? null, today)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setOpen({ kind: "menu" })}>
              Edit
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen({ kind: "made" })} disabled={!canRate || menu.dishes.length === 0}>
              We made it
            </Button>
          </Box>
        </Box>
        {menu.notes && <Typography sx={{ whiteSpace: "pre-line", mt: 1.5 }}>{menu.notes}</Typography>}

        <Box component="section" aria-labelledby="menu-recipes" sx={{ mt: 3 }}>
          <Typography id="menu-recipes" variant="h5" component="h2" sx={sectionTitle}>
            Recipes
          </Typography>
          {menu.dishes.length === 0 ? (
            <Typography sx={{ color: color.muted }}>This menu&apos;s recipes have been deleted. Edit it to pick new ones.</Typography>
          ) : (
            <Box component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {menu.dishes.map((d, i) => {
                const minutes = totalMinutes(d);
                const facts = [d.servings ? `Serves ${d.servings}` : null, minutes ? formatMinutes(minutes) : null].filter(Boolean).join(" · ");
                return (
                  <Box component="li" key={d.id} sx={{ display: "flex", alignItems: "baseline", gap: 1.5, py: 1, borderTop: i ? `1px solid ${color.rule}` : "none" }}>
                    <Box component="span" aria-hidden sx={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 600, color: color.accent, minWidth: 18 }}>
                      {i + 1}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Box component={Link} href={recipeHref(d.id, { from: { kind: "menu", id: menu.id } })} sx={{ fontWeight: 700, fontSize: 16, textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: color.rule }}>
                        {d.title}
                      </Box>
                      {facts && (
                        <Typography variant="body2" sx={{ color: color.muted }}>
                          {facts}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Box component="section" aria-labelledby="menu-made" sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${color.rule}` }}>
          <Typography id="menu-made" variant="h5" component="h2" sx={sectionTitle}>
            Times we made it
          </Typography>
          {menu.meals.length === 0 ? (
            <Typography sx={{ color: color.muted }}>Not made yet. Tap We made it after you cook it, if you want to keep track.</Typography>
          ) : (
            <>
              <Typography variant="body2" sx={{ color: color.muted, mb: 0.5 }}>
                A recipe&apos;s stars here count toward its own rating; the whole meal&apos;s stars never do.
              </Typography>
              <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
                {menu.meals.map((m) => (
                  <MealTime key={m.id} meal={m} menu={menu} today={today} canRate={canRate} onRate={() => setOpen({ kind: "rate", meal: m })} onEdit={() => setOpen({ kind: "edit", meal: m })} />
                ))}
              </Box>
            </>
          )}
        </Box>
      </Box>
      {open?.kind === "menu" && <MenuDialog open onClose={close} menu={menu} recipeChoices={recipeChoices} />}
      {open?.kind === "made" && <MealDialog open onClose={close} menu={menu} recipeChoices={recipeChoices} cooks={cooks} defaultCook={defaultCook} today={today} />}
      {open?.kind === "edit" && <MealDialog open onClose={close} menu={menu} meal={open.meal} recipeChoices={recipeChoices} cooks={cooks} defaultCook={defaultCook} today={today} />}
      {open?.kind === "rate" && <RateMealDialog open onClose={close} meal={open.meal} cooks={cooks} defaultCook={defaultCook} />}
    </Container>
  );
}
