// One-shot: persist a working LLM brain for an owner account so every agent
// runs off Gemini (Google AI Studio) without touching the UI.
//
//   node scripts/seed-brain.mjs [email]
//
// Sets app_config("llm_brain") = provider google + the 3 recommended routing
// strategies, default = balanced-gemini (Gemini-only, one Google key powers all
// tiers). Idempotent: re-running overwrites the llm_brain row for that user.

import { readFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import pg from "pg"

// --- load DATABASE_URL from .env.local (no dotenv dep) ---
function envFromFile() {
  try {
    const txt = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
    }
  } catch {}
}
envFromFile()

const email = process.argv[2] || "nakri981@gmail.com"
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set (checked env + .env.local)")
  process.exit(1)
}

const strategies = [
  {
    id: "max-quality",
    name: "Max Quality",
    tiers: {
      light: { provider: "google", model: "gemini-3.5-flash" },
      standard: { provider: "moonshot", model: "" },
      heavy: { provider: "moonshot", model: "" },
    },
  },
  {
    id: "balanced-gemini",
    name: "Balanced (Gemini plan)",
    tiers: {
      light: { provider: "google", model: "gemini-3.5-flash-lite" },
      standard: { provider: "google", model: "gemini-3.5-flash" },
      heavy: { provider: "google", model: "gemini-3.5-flash" },
    },
  },
  {
    id: "cost-saver",
    name: "Cost Saver",
    tiers: {
      light: { provider: "google", model: "gemini-3.5-flash-lite" },
      standard: { provider: "openrouter", model: "deepseek/deepseek-chat" },
      heavy: { provider: "google", model: "gemini-3.5-flash" },
    },
  },
]

const brain = {
  provider: "google", // fallback engine = Gemini, works off GEMINI_API_KEY / vault google_ai
  baseUrl: "",
  models: { light: "", standard: "", heavy: "" },
  strategies,
  defaultStrategy: "balanced-gemini",
  groupStrategies: {},
  taskModels: {},
}

const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } })

try {
  const u = await pool.query('SELECT id FROM "user" WHERE email = $1 LIMIT 1', [email])
  if (u.rows.length === 0) {
    console.error(`No user with email ${email}`)
    process.exit(1)
  }
  const userId = u.rows[0].id
  const existing = await pool.query('SELECT id FROM app_config WHERE "userId" = $1 AND key = $2 LIMIT 1', [userId, "llm_brain"])
  if (existing.rows.length > 0) {
    await pool.query('UPDATE app_config SET value = $1, "updatedAt" = now() WHERE "userId" = $2 AND key = $3', [
      JSON.stringify(brain),
      userId,
      "llm_brain",
    ])
    console.log(`Updated llm_brain for ${email} (${userId}) -> provider=google, default=balanced-gemini`)
  } else {
    await pool.query('INSERT INTO app_config (id, "userId", key, value) VALUES ($1, $2, $3, $4)', [
      randomUUID(),
      userId,
      "llm_brain",
      JSON.stringify(brain),
    ])
    console.log(`Inserted llm_brain for ${email} (${userId}) -> provider=google, default=balanced-gemini`)
  }
} finally {
  await pool.end()
}
