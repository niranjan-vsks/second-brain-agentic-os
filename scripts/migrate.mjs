// Auto-migration runner — applies any pending SQL files in ./drizzle that
// haven't been recorded in the drizzle.__drizzle_migrations tracking table
// yet. Runs automatically as part of `pnpm build` (see package.json), so
// every deploy self-heals schema drift instead of requiring a manual paste
// into the Neon SQL editor.
//
// Local dev without DATABASE_URL set: skips with a warning, does not fail
// the build (matches the "only DATABASE_URL + BETTER_AUTH_SECRET required"
// contract in .env.example).
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import pg from "pg"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("[migrate] DATABASE_URL not set — skipping migrations.")
    return
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const db = drizzle(pool)

  console.log("[migrate] Applying pending migrations from ./drizzle ...")
  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("[migrate] Up to date.")

  await pool.end()
}

main().catch((err) => {
  console.error("[migrate] Failed:", err)
  process.exit(1)
})
