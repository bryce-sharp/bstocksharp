// One-time: adds groups.apps, the list of apps a hub has (null = every app),
// so games-only sign-ups can be limited to games. Idempotent; every existing
// hub keeps every app.
//
//   node scripts/migrate-hub-apps.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-hub-apps.mjs   (live)

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
  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS apps jsonb`;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM groups WHERE apps IS NOT NULL`;
  console.log(`groups.apps ready; ${n} hub(s) limited to a list of apps`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
