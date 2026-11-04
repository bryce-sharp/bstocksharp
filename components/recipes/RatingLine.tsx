import Box from "@mui/material/Box";
import type { RatingSummary } from "@/lib/recipe-ratings";
import Stars from "./Stars";
import { color } from "./tokens";

const note = { fontSize: 14, fontWeight: 600, color: color.second } as const;

/** The recipe's overall stars with how many people they come from and its trend, or why there are none yet. */
export default function RatingLine({ ratings, size = 16 }: { ratings: RatingSummary; size?: number }) {
  if (ratings.state === "untried") return <Box component="span" sx={note}>Not tried yet</Box>;
  if (ratings.state === "unrated") return <Box component="span" sx={note}>Not rated yet</Box>;
  if (ratings.state === "newVersion") {
    return (
      <Box component="span" sx={note}>
        New version{ratings.before !== null ? `, ${ratings.before.toFixed(1)} before` : ""}
      </Box>
    );
  }
  const overall = ratings.overall ?? 0;
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "baseline", gap: 0.75, fontSize: 14 }}>
      <Stars value={overall} size={size} />
      <Box component="span" sx={{ fontWeight: 700 }}>{overall.toFixed(1)}</Box>
      <Box component="span" sx={{ color: color.muted }}>from {ratings.people.length}</Box>
      {ratings.trend && (
        <Box component="span" role="img" aria-label={ratings.trend === "up" ? "Rated higher lately" : "Rated lower lately"} sx={{ fontWeight: 700, color: ratings.trend === "up" ? color.second : color.accent }}>
          {ratings.trend === "up" ? "↑" : "↓"}
        </Box>
      )}
    </Box>
  );
}
