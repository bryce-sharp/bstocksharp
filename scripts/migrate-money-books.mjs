// Money books (docs/finance/money-books.md), in two steps around the deploy.
//
//   node scripts/migrate-money-books.mjs                       (dev, before deploy)
//   node scripts/live.mjs scripts/migrate-money-books.mjs      (live, before deploy)
//   ... deploy ...
//   node scripts/live.mjs scripts/migrate-money-books.mjs --contract   (live, after)
//
// Before: adds books + book_members and a nullable book_id on every finance
// table, gives each hub with finance data a Family book (every active person a
// member), and fills book_id. Additive: code without books ignores it.
// --contract: fills rows written in between, then makes book_id NOT NULL.
// Idempotent; rerun either step freely.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set; check .env.local");
  process.exit(1);
}
const sql = neon(url);
const contract = process.argv.includes("--contract");

// Tables with their own group_id, and the per-person pay tables.
const GROUP_TABLES = [
  "financial_accounts",
  "transactions",
  "recurring_expenses",
  "savings_goals",
  "merchant_categories",
  "funds",
  "api_tokens",
  "plaid_items",
];
const PERSON_TABLES = ["compensation_plans", "income_deductions"];

async function backfill() {
  for (const t of GROUP_TABLES) {
    await sql.query(
      `UPDATE ${t} x SET book_id = b.id FROM books b
       WHERE x.book_id IS NULL AND b.group_id = x.group_id AND b.starter`,
    );
  }
  for (const t of PERSON_TABLES) {
    await sql.query(
      `UPDATE ${t} x SET book_id = b.id FROM profiles p, books b
       WHERE x.book_id IS NULL AND p.id = x.profile_id AND b.group_id = p.group_id AND b.starter`,
    );
  }
}

async function starterBooks() {
  const hubs = await sql.query(
    `SELECT g.id FROM groups g
     WHERE NOT EXISTS (SELECT 1 FROM books b WHERE b.group_id = g.id AND b.starter)
       AND (${GROUP_TABLES.map((t) => `EXISTS (SELECT 1 FROM ${t} x WHERE x.group_id = g.id)`).join(" OR ")}
         OR ${PERSON_TABLES.map((t) => `EXISTS (SELECT 1 FROM ${t} x JOIN profiles p ON p.id = x.profile_id WHERE p.group_id = g.id)`).join(" OR ")})`,
  );
  for (const { id } of hubs) {
    const [book] = await sql`INSERT INTO books (group_id, name, starter) VALUES (${id}, 'Family', true)
      ON CONFLICT DO NOTHING RETURNING id`;
    if (!book) continue;
    await sql`INSERT INTO book_members (book_id, profile_id)
      SELECT ${book.id}, p.id FROM profiles p WHERE p.group_id = ${id} AND p.archived_at IS NULL
      ON CONFLICT DO NOTHING`;
  }
  return hubs.length;
}

async function main() {
  console.log(`database host: ${new URL(url).hostname}`);

  if (contract) {
    await backfill();
    for (const t of [...GROUP_TABLES, ...PERSON_TABLES]) {
      const [{ n }] = await sql.query(`SELECT count(*)::int AS n FROM ${t} WHERE book_id IS NULL`);
      if (n > 0) throw new Error(`${t} still has ${n} rows without a book; nothing made NOT NULL.`);
    }
    for (const t of [...GROUP_TABLES, ...PERSON_TABLES]) {
      await sql.query(`ALTER TABLE ${t} ALTER COLUMN book_id SET NOT NULL`);
    }
    console.log("book_id is NOT NULL on every finance table");
    return;
  }

  await sql`CREATE TABLE IF NOT EXISTS books (
    id serial PRIMARY KEY,
    group_id integer NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name varchar(80) NOT NULL,
    starter boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_books_group ON books (group_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uniq_books_starter ON books (group_id) WHERE starter`;
  await sql`CREATE TABLE IF NOT EXISTS book_members (
    book_id integer NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    profile_id integer NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, profile_id)
  )`;
  for (const t of [...GROUP_TABLES, ...PERSON_TABLES]) {
    await sql.query(
      `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS book_id integer REFERENCES books(id) ON DELETE CASCADE`,
    );
  }
  await sql`CREATE INDEX IF NOT EXISTS idx_fin_accounts_book ON financial_accounts (book_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_recurring_book ON recurring_expenses (book_id, start_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_txn_book_posted ON transactions (book_id, posted_on)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_merchcat_book ON merchant_categories (book_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_plaid_items_book ON plaid_items (book_id)`;

  const made = await starterBooks();
  await backfill();
  console.log(`books ready; ${made} Family book(s) made`);

  // Who will see Finance: logins whose person is a member of their hub's Family book.
  const logins = await sql`SELECT a.username, a.group_id, a.is_hub_login,
      EXISTS (SELECT 1 FROM book_members m JOIN books b ON b.id = m.book_id
              WHERE b.group_id = a.group_id AND m.profile_id = a.profile_id) AS sees_finance
    FROM accounts a
    WHERE EXISTS (SELECT 1 FROM books b WHERE b.group_id = a.group_id)
    ORDER BY a.group_id, a.username`;
  for (const l of logins) {
    console.log(`  hub ${l.group_id} ${l.username}${l.is_hub_login ? " (hub login)" : ""}: ${l.sees_finance ? "sees Finance" : "no book"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
