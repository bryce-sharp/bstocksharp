// One-time: adds invites.profile_id, the person a sign-in invite is for, so
// joining claims that person. Idempotent; existing invites keep no person.
//
//   node scripts/migrate-invite-person.mjs                    (dev database)
//   node scripts/live.mjs scripts/migrate-invite-person.mjs   (live)

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
  await sql`ALTER TABLE invites ADD COLUMN IF NOT EXISTS profile_id integer REFERENCES profiles(id) ON DELETE SET NULL`;
  console.log("invites.profile_id ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
