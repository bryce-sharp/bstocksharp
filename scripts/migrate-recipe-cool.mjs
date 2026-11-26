// One-time: recipes.cool_min, the minutes a dish cools, chills, sets or rests after cooking (docs/recipes/plan.md).
// Additive and idempotent.
//
//   node scripts/migrate-recipe-cool.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-recipe-cool.mjs   (live, before merging)

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
  await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS cool_min integer`;
  const [row] = await sql`SELECT count(*)::int AS n, count(cool_min)::int AS set FROM recipes`;
  console.log(`recipes.cool_min ready: ${row.n} recipes, ${row.set} with a cool/set time`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
