// The sample recipes for the looks lab: one with full step links (uses, splits, what each step continues from),
// and two plainer ones for the card grid.

export type Ingredient = { id: string; text: string };
export type Use = { ingredientId: string; amount?: string };
export type Step = { id: string; text: string; label: string; after?: string[]; uses?: Use[] };
export type Rating = { who: string; stars: number; color: string };

export type LookRecipe = {
  id: string;
  title: string;
  blurb: string;
  servings: number;
  prepMin: number;
  cookMin: number;
  tags: string[];
  /** Steps with nothing to combine, like heating the oven: shown across the top of the table. */
  before: string[];
  ingredients: Ingredient[];
  steps: Step[];
  ratings: Rating[];
  overall: number | null;
  trend?: "up" | "down";
  lastCooked?: string;
  cooked: number;
  basedOn?: string;
  favorite: boolean;
};

export const BANANA_BREAD: LookRecipe = {
  id: "banana-bread",
  title: "Cinnamon swirl banana bread",
  blurb: "Brown sugar and cinnamon ribboned through the middle.",
  servings: 10,
  prepMin: 15,
  cookMin: 60,
  tags: ["Baking", "Breakfast"],
  before: ["Heat the oven to 350°F (175°C)", "Grease a 9 by 5 inch loaf pan"],
  ingredients: [
    { id: "banana", text: "3 ripe bananas" },
    { id: "butter", text: "1/2 cup (115 g) butter" },
    { id: "vanilla", text: "1 tsp vanilla" },
    { id: "eggs", text: "2 eggs" },
    { id: "sugar", text: "3/4 cup (150 g) brown sugar" },
    { id: "flour", text: "1 3/4 cups (220 g) flour" },
    { id: "soda", text: "1 tsp baking soda" },
    { id: "salt", text: "1/2 tsp salt" },
    { id: "cinnamon", text: "1 1/2 tsp cinnamon" },
  ],
  steps: [
    { id: "s1", label: "Mash", text: "Mash the bananas in a large bowl.", uses: [{ ingredientId: "banana" }] },
    { id: "s2", label: "Melt", text: "Melt the butter and let it cool 5 minutes.", uses: [{ ingredientId: "butter" }] },
    {
      id: "s6",
      label: "Mix",
      text: "Meanwhile, mix 2 tbsp of the brown sugar with the cinnamon.",
      uses: [{ ingredientId: "sugar", amount: "2 tbsp" }, { ingredientId: "cinnamon" }],
    },
    {
      id: "s3",
      label: "Whisk in",
      text: "Whisk the butter, vanilla, eggs and the rest of the brown sugar (2/3 cup) into the bananas.",
      after: ["s1", "s2"],
      uses: [{ ingredientId: "vanilla" }, { ingredientId: "eggs" }, { ingredientId: "sugar", amount: "2/3 cup" }],
    },
    {
      id: "s4",
      label: "Whisk",
      text: "In another bowl, whisk the flour, baking soda and salt.",
      uses: [{ ingredientId: "flour" }, { ingredientId: "soda" }, { ingredientId: "salt" }],
    },
    { id: "s5", label: "Fold", text: "Fold the dry mix into the wet until just combined.", after: ["s3", "s4"] },
    { id: "s7", label: "Layer", text: "Pour in half the batter, sprinkle the cinnamon sugar over it, then add the rest.", after: ["s5", "s6"] },
    { id: "s8", label: "Bake 55 min", text: "Bake 55 to 60 minutes, until a toothpick comes out clean.", after: ["s7"] },
    { id: "s9", label: "Cool", text: "Cool in the pan 10 minutes, then on a rack.", after: ["s8"] },
  ],
  ratings: [
    { who: "Bryce", stars: 4.5, color: "#3987e5" },
    { who: "Lauren", stars: 4, color: "#d55181" },
  ],
  overall: 4.3,
  trend: "up",
  lastCooked: "Oct 28",
  cooked: 6,
  basedOn: "Grandma's card",
  favorite: true,
};

export const CARD_RECIPES: LookRecipe[] = [
  BANANA_BREAD,
  {
    ...BANANA_BREAD,
    id: "chicken",
    title: "Bryce's fried chicken",
    blurb: "Buttermilk brined, double dredged.",
    servings: 4,
    prepMin: 30,
    cookMin: 25,
    tags: ["Dinner", "Fried chicken"],
    ratings: [{ who: "Bryce", stars: 5, color: "#3987e5" }],
    overall: 5,
    trend: undefined,
    lastCooked: "Nov 1",
    cooked: 3,
    basedOn: undefined,
    favorite: true,
  },
  {
    ...BANANA_BREAD,
    id: "soup",
    title: "Roasted tomato soup",
    blurb: "Sheet-pan roasted, blended smooth.",
    servings: 6,
    prepMin: 15,
    cookMin: 45,
    tags: ["Dinner", "Vegetarian"],
    ratings: [],
    overall: null,
    trend: undefined,
    lastCooked: undefined,
    cooked: 0,
    basedOn: undefined,
    favorite: false,
  },
];

/** Where each use of an ingredient happens, for "2 in step 3, 2 tbsp in step 6". */
export function usesOf(recipe: LookRecipe, ingredientId: string): { step: number; amount?: string }[] {
  return recipe.steps.flatMap((s, i) => (s.uses ?? []).filter((u) => u.ingredientId === ingredientId).map((u) => ({ step: i + 1, amount: u.amount })));
}
