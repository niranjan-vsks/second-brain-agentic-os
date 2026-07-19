/**
 * Encryption key rotation — re-encrypts every AES-encrypted secret in the DB
 * under a new key. Closes the "rotation" gap vs a dedicated secrets manager.
 *
 * Covers: api_keys.encryptedKey, connected_accounts.encryptedRefreshToken,
 * youtube_channels.encryptedRefreshToken.
 *
 * Usage:
 *   OLD_CREDENTIALS_ENCRYPTION_KEY=<current> \
 *   NEW_CREDENTIALS_ENCRYPTION_KEY=<new>     \
 *   DATABASE_URL=<neon url>                  \
 *   node scripts/rotate-encryption-key.mjs
 *
 * Then set CREDENTIALS_ENCRYPTION_KEY=<new> in Vercel env and redeploy.
 * Safe to re-run: rows already encrypted under the new key are detected
 * (decrypt with old key fails → try new key → skip if it works).
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"
import pg from "pg"

const OLD = process.env.OLD_CREDENTIALS_ENCRYPTION_KEY
const NEW = process.env.NEW_CREDENTIALS_ENCRYPTION_KEY

if (!OLD || !NEW || !process.env.DATABASE_URL) {
  console.error(
    "Required env: OLD_CREDENTIALS_ENCRYPTION_KEY, NEW_CREDENTIALS_ENCRYPTION_KEY, DATABASE_URL",
  )
  process.exit(1)
}

const keyOf = (secret) => createHash("sha256").update(secret).digest()

function decryptWith(secret, payload) {
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("malformed payload")
  const d = createDecipheriv("aes-256-gcm", keyOf(secret), Buffer.from(ivB64, "base64"))
  d.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([d.update(Buffer.from(dataB64, "base64")), d.final()]).toString("utf8")
}

function encryptWith(secret, plaintext) {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", keyOf(secret), iv)
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()])
  return `${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${enc.toString("base64")}`
}

// [table, pk column, encrypted column]
const TARGETS = [
  ["api_keys", "id", "encryptedKey"],
  ["connected_accounts", "id", "accessToken"],
  ["connected_accounts", "id", "refreshToken"],
  ["youtube_channels", "id", "oauthRefreshToken"],
]

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

let rotated = 0
let alreadyNew = 0
let failed = 0

for (const [table, pk, col] of TARGETS) {
  const exists = await pool
    .query(`select 1 from information_schema.tables where table_schema='public' and table_name=$1`, [table])
    .then((r) => r.rowCount > 0)
  if (!exists) {
    console.log(`[rotate] ${table}: table missing, skipping`)
    continue
  }
  const rows = await pool.query(
    `select "${pk}" as pk, "${col}" as payload from "${table}" where "${col}" is not null and "${col}" <> ''`,
  )
  for (const row of rows.rows) {
    try {
      const plaintext = decryptWith(OLD, row.payload)
      const reencrypted = encryptWith(NEW, plaintext)
      await pool.query(`update "${table}" set "${col}" = $1 where "${pk}" = $2`, [reencrypted, row.pk])
      rotated++
    } catch {
      // Old key failed — maybe already rotated?
      try {
        decryptWith(NEW, row.payload)
        alreadyNew++
      } catch {
        console.error(`[rotate] ${table} ${row.pk}: decrypts with NEITHER key — manual attention needed`)
        failed++
      }
    }
  }
  console.log(`[rotate] ${table}: done (${rows.rowCount} rows scanned)`)
}

await pool.end()
console.log(`[rotate] Rotated: ${rotated} · already on new key: ${alreadyNew} · failed: ${failed}`)
if (failed > 0) process.exit(1)
console.log("[rotate] Now set CREDENTIALS_ENCRYPTION_KEY to the NEW value in Vercel env and redeploy.")
