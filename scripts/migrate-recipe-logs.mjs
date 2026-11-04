// One-time: recipe_logs, each person's cook log with stars and notes (docs/recipes/plan.md). Additive and
// idempotent; constraint and index names match Drizzle's. meal_id arrives with meals.
//
//   node scripts/migrate-recipe-logs.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-recipe-logs.mjs   (live, before merging)

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
  await sql`
    CREATE TABLE IF NOT EXISTS recipe_logs (
      id serial PRIMARY KEY,
      recipe_id integer NOT NULL CONSTRAINT recipe_logs_recipe_id_recipes_id_fk REFERENCES recipes(id) ON DELETE CASCADE,
      recipe_version integer NOT NULL,
      profile_id integer NOT NULL CONSTRAINT recipe_logs_profile_id_profiles_id_fk REFERENCES profiles(id) ON DELETE CASCADE,
      cooked_on date NOT NULL,
      rating integer CONSTRAINT recipe_logs_rating_check CHECK (rating BETWEEN 1 AND 5),
      counted boolean NOT NULL DEFAULT true,
      notes text,
      servings integer,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_recipe_logs_recipe ON recipe_logs (recipe_id, cooked_on)`;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM recipe_logs`;
  console.log(`recipe_logs ready (${n} rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
