// Sample recipes for the recipes mockup; nothing here is saved.

export type MockRecipe = {
  id: string;
  title: string;
  description?: string;
  servings: number;
  prepMin?: number;
  cookMin?: number;
  tags: string[];
  favorite: boolean;
  source?: { name: string; url: string };
  /** Ingredient lines; a line ending in ":" starts a group, like "For the sauce:". */
  ingredients: string[];
  steps: string[];
  notes?: string;
  /** Which chart hue (1 to 8) tints the placeholder picture. */
  hue: number;
};

export const SAMPLE_RECIPES: MockRecipe[] = [
  {
    id: "skillet-chicken",
    title: "Lemon garlic skillet chicken",
    description: "Weeknight chicken thighs with a quick pan sauce.",
    servings: 4,
    prepMin: 10,
    cookMin: 30,
    tags: ["Dinner", "Quick"],
    favorite: true,
    ingredients: [
      "1 1/2 lb boneless chicken thighs",
      "1 tsp salt",
      "1/2 tsp black pepper",
      "2 tbsp olive oil",
      "For the sauce:",
      "4 cloves garlic, minced",
      "1/2 cup chicken broth",
      "2 tbsp lemon juice",
      "1 tbsp butter",
      "Parsley to finish",
    ],
    steps: [
      "Pat the chicken dry and season both sides with the salt and pepper.",
      "Heat the oil in a large skillet over medium-high heat. Cook the chicken 6 minutes without moving it, until golden.",
      "Flip and cook another 5 to 6 minutes, until cooked through. Move to a plate.",
      "Lower the heat to medium. Add the garlic and stir for 30 seconds.",
      "Pour in the broth and lemon juice, scraping up the browned bits. Simmer 3 minutes.",
      "Stir in the butter, return the chicken, and spoon the sauce over. Finish with parsley.",
    ],
    notes: "Bone-in thighs work too; add about 10 minutes in step 3.",
    hue: 4,
  },
  {
    id: "banana-bread",
    title: "Brown butter banana bread",
    servings: 10,
    prepMin: 15,
    cookMin: 60,
    tags: ["Baking", "Breakfast"],
    favorite: false,
    source: { name: "Grandma's card", url: "" },
    ingredients: [
      "1/2 cup butter",
      "3 very ripe bananas",
      "3/4 cup brown sugar",
      "2 eggs",
      "1 tsp vanilla",
      "1 3/4 cups flour",
      "1 tsp baking soda",
      "1/2 tsp salt",
      "1/2 cup walnuts, chopped (optional)",
    ],
    steps: [
      "Heat the oven to 350°F and grease a 9 by 5 inch loaf pan.",
      "Melt the butter in a small pan and keep cooking 4 to 5 minutes, until it smells nutty and turns golden brown. Let it cool 10 minutes.",
      "Mash the bananas, then whisk in the brown butter, sugar, eggs and vanilla.",
      "Stir in the flour, baking soda and salt until just combined. Fold in the walnuts.",
      "Pour into the pan and bake 55 to 60 minutes, until a toothpick comes out clean.",
      "Cool in the pan for 15 minutes, then turn out onto a rack.",
    ],
    hue: 2,
  },
  {
    id: "tomato-soup",
    title: "Roasted tomato soup",
    description: "Sheet-pan roasted, blended smooth.",
    servings: 6,
    prepMin: 15,
    cookMin: 45,
    tags: ["Dinner", "Vegetarian", "Make ahead"],
    favorite: true,
    source: { name: "example-kitchen.com", url: "https://example-kitchen.com/roasted-tomato-soup" },
    ingredients: [
      "3 lb tomatoes, halved",
      "1 onion, quartered",
      "6 cloves garlic",
      "3 tbsp olive oil",
      "1 1/2 tsp salt",
      "2 cups vegetable broth",
      "1/2 cup cream",
      "Basil to serve",
    ],
    steps: [
      "Heat the oven to 425°F.",
      "Toss the tomatoes, onion and garlic with the oil and salt on a sheet pan. Roast 35 to 40 minutes, until soft and charred at the edges.",
      "Tip everything into a pot with the broth and simmer 10 minutes.",
      "Blend until smooth, then stir in the cream. Taste for salt.",
      "Serve with torn basil.",
    ],
    hue: 8,
  },
];

/** What "Import from a link" finds in the mockup: the shape the real import fills from a page's recipe data. */
export const IMPORTED: Omit<MockRecipe, "id" | "favorite" | "hue"> = {
  title: "Sheet pan gnocchi with sausage and peppers",
  description: "Crispy shelf-stable gnocchi roasted with everything else on one pan.",
  servings: 4,
  prepMin: 10,
  cookMin: 25,
  tags: ["Dinner", "Quick"],
  ingredients: [
    "1 lb shelf-stable potato gnocchi",
    "12 oz Italian sausage, sliced",
    "2 bell peppers, sliced",
    "1 red onion, sliced",
    "2 tbsp olive oil",
    "1 tsp Italian seasoning",
    "1/2 tsp salt",
    "1/4 cup grated parmesan",
  ],
  steps: [
    "Heat the oven to 450°F.",
    "Toss everything but the parmesan on a large sheet pan and spread it out.",
    "Roast 20 to 25 minutes, stirring halfway, until the gnocchi is crisp.",
    "Sprinkle with parmesan and serve.",
  ],
};
