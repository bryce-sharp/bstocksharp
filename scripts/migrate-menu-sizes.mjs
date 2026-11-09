// One-time: menus.sizes and meals.sizes, each recipe's size kept on a menu and on a time it was made (docs/recipes/plan.md). Additive and idempotent.
//
//   node scripts/migrate-menu-sizes.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-menu-sizes.mjs   (live, before merging)

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
  await sql`ALTER TABLE menus ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '{}'::jsonb`;
  const [row] = await sql`SELECT count(*)::int AS menus, count(*) FILTER (WHERE sizes <> '{}'::jsonb)::int AS sized FROM menus`;
  console.log(`menus.sizes ready: ${row.menus} menus, ${row.sized} with sizes`);
  await sql`ALTER TABLE meals ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '{}'::jsonb`;
  const [made] = await sql`SELECT count(*)::int AS meals, count(*) FILTER (WHERE sizes <> '{}'::jsonb)::int AS sized FROM meals`;
  console.log(`meals.sizes ready: ${made.meals} times made, ${made.sized} with sizes`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
