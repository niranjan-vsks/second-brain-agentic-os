import { pgTable, text, timestamp, boolean, serial, integer, date, numeric, jsonb } from "drizzle-orm/pg-core"

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// --- Freelance OS tables ----------------------------------------------------

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  client: text("client").notNull().default(""),
  stage: text("stage").notNull().default("lead"),
  buildType: text("buildType").notNull().default("custom"),
  value: integer("value").notNull().default(0),
  notes: text("notes").notNull().default(""),
  nextAction: text("nextAction").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const dealChecklist = pgTable("deal_checklist", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  dealId: integer("dealId").notNull(),
  stage: text("stage").notNull(),
  item: text("item").notNull(),
  done: boolean("done").notNull().default(false),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull().default("prompt"),
  buildType: text("buildType").notNull().default("general"),
  content: text("content").notNull().default(""),
  tags: text("tags").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  channel: text("channel").notNull().default("linkedin"),
  status: text("status").notNull().default("new"),
  lastTouch: timestamp("lastTouch"),
  nextFollowUp: timestamp("nextFollowUp"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const artifacts = pgTable("artifacts", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  dealId: integer("dealId"),
  type: text("type").notNull().default("proposal"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// --- FDE Prep tables ---------------------------------------------------------

export const topics = pgTable("topics", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  track: text("track").notNull().default("system-design"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  priority: integer("priority").notNull().default(2),
  status: text("status").notNull().default("not-started"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const studySessions = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  topicId: integer("topicId"),
  weekStart: date("weekStart").notNull(),
  day: text("day").notNull().default("mon"),
  plannedMinutes: integer("plannedMinutes").notNull().default(60),
  actualMinutes: integer("actualMinutes").notNull().default(0),
  focus: text("focus").notNull().default(""),
  done: boolean("done").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const drills = pgTable("drills", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  topicId: integer("topicId"),
  question: text("question").notNull(),
  answer: text("answer").notNull().default(""),
  difficulty: text("difficulty").notNull().default("medium"),
  status: text("status").notNull().default("unanswered"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  topicId: integer("topicId"),
  title: text("title").notNull(),
  url: text("url").notNull().default(""),
  kind: text("kind").notNull().default("article"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- LinkedIn OS tables -------------------------------------------------------
// claimStatus and status also have DB-level CHECK constraints (applied via Neon MCP).

export const trendItems = pgTable("trend_items", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  source: text("source").notNull().default("manual"),
  url: text("url").notNull().default(""),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  used: boolean("used").notNull().default(false),
  discoveredAt: timestamp("discoveredAt").notNull().defaultNow(),
})

export const writingSamples = pgTable("writing_samples", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  sampleText: text("sampleText").notNull(),
  tag: text("tag").notNull().default(""),
  addedAt: timestamp("addedAt").notNull().defaultNow(),
})

export const voicePreferences = pgTable("voice_preferences", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  preferenceText: text("preferenceText").notNull(),
  source: text("source").notNull().default("manual"),
  active: boolean("active").notNull().default(true),
  addedAt: timestamp("addedAt").notNull().defaultNow(),
})

export const linkedinPosts = pgTable("linkedin_posts", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  trendItemId: integer("trendItemId"),
  claimStatus: text("claimStatus").notNull().default("insight"),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("pending_review"),
  reviewedAt: timestamp("reviewedAt"),
  scheduledFor: timestamp("scheduledFor"),
  postedAt: timestamp("postedAt"),
  linkedinPostId: text("linkedinPostId"),
  likeCount: integer("likeCount"),
  commentCount: integer("commentCount"),
  shareCount: integer("shareCount"),
  impressionCount: integer("impressionCount"),
  metricsUpdatedAt: timestamp("metricsUpdatedAt"),
  metricsSource: text("metricsSource").notNull().default("manual"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const draftRevisions = pgTable("draft_revisions", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  postId: integer("postId").notNull(),
  revisionNumber: integer("revisionNumber").notNull(),
  content: text("content").notNull(),
  editedBy: text("editedBy").notNull().default("owner"),
  editedAt: timestamp("editedAt").notNull().defaultNow(),
})

export const postChatMessages = pgTable("post_chat_messages", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  postId: integer("postId").notNull(),
  role: text("role").notNull().default("owner"),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  type: text("type").notNull().default("new_draft"),
  relatedPostId: integer("relatedPostId"),
  message: text("message").notNull(),
  channel: text("channel").notNull().default("in_app"),
  delivered: boolean("delivered").notNull().default(true),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- YouTube Pipeline + Ad Creative Engine (additive, text PKs per PRD) ---------
// status/state columns carry DB-level CHECK constraints (applied via Neon MCP).
// Deferred (schema note only, do not build): multi-tenant, RAG, OpenClaw.

export const youtubeChannels = pgTable("youtube_channels", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  channelName: text("channelName").notNull(),
  youtubeChannelId: text("youtubeChannelId").notNull().default(""),
  oauthRefreshToken: text("oauthRefreshToken"), // AES-256-GCM encrypted, lib/crypto.ts
  oauthAccessToken: text("oauthAccessToken"),
  oauthTokenExpiry: timestamp("oauthTokenExpiry"),
  status: text("status").notNull().default("needs_reauth"), // connected | needs_reauth | disabled
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const pipelineSettings = pgTable("pipeline_settings", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  contentDomain: text("contentDomain").notNull().default(""),
  toneVoiceNotes: text("toneVoiceNotes").notNull().default(""),
  redFlagTerms: text("redFlagTerms").notNull().default(""),
  defaultBypassApproval: boolean("defaultBypassApproval").notNull().default(false),
  videoFormatDefault: text("videoFormatDefault").notNull().default("shorts"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const videoProjects = pgTable("video_projects", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  channelId: text("channelId").notNull(),
  topic: text("topic").notNull(),
  premise: text("premise").notNull().default(""),
  status: text("status").notNull().default("draft"), // state machine §3 of PRD
  videoFormat: text("videoFormat").notNull().default("shorts"),
  batchId: text("batchId"),
  bypassApproval: boolean("bypassApproval").notNull().default(false),
  autoPublished: boolean("autoPublished").notNull().default(false),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const videoScripts = pgTable("video_scripts", {
  id: text("id").primaryKey(),
  videoProjectId: text("videoProjectId").notNull(),
  revisionNumber: integer("revisionNumber").notNull(),
  scriptText: text("scriptText").notNull(),
  shotBreakdown: text("shotBreakdown").notNull().default(""),
  createdBy: text("createdBy").notNull().default("ai"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const generationJobs = pgTable("generation_jobs", {
  id: text("id").primaryKey(),
  videoProjectId: text("videoProjectId").notNull(),
  higgsfieldJobId: text("higgsfieldJobId"),
  promptSent: text("promptSent").notNull().default(""),
  status: text("status").notNull().default("submitted"), // submitted | polling | complete | failed
  outputUrlTemp: text("outputUrlTemp"),
  blobUrl: text("blobUrl"),
  lastPolledAt: timestamp("lastPolledAt"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const youtubeVideos = pgTable("youtube_videos", {
  id: text("id").primaryKey(),
  videoProjectId: text("videoProjectId").notNull(),
  channelId: text("channelId").notNull(),
  youtubeVideoId: text("youtubeVideoId"),
  title: text("title").notNull().default(""),
  description: text("description").notNull().default(""),
  tags: text("tags").notNull().default(""),
  thumbnailBlobUrl: text("thumbnailBlobUrl"),
  uploadStatus: text("uploadStatus").notNull().default("pending"), // pending | uploading | published | failed
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const youtubeMetrics = pgTable("youtube_metrics", {
  id: text("id").primaryKey(),
  youtubeVideoId: text("youtubeVideoId").notNull(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  watchTimeMinutes: integer("watchTimeMinutes").notNull().default(0),
  polledAt: timestamp("polledAt").notNull().defaultNow(), // append-only snapshots, never update
})

export const adCreatives = pgTable("ad_creatives", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  dealId: text("dealId"), // attaches to existing deals, same nullable pattern as artifacts
  creativeType: text("creativeType").notNull().default("ad_video"), // ad_video | ugc_style | testimonial_style
  premise: text("premise").notNull().default(""),
  script: text("script").notNull().default(""),
  generationJobId: text("generationJobId"),
  outputBlobUrl: text("outputBlobUrl"),
  status: text("status").notNull().default("draft"), // draft | generated | delivered
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// Named os_chat_messages in DB to avoid collision with LinkedIn OS post_chat_messages.
export const osChatMessages = pgTable("os_chat_messages", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  channel: text("channel").notNull().default("web"), // web | telegram
  role: text("role").notNull(), // user | assistant
  content: text("content").notNull(),
  sqlExecuted: text("sqlExecuted"), // audit trail of the actual query run
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const editRequests = pgTable("edit_requests", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  videoProjectId: text("videoProjectId").notNull(),
  sourceType: text("sourceType").notNull().default("generation_job"), // generation_job | ad_creative
  sourceBlobUrl: text("sourceBlobUrl").notNull().default(""),
  editPrompt: text("editPrompt").notNull(),
  remotionSpec: text("remotionSpec").notNull().default(""), // constrained JSON spec, not arbitrary code
  status: text("status").notNull().default("submitted"), // submitted | rendering | complete | failed
  outputBlobUrl: text("outputBlobUrl"),
  renderJobId: text("renderJobId"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const editVersions = pgTable("edit_versions", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  videoProjectId: text("videoProjectId").notNull(),
  versionNumber: integer("versionNumber").notNull(),
  editRequestId: text("editRequestId").notNull(),
  blobUrl: text("blobUrl").notNull(),
  isCurrent: boolean("isCurrent").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Career Intelligence subsystem (additive, text PKs, doc 02 of PRD pack) ------
// Status columns carry DB-level CHECK constraints (applied via Neon MCP).
// Comma-separated text lists (not arrays/JSON) match existing conventions;
// `extra` on career_settings is a JSON-string escape hatch for future settings.

export const careerSettings = pgTable("career_settings", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  enabledRoleFamilies: text("enabledRoleFamilies").notNull().default(""), // comma-separated
  enabledGeographies: text("enabledGeographies").notNull().default(""),
  remotePreferences: text("remotePreferences").notNull().default(""),
  compFloorDomesticINR: integer("compFloorDomesticINR").notNull().default(3000000),
  compStretchDomesticINR: integer("compStretchDomesticINR").notNull().default(7500000),
  compFloorIntlMonthly: integer("compFloorIntlMonthly").notNull().default(5000),
  compStretchIntlMonthly: integer("compStretchIntlMonthly").notNull().default(10000),
  compIntlCurrency: text("compIntlCurrency").notNull().default("USD"),
  companyAllowlist: text("companyAllowlist").notNull().default(""),
  companyDenylist: text("companyDenylist").notNull().default(""),
  portfolioUrl: text("portfolioUrl").notNull().default(""), // omit from prompts when empty (Task 0.7)
  portfolioLive: boolean("portfolioLive").notNull().default(false),
  autoTailorOnMatch: boolean("autoTailorOnMatch").notNull().default(false),
  autoSendOutreach: boolean("autoSendOutreach").notNull().default(false),
  autoSubmitApplications: boolean("autoSubmitApplications").notNull().default(false),
  autoShortlistThreshold: numeric("autoShortlistThreshold", { precision: 2, scale: 1 }).notNull().default("3.5"),
  batchSizeLimit: integer("batchSizeLimit").notNull().default(5),
  redFlagTerms: text("redFlagTerms").notNull().default(""),
  toneVoiceNotes: text("toneVoiceNotes").notNull().default(""),
  dailyColdEmailLimit: integer("dailyColdEmailLimit").notNull().default(10),
  followUpCadenceDays: integer("followUpCadenceDays").notNull().default(5),
  extra: text("extra").notNull().default("{}"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const jobApplications = pgTable("job_applications", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  company: text("company").notNull(),
  roleTitle: text("roleTitle").notNull(),
  roleFamily: text("roleFamily").notNull().default(""), // fde | ai_pm | genai_arch | solutions
  archetype: text("archetype").notNull().default(""),
  jobUrl: text("jobUrl").notNull().default(""),
  portalSource: text("portalSource").notNull().default(""),
  geography: text("geography").notNull().default(""),
  compensationRange: text("compensationRange").notNull().default(""),
  jobDescription: text("jobDescription").notNull().default(""),
  // state machine: discovered → evaluating → evaluated → shortlisted → tailored →
  // outreach_prepared → pending_approval | auto_approved → applied → responded →
  // interview → offer; terminal: rejected, discarded, skip
  status: text("status").notNull().default("discovered"),
  evaluationScore: numeric("evaluationScore", { precision: 2, scale: 1 }),
  legitimacyTier: text("legitimacyTier"), // high_confidence | proceed_with_caution | suspicious
  legitimacySignals: text("legitimacySignals"),
  extractedKeywords: text("extractedKeywords"),
  evaluationReportId: text("evaluationReportId"),
  bypassApproval: boolean("bypassApproval").notNull().default(false),
  autoSubmitted: boolean("autoSubmitted").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const evaluationReports = pgTable("evaluation_reports", {
  id: text("id").primaryKey(),
  jobApplicationId: text("jobApplicationId").notNull(),
  blockA_roleSummary: text("blockA_roleSummary").notNull().default(""),
  blockB_cvMatch: text("blockB_cvMatch").notNull().default(""),
  blockC_levelStrategy: text("blockC_levelStrategy").notNull().default(""),
  blockD_compDemand: text("blockD_compDemand").notNull().default(""),
  blockE_personalizationPlan: text("blockE_personalizationPlan").notNull().default(""),
  blockF_interviewPlan: text("blockF_interviewPlan").notNull().default(""),
  blockH_draftAnswers: text("blockH_draftAnswers"), // Block G (portal snapshot) lives with browser worker
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const interviewStories = pgTable("interview_stories", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  situation: text("situation").notNull().default(""),
  task: text("task").notNull().default(""),
  action: text("action").notNull().default(""),
  result: text("result").notNull().default(""),
  reflection: text("reflection").notNull().default(""),
  relatedRequirementTags: text("relatedRequirementTags").notNull().default(""),
  usedInJobApplicationIds: text("usedInJobApplicationIds").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const scanHistory = pgTable("scan_history", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  url: text("url").notNull(), // dedup key per user
  firstSeen: timestamp("firstSeen").notNull().defaultNow(),
  portalSource: text("portalSource").notNull().default(""),
  status: text("status").notNull().default("added"), // added | skipped_title | skipped_dup | skipped_expired
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const companyResearch = pgTable("company_research", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  company: text("company").notNull(),
  researchNotes: text("researchNotes").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const careerContacts = pgTable("contacts", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  jobApplicationId: text("jobApplicationId"),
  company: text("company").notNull(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("recruiter"), // recruiter | hiring_manager | peer | interviewer
  source: text("source").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const outreachMessages = pgTable("outreach_messages", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  contactId: text("contactId").notNull(),
  jobApplicationId: text("jobApplicationId"),
  messageType: text("messageType").notNull().default("cold_email"), // cold_email | linkedin_message | recruiter_email
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("draft"), // draft | approved | sent | responded
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const resumes = pgTable("resumes", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  label: text("label").notNull(), // e.g. "FDE Master", "AI PM Master"
  baseContent: text("baseContent").notNull().default(""), // markdown master resume
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const resumeVersions = pgTable("resume_versions", {
  id: text("id").primaryKey(),
  resumeId: text("resumeId").notNull(),
  jobApplicationId: text("jobApplicationId"), // null = master edit, set = tailored version
  versionNumber: integer("versionNumber").notNull(),
  content: text("content").notNull().default(""),
  changeExplanation: text("changeExplanation").notNull().default(""), // required audit trail per doc 04
  atsKeywordScore: integer("atsKeywordScore"), // 0-100 deterministic coverage
  atsKeywordsMatched: text("atsKeywordsMatched").notNull().default(""),
  atsKeywordsMissing: text("atsKeywordsMissing").notNull().default(""),
  pdfBlobUrl: text("pdfBlobUrl"), // set by browser-worker PDF render when configured
  isCurrent: boolean("isCurrent").notNull().default(true),
  createdBy: text("createdBy").notNull().default("ai"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const coverLetters = pgTable("cover_letters", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  jobApplicationId: text("jobApplicationId").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const coverLetterVersions = pgTable("cover_letter_versions", {
  id: text("id").primaryKey(),
  coverLetterId: text("coverLetterId").notNull(),
  versionNumber: integer("versionNumber").notNull(),
  content: text("content").notNull().default(""),
  changeExplanation: text("changeExplanation").notNull().default(""),
  pdfBlobUrl: text("pdfBlobUrl"),
  isCurrent: boolean("isCurrent").notNull().default(true),
  createdBy: text("createdBy").notNull().default("ai"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Connected accounts (Google Calendar OAuth for Jarvis) -------------------
// Tokens encrypted at rest via lib/crypto.ts, same pattern as youtube_channels.

export const connectedAccounts = pgTable("connected_accounts", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  provider: text("provider").notNull(), // google_calendar
  accountEmail: text("accountEmail").notNull().default(""),
  accessToken: text("accessToken"), // encrypted
  refreshToken: text("refreshToken"), // encrypted
  tokenExpiry: timestamp("tokenExpiry"),
  status: text("status").notNull().default("connected"), // connected | revoked | error
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// --- Money OS (autopay guardian) ---------------------------------------------
// SECURITY DESIGN: payment_instruments stores METADATA ONLY — label, issuer,
// last 4 digits, UPI handle. Never full card numbers, CVVs, PINs, or bank
// credentials. Cancellation is playbook-driven (no consumer API exists for
// mandate revocation in India); the AA framework seam can be added later.

export const paymentInstruments = pgTable("payment_instruments", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  label: text("label").notNull(), // e.g. "HDFC Debit", "Tata Neu Infinity CC"
  instrumentType: text("instrumentType").notNull(), // debit_card | credit_card | upi | bank_account
  issuer: text("issuer").notNull().default(""), // HDFC | Kotak | SBI | ...
  network: text("network").notNull().default(""), // Visa | RuPay | Mastercard
  lastFour: text("lastFour").notNull().default(""),
  upiHandle: text("upiHandle").notNull().default(""),
  notes: text("notes").notNull().default(""),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Settings Hub (central configuration) ------------------------------------
// app_config: per-user JSON config store (general prefs, agent configs, funnel
// seams). api_keys: BYO API keys, AES-encrypted via lib/crypto.ts; resolution
// order everywhere is DB key -> env var fallback (see lib/config.ts).

export const appConfig = pgTable("app_config", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  key: text("key").notNull(), // e.g. "leadgen", "funnels.meta_ads", "general"
  value: jsonb("value").notNull().default({}),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  provider: text("provider").notNull(), // openrouter | tavily | brave | serper | google_maps | meta_ads
  label: text("label").notNull().default(""),
  encryptedKey: text("encryptedKey").notNull(), // AES-encrypted via lib/crypto.ts
  lastFour: text("lastFour").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// --- Lead-Gen Agent (Freelance Funnel automation) -----------------------------
// Prospects are discovered + AI-qualified, then promoted into the existing
// leads table (additive: the funnel pipeline itself is untouched).

export const leadgenProspects = pgTable("leadgen_prospects", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  source: text("source").notNull().default("maps_no_website"), // maps_no_website | ai_upgrade | manual_seed
  businessName: text("businessName").notNull(),
  category: text("category").notNull().default(""),
  location: text("location").notNull().default(""),
  phone: text("phone").notNull().default(""),
  website: text("website").notNull().default(""),
  mapsUrl: text("mapsUrl").notNull().default(""),
  signals: text("signals").notNull().default(""), // raw discovery signals
  aiScore: integer("aiScore"), // 0-100 qualification score
  aiRationale: text("aiRationale").notNull().default(""),
  pitchAngle: text("pitchAngle").notNull().default(""),
  status: text("status").notNull().default("discovered"), // discovered | qualified | promoted | rejected
  promotedLeadId: integer("promotedLeadId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const leadgenRuns = pgTable("leadgen_runs", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  trigger: text("trigger").notNull().default("manual"), // manual | cron
  source: text("source").notNull().default("maps_no_website"),
  query: text("query").notNull().default(""),
  prospectsFound: integer("prospectsFound").notNull().default(0),
  prospectsQualified: integer("prospectsQualified").notNull().default(0),
  status: text("status").notNull().default("completed"), // running | completed | failed
  errorMessage: text("errorMessage").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// --- Jarvis orchestrator (god-mode) -------------------------------------------
// jarvis_actions: audit log of every mutating action Jarvis performs.
// jarvis_lessons: self-improvement memory — active lessons are injected into
// Jarvis's system prompt on every chat, so corrections persist across sessions.

export const jarvisActions = pgTable("jarvis_actions", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  tool: text("tool").notNull(), // which tool performed the mutation
  summary: text("summary").notNull().default(""),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const jarvisLessons = pgTable("jarvis_lessons", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  category: text("category").notNull().default("general"), // general | linkedin | youtube | leadgen | career | money
  lesson: text("lesson").notNull(),
  source: text("source").notNull().default("user_feedback"), // user_feedback | self_reflection
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const autopays = pgTable("autopays", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  instrumentId: text("instrumentId"),
  merchant: text("merchant").notNull(),
  description: text("description").notNull().default(""),
  rail: text("rail").notNull().default("upi_mandate"), // upi_mandate | card_si | enach | wallet | other
  amountINR: numeric("amountINR", { precision: 12, scale: 2 }),
  cadence: text("cadence").notNull().default("monthly"), // weekly | monthly | quarterly | yearly | adhoc
  nextChargeDate: date("nextChargeDate"),
  status: text("status").notNull().default("active"), // active | cancel_requested | cancelled | paused
  reminderDaysBefore: integer("reminderDaysBefore").notNull().default(3),
  lastRemindedAt: timestamp("lastRemindedAt"),
  cancellationNotes: text("cancellationNotes").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// --- Arsenal: skills + automations (Jarvis's extensible capability layer) -----
// skills: ingested capability modules (from the curated pack, uploaded zips of
// SKILL.md files, or Jarvis itself). Active skills whose targetAgents include
// an agent key are injected into that agent's system prompt at run time —
// deterministic lookup, no classifier (same philosophy as model routing).
// automations: imported workflow definitions (n8n JSON). Analyzed by Jarvis
// (heavy tier) into a structured summary + absorbable capabilities; runnable
// against a real n8n instance when the seam is configured.

export const skills = pgTable("skills", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  content: text("content").notNull(), // the skill body — prompt rules/templates/heuristics
  source: text("source").notNull().default("manual"), // curated_pack | zip | manual | jarvis | repo
  tags: text("tags").notNull().default(""), // comma-separated
  targetAgents: text("targetAgents").notNull().default(""), // comma-separated AgentKeys; empty = library-only
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const automations = pgTable("automations", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull().default("n8n"), // n8n (future: make, zapier)
  definition: jsonb("definition").notNull().default({}), // the raw workflow JSON
  analysis: jsonb("analysis").notNull().default({}), // Jarvis analysis: summary, nodes, absorbable capabilities
  status: text("status").notNull().default("imported"), // imported | analyzed | deployed
  n8nWorkflowId: text("n8nWorkflowId"), // id on the connected n8n instance once deployed
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const automationRuns = pgTable("automation_runs", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  automationId: text("automationId").notNull(),
  trigger: text("trigger").notNull().default("manual"), // manual | jarvis
  status: text("status").notNull().default("started"), // started | succeeded | failed
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// secret_access_log: audit trail for the secrets-hardening pass — every read,
// write, or delete of a vaulted API key is recorded here (provider + action +
// caller only, NEVER the secret value). Closes the real gap AES-in-Postgres
// has vs a dedicated secrets manager: visibility into who/what touched a
// secret and when.
export const secretAccessLog = pgTable("secret_access_log", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  provider: text("provider").notNull(),
  action: text("action").notNull(), // read | write | delete
  source: text("source").notNull().default(""), // calling code path, e.g. "leadgen.qualify"
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
