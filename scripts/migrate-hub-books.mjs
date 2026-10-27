// One-time: adds books.hub_login (the Hub, the hub's shared login, can open the
// book). Idempotent; no book is open to the Hub until a member ticks it.
//
//   node scripts/migrate-hub-books.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-hub-books.mjs   (live)

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
  await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS hub_login boolean NOT NULL DEFAULT false`;
  console.log("books.hub_login ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
