// One-time: Snug results per person per day (snug_days), so signed-in players keep
// their quilts across devices. Additive and idempotent; constraint and index names
// match Drizzle's.
//
//   node scripts/migrate-snug.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-snug.mjs   (live, before merging)

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set — check .env.local");
  process.exit(1);
}
const sql = neon(url);

async function main() {
  console.log(`database host: ${new URL(url).hostname}`);
  await sql`
    CREATE TABLE IF NOT EXISTS snug_days (
      id serial PRIMARY KEY,
      profile_id integer NOT NULL CONSTRAINT snug_days_profile_id_profiles_id_fk REFERENCES profiles(id) ON DELETE CASCADE,
      date_key date NOT NULL,
      attempt jsonb,
      best jsonb,
      best_gaps integer,
      best_hints integer,
      best_time_ms integer,
      progress jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_snug_day_profile_date ON snug_days (profile_id, date_key)`;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM snug_days`;
  console.log(`snug_days ready (${n} rows)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
