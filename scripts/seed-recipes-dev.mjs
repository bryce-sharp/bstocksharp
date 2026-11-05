// Dev only: fills a household's Recipes with real-looking recipes, step links, recipes inside recipes, menus and
// months of cook logs from two people, for trying every Recipes screen. Refuses the live database.
//
//   node scripts/seed-recipes-dev.mjs            (the household with Bryce and Lauren)
//
// Idempotent: a recipe or menu whose name the household already has is left alone, and a time made is added once per day.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set; check .env.local");
  process.exit(1);
}
// Neon's endpoint id, the same for its pooled ("-pooler") and direct addresses.
const endpoint = (address) => new URL(address).hostname.split(".")[0].replace(/-pooler$/, "");
const ours = [process.env.POSTGRES_URL, process.env.POSTGRES_URL_NON_POOLING].filter(Boolean).map(endpoint);
const live = [process.env.LIVE_POSTGRES_URL, process.env.LIVE_POSTGRES_URL_NON_POOLING].filter(Boolean).map(endpoint);
if (!live.length || ours.some((e) => live.includes(e))) {
  console.error("Refusing: this seeds dev only, and the live database address is missing or matches this one.");
  process.exit(1);
}
const sql = neon(url);

// Ingredients are [key, line] or [key, line, linked recipe title]; uses are "key" or ["key", "amount"].
const RECIPES = [
  {
    title: "Fry sauce",
    description: "The pink sauce for burgers and fries.",
    prepMin: 5,
    tags: ["Sauce", "Burgers"],
    ingredients: [["mayo", "1/2 cup mayonnaise"], ["ketchup", "1/4 cup ketchup"], ["pickle", "1 tbsp pickle juice"], ["garlic", "1/2 tsp garlic powder"], ["paprika", "1/4 tsp smoked paprika"]],
    steps: [
      ["Whisk the mayonnaise, ketchup, pickle juice, garlic powder and paprika in a small bowl.", ["mayo", "ketchup", "pickle", "garlic", "paprika"]],
      ["Chill at least 30 minutes so the flavors come together."],
    ],
  },
  {
    title: "Smash burgers",
    description: "Crispy edged patties, two to a bun.",
    servings: 4,
    prepMin: 10,
    cookMin: 15,
    tags: ["Dinner", "Burgers"],
    ingredients: [
      ["beef", "1 1/2 lb ground beef (80/20)"], ["salt", "1 tsp kosher salt"], ["pepper", "1/2 tsp black pepper"], ["onion", "1 small yellow onion"],
      ["cheese", "8 slices American cheese"], ["butter", "2 tbsp butter"], ["buns", "4 potato buns"], ["pickles", "Dill pickle chips"], ["sauce", "1 batch Fry sauce", "Fry sauce"],
    ],
    steps: [
      ["Heat a cast iron skillet over high heat for 5 minutes."],
      ["Slice the onion paper thin.", ["onion"]],
      ["Divide the beef into 8 loose balls.", ["beef"]],
      ["Meanwhile, toast the buns cut side down in the butter until golden.", ["buns", "butter"]],
      ["Smash each ball flat with some onion on top, season with the salt and pepper, and cook 2 minutes.", ["salt", "pepper"]],
      ["Flip, add a slice of cheese to each patty and cook 1 minute more.", ["cheese"]],
      ["Stack two patties on each bun with pickles and a spoonful of fry sauce.", ["pickles", "sauce"]],
    ],
  },
  {
    title: "Cinnamon swirl banana bread",
    description: "Brown sugar and cinnamon ribboned through the middle.",
    servings: 10,
    prepMin: 15,
    cookMin: 60,
    tags: ["Baking", "Breakfast"],
    ingredients: [
      ["banana", "3 ripe bananas"], ["butter", "1/2 cup (115 g) butter"], ["vanilla", "1 tsp vanilla"], ["eggs", "2 eggs"], ["sugar", "3/4 cup (150 g) brown sugar"],
      ["flour", "1 3/4 cups (220 g) flour"], ["soda", "1 tsp baking soda"], ["salt", "1/2 tsp salt"], ["cinnamon", "1 1/2 tsp cinnamon"],
    ],
    steps: [
      ["Heat the oven to 350°F (175°C)."],
      ["Grease a 9 by 5 inch loaf pan."],
      ["Mash the bananas in a large bowl.", ["banana"]],
      ["Melt the butter and let it cool 5 minutes.", ["butter"]],
      ["Meanwhile, mix 1/4 cup of the brown sugar with the cinnamon.", [["sugar", "1/4 cup"], "cinnamon"]],
      ["Whisk the butter, vanilla, eggs and the rest of the brown sugar into the bananas.", ["vanilla", "eggs", ["sugar", "1/2 cup"]]],
      ["In another bowl, whisk the flour, baking soda and salt.", ["flour", "soda", "salt"]],
      ["Fold the dry mix into the wet until just combined."],
      ["Pour in half the batter, sprinkle the cinnamon sugar over it, then add the rest."],
      ["Bake 55 to 60 minutes, until a toothpick comes out clean."],
      ["Cool in the pan 10 minutes, then on a rack."],
    ],
  },
  {
    title: "Brown butter chocolate chip cookies",
    description: "Toffee-ish from the brown butter, salty on top.",
    servings: 24,
    prepMin: 20,
    cookMin: 12,
    tags: ["Baking", "Dessert"],
    ingredients: [
      ["butter", "1 cup (226 g) unsalted butter"], ["brown", "1 cup (200 g) packed brown sugar"], ["white", "1/2 cup (100 g) granulated sugar"], ["eggs", "2 large eggs"],
      ["vanilla", "2 tsp vanilla extract"], ["flour", "2 1/4 cups (280 g) all-purpose flour"], ["soda", "1 tsp baking soda"], ["salt", "1 tsp salt"],
      ["chips", "2 cups chocolate chips"], ["flaky", "Flaky salt, for the tops"],
    ],
    steps: [
      ["Heat the oven to 375°F (190°C) and line two baking sheets."],
      ["Brown the butter in a saucepan over medium heat, then let it cool 10 minutes.", ["butter"]],
      ["In a medium bowl, whisk the flour, baking soda and salt.", ["flour", "soda", "salt"]],
      ["Whisk the brown sugar and granulated sugar into the butter.", ["brown", "white"]],
      ["Beat in the eggs and vanilla until glossy.", ["eggs", "vanilla"]],
      ["Fold in the flour mixture, then the chocolate chips.", ["chips"]],
      ["Chill the dough 30 minutes."],
      ["Scoop 2 tablespoon balls onto the baking sheets, top with flaky salt, and bake 10 to 12 minutes.", ["flaky"]],
    ],
  },
  {
    title: "Pico de gallo",
    description: "Fresh salsa for tacos, eggs and chips.",
    prepMin: 15,
    tags: ["Sauce", "Mexican"],
    ingredients: [["tomatoes", "4 Roma tomatoes"], ["onion", "1/2 white onion"], ["jalapeno", "1 jalapeño"], ["cilantro", "1/2 cup chopped cilantro"], ["lime", "1 lime"], ["salt", "1/2 tsp salt"]],
    steps: [
      ["Dice the tomatoes and onion, and seed and mince the jalapeño.", ["tomatoes", "onion", "jalapeno"]],
      ["Stir in the cilantro, the juice of the lime and the salt.", ["cilantro", "lime", "salt"]],
      ["Rest 15 minutes before serving."],
    ],
  },
  {
    title: "Chicken tacos",
    description: "Weeknight thighs with lime and chili.",
    servings: 4,
    prepMin: 15,
    cookMin: 15,
    tags: ["Dinner", "Mexican"],
    ingredients: [
      ["chicken", "1 1/2 lb boneless skinless chicken thighs"], ["chili", "1 tbsp chili powder"], ["cumin", "1 tsp ground cumin"], ["salt", "1 tsp salt"], ["lime", "2 limes"],
      ["oil", "1 tbsp olive oil"], ["tortillas", "12 corn tortillas"], ["pico", "1 batch Pico de gallo", "Pico de gallo"], ["avocado", "2 avocados"], ["cotija", "1/2 cup crumbled cotija"],
    ],
    steps: [
      ["Toss the chicken with the chili powder, cumin, salt and the juice of 1 lime.", ["chicken", "chili", "cumin", "salt", ["lime", "1"]]],
      ["Heat the oil in a large skillet over medium high heat.", ["oil"]],
      ["Cook the chicken thighs 5 to 6 minutes a side, then rest 5 minutes and slice."],
      ["Meanwhile, warm the tortillas in a dry pan.", ["tortillas"]],
      ["Mash the avocados with the juice of the other lime.", ["avocado", ["lime", "1"]]],
      ["Fill the tortillas with the chicken, pico de gallo, avocado and cotija.", ["pico", "cotija"]],
    ],
  },
  {
    title: "Herb roast turkey breast",
    description: "Garlic herb butter under the skin.",
    servings: 6,
    prepMin: 15,
    cookMin: 90,
    tags: ["Dinner", "Thanksgiving"],
    ingredients: [
      ["turkey", "1 bone-in turkey breast (about 6 lb)"], ["butter", "6 tbsp butter, softened"], ["garlic", "4 cloves garlic, minced"], ["sage", "1 tbsp chopped sage"],
      ["thyme", "1 tbsp thyme leaves"], ["salt", "2 tsp kosher salt"], ["pepper", "1 tsp black pepper"], ["broth", "1 cup chicken broth"],
    ],
    steps: [
      ["Heat the oven to 425°F (220°C)."],
      ["Mash the butter with the garlic, sage, thyme, salt and pepper.", ["butter", "garlic", "sage", "thyme", "salt", "pepper"]],
      ["Rub the butter under and over the skin of the turkey.", ["turkey"]],
      ["Roast 20 minutes, then pour the broth into the pan, lower the oven to 350°F and roast about 70 minutes more.", ["broth"]],
      ["Rest 20 minutes before carving."],
    ],
  },
  {
    title: "Garlic mashed potatoes",
    description: "Yukon Golds with garlic cooked right in.",
    servings: 6,
    prepMin: 15,
    cookMin: 25,
    tags: ["Side", "Thanksgiving"],
    ingredients: [["potatoes", "3 lb Yukon Gold potatoes"], ["salt", "2 tsp salt"], ["garlic", "6 cloves garlic"], ["butter", "1/2 cup butter"], ["cream", "1 cup heavy cream"], ["chives", "2 tbsp chopped chives"]],
    steps: [
      ["Boil the peeled, quartered potatoes with the garlic and 1 tsp of the salt until tender, about 20 minutes.", ["potatoes", "garlic", ["salt", "1 tsp"]]],
      ["Meanwhile, warm the butter and cream in a small pot.", ["butter", "cream"]],
      ["Drain, then mash the potatoes and garlic with the warm cream mixture and the rest of the salt.", [["salt", "1 tsp"]]],
      ["Top with the chives.", ["chives"]],
    ],
  },
  {
    title: "Cranberry orange sauce",
    description: "Ten minutes, and better than the can.",
    prepMin: 5,
    cookMin: 10,
    tags: ["Sauce", "Thanksgiving"],
    ingredients: [["cranberries", "12 oz fresh cranberries"], ["sugar", "3/4 cup sugar"], ["orange", "1 orange"], ["cinnamon", "1 cinnamon stick"]],
    steps: [
      ["Zest the orange, then squeeze its juice into a saucepan.", ["orange"]],
      ["Add the cranberries, sugar and cinnamon stick and simmer 10 minutes, until the berries burst.", ["cranberries", "sugar", "cinnamon"]],
      ["Stir in the orange zest and cool completely."],
    ],
  },
  {
    title: "All butter pie crust",
    description: "One crust; double it for a covered pie.",
    prepMin: 15,
    tags: ["Baking"],
    ingredients: [["flour", "1 1/4 cups (160 g) all-purpose flour"], ["salt", "1/2 tsp salt"], ["sugar", "1 tsp sugar"], ["butter", "1/2 cup (113 g) cold butter, cubed"], ["water", "4 tbsp ice water"]],
    steps: [
      ["Whisk the flour, salt and sugar.", ["flour", "salt", "sugar"]],
      ["Cut in the butter until it looks like coarse crumbs.", ["butter"]],
      ["Stir in the ice water a tablespoon at a time until the dough holds together.", ["water"]],
      ["Shape into a disk, wrap, and chill 1 hour."],
    ],
  },
  {
    title: "Pumpkin pie",
    description: "Classic spice, set and silky.",
    servings: 8,
    prepMin: 20,
    cookMin: 60,
    tags: ["Baking", "Dessert", "Thanksgiving"],
    ingredients: [
      ["crust", "1 All butter pie crust", "All butter pie crust"], ["pumpkin", "15 oz pumpkin purée"], ["milk", "12 oz evaporated milk"], ["eggs", "2 large eggs"],
      ["brown", "3/4 cup brown sugar"], ["cinnamon", "1 tsp cinnamon"], ["ginger", "1/2 tsp ground ginger"], ["nutmeg", "1/4 tsp nutmeg"], ["salt", "1/2 tsp salt"], ["cream", "Whipped cream, to serve"],
    ],
    steps: [
      ["Heat the oven to 425°F (220°C)."],
      ["Roll out the pie crust and fit it into a 9 inch pie plate.", ["crust"]],
      ["In a large bowl, whisk the pumpkin, evaporated milk, eggs, brown sugar, spices and salt.", ["pumpkin", "milk", "eggs", "brown", "cinnamon", "ginger", "nutmeg", "salt"]],
      ["Pour the filling into the crust and bake 15 minutes, then lower the oven to 350°F and bake 40 to 50 minutes more."],
      ["Cool at least 2 hours and serve with whipped cream.", ["cream"]],
    ],
  },
  {
    title: "Buttermilk pancakes",
    description: "Tall and fluffy; the batter can wait 10 minutes.",
    servings: 4,
    prepMin: 10,
    cookMin: 20,
    tags: ["Breakfast"],
    ingredients: [
      ["flour", "2 cups (250 g) all-purpose flour"], ["sugar", "2 tbsp sugar"], ["powder", "2 tsp baking powder"], ["soda", "1/2 tsp baking soda"], ["salt", "1/2 tsp salt"],
      ["buttermilk", "2 cups buttermilk"], ["eggs", "2 large eggs"], ["melted", "3 tbsp melted butter"], ["pan", "Butter for the pan"],
    ],
    steps: [
      ["In a large bowl, whisk the flour, sugar, baking powder, baking soda and salt.", ["flour", "sugar", "powder", "soda", "salt"]],
      ["In another bowl, whisk the buttermilk, eggs and melted butter.", ["buttermilk", "eggs", "melted"]],
      ["Pour the wet into the dry and stir until just combined; a few lumps are fine."],
      ["Heat a griddle over medium heat and grease it.", ["pan"]],
      ["Pour 1/4 cup of batter per pancake and cook until bubbles form, then flip and cook 1 to 2 minutes more."],
    ],
  },
];

// Cook logs: [title, who, day, stars, notes?, wentWrong?].
const LOGS = [
  ["Cinnamon swirl banana bread", "Lauren", "2026-03-14", 4, "Too dry; pulled it at 55 minutes next time"],
  ["Cinnamon swirl banana bread", "Bryce", "2026-05-02", 4],
  ["Cinnamon swirl banana bread", "Lauren", "2026-07-20", 2, "Forgot the baking soda", true],
  ["Cinnamon swirl banana bread", "Lauren", "2026-09-10", 5, "Extra ripe bananas, perfect"],
  ["Cinnamon swirl banana bread", "Bryce", "2026-10-25", 5],
  ["Brown butter chocolate chip cookies", "Bryce", "2026-06-12", 4, "Chilled overnight; thicker"],
  ["Brown butter chocolate chip cookies", "Lauren", "2026-08-30", 5],
  ["Brown butter chocolate chip cookies", "Bryce", "2026-10-11", 5, "Doubled the flaky salt"],
  ["Buttermilk pancakes", "Lauren", "2026-09-21", 4],
  ["Buttermilk pancakes", "Bryce", "2026-10-19", 3, "Griddle too hot at first"],
  ["Smash burgers", "Bryce", "2026-08-03", 4],
  ["Chicken tacos", "Lauren", "2026-09-02", 4],
];

// Meals: name, day, notes, recipes, then each person's [meal stars, notes, stars per recipe in order].
// Menus with the times they were made; ratings are { person: [meal stars, notes, stars for each recipe] }.
const MENUS = [
  {
    name: "Burger night",
    notes: "Make the fry sauce first so it can sit",
    recipes: ["Smash burgers", "Fry sauce"],
    made: [
      { cookedOn: "2026-10-18", notes: "Watched the game", ratings: { Bryce: [5, "The fry sauce made it", [5, 5]], Lauren: [4, null, [4, 5]] } },
      { cookedOn: "2026-11-02", notes: null, ratings: { Bryce: [4, "Buns were a little stale", [4, 5]] } },
    ],
  },
  {
    name: "Taco Tuesday",
    notes: null,
    recipes: ["Chicken tacos", "Pico de gallo"],
    made: [{ cookedOn: "2026-10-27", notes: null, ratings: { Bryce: [4, null, [4, 4]], Lauren: [5, "Pico was the star", [4, 5]] } }],
  },
  {
    name: "Friendsgiving 2026",
    notes: "Turkey goes in first; the pie can be made the day before",
    recipes: ["Herb roast turkey breast", "Garlic mashed potatoes", "Cranberry orange sauce", "Pumpkin pie"],
    made: [
      {
        cookedOn: "2026-11-01",
        notes: "Eight of us; Jamie brought rolls",
        ratings: { Bryce: [3, "Everything rich at once; next time a green salad", [5, 5, 3, 4]], Lauren: [4, "Pie first, honestly", [4, 5, 4, 5]] },
      },
    ],
  },
  { name: "Bake sale", notes: "Both freeze well, so bake ahead", recipes: ["Brown butter chocolate chip cookies", "Cinnamon swirl banana bread"], made: [] },
];

async function main() {
  console.log(`database host: ${new URL(url).hostname}`);
  const people = await sql`SELECT id, name, group_id FROM profiles WHERE name IN ('Bryce', 'Lauren') AND archived_at IS NULL`;
  const groupId = people.find((p) => p.name === "Bryce")?.group_id;
  const who = new Map(people.filter((p) => p.group_id === groupId).map((p) => [p.name, p.id]));
  if (!groupId || who.size !== 2) throw new Error("Expected one household with Bryce and Lauren.");

  const existing = new Map((await sql`SELECT id, title FROM recipes WHERE group_id = ${groupId}`).map((r) => [r.title, r.id]));
  const added = new Set();
  for (const r of RECIPES) {
    if (existing.has(r.title)) continue;
    const ingredients = r.ingredients.map(([id, text, inner]) => ({ id, text, ...(inner && existing.has(inner) ? { recipeId: existing.get(inner) } : {}) }));
    const steps = r.steps.map(([text, uses], i) => ({
      id: `s${i + 1}`,
      text,
      ...(uses ? { uses: uses.map((u) => (Array.isArray(u) ? { ingredientId: u[0], amount: u[1] } : { ingredientId: u })) } : {}),
    }));
    const [row] = await sql`
      INSERT INTO recipes (group_id, created_by_profile_id, title, description, servings, prep_min, cook_min, tags, source_kind, ingredients, steps)
      VALUES (${groupId}, ${who.get("Bryce")}, ${r.title}, ${r.description}, ${r.servings ?? null}, ${r.prepMin ?? null}, ${r.cookMin ?? null},
              ${JSON.stringify(r.tags)}::jsonb, 'mine', ${JSON.stringify(ingredients)}::jsonb, ${JSON.stringify(steps)}::jsonb)
      RETURNING id`;
    existing.set(r.title, row.id);
    added.add(r.title);
    console.log(`added ${r.title}`);
  }

  for (const [title, name, day, stars, notes, wrong] of LOGS) {
    if (!added.has(title)) continue;
    await sql`INSERT INTO recipe_logs (recipe_id, recipe_version, profile_id, cooked_on, rating, counted, notes)
              VALUES (${existing.get(title)}, 1, ${who.get(name)}, ${day}, ${stars}, ${!wrong}, ${notes ?? null})`;
  }

  const menus = new Map((await sql`SELECT id, name FROM menus WHERE group_id = ${groupId}`).map((m) => [m.name, m.id]));
  for (const m of MENUS) {
    const ids = m.recipes.map((t) => existing.get(t));
    if (!menus.has(m.name)) {
      const [row] = await sql`INSERT INTO menus (group_id, name, notes, recipe_ids, created_by_profile_id)
                              VALUES (${groupId}, ${m.name}, ${m.notes}, ${JSON.stringify(ids)}::jsonb, ${who.get("Bryce")}) RETURNING id`;
      menus.set(m.name, row.id);
      console.log(`added menu ${m.name}`);
    }
    const menuId = menus.get(m.name);
    const days = new Set((await sql`SELECT cooked_on::text AS day FROM meals WHERE menu_id = ${menuId}`).map((r) => r.day));
    for (const time of m.made) {
      if (days.has(time.cookedOn)) continue;
      const [row] = await sql`INSERT INTO meals (group_id, menu_id, cooked_on, notes, recipe_ids, created_by_profile_id)
                              VALUES (${groupId}, ${menuId}, ${time.cookedOn}, ${time.notes}, ${JSON.stringify(ids)}::jsonb, ${who.get("Bryce")}) RETURNING id`;
      for (const [name, [stars, notes, dishes]] of Object.entries(time.ratings)) {
        await sql`INSERT INTO meal_ratings (meal_id, profile_id, rating, notes) VALUES (${row.id}, ${who.get(name)}, ${stars}, ${notes})`;
        for (const [i, recipeId] of ids.entries()) {
          await sql`INSERT INTO recipe_logs (recipe_id, recipe_version, profile_id, cooked_on, rating, meal_id)
                    SELECT id, version, ${who.get(name)}, ${time.cookedOn}, ${dishes[i]}, ${row.id} FROM recipes WHERE id = ${recipeId}`;
        }
      }
      console.log(`added ${m.name} on ${time.cookedOn}`);
    }
  }
  console.log(`done: ${added.size} recipes added`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
