// One-time: Snug moved to month quilts (puzzle version 2), so every saved day from the earlier boards is stale.
// Deletes snug_days rows where no run or unfinished game carries "v": 2. Counts only, unless --yes.
// Browsers clear their own stale copies, and the app ignores stale rows, so this is cleanup, not a requirement.
//
//   node scripts/migrate-snug-reset.mjs [--yes]                    (dev database)
//   node scripts/live.mjs scripts/migrate-snug-reset.mjs [--yes]   (live)

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set — check .env.local");
  process.exit(1);
}
const sql = neon(url);
const apply = process.argv.includes("--yes");

async function main() {
  console.log(`database host: ${new URL(url).hostname}`);
  const stale = await sql`
    SELECT d.id, p.name, d.date_key::text AS date_key
    FROM snug_days d JOIN profiles p ON p.id = d.profile_id
    WHERE COALESCE(d.attempt->>'v', d.best->>'v', d.progress->>'v') IS DISTINCT FROM '2'
    ORDER BY p.name, d.date_key`;
  console.log(`${stale.length} stale row(s)`);
  for (const r of stale) console.log(`  ${r.name} ${r.date_key}`);
  if (!apply) {
    console.log("Dry run; pass --yes to delete them.");
    return;
  }
  const ids = stale.map((r) => r.id);
  if (ids.length) await sql`DELETE FROM snug_days WHERE id = ANY(${ids})`;
  console.log(`deleted ${ids.length} row(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
