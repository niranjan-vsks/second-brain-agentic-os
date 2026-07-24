import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { jobApplications, careerSettings, interviewStories, companyResearch, resumes } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { CareerTab } from "@/components/career/career-tab"

export default async function CareerPage() {
  const user = await requireUser()
  const userId = user.id
  const [careerJobRows, careerSettingsRows, careerStoryRows, careerResearchRows, careerResumeRows] = await Promise.all([
    db.select().from(jobApplications).where(eq(jobApplications.userId, userId)).orderBy(desc(jobApplications.updatedAt)),
    db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1),
    db.select().from(interviewStories).where(eq(interviewStories.userId, userId)).orderBy(desc(interviewStories.createdAt)),
    db.select().from(companyResearch).where(eq(companyResearch.userId, userId)).orderBy(desc(companyResearch.createdAt)),
    db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.createdAt)),
  ])
  return (
    <CareerTab
      jobs={careerJobRows}
      settings={careerSettingsRows[0] ?? null}
      stories={careerStoryRows}
      research={careerResearchRows}
      masterResumes={careerResumeRows}
    />
  )
}
