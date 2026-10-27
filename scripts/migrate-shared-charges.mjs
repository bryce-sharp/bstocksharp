// One-time: charges another book also counts (docs/finance/money-books.md).
// Adds transaction_shares and merchant_categories.also_book_id. Idempotent and
// additive: nothing is shared until someone ticks "Also count for".
//
//   node scripts/migrate-shared-charges.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-shared-charges.mjs   (live)

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
  await sql`CREATE TABLE IF NOT EXISTS transaction_shares (
    transaction_id integer NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    book_id integer NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    spend_category varchar(40),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (transaction_id, book_id)
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_txn_shares_book ON transaction_shares (book_id)`;
  await sql`ALTER TABLE merchant_categories ADD COLUMN IF NOT EXISTS also_book_id integer REFERENCES books(id) ON DELETE SET NULL`;
  console.log("transaction_shares and merchant_categories.also_book_id ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
