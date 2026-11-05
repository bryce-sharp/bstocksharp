// One-time: menus, so a set of recipes exists before anyone makes it, and each meal becomes one time a menu was
// made (docs/recipes/plan.md). Idempotent. Each meal without a menu gets one: meals with the same name and the same
// recipes share a menu. The first run is additive, so the deployed code keeps working; --finish runs after the
// deploy, picks up meals logged in between, then requires a menu and drops meals.name.
//
//   node scripts/migrate-menus.mjs                              (dev database)
//   node scripts/migrate-menus.mjs --finish                     (dev database, after the code runs there)
//   node scripts/live.mjs scripts/migrate-menus.mjs             (live, before merging)
//   node scripts/live.mjs scripts/migrate-menus.mjs --finish    (live, after the deploy)

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set; check .env.local");
  process.exit(1);
}
const sql = neon(url);
const finish = process.argv.includes("--finish");

async function hasColumn(table, column) {
  const [row] = await sql`SELECT 1 FROM information_schema.columns WHERE table_name = ${table} AND column_name = ${column}`;
  return Boolean(row);
}

async function main() {
  console.log(`database host: ${new URL(url).hostname}`);
  await sql`
    CREATE TABLE IF NOT EXISTS menus (
      id serial PRIMARY KEY,
      group_id integer NOT NULL CONSTRAINT menus_group_id_groups_id_fk REFERENCES groups(id) ON DELETE CASCADE,
      name varchar(160) NOT NULL,
      notes text,
      recipe_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_by_profile_id integer CONSTRAINT menus_created_by_profile_id_profiles_id_fk REFERENCES profiles(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_menus_group ON menus (group_id)`;
  await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS menu_id integer`;
  const [fk] = await sql`SELECT 1 FROM pg_constraint WHERE conname = 'meals_menu_id_menus_id_fk'`;
  if (!fk) await sql`ALTER TABLE meals ADD CONSTRAINT meals_menu_id_menus_id_fk FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE`;
  await sql`CREATE INDEX IF NOT EXISTS idx_meals_menu ON meals (menu_id, cooked_on)`;

  if (await hasColumn("meals", "name")) {
    // The new code saves meals without a name, so the name stops being required before it deploys.
    await sql`ALTER TABLE meals ALTER COLUMN name DROP NOT NULL`;
    const [{ made }, { linked }] = await sql.transaction([
      sql`WITH firsts AS (
            SELECT DISTINCT ON (group_id, name, recipe_ids) group_id, name, recipe_ids, created_by_profile_id, created_at
            FROM meals m
            WHERE menu_id IS NULL AND name IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM menus u WHERE u.group_id = m.group_id AND u.name = m.name AND u.recipe_ids = m.recipe_ids)
            ORDER BY group_id, name, recipe_ids, id
          ), made AS (
            INSERT INTO menus (group_id, name, recipe_ids, created_by_profile_id, created_at)
            SELECT group_id, name, recipe_ids, created_by_profile_id, created_at FROM firsts
            RETURNING id
          )
          SELECT count(*)::int AS made FROM made`,
      sql`WITH linked AS (
            UPDATE meals m SET menu_id = (SELECT min(u.id) FROM menus u WHERE u.group_id = m.group_id AND u.name = m.name AND u.recipe_ids = m.recipe_ids)
            WHERE menu_id IS NULL AND name IS NOT NULL
            RETURNING id
          )
          SELECT count(*)::int AS linked FROM linked`,
    ]).then((r) => r.map((rows) => rows[0]));
    console.log(`made ${made} menus from meals; linked ${linked} meals`);
  }

  if (finish) {
    const [{ loose }] = await sql`SELECT count(*)::int AS loose FROM meals WHERE menu_id IS NULL`;
    if (loose) throw new Error(`${loose} meals still have no menu; nothing was finished`);
    await sql`ALTER TABLE meals ALTER COLUMN menu_id SET NOT NULL`;
    await sql`ALTER TABLE meals DROP COLUMN IF EXISTS name`;
    console.log("finished: every meal has a menu, and meals.name is gone");
  }
  const [{ menus, meals }] = await sql`SELECT (SELECT count(*)::int FROM menus) AS menus, (SELECT count(*)::int FROM meals) AS meals`;
  console.log(`menus ready (${menus} menus, ${meals} times made)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
