"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import Link from "@/components/shared/AppLink";
import type { MealDetail, RecipeChoice } from "@/lib/queries/recipes";
import { shortDay } from "@/lib/recipes";
import BackLink from "./BackLink";
import type { Cook } from "./CookLogDialog";
import MealDialog, { RateMealDialog } from "./MealDialog";
import { panelSx } from "./RecipeCard";
import Stars from "./Stars";
import { color } from "./tokens";

const sectionTitle = { fontSize: 22, mb: 1 } as const;

function Dot({ fill }: { fill: string | null }) {
  return <Box aria-hidden sx={{ flex: "none", width: 10, height: 10, borderRadius: "50%", bgcolor: fill ?? color.muted }} />;
}

/** The whole dinner: each person's stars for the meal, then each recipe with the stars it got that night. */
export default function MealView({ meal, recipeChoices, cooks, defaultCook, today }: { meal: MealDetail; recipeChoices: RecipeChoice[]; cooks: Cook[]; defaultCook: number | null; today: string }) {
  const [open, setOpen] = React.useState<"edit" | "rate" | null>(null);
  const canRate = cooks.some((c) => c.canLog);
  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <BackLink href="/recipes/meals" label="All meals" />
      <Box sx={{ ...panelSx, p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 1.5 }}>
          <Box sx={{ flex: "1 1 240px", minWidth: 0 }}>
            <Typography variant="h3" component="h1" sx={{ fontSize: "clamp(28px, 4vw, 40px)", lineHeight: 1.1 }}>
              {meal.name}
            </Typography>
            <Typography sx={{ color: color.muted, mt: 0.5 }}>
              {shortDay(meal.cookedOn, today)} · {meal.dishes.length === 1 ? "1 recipe" : `${meal.dishes.length} recipes`}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setOpen("edit")}>
              Edit
            </Button>
            <Button variant="contained" startIcon={<StarBorderIcon />} onClick={() => setOpen("rate")} disabled={!canRate || meal.dishes.length === 0}>
              Rate it
            </Button>
          </Box>
        </Box>
        {meal.notes && <Typography sx={{ whiteSpace: "pre-line", mt: 1.5 }}>{meal.notes}</Typography>}

        <Box component="section" aria-labelledby="meal-stars" sx={{ mt: 3 }}>
          <Typography id="meal-stars" variant="h5" component="h2" sx={sectionTitle}>
            The whole meal
          </Typography>
          {meal.ratings.length === 0 ? (
            <Typography sx={{ color: color.muted }}>No one has rated the meal yet.</Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {meal.ratings.map((r, i) => (
                <Box component="li" key={r.profileId} sx={{ display: "flex", gap: 1.5, py: 1, borderTop: i ? `1px solid ${color.rule}` : "none" }}>
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
        </Box>

        <Box component="section" aria-labelledby="meal-recipes" sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${color.rule}` }}>
          <Typography id="meal-recipes" variant="h5" component="h2" sx={sectionTitle}>
            Recipes
          </Typography>
          <Typography variant="body2" sx={{ color: color.muted, mb: 1 }}>
            These stars count toward each recipe&apos;s own rating; the meal&apos;s stars never do.
          </Typography>
          {meal.dishes.length === 0 ? (
            <Typography sx={{ color: color.muted }}>This meal&apos;s recipes have been deleted.</Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {meal.dishes.map((d, i) => {
                const logs = meal.logs.filter((l) => l.recipeId === d.id);
                return (
                  <Box component="li" key={d.id} sx={{ py: 1.25, borderTop: i ? `1px solid ${color.rule}` : "none" }}>
                    <Box component={Link} href={`/recipes/${d.id}`} sx={{ fontWeight: 700, fontSize: 16, textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: color.rule }}>
                      {d.title}
                    </Box>
                    {logs.length > 0 && (
                      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, mt: 0.5, display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
                        {logs.map((l) => (
                          <Box component="li" key={l.id} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                            <Dot fill={l.color} />
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {l.person}
                            </Typography>
                            {l.rating !== null ? (
                              <Box sx={{ opacity: l.counted ? 1 : 0.45 }}>
                                <Stars value={l.rating} size={13} />
                              </Box>
                            ) : (
                              <Typography variant="body2" sx={{ color: color.muted }}>
                                no stars
                              </Typography>
                            )}
                            {!l.counted && (
                              <Typography variant="body2" sx={{ fontWeight: 600, color: color.second }}>
                                Something went wrong
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
      {open === "edit" && <MealDialog open onClose={() => setOpen(null)} meal={meal} recipeChoices={recipeChoices} cooks={cooks} defaultCook={defaultCook} today={today} />}
      {open === "rate" && <RateMealDialog open onClose={() => setOpen(null)} meal={meal} cooks={cooks} defaultCook={defaultCook} />}
    </Container>
  );
}
