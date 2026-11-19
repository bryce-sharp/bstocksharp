// One-time: people deactivated before deactivation ended their pay still have open
// pay plans and paycheck deductions. ATLAS now reads plan dates only, so end those
// rows on the last day of the household month they were deactivated in, and remove
// rows that start after it, the same rule deactivateProfile now applies. Safe to run
// before or after the code ships: the old code leaves deactivated people out anyway.
// Idempotent.
//
//   node scripts/migrate-end-archived-pay.mjs            dry run
//   node scripts/migrate-end-archived-pay.mjs --apply    write it

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set — check .env.local");
  process.exit(1);
}
const sql = neon(url);
const apply = process.argv.includes("--apply");

async function main() {
  // Each deactivated person's cutoff: the last day of the month they were deactivated, in the household's zone.
  const people = await sql`
    SELECT p.id, p.name, g.timezone,
      (date_trunc('month', p.archived_at AT TIME ZONE g.timezone) + interval '1 month - 1 day')::date::text AS cutoff
    FROM profiles p JOIN groups g ON g.id = p.group_id
    WHERE p.archived_at IS NOT NULL
    ORDER BY p.id`;
  let changes = 0;
  for (const p of people) {
    for (const table of ["compensation_plans", "income_deductions"]) {
      const later = await sql.query(
        `SELECT id, start_date::text AS s FROM ${table} WHERE profile_id = $1 AND start_date > $2`,
        [p.id, p.cutoff],
      );
      const open = await sql.query(
        `SELECT id, start_date::text AS s, end_date::text AS e FROM ${table}
         WHERE profile_id = $1 AND start_date <= $2 AND (end_date IS NULL OR end_date > $2)`,
        [p.id, p.cutoff],
      );
      for (const r of later) console.log(`person #${p.id} ${table} #${r.id} starts ${r.s}, after ${p.cutoff} → remove`);
      for (const r of open) console.log(`person #${p.id} ${table} #${r.id} ${r.s}..${r.e ?? "open"} → end ${p.cutoff}`);
      changes += later.length + open.length;
      if (apply && (later.length || open.length)) {
        await sql.transaction([
          sql.query(`DELETE FROM ${table} WHERE profile_id = $1 AND start_date > $2`, [p.id, p.cutoff]),
          sql.query(
            `UPDATE ${table} SET end_date = $2 WHERE profile_id = $1 AND start_date <= $2 AND (end_date IS NULL OR end_date > $2)`,
            [p.id, p.cutoff],
          ),
        ]);
      }
    }
  }
  console.log(`${people.length} deactivated people, ${changes} rows to change.`);
  if (!apply) console.log("Dry run — re-run with --apply to write.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
