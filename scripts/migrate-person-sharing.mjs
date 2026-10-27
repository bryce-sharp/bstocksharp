// One-time: adds profiles.sharing (who can see each person's data, per
// personal app; {} = everyone). Idempotent; everything stays visible to everyone.
//
//   node scripts/migrate-person-sharing.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-person-sharing.mjs   (live)

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
  await sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sharing jsonb NOT NULL DEFAULT '{}'::jsonb`;
  console.log("profiles.sharing ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
