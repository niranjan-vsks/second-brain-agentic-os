import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import {
  deals,
  assets,
  leads,
  artifacts,
  topics,
  drills,
  resources,
  trendItems,
  linkedinPosts,
  writingSamples,
  voicePreferences,
  youtubeChannels,
  videoProjects,
  pipelineSettings,
  youtubeVideos,
  jobApplications,
  careerSettings,
  interviewStories,
  companyResearch,
  resumes,
} from "@/lib/db/schema"
import { asc, desc, eq, inArray } from "drizzle-orm"
import { ensureSyllabusSeeded } from "@/lib/seed"
import { Dashboard } from "@/components/dashboard"

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")
  const userId = session.user.id

  await ensureSyllabusSeeded(userId)

  const [
    dealRows,
    assetRows,
    leadRows,
    artifactRows,
    topicRows,
    drillRows,
    resourceRows,
    trendRows,
    postRows,
    sampleRows,
    preferenceRows,
    ytChannelRows,
    ytProjectRows,
    ytSettingsRows,
    ytVideoRows,
    careerJobRows,
    careerSettingsRows,
    careerStoryRows,
    careerResearchRows,
    careerResumeRows,
  ] = await Promise.all([
    db.select().from(deals).where(eq(deals.userId, userId)).orderBy(desc(deals.updatedAt)),
    db.select().from(assets).where(eq(assets.userId, userId)).orderBy(desc(assets.updatedAt)),
    db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.updatedAt)),
    db.select().from(artifacts).where(eq(artifacts.userId, userId)).orderBy(desc(artifacts.updatedAt)),
    db.select().from(topics).where(eq(topics.userId, userId)).orderBy(asc(topics.priority), asc(topics.sortOrder)),
    db.select().from(drills).where(eq(drills.userId, userId)).orderBy(desc(drills.updatedAt)),
    db.select().from(resources).where(eq(resources.userId, userId)).orderBy(desc(resources.createdAt)),
    db.select().from(trendItems).where(eq(trendItems.userId, userId)).orderBy(desc(trendItems.discoveredAt)),
    db.select().from(linkedinPosts).where(eq(linkedinPosts.userId, userId)).orderBy(desc(linkedinPosts.updatedAt)),
    db.select().from(writingSamples).where(eq(writingSamples.userId, userId)).orderBy(desc(writingSamples.addedAt)),
    db
      .select()
      .from(voicePreferences)
      .where(eq(voicePreferences.userId, userId))
      .orderBy(desc(voicePreferences.addedAt)),
    db.select().from(youtubeChannels).where(eq(youtubeChannels.userId, userId)).orderBy(desc(youtubeChannels.createdAt)),
    db.select().from(videoProjects).where(eq(videoProjects.userId, userId)).orderBy(desc(videoProjects.updatedAt)),
    db.select().from(pipelineSettings).where(eq(pipelineSettings.userId, userId)).limit(1),
    db
      .select()
      .from(youtubeVideos)
      .where(
        inArray(
          youtubeVideos.channelId,
          db.select({ id: youtubeChannels.id }).from(youtubeChannels).where(eq(youtubeChannels.userId, userId)),
        ),
      ),
    db.select().from(jobApplications).where(eq(jobApplications.userId, userId)).orderBy(desc(jobApplications.updatedAt)),
    db.select().from(careerSettings).where(eq(careerSettings.userId, userId)).limit(1),
    db.select().from(interviewStories).where(eq(interviewStories.userId, userId)).orderBy(desc(interviewStories.createdAt)),
    db.select().from(companyResearch).where(eq(companyResearch.userId, userId)).orderBy(desc(companyResearch.createdAt)),
    db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.createdAt)),
  ])

  return (
    <Dashboard
      userName={session.user.name}
      deals={dealRows}
      assets={assetRows}
      leads={leadRows}
      artifacts={artifactRows}
      topics={topicRows}
      drills={drillRows}
      resources={resourceRows}
      trends={trendRows}
      posts={postRows}
      samples={sampleRows}
      preferences={preferenceRows}
      ytChannels={ytChannelRows}
      ytProjects={ytProjectRows}
      ytSettings={ytSettingsRows[0] ?? null}
      ytVideos={ytVideoRows}
      careerJobs={careerJobRows}
      careerSettings={careerSettingsRows[0] ?? null}
      careerStories={careerStoryRows}
      careerResearch={careerResearchRows}
      careerResumes={careerResumeRows}
    />
  )
}
