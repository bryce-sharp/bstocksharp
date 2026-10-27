// One-time: adds accounts.apps (the apps a login may open; null = all the
// hub's) and accounts.is_hub_login (one shared, person-less login per hub).
// Idempotent; every existing login keeps every app.
//
//   node scripts/migrate-hub-login.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-hub-login.mjs   (live)

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
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS apps jsonb`;
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_hub_login boolean NOT NULL DEFAULT false`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS accounts_one_hub_login ON accounts (group_id) WHERE is_hub_login`;
  console.log("accounts.apps and accounts.is_hub_login ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
