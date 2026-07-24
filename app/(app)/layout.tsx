import { requireUser } from "@/lib/session"
import { ensureSyllabusSeeded } from "@/lib/seed"
import { AppShell } from "@/components/app-shell"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  await ensureSyllabusSeeded(user.id)
  return <AppShell userName={user.name}>{children}</AppShell>
}
