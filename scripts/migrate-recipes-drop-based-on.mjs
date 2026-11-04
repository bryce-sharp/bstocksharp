// One-time: drop recipes.based_on_recipe_id, left from the dropped My version plan (docs/recipes/plan.md). It
// refuses while any recipe uses the column. Run on live only after the code without the column is deployed.
//
//   node scripts/migrate-recipes-drop-based-on.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-recipes-drop-based-on.mjs   (live, after the PR merges and deploys)

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set; check .env.local");
  process.exit(1);
}
const sql = neon(url);

async function main() {
  console.log(`database host: ${new URL(url).hostname}`);
  const [{ present }] = await sql`
    SELECT count(*)::int AS present FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'based_on_recipe_id'`;
  if (!present) return console.log("recipes.based_on_recipe_id is already gone");
  const [{ n }] = await sql`SELECT count(based_on_recipe_id)::int AS n FROM recipes`;
  if (n > 0) throw new Error(`${n} recipes still use based_on_recipe_id; not dropping it`);
  await sql`ALTER TABLE recipes DROP COLUMN based_on_recipe_id`;
  console.log("recipes.based_on_recipe_id dropped (it was empty)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
