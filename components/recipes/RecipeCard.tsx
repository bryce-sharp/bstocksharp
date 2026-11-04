import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Link from "@/components/shared/AppLink";
import type { RecipeSummary } from "@/lib/queries/recipes";
import { formatMinutes, shortDay, totalMinutes } from "@/lib/recipes";
import FavoriteButton from "./FavoriteButton";
import RatingLine from "./RatingLine";
import TagChip from "./TagChip";
import { color, gingham, radius, shadow } from "./tokens";

export const panelSx = {
  bgcolor: color.surface,
  border: `1px solid ${color.panelRule}`,
  borderRadius: `${radius.base}px`,
  boxShadow: shadow.panel,
} as const;

/** A recipe in the list: the whole card opens it, and the heart stays its own button. */
export default function RecipeCard({
  recipe,
  person,
  canFavorite,
  today,
}: {
  recipe: RecipeSummary;
  person: string | null;
  canFavorite: boolean;
  today: string;
}) {
  const total = totalMinutes(recipe);
  const last = recipe.ratings.lastCooked;
  const meta = [
    total !== null ? formatMinutes(total) : null,
    recipe.servings ? `${recipe.servings} servings` : null,
    last ? `cooked ${shortDay(last, today)}` : null,
  ].filter(Boolean);

  return (
    <Box sx={{ ...panelSx, position: "relative", p: 1.5, display: "flex", flexDirection: "column", "&:hover": { borderColor: color.accent }, "&:focus-within": { borderColor: color.accent } }}>
      <Box aria-hidden sx={{ height: 110, borderRadius: `${radius.base - 6}px`, background: gingham(), mb: 1.25 }} />
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
        <Typography
          component={Link}
          href={`/recipes/${recipe.id}`}
          variant="h6"
          sx={{
            flex: 1,
            fontSize: 21,
            lineHeight: 1.15,
            // The title's link covers the card, so anywhere but the heart opens the recipe.
            "&::after": { content: '""', position: "absolute", inset: 0, borderRadius: `${radius.base}px` },
            "&:focus-visible": { outline: "none" },
          }}
        >
          {recipe.title}
        </Typography>
        <Box sx={{ position: "relative", zIndex: 1, mt: -0.75, mr: -0.75 }}>
          <FavoriteButton recipeId={recipe.id} favorite={recipe.favorite} person={person} canFavorite={canFavorite} size="small" />
        </Box>
      </Box>
      <Box sx={{ mt: 0.75 }}>
        <RatingLine ratings={recipe.ratings} />
      </Box>
      {meta.length > 0 && (
        <Typography variant="body2" sx={{ mt: 0.5, color: color.muted, fontSize: 13 }}>
          {meta.join(" · ")}
        </Typography>
      )}
      {recipe.tags.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.625, mt: 1 }}>
          {recipe.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </Box>
      )}
    </Box>
  );
}
