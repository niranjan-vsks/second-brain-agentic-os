"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { osChatMessages } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { answerOsQuestion } from "@/lib/os-chat"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export async function getChatHistory() {
  const userId = await getUserId()
  const rows = await db
    .select()
    .from(osChatMessages)
    .where(eq(osChatMessages.userId, userId))
    .orderBy(desc(osChatMessages.createdAt))
    .limit(50)
  return rows.reverse()
}

export async function askOs(question: string) {
  const userId = await getUserId()
  if (!question.trim()) throw new Error("Empty question")
  const answer = await answerOsQuestion(userId, question.trim(), "web")
  return answer
}

// Jarvis: tool-calling upgrade — SQL + Google Calendar + autopay tools in one loop.
// Persists to the same os_chat_messages history as Ask OS.
export async function askJarvis(question: string) {
  const userId = await getUserId()
  const q = question.trim()
  if (!q) throw new Error("Empty question")

  const { randomUUID } = await import("crypto")
  const { jarvisChat } = await import("@/lib/jarvis")

  // Short rolling context: last 6 messages from history + the new question.
  const history = await db
    .select()
    .from(osChatMessages)
    .where(eq(osChatMessages.userId, userId))
    .orderBy(desc(osChatMessages.createdAt))
    .limit(6)
  const messages = [
    ...history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: q },
  ]

  await db.insert(osChatMessages).values({ id: randomUUID(), userId, channel: "web", role: "user", content: q })
  const result = await jarvisChat(userId, messages)
  await db
    .insert(osChatMessages)
    .values({ id: randomUUID(), userId, channel: "web", role: "assistant", content: result.text })
  return result.text
}
