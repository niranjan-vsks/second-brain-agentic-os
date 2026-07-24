import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { deals, assets, leads, artifacts } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { FreelanceTab } from "@/components/freelance/freelance-tab"

export default async function FreelancePage() {
  const user = await requireUser()
  const userId = user.id
  const [dealRows, assetRows, leadRows, artifactRows] = await Promise.all([
    db.select().from(deals).where(eq(deals.userId, userId)).orderBy(desc(deals.updatedAt)),
    db.select().from(assets).where(eq(assets.userId, userId)).orderBy(desc(assets.updatedAt)),
    db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.updatedAt)),
    db.select().from(artifacts).where(eq(artifacts.userId, userId)).orderBy(desc(artifacts.updatedAt)),
  ])
  return <FreelanceTab deals={dealRows} assets={assetRows} leads={leadRows} artifacts={artifactRows} />
}
