// Regression checks for Recipes: scaling, pasted lists, ratings, the safe fetch's address rules, and reading recipes
// from pages and pasted text. The page cases are invented recipes in the shapes real sites use, so no site's content
// lives here. With --live it also imports a list of real links and flags any that stop reading well.
//
//   npm run recipes:check
//   npm run recipes:check -- --live

import { recipeFromHtml, recipeFromPageText, recipeFromText, isoMinutes, textMinutes, yieldServings, tidyLine, withoutIngredientEcho } from "../lib/recipe-import.ts";
import { splitPasted, webUrl } from "../lib/recipes.ts";
import { batchesOf, formatAmount, showIngredient, showShare, showTemperatures, withAmount } from "../lib/recipe-units.ts";
import { ingredientLines, toIngredients, toSteps } from "../components/recipes/lines.ts";
import { lineForUse, shortName, sharesOf, suggestUses } from "../lib/recipe-links.ts";
import { summarizeRatings, type RatingLog } from "../lib/recipe-ratings.ts";
import { checkUrl, isPrivateAddress, readBody, safeFetchText, SafeFetchError } from "../lib/safe-fetch.ts";
import http from "node:http";
import zlib from "node:zlib";

let failed = 0;
let passed = 0;
function eq(name: string, got: unknown, want: unknown) {
  const round = (v: unknown) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v);
  if (JSON.stringify(round(got)) === JSON.stringify(round(want))) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
}
const ld = (recipe: object, extra = "") => `<html><head>${extra}<script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body></body></html>`;

// ── Scaling and pasted lists ──────────────────────────────────────────────────
for (const [line, factor, want] of [
  ["2 cups flour", 2, "4 cups flour"],
  ["1/2 cup (115 g) butter", 2, "1 cup (230 g) butter"],
  ["2 (14 oz) cans tomatoes", 2, "4 (14 oz) cans tomatoes"],
  ["1 can (14 oz) tomatoes", 2, "2 cans (14 oz) tomatoes"],
  ["1 stick (113 g) butter", 2, "2 sticks (226 g) butter"],
  ["1 teaspoon vanilla", 2, "2 teaspoons vanilla"],
  ["4 tbsp butter", 2, "1/2 cup butter"],
  ["6 tbsp butter", 1, "6 tbsp butter"],
  ["3 tbsp oil", 2, "6 tbsp oil"],
  ["1 1/2 tsp salt", 2, "1 tbsp salt"],
  ["8 oz pasta", 2, "1 lb pasta"],
  ["2 (14 oz) cans tomatoes", 1.5, "3 (14 oz) cans tomatoes"],
  ["200 g (1 cup) sugar", 2, "400 g (2 cups) sugar"],
  ["2/3 cup butter", 1.2, "3/4 cup plus 1 tbsp butter"],
  ["1/2 cup sugar", 1.25, "1/2 cup plus 2 tbsp sugar"],
  ["1 1/2 tsp cinnamon", 1.2, "1 3/4 tsp cinnamon"],
  ["10 oz beef", 1.2, "12 oz beef"],
  ["½ tsp salt", 2, "1 tsp salt"],
  ["2-3 cloves garlic", 2, "4 to 6 cloves garlic"],
  ["Salt to taste", 3, "Salt to taste"],
  ["7 oz chocolate", 1 / 3, "2 1/3 oz chocolate"],
  ["500 g flour", 1.5, "750 g flour"],
] as const) {
  eq(`scale ${line} x${factor}`, showIngredient(line, factor, "written"), want);
}

// ── Units ─────────────────────────────────────────────────────────────────────
for (const [line, system, factor, want] of [
  ["2 cups flour", "metric", 1, "about 250 g flour"],
  ["1 cup almond flour", "metric", 1, "235 ml almond flour"],
  ["1 cup peanut butter", "metric", 1, "235 ml peanut butter"],
  ["1 cup (200 g) sugar", "metric", 1, "200 g sugar"],
  ["1 cup (200 g) sugar", "us", 1, "1 cup sugar"],
  ["1/2 cup (1 stick, 113 g) butter", "metric", 2, "225 g butter"],
  ["½ tsp salt", "metric", 2, "1 tsp salt"],
  ["4 tbsp butter", "metric", 1, "about 55 g butter"],
  ["3 tbsp olive oil", "metric", 2, "90 ml olive oil"],
  ["1 lb ground beef", "metric", 1, "450 g ground beef"],
  ["2-3 cups water", "metric", 2, "0.95 to 1.4 l water"],
  ["250 ml milk", "us", 1, "1 cup milk"],
  ["750 g beef chuck", "us", 1, "1 2/3 lb beef chuck"],
  ["500 g bread flour", "us", 1, "500 g bread flour"],
  ["500 g bread flour", "us", 2, "1 kg bread flour"],
  ["2 (14 oz) cans tomatoes", "metric", 1, "2 (14 oz) cans tomatoes"],
  ["2 T sugar", "metric", 1, "2 T sugar"],
  ["1 cup warm milk (110°F)", "metric", 1, "235 ml warm milk (45°C)"],
  ["2 large eggs", "metric", 2, "4 large eggs"],
  ["1-3/4 cups all-purpose flour", "metric", 1, "about 220 g all-purpose flour"],
  ["1-3/4 cups all-purpose flour", "written", 2, "3 1/2 cups all-purpose flour"],
  ["4 sticks of celery", "metric", 2, "8 sticks of celery"],
  ["1½ cups plus 1 Tbsp. (200 g) all-purpose flour", "metric", 1, "200 g all-purpose flour"],
  ["1½ cups plus 1 Tbsp. all-purpose flour", "metric", 1, "about 195 g all-purpose flour"],
  ["1½ cups plus 1 Tbsp. flour", "written", 2, "3 cups plus 2 Tbsp flour"],
  ["1½ cups plus 1 Tbsp. flour", "us", 1, "1½ cups plus 1 Tbsp. flour"],
  ["2 tablespoons (25g) granulated sugar", "metric", 1, "25g granulated sugar"],
  ["2 tablespoons (25g) granulated sugar", "us", 1, "2 tablespoons granulated sugar"],
  ["1/2 to 2/3 cup (113g to 152g) hot water", "metric", 1, "113g to 152g hot water"],
  ["1 g instant yeast", "us", 1, "1 g instant yeast"],
  ["2 g instant yeast", "us", 2, "4 g instant yeast"],
  ["1/8 tsp salt", "written", 0.25, "0.03 tsp salt"],
  ["1 cup water (for the rice)", "metric", 1, "235 ml water (for the rice)"],
  ["1 cup water for the sugar syrup", "metric", 1, "235 ml water for the sugar syrup"],
  ["1 cup flour, plus more for dusting", "metric", 1, "about 125 g flour, plus more for dusting"],
] as const) {
  eq(`units ${line} ${system} x${factor}`, showIngredient(line, factor, system), want);
}
eq("temperatures metric", showTemperatures("Bake at 350°F, then 425 degrees F. Fry at 350-375°F. Add 2 C of water.", "metric"), "Bake at 180°C, then 220°C. Fry at 180–190°C. Add 2 C of water.");
eq("temperatures us", showTemperatures("Preheat to 180°C (160°C fan). Roast at 200C.", "us"), "Preheat to 350°F (325°F fan). Roast at 400°F.");
eq("temperatures signed", showTemperatures("Freeze at -18°C. Room 1350°F.", "us"), "Freeze at 0°F. Room 1350°F.");
eq("temperatures cold", showTemperatures("Freeze at 0°F. Chill to 40°F.", "metric"), "Freeze at -18°C. Chill to 4°C.");
eq("temperatures given in both", ["Heat the oven to 350°F (175°C).", "Heat to 180°C (350°F), then 425°F."].flatMap((t) => [showTemperatures(t, "us"), showTemperatures(t, "metric")]), ["Heat the oven to 350°F.", "Heat the oven to 175°C.", "Heat to 350°F, then 425°F.", "Heat to 180°C, then 220°C."]);
eq("temperatures as written", showTemperatures("Bake at 350°F.", "written"), "Bake at 350°F.");
eq("format 26.4", formatAmount(26.4), "26");
eq("paste bullets", splitPasted("- 2 cups flour\n• 1 tsp salt\n▢ 3 eggs"), ["2 cups flour", "1 tsp salt", "3 eggs"]);
eq("paste numbers", splitPasted("1. Mix.\n2) Add eggs.\nStep 3: Bake."), ["Mix.", "Add eggs.", "Bake."]);
eq("paste keeps ranges", splitPasted("10 - 12 cherry tomatoes\n1.5 cups milk"), ["10 - 12 cherry tomatoes", "1.5 cups milk"]);

// ── Step links ────────────────────────────────────────────────────────────────
const linkIngredients = ["2 cups all-purpose flour", "1 cup packed brown sugar", "1/2 cup granulated sugar", "2 large eggs", "1 tsp baking soda", "1 tsp baking powder", "Salt and pepper", "1 lb boneless chicken breast", "2 cups chicken broth"].map((text, i) => ({ id: `i${i}`, text }));
const linkSteps = [
  { id: "s0", text: "Whisk the flour, baking soda and baking powder." },
  { id: "s1", text: "Beat in the brown sugar, then the eggs.", uses: [{ ingredientId: "i3", amount: "1" }] },
  { id: "s2", text: "Season with salt. Add the broth." },
  { id: "s3", text: "Sprinkle with sugar, then brush with the last egg.", uses: [{ ingredientId: "i3", amount: "1" }] },
];
const suggested = suggestUses(linkIngredients, linkSteps);
eq("suggest links", linkSteps.map((st) => (suggested.get(st.id) ?? []).map((id) => shortName(linkIngredients.find((x) => x.id === id)!.text))), [["all-purpose flour", "baking soda", "baking powder"], ["brown sugar"], ["Salt and pepper", "chicken broth"], []]);
eq("counts agree", [["1 egg", 2], ["2 eggs", 0.5], ["4 cloves garlic, minced", 0.25], ["10 basil leaves", 0.1], ["1 (14 oz) can tomatoes", 2], ["1 small onion, sliced", 2]].map(([l, f]) => showIngredient(l as string, f as number, "written")), ["2 eggs", "1 egg", "1 clove garlic, minced", "1 basil leaf", "2 (14 oz) cans tomatoes", "2 small onions, sliced"]);
eq("a share of a count agrees", [withAmount("2 limes", "1"), withAmount("4 large eggs", "1")], ["1 lime", "1 large egg"]);
const butterSteps = [{ id: "m1", text: "Melt the butter." }, { id: "m2", text: "Whisk the butter into the bananas." }];
const butterLines = [{ id: "b", text: "1/2 cup butter" }, { id: "n", text: "3 bananas" }];
eq("a later mention is not suggested again", [...suggestUses(butterLines, butterSteps)], [["m1", ["b"]], ["m2", ["n"]]]);
eq("short names", ["1 can (14 oz) diced tomatoes", "2 cloves garlic, minced", "1/2 cup (115 g) unsalted butter, melted"].map(shortName), ["tomatoes", "garlic", "butter"]);
eq("shares", sharesOf("i3", linkSteps), [{ step: 2, amount: "1" }, { step: 4, amount: "1" }]);
eq("share keeps the line's own equivalent", [withAmount("1 cup (150 g) all-purpose flour", "1/2"), showShare("1 cup (150 g) all-purpose flour", "1/2", 1, "metric"), showShare("4 large eggs", "2", 2, "us")], ["1/2 cup (75 g) all-purpose flour", "75 g", "4"]);
eq("links keep their notes", toSteps([{ key: "s1", text: "Mix" }], [], { s1: [{ ingredientId: "i1", note: "the dry part" }, { ingredientId: "i2", amount: " 2 ", note: "n" }] })[0]!.uses, [{ ingredientId: "i1", note: "the dry part" }, { ingredientId: "i2", note: "n", amount: "2" }]);
const eggs = { id: "e", text: "2 eggs" };
const eggSteps = [{ id: "s1", text: "Beat", uses: [{ ingredientId: "e", amount: "1" }] }, { id: "s2", text: "Brush", uses: [{ ingredientId: "e" }] }];
eq("a use with no share after a share is the rest", [lineForUse(eggs, "1", eggSteps), lineForUse(eggs, undefined, eggSteps), lineForUse(eggs, undefined, [eggSteps[1]!])], ["1 egg", "Rest of the eggs", "2 eggs"]);
eq("with amount", [withAmount("4 large eggs", "2"), withAmount("2 cups flour", "1"), withAmount("2 cups flour", "2 tbsp"), withAmount("1/2 cup (115 g) butter", "1/4")], ["2 large eggs", "1 cup flour", "2 tbsp flour", "1/4 cup (58 g) butter"]);

// ── Recipes inside recipes ────────────────────────────────────────────────────
eq("batches", ["2 batches Fry sauce", "1 recipe pie crust", "1/2 batch dough", "1 cup fry sauce", "Fry sauce"].map(batchesOf), [2, 1, 0.5, 1, 1]);
const withLink = [{ id: "a1", text: "1 batch Fry sauce", recipeId: 7 }, { id: "a2", text: "1 bun" }];
eq("links survive the form", toIngredients(ingredientLines(withLink), withLink), withLink);
eq("an unlinked line drops its link", toIngredients(ingredientLines(withLink).map(({ recipeId: _r, ...l }) => l), withLink), [{ id: "a1", text: "1 batch Fry sauce" }, { id: "a2", text: "1 bun" }]);

// ── Ratings ───────────────────────────────────────────────────────────────────
const L = (profileId: number, cookedOn: string, rating: number | null, counted = true, recipeVersion = 1): RatingLog => ({ profileId, cookedOn, rating, counted, recipeVersion });
const T = "2026-11-03";
eq("untried", summarizeRatings([], 1, T).state, "untried");
eq("went wrong only", summarizeRatings([L(1, T, 2, false)], 1, T).state, "unrated");
eq("one person once", summarizeRatings([...Array.from({ length: 10 }, () => L(1, T, 5)), L(2, T, 3)], 1, T).overall, 4);
eq("half life", summarizeRatings([L(1, "2026-05-05", 2), L(1, T, 4)], 1, T).people[0]!.rating, 3.332);
eq("new version", summarizeRatings([L(1, "2026-10-01", 4, true, 1)], 2, T).state, "newVersion");
eq("trend up", summarizeRatings([L(1, "2026-01-01", 2), L(1, "2026-02-01", 2), L(1, "2026-09-01", 4), L(1, "2026-10-01", 5)], 1, T).trend, "up");

// ── Safe fetch address rules ──────────────────────────────────────────────────
for (const [address, blocked] of [["127.0.0.1", true], ["10.1.2.3", true], ["169.254.169.254", true], ["::1", true], ["::ffff:7f00:1", true], ["fd00::1", true], ["8.8.8.8", false], ["2606:4700::1111", false]] as const) {
  eq(`private ${address}`, isPrivateAddress(address), blocked);
}
const refused = (u: string) => { try { checkUrl(u); return false; } catch (e) { return e instanceof SafeFetchError; } };
for (const [u, r] of [["ftp://x.com", true], ["http://localhost/", true], ["http://user:pw@example.com", true], ["http://example.com:8080", true], ["http://[::1]/", true], ["https://example.com/a", false]] as const) {
  eq(`url ${u}`, refused(u), r);
}

// ── Safe fetch bodies, from a real local server ───────────────────────────────
const gzipped = zlib.gzipSync("<html>" + "a".repeat(5000) + "</html>");
const server = http.createServer((req, res) => {
  res.setHeader("content-encoding", "gzip");
  if (req.url === "/whole") return res.end(gzipped);
  if (req.url === "/big") return res.end(zlib.gzipSync("a".repeat(200_000)));
  res.setHeader("content-length", gzipped.length);
  res.write(gzipped.subarray(0, 15));
  if (req.url === "/cut") setTimeout(() => res.socket?.destroy(), 20);
});
await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
const port = (server.address() as { port: number }).port;
// A reader that never settles reports "hung" instead of stalling the checks.
const body = (path: string, maxBytes = 100_000, ms = 2000) =>
  new Promise<string>((resolve) => {
    const hung = setTimeout(() => resolve("hung"), ms + 1000);
    const done = (v: string) => (clearTimeout(hung), resolve(v));
    const signal = AbortSignal.timeout(ms);
    const req = http.get({ host: "127.0.0.1", port, path, signal }, (res) =>
      readBody(res, maxBytes, signal).then((b) => done(`${b.length} bytes`), (e) => done(e instanceof SafeFetchError ? e.reason : "other")),
    );
    req.on("error", () => {});
  });
eq("body whole", await body("/whole"), "5013 bytes");
eq("body cut short", await body("/cut"), "network");
eq("body stalled", await body("/stall", 100_000, 300), "timeout");
eq("body too big", await body("/big"), "size");
server.closeAllConnections();
server.close();

// ── Hostile pages read in linear time ─────────────────────────────────────────
const MB3 = 3_000_000;
const fill = (s: string) => s.repeat(Math.floor(MB3 / s.length));
for (const [name, read] of [
  ["unclosed tags in data", () => recipeFromHtml(ld({ "@type": "Recipe", name: "X", description: "<".repeat(MB3), recipeIngredient: ["1 a"] }), "https://x.com")],
  ["unclosed data scripts", () => recipeFromHtml(fill('<script type="application/ld+json">'), "https://x.com")],
  ["unclosed comments", () => recipeFromPageText("<body>" + fill("<!--"), "https://x.com")],
  ["unclosed paragraphs", () => recipeFromPageText("<body>" + fill("<p"), "https://x.com")],
  ["unclosed microdata", () => recipeFromHtml('<div itemscope itemtype="https://schema.org/Recipe">' + fill('<span itemprop="recipeIngredient"><i itemscope>'), "https://x.com")],
  ["unclosed card headings", () => recipeFromHtml(ld({ "@type": "Recipe", name: "X", recipeIngredient: ["1 a"] }, '<div class="tasty-recipes-ingredients-body">' + fill("<p><strong><h3>")), "https://x.com")],
  ["many ingredient headings", () => recipeFromText(fill("Ingredients\n"))],
] as const) {
  const t = performance.now();
  read();
  eq(`linear: ${name}`, performance.now() - t < 2000, true);
}

// ── Small readers ─────────────────────────────────────────────────────────────
eq("iso times", [isoMinutes("PT1H30M"), isoMinutes("P0DT0H20M"), isoMinutes("PT")], [90, 20, null]);
eq("text times", [textMinutes("2 hours 20 mins"), textMinutes("2hours HOURS"), textMinutes("1h 30m"), textMinutes("soon")], [140, 120, 90, null]);
eq("yields", [yieldServings("4"), yieldServings(["4", "4 servings"]), yieldServings("Makes 12 cookies"), yieldServings(["1", "1 Loaf"]), yieldServings(["12", "1 (9x5-inch) loaf"]), yieldServings("Cuts into 8-10 slices"), yieldServings("2 pies")], [4, 4, 12, null, 12, 8, null]);
eq("tidy parentheses", tidyLine("1 cup warm milk ((110 degrees F) )"), "1 cup warm milk (110 degrees F)");
eq("ingredient echo", withoutIngredientEcho("Whisk until smooth. 2 large eggs, 1/2 cup sugar", ["2 large eggs (room temperature)", "1/2 cup sugar"]), "Whisk until smooth.");
eq("no false echo", withoutIngredientEcho("Bake 25 minutes. Cool, then slice.", ["1 cup flour"]), "Bake 25 minutes. Cool, then slice.");

// ── Pages with recipe data ────────────────────────────────────────────────────
const graph = recipeFromHtml(
  ld(
    {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage" },
        {
          "@type": ["Recipe", "NewsArticle"],
          name: "Skillet Corn &amp; Bread",
          description: "<p>Golden.</p>",
          recipeYield: ["8", "8 slices"],
          prepTime: "PT15M",
          totalTime: "PT1H15M",
          recipeCategory: "Side dish, Breakfast",
          image: [{ "@type": "ImageObject", url: "https://img.example/a.jpg" }],
          recipeIngredient: ["2 cups cornmeal", "1 tsp salt", "1 cup buttermilk"],
          recipeInstructions: [
            { "@type": "HowToSection", name: "Batter", itemListElement: [{ "@type": "HowToStep", text: "Mix it." }, { "@type": "HowToStep", text: "Rest it 10 minutes." }] },
            { "@type": "HowToStep", text: "Bake 45 minutes." },
          ],
        },
      ],
    },
    '<meta property="og:site_name" content="Test Kitchen - Easy Food">',
  ),
  "https://www.example.com/skillet",
);
eq("graph recipe", graph && { t: graph.title, d: graph.description, s: graph.servings, p: graph.prepMin, c: graph.cookMin, tags: graph.tags, i: graph.ingredients.length, steps: graph.steps, src: graph.sourceName, img: graph.imageUrl }, { t: "Skillet Corn & Bread", d: "Golden.", s: 8, p: 15, c: 60, tags: ["Side dish", "Breakfast"], i: 3, steps: ["Mix it.", "Rest it 10 minutes.", "Bake 45 minutes."], src: "Test Kitchen", img: "https://img.example/a.jpg" });
eq("no recipe data", recipeFromHtml("<html><body>Nothing</body></html>", "https://x.com"), null);
eq("raw line break in JSON", recipeFromHtml('<script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeIngredient":["1 onion"],"description":"Warm\nand good"}</script>', "https://x.com")?.title, "Soup");

// A WP Recipe Maker card: its headings go to the data's lines when the counts match.
const wprm = `<div class="wprm-recipe-ingredients-container"><div class="wprm-recipe-ingredient-group"><h4 class="wprm-recipe-group-name">For the Rub:</h4><ul><li class="wprm-recipe-ingredient">a</li><li class="wprm-recipe-ingredient">b</li></ul></div><div class="wprm-recipe-ingredient-group"><h4 class="wprm-recipe-group-name">Roast</h4><ul><li class="wprm-recipe-ingredient">c</li></ul></div></div><div class="wprm-recipe-instructions-container"></div>`;
const roast = recipeFromHtml(ld({ "@type": "Recipe", name: "Pork Roast", recipeIngredient: ["1 tbsp salt", "1 tbsp pepper", "3 lb pork shoulder ((bone-in))"], recipeInstructions: ["Rub the pork. 1 tbsp salt, 1 tbsp pepper", "Roast 3 hours."] }, wprm), "https://x.com");
eq("wprm groups", roast?.ingredients, [{ text: "1 tbsp salt", group: "For the Rub" }, { text: "1 tbsp pepper", group: "For the Rub" }, { text: "3 lb pork shoulder (bone-in)", group: "Roast" }]);
eq("wprm echo removed", roast?.steps, ["Rub the pork.", "Roast 3 hours."]);
const mismatch = recipeFromHtml(ld({ "@type": "Recipe", name: "X", recipeIngredient: ["1 a", "2 b"] }, wprm), "https://x.com");
eq("wprm count mismatch keeps no groups", mismatch?.ingredients.some((i) => i.group), false);

// A Tasty Recipes card.
const tasty = `<div class="tasty-recipes-ingredients-body"><h4>For the stew</h4><ul><li>a</li><li>b</li></ul><p><strong>To serve</strong></p><ul><li>c</li></ul></div><div class="tasty-recipes-instructions"></div>`;
eq("tasty groups", recipeFromHtml(ld({ "@type": "Recipe", name: "Stew", recipeIngredient: ["2 lb beef", "1 onion", "Rice"] }, tasty), "https://x.com")?.ingredients.map((i) => i.group), ["For the stew", "For the stew", "To serve"]);

// Microdata with a Jetpack directions block, as older blogs mark recipes.
const micro = `<html><body><div itemscope itemtype="https://schema.org/Recipe"><h3 itemprop="name">Roast Chicken</h3><span itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">Someone</span></span><meta itemprop="recipeYield" content="4"><time itemprop="totalTime" datetime="PT1H20M">1 hr 20 min</time><ul><li itemprop="recipeIngredient">1 whole chicken (4 lb)</li><li itemprop="recipeIngredient">2 lemons</li><li itemprop="recipeIngredient">1 head garlic</li></ul><div class="jetpack-recipe-directions"><p>Heat the oven to 425°F.</p><p>Roast 75 minutes.</p></div></div></body></html>`;
const chicken = recipeFromHtml(micro, "https://x.com");
eq("microdata", chicken && { t: chicken.title, s: chicken.servings, c: chicken.cookMin, i: chicken.ingredients.length, steps: chicken.steps }, { t: "Roast Chicken", s: 4, c: 80, i: 3, steps: ["Heat the oven to 425°F.", "Roast 75 minutes."] });

// Capitals in recipe data mark a heading, as on Jamie Oliver's lasagne, unless the whole list is in capitals.
const dataLines = (recipeIngredient: string[]) => recipeFromHtml(ld({ "@type": "Recipe", name: "X", recipeIngredient }), "https://x.com")?.ingredients;
eq("data capitals heading", dataLines(["1 kg beef", "WHITE SAUCE", "2 leeks", "For the top:", "1 cup cheese"]), [{ text: "1 kg beef" }, { text: "2 leeks", group: "White sauce" }, { text: "1 cup cheese", group: "For the top" }]);
eq("data all capitals", dataLines(["1 CUP FLOUR", "SALT TO TASTE", "1 TSP YEAST"]), [{ text: "1 CUP FLOUR" }, { text: "SALT TO TASTE" }, { text: "1 TSP YEAST" }]);
// A broken optional image is dropped, so it cannot block the save; the recipe's own bad link falls back to the page.
const pictured = (image: unknown, url?: string) => recipeFromHtml(ld({ "@type": "Recipe", name: "X", recipeIngredient: ["1 a"], image, url }), "https://x.com/page");
eq("image links", [pictured("https://")?.imageUrl, pictured(["https://", { url: "https://x.com/a b.jpg" }])?.imageUrl, pictured("/a.jpg")?.imageUrl], [null, "https://x.com/a%20b.jpg", null]);
eq("bad recipe link", pictured(null, "https://")?.sourceUrl, "https://x.com/page");
eq("web urls", [webUrl("https://"), webUrl(" http://a.com "), webUrl("javascript:alert(1)"), webUrl(`https://a.com/${"a".repeat(2000)}`)], [null, "http://a.com/", null, null]);

// ── Pasted text ───────────────────────────────────────────────────────────────
eq("pasted capitals", recipeFromText("Buns\nIngredients\nDOUGH\n2 cups flour\nGLAZE\n1 cup sugar\nInstructions\n1. Mix.").ingredients, [{ text: "2 cups flour", group: "Dough" }, { text: "1 cup sugar", group: "Glaze" }]);
const simple = recipeFromText("Weeknight Chili\nHearty.\nServes 6\n\nIngredients\n- 1 lb ground beef\n- 1 can beans\n\nInstructions\n1. Brown the beef.\n2. Simmer 30 minutes.");
eq("paste simple", [simple.title, simple.description, simple.servings, simple.ingredients.map((i) => i.text), simple.steps], ["Weeknight Chili", "Hearty.", 6, ["1 lb ground beef", "1 can beans"], ["Brown the beef.", "Simmer 30 minutes."]]);

// A whole copied page: header, blog text, then the recipe card with split-up times, a photo caption and footer.
const page = [
  "SITE NAV", "FAVORITES · DINNER", "November 1, 2026", "Sunday Pot Roast", "", "Our favorite Sunday pot roast. It is tender.", "",
  "PREP TIME", "20 MINS", "", "Lots of blog text about pot roast and family dinners goes here.", "",
  "Sunday Pot Roast", "sunday pot roast", "4.9 FROM 120 VOTES", "LEAVE A REVIEW", "PRINT RECIPE",
  "PREP TIME", "20", "minutes", "COOK TIME", "3", "hours", "Serves", "SERVES", "6",
  "Tender beef braised with carrots and potatoes until it falls apart.",
  "Ingredients", "ROAST", "3 lb chuck roast", "1 tbsp salt", "VEGETABLES", "4 carrots, chopped", "1 lb potatoes",
  "Instructions", "Sear the roast on all sides.", "Braise 3 hours at 300°F.",
  "Recipe Notes", "Leftovers keep 4 days.", "", "Recipe by: Someone", "SHOP THIS POST",
].join("\n");
const potRoast = recipeFromText(page);
eq("paste page", { t: potRoast.title, d: potRoast.description, s: potRoast.servings, p: potRoast.prepMin, c: potRoast.cookMin, i: potRoast.ingredients, steps: potRoast.steps, n: potRoast.notes }, {
  t: "Sunday Pot Roast",
  d: "Tender beef braised with carrots and potatoes until it falls apart.",
  s: 6,
  p: 20,
  c: 180,
  i: [{ text: "3 lb chuck roast", group: "Roast" }, { text: "1 tbsp salt", group: "Roast" }, { text: "4 carrots, chopped", group: "Vegetables" }, { text: "1 lb potatoes", group: "Vegetables" }],
  steps: ["Sear the roast on all sides.", "Braise 3 hours at 300°F."],
  n: "Leftovers keep 4 days.",
});

// An older post with no Ingredients heading, read from the page's text.
const oldPost = `<html><head><title>Lentil Soup - Some Blog</title></head><body><nav>Home</nav><p>A story about soup.</p><p>Lentil Soup</p><p>Adapted from a friend</p><p>Total Time: 45 minutes</p><p>1 cup lentils<br>1 onion, diced<br>2 carrots, diced<br>4 cups stock<br>Salt and pepper</p><p>1. Soften the onion and carrots.</p><p>2. Add lentils and stock; simmer 30 minutes.</p><p>Thanks for reading, see you next week!</p><p>Share this:</p></body></html>`;
const soup = recipeFromPageText(oldPost, "https://blog.example/lentil-soup/");
eq("old post", soup && { t: soup.title, from: soup.readFrom, i: soup.ingredients.length, steps: soup.steps }, { t: "Lentil Soup", from: "text", i: 5, steps: ["Soften the onion and carrots.", "Add lentils and stock; simmer 30 minutes."] });
const roundup = `<html><body><h1>25 Burgers to Make This Summer</h1><p>7 minutes minutes</p><p>5 from 27 votes</p><p>Condiments</p><p>Pickled Onions</p><p>A quick tutorial for crunchy onions you will love on burgers.</p><p>1 hour 15 minutes</p><p>5 from 101 votes</p><p>Caramelized Onions</p></body></html>`;
eq("round-up is not a recipe", recipeFromPageText(roundup, "https://blog.example/burgers/"), null);

console.log(`${passed} passed, ${failed} failed`);

// ── Live links ────────────────────────────────────────────────────────────────
// Real pages that read well on 2026-11-04. Sites edit posts, so this reports drift rather than exact matches.
const LIVE: [url: string, minIngredients: number, minSteps: number][] = [
  ["https://www.budgetbytes.com/one-pot-creamy-pesto-chicken-pasta/", 10, 5],
  ["https://www.bbcgoodfood.com/recipes/brilliant-banana-loaf", 6, 5],
  ["https://www.seriouseats.com/the-food-lab-best-chocolate-chip-cookie-recipe", 8, 4],
  ["https://www.allrecipes.com/recipe/20144/banana-banana-bread/", 6, 4],
  ["https://cooking.nytimes.com/recipes/1015819-chocolate-chip-cookies", 8, 3],
  ["https://thesaltymarshmallow.com/best-banana-bread-recipe/", 7, 5],
  ["https://www.tastesoflizzyt.com/homemade-cinnamon-rolls/", 12, 10],
  ["https://www.recipetineats.com/chicken-stir-fry/", 12, 6],
  ["https://www.justonecookbook.com/teriyaki-chicken/", 8, 6],
  ["https://pinchofyum.com/the-best-soft-chocolate-chip-cookies", 7, 3],
  ["https://www.kingarthurbaking.com/recipes/classic-sandwich-bread-recipe", 5, 6],
  ["https://www.inspiredtaste.net/94579/pumpkin-muffin-recipe/", 9, 4],
  ["https://smittenkitchen.com/2026/09/tomato-risotto-with-frizzled-red-onions/", 10, 3],
  ["https://smittenkitchen.com/2010/10/summer-squash-soup/", 7, 1],
  ["https://iamafoodblog.com/6-ingredient-piri-piri-chicken-a-nandos-knockoff/", 6, 6],
  ["https://www.howsweeteats.com/2009/10/chunky-fire-roasted-chili/", 12, 4],
  ["https://www.closetcooking.com/kalbi-korean-bbq-short-ribs/", 6, 2],
];

if (process.argv.includes("--live")) {
  const rows = await Promise.all(
    LIVE.map(async ([url, minI, minS]) => {
      const host = new URL(url).hostname.replace(/^www\./, "");
      try {
        const res = await safeFetchText(url);
        const d = recipeFromHtml(res.body, res.url) ?? recipeFromPageText(res.body, res.url);
        if (!d) return `DROP   ${host}: no recipe read`;
        const ok = d.ingredients.length >= minI && d.steps.length >= minS && !!d.title;
        return `${ok ? "ok    " : "DRIFT "} ${host}: "${d.title}" ${d.ingredients.length} ingredients, ${d.steps.length} steps (${d.readFrom})`;
      } catch (e) {
        return `FETCH  ${host}: ${e instanceof Error ? e.message : e}`;
      }
    }),
  );
  console.log(rows.join("\n"));
  if (rows.some((r) => !r.startsWith("ok"))) failed++;
}

process.exit(failed ? 1 : 0);
