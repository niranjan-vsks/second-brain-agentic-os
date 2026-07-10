export interface Deal {
  id: number
  userId: string
  name: string
  client: string
  stage: string
  buildType: string
  value: number
  notes: string
  nextAction: string
  createdAt: Date
  updatedAt: Date
}

export interface ChecklistItem {
  id: number
  userId: string
  dealId: number
  stage: string
  item: string
  done: boolean
  sortOrder: number
  createdAt: Date
}

export interface Asset {
  id: number
  userId: string
  title: string
  category: string
  buildType: string
  content: string
  tags: string
  createdAt: Date
  updatedAt: Date
}

export interface Lead {
  id: number
  userId: string
  name: string
  company: string
  channel: string
  status: string
  lastTouch: Date | null
  nextFollowUp: Date | null
  notes: string
  createdAt: Date
  updatedAt: Date
}

export interface Artifact {
  id: number
  userId: string
  dealId: number | null
  type: string
  title: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface Topic {
  id: number
  userId: string
  track: string
  title: string
  description: string
  priority: number
  status: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface StudySession {
  id: number
  userId: string
  topicId: number | null
  weekStart: string
  day: string
  plannedMinutes: number
  actualMinutes: number
  focus: string
  done: boolean
  createdAt: Date
}

export interface Drill {
  id: number
  userId: string
  topicId: number | null
  question: string
  answer: string
  difficulty: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface Resource {
  id: number
  userId: string
  topicId: number | null
  title: string
  url: string
  kind: string
  notes: string
  createdAt: Date
}

// --- LinkedIn OS ---------------------------------------------------------

export type ClaimStatus = "shipped" | "piloting" | "building" | "concept" | "insight" | "commentary"
export type PostStatus = "pending_review" | "approved" | "scheduled" | "posted" | "rejected"

export interface TrendItem {
  id: number
  userId: string
  source: string
  url: string
  title: string
  summary: string
  used: boolean
  discoveredAt: Date
}

export interface WritingSample {
  id: number
  userId: string
  sampleText: string
  tag: string
  addedAt: Date
}

export interface VoicePreference {
  id: number
  userId: string
  preferenceText: string
  source: string
  active: boolean
  addedAt: Date
}

export interface LinkedinPost {
  id: number
  userId: string
  trendItemId: number | null
  claimStatus: string
  content: string
  status: string
  reviewedAt: Date | null
  scheduledFor: Date | null
  postedAt: Date | null
  linkedinPostId: string | null
  likeCount: number | null
  commentCount: number | null
  shareCount: number | null
  impressionCount: number | null
  metricsUpdatedAt: Date | null
  metricsSource: string
  createdAt: Date
  updatedAt: Date
}

export interface DraftRevision {
  id: number
  userId: string
  postId: number
  revisionNumber: number
  content: string
  editedBy: string
  editedAt: Date
}

export interface PostChatMessage {
  id: number
  userId: string
  postId: number
  role: string
  content: string
  createdAt: Date
}

export interface AppNotification {
  id: number
  userId: string
  type: string
  relatedPostId: number | null
  message: string
  channel: string
  delivered: boolean
  read: boolean
  createdAt: Date
}

// --- YouTube Pipeline + Ad Creative Engine -------------------------------

export type VideoProjectStatus =
  | "draft"
  | "scripting"
  | "script_ready"
  | "prompt_ready"
  | "generating"
  | "generated"
  | "pending_approval"
  | "auto_approved"
  | "uploading"
  | "published"
  | "failed"
  | "rejected"

export interface YoutubeChannel {
  id: string
  userId: string
  channelName: string
  youtubeChannelId: string
  oauthRefreshToken: string | null
  oauthAccessToken: string | null
  oauthTokenExpiry: Date | null
  status: string
  createdAt: Date
}

export interface PipelineSettings {
  id: string
  userId: string
  contentDomain: string
  toneVoiceNotes: string
  redFlagTerms: string
  defaultBypassApproval: boolean
  videoFormatDefault: string
  updatedAt: Date
}

export interface VideoProject {
  id: string
  userId: string
  channelId: string
  topic: string
  premise: string
  status: string
  videoFormat: string
  batchId: string | null
  bypassApproval: boolean
  autoPublished: boolean
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

export interface VideoScript {
  id: string
  videoProjectId: string
  revisionNumber: number
  scriptText: string
  shotBreakdown: string
  createdBy: string
  createdAt: Date
}

export interface GenerationJob {
  id: string
  videoProjectId: string
  higgsfieldJobId: string | null
  promptSent: string
  status: string
  outputUrlTemp: string | null
  blobUrl: string | null
  lastPolledAt: Date | null
  errorMessage: string | null
  createdAt: Date
}

export interface YoutubeVideoRow {
  id: string
  videoProjectId: string
  channelId: string
  youtubeVideoId: string | null
  title: string
  description: string
  tags: string
  thumbnailBlobUrl: string | null
  uploadStatus: string
  publishedAt: Date | null
  createdAt: Date
}

export interface YoutubeMetric {
  id: string
  youtubeVideoId: string
  views: number
  likes: number
  comments: number
  watchTimeMinutes: number
  polledAt: Date
}

export interface AdCreative {
  id: string
  userId: string
  dealId: string | null
  creativeType: string
  premise: string
  script: string
  generationJobId: string | null
  outputBlobUrl: string | null
  status: string
  createdAt: Date
}

export interface OsChatMessage {
  id: string
  userId: string
  channel: string
  role: string
  content: string
  sqlExecuted: string | null
  createdAt: Date
}

export interface EditRequest {
  id: string
  userId: string
  videoProjectId: string
  sourceType: string
  sourceBlobUrl: string
  editPrompt: string
  remotionSpec: string
  status: string
  outputBlobUrl: string | null
  renderJobId: string | null
  errorMessage: string | null
  createdAt: Date
}

export interface EditVersion {
  id: string
  userId: string
  videoProjectId: string
  versionNumber: number
  editRequestId: string
  blobUrl: string
  isCurrent: boolean
  createdAt: Date
}

// --- Career Intelligence subsystem ---------------------------------------

export type JobApplicationStatus =
  | "discovered"
  | "evaluating"
  | "evaluated"
  | "shortlisted"
  | "tailored"
  | "outreach_prepared"
  | "pending_approval"
  | "auto_approved"
  | "applied"
  | "responded"
  | "interview"
  | "offer"
  | "rejected"
  | "discarded"
  | "skip"

export interface CareerSettings {
  id: string
  userId: string
  enabledRoleFamilies: string
  enabledGeographies: string
  remotePreferences: string
  compFloorDomesticINR: number
  compStretchDomesticINR: number
  compFloorIntlMonthly: number
  compStretchIntlMonthly: number
  compIntlCurrency: string
  companyAllowlist: string
  companyDenylist: string
  portfolioUrl: string
  portfolioLive: boolean
  autoTailorOnMatch: boolean
  autoSendOutreach: boolean
  autoSubmitApplications: boolean
  autoShortlistThreshold: string
  batchSizeLimit: number
  redFlagTerms: string
  toneVoiceNotes: string
  dailyColdEmailLimit: number
  followUpCadenceDays: number
  extra: string
  updatedAt: Date
}

export interface JobApplication {
  id: string
  userId: string
  company: string
  roleTitle: string
  roleFamily: string
  archetype: string
  jobUrl: string
  portalSource: string
  geography: string
  compensationRange: string
  jobDescription: string
  status: string
  evaluationScore: string | null
  legitimacyTier: string | null
  legitimacySignals: string | null
  extractedKeywords: string | null
  evaluationReportId: string | null
  bypassApproval: boolean
  autoSubmitted: boolean
  createdAt: Date
  updatedAt: Date
}

export interface EvaluationReport {
  id: string
  jobApplicationId: string
  blockA_roleSummary: string
  blockB_cvMatch: string
  blockC_levelStrategy: string
  blockD_compDemand: string
  blockE_personalizationPlan: string
  blockF_interviewPlan: string
  blockH_draftAnswers: string | null
  createdAt: Date
}

export interface InterviewStory {
  id: string
  userId: string
  situation: string
  task: string
  action: string
  result: string
  reflection: string
  relatedRequirementTags: string
  usedInJobApplicationIds: string
  createdAt: Date
}

export interface ScanHistoryEntry {
  id: string
  userId: string
  url: string
  firstSeen: Date
  portalSource: string
  status: string
  createdAt: Date
}

export interface CompanyResearchNote {
  id: string
  userId: string
  company: string
  researchNotes: string
  createdAt: Date
}

export interface CareerContact {
  id: string
  userId: string
  jobApplicationId: string | null
  company: string
  name: string
  role: string
  source: string
  createdAt: Date
}

export interface OutreachMessage {
  id: string
  userId: string
  contactId: string
  jobApplicationId: string | null
  messageType: string
  content: string
  status: string
  sentAt: Date | null
  createdAt: Date
}

export interface Resume {
  id: string
  userId: string
  label: string
  baseContent: string
  createdAt: Date
}

export interface ResumeVersion {
  id: string
  resumeId: string
  jobApplicationId: string | null
  versionNumber: number
  content: string
  changeExplanation: string
  atsKeywordScore: number | null
  atsKeywordsMatched: string
  atsKeywordsMissing: string
  pdfBlobUrl: string | null
  isCurrent: boolean
  createdBy: string
  createdAt: Date
}

export interface CoverLetter {
  id: string
  userId: string
  jobApplicationId: string
  createdAt: Date
}

export interface CoverLetterVersion {
  id: string
  coverLetterId: string
  versionNumber: number
  content: string
  changeExplanation: string
  pdfBlobUrl: string | null
  isCurrent: boolean
  createdBy: string
  createdAt: Date
}

// --- Money OS (autopay guardian) ---------------------------------------------

export interface PaymentInstrument {
  id: string
  userId: string
  label: string
  instrumentType: string // debit_card | credit_card | upi | bank_account
  issuer: string
  network: string
  lastFour: string
  upiHandle: string
  notes: string
  isActive: boolean
  createdAt: Date
}

export interface Autopay {
  id: string
  userId: string
  instrumentId: string | null
  merchant: string
  description: string
  rail: string // upi_mandate | card_si | enach | wallet | other
  amountINR: string | null
  cadence: string // weekly | monthly | quarterly | yearly | adhoc
  nextChargeDate: string | null
  status: string // active | cancel_requested | cancelled | paused
  reminderDaysBefore: number
  lastRemindedAt: Date | null
  cancellationNotes: string
  createdAt: Date
  updatedAt: Date
}

export interface ConnectedAccount {
  id: string
  userId: string
  provider: string
  accountEmail: string
  status: string
  createdAt: Date
  updatedAt: Date
}
