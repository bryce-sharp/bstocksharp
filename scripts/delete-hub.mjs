// Deletes a login's whole hub: the hub, every login and person in it, and all
// their data (foreign keys cascade). For test and spam hubs. Shows what it
// would delete unless --yes, and refuses the demo hub and any site admin's hub.
//
//   node scripts/delete-hub.mjs <username> [--yes]                    (dev database)
//   node scripts/live.mjs scripts/delete-hub.mjs <username> [--yes]   (live)

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local", quiet: true });

const url = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set; check .env.local");
  process.exit(1);
}
const sql = neon(url);
const username = (process.argv[2] ?? "").trim().toLowerCase();
const apply = process.argv.includes("--yes");
const admins = (process.env.SITE_ADMINS ?? "bstocksharp").split(",").map((n) => n.trim().toLowerCase());

async function main() {
  if (!username || username.startsWith("--")) {
    console.error("Usage: node scripts/delete-hub.mjs <username> [--yes]");
    process.exit(1);
  }
  console.log(`database host: ${new URL(url).hostname}`);
  const [account] = await sql`
    SELECT g.id, g.name, g.is_demo, g.apps, g.created_at::text AS created
    FROM accounts a JOIN groups g ON g.id = a.group_id WHERE a.username = ${username}`;
  if (!account) {
    console.log(`No login named "${username}".`);
    return;
  }
  const logins = await sql`SELECT username FROM accounts WHERE group_id = ${account.id} ORDER BY id`;
  const people = await sql`SELECT name FROM profiles WHERE group_id = ${account.id} ORDER BY id`;
  const [{ games }] = await sql`
    SELECT count(*)::int AS games FROM snug_days s JOIN profiles p ON p.id = s.profile_id WHERE p.group_id = ${account.id}`;
  console.log(`hub #${account.id} "${account.name}" (apps ${JSON.stringify(account.apps ?? "all")}, made ${account.created})`);
  console.log(`  logins: ${logins.map((l) => l.username).join(", ")}`);
  console.log(`  people: ${people.map((p) => p.name).join(", ") || "none"}`);
  console.log(`  saved Snug days: ${games}`);
  if (account.is_demo || logins.some((l) => admins.includes(l.username))) {
    console.error("Refusing: this is the demo hub or a site admin's hub.");
    process.exit(1);
  }
  if (!apply) {
    console.log("Dry run; pass --yes to delete this hub and everything in it.");
    return;
  }
  await sql`DELETE FROM groups WHERE id = ${account.id}`;
  console.log(`deleted hub #${account.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
