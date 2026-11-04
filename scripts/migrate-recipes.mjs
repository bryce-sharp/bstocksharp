// One-time: the Recipes section's tables, recipes and recipe_favorites (docs/recipes/plan.md).
// Additive and idempotent; constraint and index names match Drizzle's.
//
//   node scripts/migrate-recipes.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-recipes.mjs   (live, before merging)

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
    CREATE TABLE IF NOT EXISTS recipes (
      id serial PRIMARY KEY,
      group_id integer NOT NULL CONSTRAINT recipes_group_id_groups_id_fk REFERENCES groups(id) ON DELETE CASCADE,
      created_by_profile_id integer CONSTRAINT recipes_created_by_profile_id_profiles_id_fk REFERENCES profiles(id) ON DELETE SET NULL,
      version integer NOT NULL DEFAULT 1,
      title varchar(160) NOT NULL,
      description text,
      servings integer,
      prep_min integer,
      cook_min integer,
      notes text,
      tags jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_kind varchar(20) NOT NULL DEFAULT 'mine',
      source_url text,
      source_name varchar(160),
      image_url text,
      ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
      steps jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_recipes_group ON recipes (group_id)`;
  await sql`
    CREATE TABLE IF NOT EXISTS recipe_favorites (
      profile_id integer NOT NULL CONSTRAINT recipe_favorites_profile_id_profiles_id_fk REFERENCES profiles(id) ON DELETE CASCADE,
      recipe_id integer NOT NULL CONSTRAINT recipe_favorites_recipe_id_recipes_id_fk REFERENCES recipes(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT recipe_favorites_profile_id_recipe_id_pk PRIMARY KEY (profile_id, recipe_id)
    )`;
  const [{ r }] = await sql`SELECT count(*)::int AS r FROM recipes`;
  const [{ f }] = await sql`SELECT count(*)::int AS f FROM recipe_favorites`;
  console.log(`recipes ready (${r} rows); recipe_favorites ready (${f} rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
