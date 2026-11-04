// One-time: profiles.recipe_units, each person's As written, US or Metric choice for Recipes (docs/recipes/plan.md).
// Additive and idempotent.
//
//   node scripts/migrate-recipe-units.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-recipe-units.mjs   (live, before merging)

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
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS recipe_units varchar(10) NOT NULL DEFAULT 'written'`;
  const rows = await sql`SELECT recipe_units, count(*)::int AS n FROM profiles GROUP BY recipe_units`;
  console.log(`profiles.recipe_units ready: ${rows.map((r) => `${r.recipe_units} ${r.n}`).join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
