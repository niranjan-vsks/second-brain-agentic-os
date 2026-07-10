"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { autopays, paymentInstruments, connectedAccounts } from "@/lib/db/schema"
import { and, eq, desc } from "drizzle-orm"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { playbookFor } from "@/lib/jarvis"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// --- Payment instruments (METADATA ONLY — no credentials, ever) --------------

export async function getPaymentInstruments() {
  const userId = await getUserId()
  return db.select().from(paymentInstruments).where(eq(paymentInstruments.userId, userId)).orderBy(desc(paymentInstruments.createdAt))
}

export async function addPaymentInstrument(input: {
  label: string
  instrumentType: string
  issuer: string
  network?: string
  lastFour?: string
  upiHandle?: string
  notes?: string
}) {
  const userId = await getUserId()
  if (!input.label.trim()) throw new Error("Label required")
  // Defensive: reject anything that looks like a full card number.
  if (/\d{8,}/.test(`${input.lastFour ?? ""}${input.notes ?? ""}${input.label}`)) {
    throw new Error("Do not enter full card numbers — last 4 digits only. This app never stores payment credentials.")
  }
  await db.insert(paymentInstruments).values({
    id: randomUUID(),
    userId,
    label: input.label.trim(),
    instrumentType: input.instrumentType,
    issuer: input.issuer.trim(),
    network: input.network?.trim() ?? "",
    lastFour: (input.lastFour ?? "").replace(/\D/g, "").slice(-4),
    upiHandle: input.upiHandle?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
  })
  revalidatePath("/")
  return { ok: true as const }
}

export async function deletePaymentInstrument(id: string) {
  const userId = await getUserId()
  await db.delete(paymentInstruments).where(and(eq(paymentInstruments.id, id), eq(paymentInstruments.userId, userId)))
  revalidatePath("/")
  return { ok: true as const }
}

// --- Autopays -----------------------------------------------------------------

export async function getAutopays() {
  const userId = await getUserId()
  return db.select().from(autopays).where(eq(autopays.userId, userId)).orderBy(desc(autopays.updatedAt))
}

export async function addAutopay(input: {
  merchant: string
  description?: string
  rail: string
  amountINR?: string
  cadence: string
  nextChargeDate?: string
  instrumentId?: string
  reminderDaysBefore?: number
}) {
  const userId = await getUserId()
  if (!input.merchant.trim()) throw new Error("Merchant required")
  await db.insert(autopays).values({
    id: randomUUID(),
    userId,
    merchant: input.merchant.trim(),
    description: input.description?.trim() ?? "",
    rail: input.rail,
    amountINR: input.amountINR ? input.amountINR : null,
    cadence: input.cadence,
    nextChargeDate: input.nextChargeDate || null,
    instrumentId: input.instrumentId || null,
    reminderDaysBefore: input.reminderDaysBefore ?? 3,
  })
  revalidatePath("/")
  return { ok: true as const }
}

/** Mark cancel_requested and attach the per-bank playbook. */
export async function requestCancellation(autopayId: string) {
  const userId = await getUserId()
  const [row] = await db.select().from(autopays).where(and(eq(autopays.id, autopayId), eq(autopays.userId, userId)))
  if (!row) throw new Error("Autopay not found")
  let issuer = ""
  if (row.instrumentId) {
    const [inst] = await db
      .select()
      .from(paymentInstruments)
      .where(and(eq(paymentInstruments.id, row.instrumentId), eq(paymentInstruments.userId, userId)))
    issuer = inst?.issuer ?? ""
  }
  const playbook = playbookFor(issuer || row.merchant)
  await db
    .update(autopays)
    .set({ status: "cancel_requested", cancellationNotes: playbook, updatedAt: new Date() })
    .where(and(eq(autopays.id, autopayId), eq(autopays.userId, userId)))
  revalidatePath("/")
  return { ok: true as const, playbook }
}

export async function updateAutopayStatus(autopayId: string, status: "active" | "cancelled" | "paused") {
  const userId = await getUserId()
  await db
    .update(autopays)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(autopays.id, autopayId), eq(autopays.userId, userId)))
  revalidatePath("/")
  return { ok: true as const }
}

export async function deleteAutopay(autopayId: string) {
  const userId = await getUserId()
  await db.delete(autopays).where(and(eq(autopays.id, autopayId), eq(autopays.userId, userId)))
  revalidatePath("/")
  return { ok: true as const }
}

// --- Calendar connection status (for the Money/Jarvis settings card) ----------

export async function getCalendarConnectionStatus() {
  const userId = await getUserId()
  const [row] = await db
    .select({
      id: connectedAccounts.id,
      accountEmail: connectedAccounts.accountEmail,
      status: connectedAccounts.status,
    })
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.provider, "google_calendar")))
    .limit(1)
  return row ?? null
}

export async function disconnectCalendar() {
  const userId = await getUserId()
  await db
    .update(connectedAccounts)
    .set({ status: "revoked", accessToken: null, refreshToken: null, updatedAt: new Date() })
    .where(and(eq(connectedAccounts.userId, userId), eq(connectedAccounts.provider, "google_calendar")))
  revalidatePath("/")
  return { ok: true as const }
}
