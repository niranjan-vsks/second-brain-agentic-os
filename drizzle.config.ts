import { defineConfig } from "drizzle-kit"

// Auto-migration seam: `drizzle-kit generate` diffs lib/db/schema.ts against
// the last generated migration and writes a new versioned SQL file into
// ./drizzle. scripts/migrate.mjs applies any not-yet-applied files at build
// time (see package.json "build" script) — no more hand-pasting setup.sql.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
