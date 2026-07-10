/**
 * AES-256-GCM encryption for credentials at rest (§8 of the YouTube PRD).
 * Key derived from CREDENTIALS_ENCRYPTION_KEY env var (any strong secret;
 * generate with: openssl rand -base64 32). Never store raw OAuth tokens in Neon.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

function key(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!secret) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not set")
  return createHash("sha256").update(secret).digest()
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  return `${iv.toString("base64")}.${cipher.getAuthTag().toString("base64")}.${enc.toString("base64")}`
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".")
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload")
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8")
}

export function isCryptoConfigured(): boolean {
  return Boolean(process.env.CREDENTIALS_ENCRYPTION_KEY)
}
