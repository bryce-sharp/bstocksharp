// One-time: meals, meal_ratings and recipe_logs.meal_id, so a dinner groups its cook log entries
// (docs/recipes/plan.md). Additive and idempotent; constraint and index names match Drizzle's.
//
//   node scripts/migrate-meals.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-meals.mjs   (live, before merging)

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
    CREATE TABLE IF NOT EXISTS meals (
      id serial PRIMARY KEY,
      group_id integer NOT NULL CONSTRAINT meals_group_id_groups_id_fk REFERENCES groups(id) ON DELETE CASCADE,
      name varchar(160) NOT NULL,
      cooked_on date NOT NULL,
      notes text,
      recipe_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_by_profile_id integer CONSTRAINT meals_created_by_profile_id_profiles_id_fk REFERENCES profiles(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meals_group ON meals (group_id, cooked_on)`;
  await sql`
    CREATE TABLE IF NOT EXISTS meal_ratings (
      meal_id integer NOT NULL CONSTRAINT meal_ratings_meal_id_meals_id_fk REFERENCES meals(id) ON DELETE CASCADE,
      profile_id integer NOT NULL CONSTRAINT meal_ratings_profile_id_profiles_id_fk REFERENCES profiles(id) ON DELETE CASCADE,
      rating integer CONSTRAINT meal_ratings_rating_check CHECK (rating BETWEEN 1 AND 5),
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT meal_ratings_meal_id_profile_id_pk PRIMARY KEY (meal_id, profile_id)
    )`;
  await sql`ALTER TABLE recipe_logs ADD COLUMN IF NOT EXISTS meal_id integer`;
  const [fk] = await sql`SELECT 1 FROM pg_constraint WHERE conname = 'recipe_logs_meal_id_meals_id_fk'`;
  if (!fk) {
    await sql`ALTER TABLE recipe_logs ADD CONSTRAINT recipe_logs_meal_id_meals_id_fk FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE`;
  }
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_recipe_logs_meal ON recipe_logs (meal_id, profile_id, recipe_id) WHERE meal_id IS NOT NULL`;
  const [{ meals, ratings }] = await sql`SELECT (SELECT count(*)::int FROM meals) AS meals, (SELECT count(*)::int FROM meal_ratings) AS ratings`;
  console.log(`meals ready (${meals} meals, ${ratings} meal ratings); recipe_logs.meal_id ready`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
