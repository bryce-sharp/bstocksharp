"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import InputAdornment from "@mui/material/InputAdornment";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import FavoriteIcon from "@mui/icons-material/Favorite";
import SearchIcon from "@mui/icons-material/Search";
import Link from "@/components/shared/AppLink";
import type { RecipeSummary } from "@/lib/queries/recipes";
import { matchesSearch } from "@/lib/recipes";
import RecipeCard, { panelSx } from "./RecipeCard";
import { rememberList } from "./BackLink";
import TagChip from "./TagChip";
import { color } from "./tokens";

type Sort = "az" | "cooked" | "rated" | "new";
type Filters = { q: string; tag: string | null; fav: boolean; untried: boolean; top: boolean; site: boolean; sort: Sort };

const SORTS: { value: Sort; label: string }[] = [
  { value: "az", label: "A to Z" },
  { value: "cooked", label: "Recently cooked" },
  { value: "rated", label: "Top rated" },
  { value: "new", label: "Newest" },
];
const isSort = (v: string | null): v is Sort => SORTS.some((s) => s.value === v);

/** A recipe's stars for sorting and the "4 stars and up" filter; unrated recipes have none. */
const starsOf = (r: RecipeSummary) => r.ratings.overall ?? -1;

const SORTERS: Record<Sort, (a: RecipeSummary, b: RecipeSummary) => number> = {
  az: () => 0,
  cooked: (a, b) => (b.ratings.lastCooked ?? "").localeCompare(a.ratings.lastCooked ?? ""),
  rated: (a, b) => starsOf(b) - starsOf(a),
  new: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
};

/** Keeps the search in the address, so Back from a recipe returns to the same list. */
function writeUrl(f: Filters) {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.tag) params.set("tag", f.tag);
  if (f.fav) params.set("fav", "1");
  if (f.untried) params.set("untried", "1");
  if (f.top) params.set("top", "1");
  if (f.site) params.set("site", "1");
  if (f.sort !== "az") params.set("sort", f.sort);
  const query = params.toString();
  window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  rememberList(query ? `?${query}` : "");
}

/** Tags by how many recipes use them, then A to Z. */
function tagsByUse(recipes: RecipeSummary[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export default function RecipeList({
  recipes,
  person,
  canFavorite,
  today,
}: {
  recipes: RecipeSummary[];
  person: string | null;
  canFavorite: boolean;
  today: string;
}) {
  const params = useSearchParams();
  const [filters, setFilters] = React.useState<Filters>(() => {
    const sort = params.get("sort");
    return {
      q: params.get("q") ?? "",
      tag: params.get("tag"),
      fav: params.get("fav") === "1",
      untried: params.get("untried") === "1",
      top: params.get("top") === "1",
      site: params.get("site") === "1",
      sort: isSort(sort) ? sort : "az",
    };
  });
  const update = (next: Partial<Filters>) => {
    const f = { ...filters, ...next };
    setFilters(f);
    writeUrl(f);
  };

  React.useEffect(() => rememberList(window.location.search), []);
  const tags = React.useMemo(() => tagsByUse(recipes), [recipes]);
  const shown = recipes
    .filter(
      (r) =>
        (!filters.fav || r.favorite) &&
        (!filters.untried || r.ratings.state === "untried") &&
        (!filters.top || starsOf(r) >= 4) &&
        (!filters.site || r.sourceKind === "imported") &&
        (!filters.tag || r.tags.includes(filters.tag)) &&
        matchesSearch(r, filters.q),
    )
    .sort(SORTERS[filters.sort]);
  const filtering = filters.q !== "" || filters.tag !== null || filters.fav || filters.untried || filters.top || filters.site;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 2, mb: 2.5 }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="h3" component="h1">
            Recipes
          </Typography>
          <Typography sx={{ color: color.muted }}>
            {recipes.length === 1 ? "1 recipe" : `${recipes.length} recipes`} in the household cookbook
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Button component={Link} href="/recipes/import" variant="outlined" startIcon={<LinkIcon />}>
            Import from a link
          </Button>
          <Button component={Link} href="/recipes/new" variant="contained" startIcon={<AddIcon />}>
            New recipe
          </Button>
        </Box>
      </Box>

      {recipes.length > 0 && (
        <>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              fullWidth
              placeholder="Search titles, tags, ingredients and notes"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: color.muted }} /></InputAdornment> },
                htmlInput: { "aria-label": "Search recipes", type: "search" },
              }}
              sx={{ "& .MuiOutlinedInput-root": { bgcolor: color.surface, borderRadius: 999 } }}
            />
            <TextField
              select
              value={filters.sort}
              onChange={(e) => update({ sort: e.target.value as Sort })}
              slotProps={{ htmlInput: { "aria-label": "Sort recipes" }, select: { MenuProps: { disablePortal: true } } }}
              sx={{ flex: "none", width: { xs: 150, sm: 190 }, "& .MuiOutlinedInput-root": { bgcolor: color.surface, borderRadius: 999 } }}
            >
              {SORTS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5, mb: 3 }}>
            <TagChip
              icon={<FavoriteIcon />}
              label={person ? `${person}'s favorites` : "Favorites"}
              selected={filters.fav}
              aria-pressed={filters.fav}
              onClick={() => update({ fav: !filters.fav })}
            />
            <TagChip label="Not tried yet" selected={filters.untried} aria-pressed={filters.untried} onClick={() => update({ untried: !filters.untried })} />
            <TagChip label="4 stars and up" selected={filters.top} aria-pressed={filters.top} onClick={() => update({ top: !filters.top })} />
            {recipes.some((r) => r.sourceKind === "imported") && (
              <TagChip label="From a site" selected={filters.site} aria-pressed={filters.site} onClick={() => update({ site: !filters.site })} />
            )}
            {tags.map((t) => (
              <TagChip key={t} label={t} selected={filters.tag === t} aria-pressed={filters.tag === t} onClick={() => update({ tag: filters.tag === t ? null : t })} />
            ))}
          </Box>
        </>
      )}

      {recipes.length === 0 ? (
        <Box sx={{ ...panelSx, p: { xs: 3, md: 5 }, textAlign: "center" }}>
          <Typography variant="h5" component="h2">
            No recipes yet
          </Typography>
          <Typography sx={{ color: color.muted, mt: 1, mb: 2.5 }}>Add the first one: a family favorite, or tonight&apos;s dinner.</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1 }}>
            <Button component={Link} href="/recipes/import" variant="outlined" startIcon={<LinkIcon />}>
              Import from a link
            </Button>
            <Button component={Link} href="/recipes/new" variant="contained" startIcon={<AddIcon />}>
              Add a recipe
            </Button>
          </Box>
        </Box>
      ) : shown.length === 0 ? (
        <Box sx={{ ...panelSx, p: 3, textAlign: "center" }}>
          <Typography sx={{ color: color.muted }}>Nothing matches.</Typography>
          {filtering && (
            <Button onClick={() => update({ q: "", tag: null, fav: false, untried: false, top: false, site: false })} sx={{ mt: 1 }}>
              Clear the search
            </Button>
          )}
        </Box>
      ) : (
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
          {shown.map((r) => (
            <RecipeCard key={r.id} recipe={r} person={person} canFavorite={canFavorite} today={today} />
          ))}
        </Box>
      )}
    </Container>
  );
}
