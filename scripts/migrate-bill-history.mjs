// One-time: link the versions of each bill. "Price changed as of a month" in
// ATLAS ends a bill and starts a new row; series_id gives every version the id
// of the first one, so a bill's price history survives a rename. Existing
// versions are linked when a row starts the day after a same-named row ended.
// Also adds ignored_price, a price the household declined to apply. Additive
// and idempotent.
//
//   node scripts/migrate-bill-history.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-bill-history.mjs   (live, before merging)

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set — check .env.local");
  process.exit(1);
}
const sql = neon(url);

const nextDay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

async function main() {
  console.log(`database host: ${new URL(url).hostname}`);
  await sql`ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS series_id integer`;
  await sql`ALTER TABLE recurring_expenses ADD COLUMN IF NOT EXISTS ignored_price numeric(10, 2)`;

  const rows = await sql`
    SELECT id, group_id, lower(name) AS name, start_date::text AS start, end_date::text AS "end", series_id
    FROM recurring_expenses ORDER BY group_id, lower(name), start_date, id`;
  const seriesOf = new Map(rows.map((r) => [r.id, r.series_id ?? r.id]));
  const linked = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const cur = rows[i];
    if (cur.group_id !== prev.group_id || cur.name !== prev.name || !prev.end) continue;
    if (nextDay(prev.end) !== cur.start || cur.series_id !== null) continue;
    const series = seriesOf.get(prev.id);
    await sql`UPDATE recurring_expenses SET series_id = ${series} WHERE id = ${cur.id} AND series_id IS NULL`;
    seriesOf.set(cur.id, series);
    linked.push({ id: cur.id, name: cur.name, starts: cur.start, series });
  }
  console.log(`linked ${linked.length} later versions to their first version`);
  if (linked.length) console.table(linked);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
