# Recipes

Status: plan agreed 2026-11-03; the look (Sage & Butter) chosen 2026-11-03; PR 1 (the section, recipes,
favorites) and PR 2 (the cook log and ratings) built 2026-11-03 (#88); PR 3 (cook mode, #89) and PR 4 (import)
built 2026-11-04; PR 5 (units), PR 6 (step links), PR 8 (recipes inside recipes) and PR 9 (meals) built 2026-11-04. The dev mockup is retired now that every screen of it is real; the looks lab `/recipes/looks`
stays as the reference for the table view.

Decided: a Recipes section of this site, shared by the household; anyone in the household edits any recipe, and
there are no private recipes or personal copies of one; ratings and favorites belong to each person; grocery lists wait until later; the
look is **Sage & Butter** (below); the section is called **Recipes** for now.

## The idea

A household cookbook that remembers how each recipe went. You save your own recipes or import them from a link,
cook them step by step with timers, and log each time you make one, with your own stars and notes. Recipes can
use other recipes and belong to meals.

## The look: Sage & Butter

Chosen from the looks lab (`/recipes/looks`): Cottage's calm with Buttercup's sunshine. Cute, never busy: one
quiet pattern, soft colors, friendly type that stays easy to read.

| Token | Value | Used for |
| --- | --- | --- |
| Page | `#f6f2e4` oat | The page behind everything |
| Surface | `#fffdf6` cream | Cards and panels |
| Ink | `#2f3a30` | Text |
| Muted | `#687266` | Secondary text |
| Accent | `#5c7c59` sage, white text on it | Buttons, the active tab, step numbers, gingham, the section's accent color |
| Second | `#a27a12` deep mustard | "Not tried yet", trends, notes that need a second color |
| Highlight | `#fcefc0` butter | Ingredients and steps lit by step links, table rows |
| Star | `#e0a821` butter gold | Star ratings |
| Rule | `#e3e3cf` | Borders and table lines |

- **Type:** Lora italic (600) for titles and headings; Nunito for everything else.
- **Pattern:** sage gingham for pictures until recipes have photos; a sage and butter plaid band across the top
  of the section and of cook mode.
- **Shape:** 12px corners, a 1px border and a soft shadow on cards.
- The tokens live in one place in the Recipes code, in the same shape as `app/tokens.ts`, so this look can later
  grow into per-section themes across the site.

## Words we use

| Word | Means |
| --- | --- |
| Recipe | Title, servings, times, tags, notes, its ingredients and steps. Shared by the household. |
| Ingredient | One line as written ("1 1/2 cups (190 g) flour"), with an optional group ("For the sauce") and an optional link to another recipe ("1 batch Fry sauce"). |
| Step | One instruction, with an optional short action word ("Fold in") and its **uses**. |
| Use | A step taking some of an ingredient: "2 eggs" of "4 eggs". Uses power highlighting, split ingredients and the table view. |
| Cook log entry | One person cooking a recipe once: date, stars (optional), notes, servings made. |
| Meal | One dinner or occasion ("Thanksgiving 2026") that groups several cook log entries, with its own notes. |
| Saved menu | A reusable set of recipes ("Burger night"), started again as a meal. |

## How it behaves

### Ratings and favorites
- Each person rates a recipe in their cook log entries.
- **Something went wrong:** a checkbox on a log entry keeps that rating out of the stars. It stays in the history
  with its notes.
- **Versions:** saving changes to ingredients or steps asks **Small fix** (ratings stay) or **Changed the recipe**
  (a new version). Only ratings on the current version count; older ones stay in the history. Until the new
  version is rated, the card says "New version, 4.0 before".
- **A person's rating** is a weighted average of their counted ratings on the current version, where a rating's
  weight halves every 6 months, so changing tastes show without one night swinging it.
- **The overall** on the card is the average of each person's rating, with how many people ("4.3 from 2"), so
  someone who cooks it 20 times still counts once.
- **Trend:** an up or down arrow when recent ratings clearly differ from earlier ones: with at least 4 counted
  ratings, the latest third (at least 2) averages 0.75 stars or more above or below the rest
  (`lib/recipe-ratings.ts`). The recipe page charts every
  rating over time, one color per person, with version changes marked.
- No log entries means **Not tried yet**; rated entries that were all marked "something went wrong" mean
  **Not rated yet**. The card also shows **Last cooked**.
- Favorites are per person: your star does not change anyone else's list.
- The version question appears only once a recipe has been cooked, and only when ingredients or steps changed.

### Search and filters
- Search covers titles, tags, ingredients and log notes.
- Filters: favorites, tags, not tried yet, 4 stars and up, mine (written here) or from a site,
  recently cooked.

### Scaling and units
- Changing servings scales every amount, including split uses and linked recipes.
- Each person picks **As written**, **US** or **Metric**.
- Conversions stay within a kind: volume to volume, weight to weight, °F to °C. Scaling picks a sensible unit
  ("4 tbsp" becomes "1/4 cup").
- Weights for baking: a small table of common ingredients (flour, sugars, butter, cocoa, salt, oats, rice)
  turns cups into grams, marked "about". When a line already gives both ("1 cup (200 g) sugar"),
  that wins. A pizza dough written in grams stays in grams, so US leaves grams of those staples alone.
- As built (`lib/recipe-units.ts`, PR 5): the choice is saved on the person (`profiles.recipe_units`), set from
  a switch above the ingredients and carried into cook mode. Spoons stay spoons in Metric below a quarter cup;
  a quarter cup or more of a staple is weighed. Scaling steps along tsp, tbsp, cup (an awkward amount reads
  "3/4 cup plus 1 tbsp"), oz and lb, g and kg, ml and l; sticks and quarts just scale. Oven temperatures in steps
  and lines convert (350°F reads 180°C). A package size after a count ("1 can (14 oz)") stays as written, and so
  do amounts inside a step's text until step links (PR 6) know which ingredient a step uses.

### Cook mode
- Starts with a **read-through**: every step on one screen and a prep checklist of the ingredients.
- One big step at a time, **Up next** always visible, the screen kept on, Back and Next.
- A timer button for each time a step mentions; timers keep running in a tray across steps, then beep, buzz
  and stay on screen until dismissed.
- When the next step starts with "meanwhile" or "while" and this step has a timer, it says so.
- With step links, the step shows only its uses ("2 eggs"), and the ingredients panel highlights them.
- **Done cooking** asks how it went (stars and notes), or "Later".

### Step links, splits and highlighting
- In side-by-side view, tapping a step highlights the ingredients it uses; tapping an ingredient highlights its
  steps.
- An ingredient used in several steps shows its parts: "4 eggs · 2 in step 2, 2 in step 6".
- Editing suggests links by matching ingredient words in each step; you confirm them and type split amounts.
  Imported recipes start with suggestions only.
- As built (`lib/recipe-links.ts`, PR 6): a Step links section in the form shows each step with its linked
  ingredients, dashed suggestions to tap, "Link all", and an amount for a part. A step names an ingredient by its
  last word ("flour"), or its last two when two ingredients share the last word ("brown sugar"). Pointing at a
  step or an ingredient (hover, focus or tap) lights up the other side; cook mode lists the step's uses
  ("1/3 cup butter") and lights them in the ingredients panel. Links never count as a change to the recipe.

### At a glance (the table view)
- Drawn from the step links, like cookingforengineers.com: ingredients down the left, each step a cell to the
  right spanning what it combines, labelled with its action word.
- Each step continues from earlier steps (guessed from order, editable). A split ingredient takes a row per use.
- A recipe without links shows the normal view instead.

### Recipes inside recipes
- In edit mode, an ingredient line can link to another recipe with a picker ("1 batch Fry sauce").
- The link opens that recipe; scaling the outer recipe scales the inner one; a meal can pull it in.
- Deleting a linked recipe leaves the line as text.
- As built (PR 8): each ingredient line has a book button that opens a picker of the household's other recipes,
  and a line that names one ("1 batch Fry sauce") offers "Link the Fry sauce recipe". Saving keeps a link only to
  another recipe of the same household. The recipe page and cook mode show "Open the Fry sauce recipe", opened at
  the size the outer recipe needs (`?scale=`): the line's batches ("2 batches", "1/2 recipe") times its scaling.

### Meals and saved menus
- Log a meal: name, date, notes, the recipes in it. It creates one cook log entry per recipe (each person still
  rates each recipe), and each person can rate the meal overall.
- Each recipe's history shows "Part of Thanksgiving 2026"; the meal page shows the whole dinner.
- A meal's stars answer "did it all go together?" and never change a recipe's own stars, so a bad pairing never
  pulls down a good recipe; the meal's notes say why.
- As built (PR 9): Meals (`/recipes/meals`) lists the household's meals; Log a meal takes a name, day, notes and
  its recipes, then the logger's meal stars, notes and optional stars for each recipe. Each person who rates a meal
  gets one cook log entry per recipe in it (unique per meal, person and recipe), so re-rating changes that entry.
  A meal entry keeps the meal's person and day; changing the meal's day moves its entries, removing a recipe
  removes that recipe's entries, and deleting the meal deletes its stars and entries, as deleting a recipe does.
  The cook log lists the newest version first, then newest first within it, so a back-dated cook stays with its
  version and each "Version N starts here" marker sits under that version's first cook.
- A saved menu is a meal you can start again. Starting it begins a **multi-recipe cook mode**: every recipe's
  steps in tabs, one shared timer tray, and one read-through for the whole meal.

### Import from a link
- Reads the page's standard recipe data (schema.org Recipe, JSON-LD), then shows it for review before saving.
- A new safe-fetch helper does the fetching: web addresses only, private and local network addresses refused
  (checked again on every redirect), short timeout, size cap. Failures go to `logEvent`.
- A page without recipe data offers pasting the text instead.
- The helper is `lib/safe-fetch.ts` (Node's https with a checked DNS lookup, so every connection's address is
  checked); the parser is `lib/recipe-import.ts`. A link already saved says so before saving a second copy.
- Reads, in order: the page's JSON-LD; schema.org microdata (older blogs, Jetpack cards); then the page's own text
  with the paste reader, flagged on the review screen as "read from the page's text". Headings come from the WP
  Recipe Maker or Tasty Recipes card when its line count matches the data.
- Pasted text may be a whole copied page: the reader finds the recipe card's name, description, times, servings,
  ingredient headings (all caps or ending in a colon), steps and notes, or an older post's heading-less block.
- The parser reads untrusted pages, so every pattern runs in linear time: tags never match past a `<`, captured
  text is bounded, and scripts and comments are skipped in one forward pass. `recipes:check` times hostile 3 MB
  pages. The fetch reads the body through one stream pipeline, so a cut-off or stalled response ends in an error.
- Sites behind a bot check (Ambitious Kitchen, Damn Delicious, Maangchi) answer 403; pasting is the way in, and we
  never try to get past the check.
- Tested 2026-11-04 on about 120 recipes from about 70 sites; `npm run recipes:check` (add `-- --live` for real
  links) keeps the cases that came up.

## Data

One row per recipe, with its ingredients and steps as jsonb, since the recipe owns them and is always edited
whole. Ingredient and step ids are stable from the first PR, so uses, links and the table never need a migration.

| Table | Columns |
| --- | --- |
| `recipes` | id, groupId, createdByProfileId, version, title, description, servings, prepMin, cookMin, notes, tags (jsonb), sourceKind (`mine` · `imported`), sourceUrl, sourceName, imageUrl, ingredients (jsonb), steps (jsonb), createdAt, updatedAt |
| `recipe_favorites` | profileId, recipeId (unique together) |
| `recipe_logs` | id, recipeId, recipeVersion, profileId, cookedOn, rating (1 to 5, optional), counted (false when something went wrong), notes, servings, mealId, createdAt |
| `meals` | id, groupId, name, cookedOn, notes, recipeIds (jsonb, ordered), createdByProfileId, createdAt; menuId arrives with menus |
| `meal_ratings` | mealId, profileId, rating (1 to 5, optional), notes |
| `menus` | id, groupId, name, recipeIds (jsonb, ordered), notes, createdAt |

jsonb shapes:

```ts
type Ingredient = { id: string; text: string; group?: string; recipeId?: number };
type Use = { ingredientId: string; amount?: string; note?: string };
type Step = { id: string; text: string; label?: string; after?: string[]; uses?: Use[] };
```

Each table ships as an idempotent `scripts/migrate-<name>.mjs`, run on dev, then on live before the PR that
reads it merges.

## Build order

- [x] **Phase 0: look and feel.** Nineteen directions tried in `/recipes/looks`; Sage & Butter chosen.
- **Phase 1: the cookbook**
  - [x] PR 1: the section and `recipes`: list, recipe page, new and edit, tags, search, scaling, per-person
    favorites. Favorites belong to the person picked in the header's Viewing menu, as in Games and Garage.
  - [x] PR 2: cook log: per-person stars and notes, "something went wrong", versions, weighted stars, overall and
    trend on cards, not tried yet, last cooked, filters, the ratings chart.
  - [x] PR 3: cook mode: read-through, Up next, timers, "meanwhile" notes, keep the screen on (one shared hook,
    which the workout runner moves onto), Done cooking asks for a log.
  - [x] PR 4: import from a link: safe fetch, recipe data parsing, review, paste fallback.
- **Phase 2: smarter recipes**
  - [x] PR 5: units: As written, US or Metric per person; sensible units when scaling; baking weights.
  - [x] PR 6: step links: uses, splits, highlighting, suggested links in edit mode.
  - PR 7 (My version) dropped 2026-11-04: no personal copies of recipes.
  - [x] PR 8: recipes inside recipes: the edit-mode picker, scaling through.
  - [x] PR 9: meals: log a meal, meal page, meal ratings.
- **Phase 3: the fancy parts**
  - [ ] PR 10: At a glance table view.
  - [ ] PR 11: saved menus.
  - [ ] PR 12: multi-recipe cook mode.
  - [ ] PR 13: photos (Vercel Blob uploads; the `attachments` table exists) on recipes and log entries.
- **Later:** grocery list from a recipe, meal or menu.

## Open questions

None right now. The 6 month fade for old ratings is a starting point we can tune once there is real history.
