-- =============================================================================
-- second-brain-os · complete database setup
-- Run this entire file once in the Neon SQL editor (or any Postgres client).
-- All statements use CREATE TABLE IF NOT EXISTS — safe to re-run.
-- Order matters: Better Auth tables first (auth FKs reference "user"),
-- then app tables, then LinkedIn OS tables.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Better Auth — required tables (do NOT rename any column)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "user" (
  "id"            text        PRIMARY KEY,
  "name"          text        NOT NULL,
  "email"         text        NOT NULL UNIQUE,
  "emailVerified" boolean     NOT NULL DEFAULT false,
  "image"         text,
  "createdAt"     timestamp   NOT NULL DEFAULT now(),
  "updatedAt"     timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"          text        PRIMARY KEY,
  "expiresAt"   timestamp   NOT NULL,
  "token"       text        NOT NULL UNIQUE,
  "createdAt"   timestamp   NOT NULL DEFAULT now(),
  "updatedAt"   timestamp   NOT NULL DEFAULT now(),
  "ipAddress"   text,
  "userAgent"   text,
  "userId"      text        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                     text        PRIMARY KEY,
  "accountId"              text        NOT NULL,
  "providerId"             text        NOT NULL,
  "userId"                 text        NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken"            text,
  "refreshToken"           text,
  "idToken"                text,
  "accessTokenExpiresAt"   timestamp,
  "refreshTokenExpiresAt"  timestamp,
  "scope"                  text,
  "password"               text,
  "createdAt"              timestamp   NOT NULL DEFAULT now(),
  "updatedAt"              timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"          text        PRIMARY KEY,
  "identifier"  text        NOT NULL,
  "value"       text        NOT NULL,
  "expiresAt"   timestamp   NOT NULL,
  "createdAt"   timestamp   DEFAULT now(),
  "updatedAt"   timestamp   DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 2. Freelance Funnel
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "deals" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "name"        text        NOT NULL,
  "client"      text        NOT NULL DEFAULT '',
  "stage"       text        NOT NULL DEFAULT 'lead',
  "buildType"   text        NOT NULL DEFAULT 'custom',
  "value"       integer     NOT NULL DEFAULT 0,
  "notes"       text        NOT NULL DEFAULT '',
  "nextAction"  text        NOT NULL DEFAULT '',
  "createdAt"   timestamp   NOT NULL DEFAULT now(),
  "updatedAt"   timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "deal_checklist" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "dealId"      integer     NOT NULL,
  "stage"       text        NOT NULL,
  "item"        text        NOT NULL,
  "done"        boolean     NOT NULL DEFAULT false,
  "sortOrder"   integer     NOT NULL DEFAULT 0,
  "createdAt"   timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "assets" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "title"       text        NOT NULL,
  "category"    text        NOT NULL DEFAULT 'prompt',
  "buildType"   text        NOT NULL DEFAULT 'general',
  "content"     text        NOT NULL DEFAULT '',
  "tags"        text        NOT NULL DEFAULT '',
  "createdAt"   timestamp   NOT NULL DEFAULT now(),
  "updatedAt"   timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "leads" (
  "id"            serial      PRIMARY KEY,
  "userId"        text        NOT NULL,
  "name"          text        NOT NULL,
  "company"       text        NOT NULL DEFAULT '',
  "channel"       text        NOT NULL DEFAULT 'linkedin',
  "status"        text        NOT NULL DEFAULT 'new',
  "lastTouch"     timestamp,
  "nextFollowUp"  timestamp,
  "notes"         text        NOT NULL DEFAULT '',
  "createdAt"     timestamp   NOT NULL DEFAULT now(),
  "updatedAt"     timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "artifacts" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "dealId"      integer,
  "type"        text        NOT NULL DEFAULT 'proposal',
  "title"       text        NOT NULL,
  "content"     text        NOT NULL DEFAULT '',
  "createdAt"   timestamp   NOT NULL DEFAULT now(),
  "updatedAt"   timestamp   NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 3. FDE Prep
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "topics" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "track"       text        NOT NULL DEFAULT 'system-design',
  "title"       text        NOT NULL,
  "description" text        NOT NULL DEFAULT '',
  "priority"    integer     NOT NULL DEFAULT 2,
  "status"      text        NOT NULL DEFAULT 'not-started',
  "sortOrder"   integer     NOT NULL DEFAULT 0,
  "createdAt"   timestamp   NOT NULL DEFAULT now(),
  "updatedAt"   timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "study_sessions" (
  "id"              serial      PRIMARY KEY,
  "userId"          text        NOT NULL,
  "topicId"         integer,
  "weekStart"       date        NOT NULL,
  "day"             text        NOT NULL DEFAULT 'mon',
  "plannedMinutes"  integer     NOT NULL DEFAULT 60,
  "actualMinutes"   integer     NOT NULL DEFAULT 0,
  "focus"           text        NOT NULL DEFAULT '',
  "done"            boolean     NOT NULL DEFAULT false,
  "createdAt"       timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "drills" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "topicId"     integer,
  "question"    text        NOT NULL,
  "answer"      text        NOT NULL DEFAULT '',
  "difficulty"  text        NOT NULL DEFAULT 'medium',
  "status"      text        NOT NULL DEFAULT 'unanswered',
  "createdAt"   timestamp   NOT NULL DEFAULT now(),
  "updatedAt"   timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "resources" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "topicId"     integer,
  "title"       text        NOT NULL,
  "url"         text        NOT NULL DEFAULT '',
  "kind"        text        NOT NULL DEFAULT 'article',
  "notes"       text        NOT NULL DEFAULT '',
  "createdAt"   timestamp   NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------------------
-- 4. LinkedIn OS
-- claimStatus and status have CHECK constraints so the DB itself enforces
-- the state machine — not just the application layer.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "trend_items" (
  "id"            serial      PRIMARY KEY,
  "userId"        text        NOT NULL,
  "source"        text        NOT NULL DEFAULT 'manual',
  "url"           text        NOT NULL DEFAULT '',
  "title"         text        NOT NULL,
  "summary"       text        NOT NULL DEFAULT '',
  "used"          boolean     NOT NULL DEFAULT false,
  "discoveredAt"  timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "writing_samples" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "sampleText"  text        NOT NULL,
  "tag"         text        NOT NULL DEFAULT '',
  "addedAt"     timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "voice_preferences" (
  "id"                serial      PRIMARY KEY,
  "userId"            text        NOT NULL,
  "preferenceText"    text        NOT NULL,
  "source"            text        NOT NULL DEFAULT 'manual',
  "active"            boolean     NOT NULL DEFAULT true,
  "addedAt"           timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "linkedin_posts" (
  "id"                  serial      PRIMARY KEY,
  "userId"              text        NOT NULL,
  "trendItemId"         integer,
  "claimStatus"         text        NOT NULL DEFAULT 'insight'
                          CHECK ("claimStatus" IN ('shipped','piloting','building','concept','insight','commentary')),
  "content"             text        NOT NULL DEFAULT '',
  "status"              text        NOT NULL DEFAULT 'pending_review'
                          CHECK ("status" IN ('pending_review','approved','scheduled','posted','rejected')),
  "reviewedAt"          timestamp,
  "scheduledFor"        timestamp,
  "postedAt"            timestamp,
  "linkedinPostId"      text,
  "likeCount"           integer,
  "commentCount"        integer,
  "shareCount"          integer,
  "impressionCount"     integer,
  "metricsUpdatedAt"    timestamp,
  "metricsSource"       text        NOT NULL DEFAULT 'manual',
  "createdAt"           timestamp   NOT NULL DEFAULT now(),
  "updatedAt"           timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "draft_revisions" (
  "id"              serial      PRIMARY KEY,
  "userId"          text        NOT NULL,
  "postId"          integer     NOT NULL,
  "revisionNumber"  integer     NOT NULL,
  "content"         text        NOT NULL,
  "editedBy"        text        NOT NULL DEFAULT 'owner',
  "editedAt"        timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "post_chat_messages" (
  "id"          serial      PRIMARY KEY,
  "userId"      text        NOT NULL,
  "postId"      integer     NOT NULL,
  "role"        text        NOT NULL DEFAULT 'owner',
  "content"     text        NOT NULL,
  "createdAt"   timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"              serial      PRIMARY KEY,
  "userId"          text        NOT NULL,
  "type"            text        NOT NULL DEFAULT 'new_draft',
  "relatedPostId"   integer,
  "message"         text        NOT NULL,
  "channel"         text        NOT NULL DEFAULT 'in_app',
  "delivered"       boolean     NOT NULL DEFAULT true,
  "read"            boolean     NOT NULL DEFAULT false,
  "createdAt"       timestamp   NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION 5: YOUTUBE ADS PIPELINE + AD CREATIVE ENGINE (11 tables, text PKs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "youtube_channels" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "channelName" text NOT NULL,
  "youtubeChannelId" text NOT NULL DEFAULT '',
  "oauthRefreshToken" text,
  "oauthAccessToken" text,
  "oauthTokenExpiry" timestamp,
  "status" text NOT NULL DEFAULT 'needs_reauth' CHECK ("status" IN ('connected','needs_reauth','disabled')),
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "pipeline_settings" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "contentDomain" text NOT NULL DEFAULT '',
  "toneVoiceNotes" text NOT NULL DEFAULT '',
  "redFlagTerms" text NOT NULL DEFAULT '',
  "defaultBypassApproval" boolean NOT NULL DEFAULT false,
  "videoFormatDefault" text NOT NULL DEFAULT 'shorts',
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "video_projects" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "channelId" text NOT NULL,
  "topic" text NOT NULL,
  "premise" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','scripting','script_ready','prompt_ready','generating','generated','pending_approval','auto_approved','uploading','published','failed','rejected')),
  "videoFormat" text NOT NULL DEFAULT 'shorts',
  "batchId" text,
  "bypassApproval" boolean NOT NULL DEFAULT false,
  "autoPublished" boolean NOT NULL DEFAULT false,
  "errorMessage" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "video_scripts" (
  "id" text PRIMARY KEY,
  "videoProjectId" text NOT NULL,
  "revisionNumber" integer NOT NULL,
  "scriptText" text NOT NULL,
  "shotBreakdown" text NOT NULL DEFAULT '',
  "createdBy" text NOT NULL DEFAULT 'ai',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "generation_jobs" (
  "id" text PRIMARY KEY,
  "videoProjectId" text NOT NULL,
  "higgsfieldJobId" text,
  "promptSent" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'submitted' CHECK ("status" IN ('submitted','polling','complete','failed')),
  "outputUrlTemp" text,
  "blobUrl" text,
  "lastPolledAt" timestamp,
  "errorMessage" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "youtube_videos" (
  "id" text PRIMARY KEY,
  "videoProjectId" text NOT NULL,
  "channelId" text NOT NULL,
  "youtubeVideoId" text,
  "title" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "tags" text NOT NULL DEFAULT '',
  "thumbnailBlobUrl" text,
  "uploadStatus" text NOT NULL DEFAULT 'pending' CHECK ("uploadStatus" IN ('pending','uploading','published','failed')),
  "publishedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "youtube_metrics" (
  "id" text PRIMARY KEY,
  "youtubeVideoId" text NOT NULL,
  "views" integer NOT NULL DEFAULT 0,
  "likes" integer NOT NULL DEFAULT 0,
  "comments" integer NOT NULL DEFAULT 0,
  "watchTimeMinutes" integer NOT NULL DEFAULT 0,
  "polledAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ad_creatives" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "dealId" text,
  "creativeType" text NOT NULL DEFAULT 'ad_video' CHECK ("creativeType" IN ('ad_video','ugc_style','testimonial_style')),
  "premise" text NOT NULL DEFAULT '',
  "script" text NOT NULL DEFAULT '',
  "generationJobId" text,
  "outputBlobUrl" text,
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','generated','delivered')),
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "os_chat_messages" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "channel" text NOT NULL DEFAULT 'web' CHECK ("channel" IN ('web','telegram')),
  "role" text NOT NULL CHECK ("role" IN ('user','assistant')),
  "content" text NOT NULL,
  "sqlExecuted" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "edit_requests" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "videoProjectId" text NOT NULL,
  "sourceType" text NOT NULL DEFAULT 'generation_job' CHECK ("sourceType" IN ('generation_job','ad_creative')),
  "sourceBlobUrl" text NOT NULL DEFAULT '',
  "editPrompt" text NOT NULL,
  "remotionSpec" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'submitted' CHECK ("status" IN ('submitted','rendering','complete','failed')),
  "outputBlobUrl" text,
  "renderJobId" text,
  "errorMessage" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "edit_versions" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "videoProjectId" text NOT NULL,
  "versionNumber" integer NOT NULL,
  "editRequestId" text NOT NULL,
  "blobUrl" text NOT NULL,
  "isCurrent" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION 6: CAREER INTELLIGENCE (12 tables, text PKs)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "career_settings" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "enabledRoleFamilies" text NOT NULL DEFAULT '',
  "enabledGeographies" text NOT NULL DEFAULT '',
  "remotePreferences" text NOT NULL DEFAULT '',
  "compFloorDomesticINR" integer NOT NULL DEFAULT 3000000,
  "compStretchDomesticINR" integer NOT NULL DEFAULT 7500000,
  "compFloorIntlMonthly" integer NOT NULL DEFAULT 5000,
  "compStretchIntlMonthly" integer NOT NULL DEFAULT 10000,
  "compIntlCurrency" text NOT NULL DEFAULT 'USD',
  "companyAllowlist" text NOT NULL DEFAULT '',
  "companyDenylist" text NOT NULL DEFAULT '',
  "portfolioUrl" text NOT NULL DEFAULT '',
  "portfolioLive" boolean NOT NULL DEFAULT false,
  "autoTailorOnMatch" boolean NOT NULL DEFAULT false,
  "autoSendOutreach" boolean NOT NULL DEFAULT false,
  "autoSubmitApplications" boolean NOT NULL DEFAULT false,
  "autoShortlistThreshold" numeric(2,1) NOT NULL DEFAULT 3.5,
  "batchSizeLimit" integer NOT NULL DEFAULT 5,
  "redFlagTerms" text NOT NULL DEFAULT '',
  "toneVoiceNotes" text NOT NULL DEFAULT '',
  "dailyColdEmailLimit" integer NOT NULL DEFAULT 10,
  "followUpCadenceDays" integer NOT NULL DEFAULT 5,
  "extra" text NOT NULL DEFAULT '{}',
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "job_applications" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "company" text NOT NULL,
  "roleTitle" text NOT NULL,
  "roleFamily" text NOT NULL DEFAULT '',
  "archetype" text NOT NULL DEFAULT '',
  "jobUrl" text NOT NULL DEFAULT '',
  "portalSource" text NOT NULL DEFAULT '',
  "geography" text NOT NULL DEFAULT '',
  "compensationRange" text NOT NULL DEFAULT '',
  "jobDescription" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'discovered' CHECK ("status" IN ('discovered','evaluating','evaluated','shortlisted','tailored','outreach_prepared','pending_approval','auto_approved','applied','responded','interview','offer','rejected','discarded','skip')),
  "evaluationScore" numeric(2,1),
  "legitimacyTier" text CHECK ("legitimacyTier" IS NULL OR "legitimacyTier" IN ('high_confidence','proceed_with_caution','suspicious')),
  "legitimacySignals" text,
  "extractedKeywords" text,
  "evaluationReportId" text,
  "bypassApproval" boolean NOT NULL DEFAULT false,
  "autoSubmitted" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "evaluation_reports" (
  "id" text PRIMARY KEY,
  "jobApplicationId" text NOT NULL,
  "blockA_roleSummary" text NOT NULL DEFAULT '',
  "blockB_cvMatch" text NOT NULL DEFAULT '',
  "blockC_levelStrategy" text NOT NULL DEFAULT '',
  "blockD_compDemand" text NOT NULL DEFAULT '',
  "blockE_personalizationPlan" text NOT NULL DEFAULT '',
  "blockF_interviewPlan" text NOT NULL DEFAULT '',
  "blockH_draftAnswers" text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "interview_stories" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "situation" text NOT NULL DEFAULT '',
  "task" text NOT NULL DEFAULT '',
  "action" text NOT NULL DEFAULT '',
  "result" text NOT NULL DEFAULT '',
  "reflection" text NOT NULL DEFAULT '',
  "relatedRequirementTags" text NOT NULL DEFAULT '',
  "usedInJobApplicationIds" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "scan_history" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "url" text NOT NULL,
  "firstSeen" timestamp NOT NULL DEFAULT now(),
  "portalSource" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'added' CHECK ("status" IN ('added','skipped_title','skipped_dup','skipped_expired')),
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "company_research" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "company" text NOT NULL,
  "researchNotes" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "contacts" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "jobApplicationId" text,
  "company" text NOT NULL,
  "name" text NOT NULL DEFAULT '',
  "role" text NOT NULL DEFAULT 'recruiter' CHECK ("role" IN ('recruiter','hiring_manager','peer','interviewer')),
  "source" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "outreach_messages" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "contactId" text NOT NULL,
  "jobApplicationId" text,
  "messageType" text NOT NULL DEFAULT 'cold_email' CHECK ("messageType" IN ('cold_email','linkedin_message','recruiter_email')),
  "content" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'draft' CHECK ("status" IN ('draft','approved','sent','responded')),
  "sentAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "resumes" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "label" text NOT NULL,
  "baseContent" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "resume_versions" (
  "id" text PRIMARY KEY,
  "resumeId" text NOT NULL,
  "jobApplicationId" text,
  "versionNumber" integer NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "changeExplanation" text NOT NULL DEFAULT '',
  "atsKeywordScore" integer,
  "atsKeywordsMatched" text NOT NULL DEFAULT '',
  "atsKeywordsMissing" text NOT NULL DEFAULT '',
  "pdfBlobUrl" text,
  "isCurrent" boolean NOT NULL DEFAULT true,
  "createdBy" text NOT NULL DEFAULT 'ai',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cover_letters" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "jobApplicationId" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "cover_letter_versions" (
  "id" text PRIMARY KEY,
  "coverLetterId" text NOT NULL,
  "versionNumber" integer NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "changeExplanation" text NOT NULL DEFAULT '',
  "pdfBlobUrl" text,
  "isCurrent" boolean NOT NULL DEFAULT true,
  "createdBy" text NOT NULL DEFAULT 'ai',
  "createdAt" timestamp NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION 7: JARVIS CONNECTIONS + MONEY OS (3 tables)
-- =============================================================================

-- Google Calendar OAuth for Jarvis (tokens encrypted via lib/crypto.ts)
CREATE TABLE IF NOT EXISTS "connected_accounts" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "provider" text NOT NULL CHECK ("provider" IN ('google_calendar')),
  "accountEmail" text NOT NULL DEFAULT '',
  "accessToken" text,
  "refreshToken" text,
  "tokenExpiry" timestamp,
  "status" text NOT NULL DEFAULT 'connected' CHECK ("status" IN ('connected','revoked','error')),
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- METADATA ONLY: labels, issuer, last-4, UPI handle. Never full card numbers,
-- CVVs, PINs, or bank credentials. Cancellation is playbook-driven.
CREATE TABLE IF NOT EXISTS "payment_instruments" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "label" text NOT NULL,
  "instrumentType" text NOT NULL CHECK ("instrumentType" IN ('debit_card','credit_card','upi','bank_account')),
  "issuer" text NOT NULL DEFAULT '',
  "network" text NOT NULL DEFAULT '',
  "lastFour" text NOT NULL DEFAULT '',
  "upiHandle" text NOT NULL DEFAULT '',
  "notes" text NOT NULL DEFAULT '',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "autopays" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "instrumentId" text,
  "merchant" text NOT NULL,
  "description" text NOT NULL DEFAULT '',
  "rail" text NOT NULL DEFAULT 'upi_mandate' CHECK ("rail" IN ('upi_mandate','card_si','enach','wallet','other')),
  "amountINR" numeric(12,2),
  "cadence" text NOT NULL DEFAULT 'monthly' CHECK ("cadence" IN ('weekly','monthly','quarterly','yearly','adhoc')),
  "nextChargeDate" date,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','cancel_requested','cancelled','paused')),
  "reminderDaysBefore" integer NOT NULL DEFAULT 3,
  "lastRemindedAt" timestamp,
  "cancellationNotes" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);


-- =============================================================================
-- SECTION 8: SETTINGS HUB + LEAD-GEN AGENT (4 tables)
-- =============================================================================

-- Per-user JSON config store (Settings Hub: general prefs, agent configs, funnel seams)
CREATE TABLE IF NOT EXISTS "app_config" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "key" text NOT NULL,
  "value" jsonb NOT NULL DEFAULT '{}',
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE("userId", "key")
);

-- BYO API keys: AES-encrypted via lib/crypto.ts. NEVER add to the Ask OS allowlist.
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "provider" text NOT NULL,
  "label" text NOT NULL DEFAULT '',
  "encryptedKey" text NOT NULL,
  "lastFour" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  UNIQUE("userId", "provider")
);

-- Lead-gen agent: discovered businesses, AI-qualified, promotable into leads
CREATE TABLE IF NOT EXISTS "leadgen_prospects" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "source" text NOT NULL DEFAULT 'maps_no_website' CHECK ("source" IN ('maps_no_website','ai_upgrade','manual_seed')),
  "businessName" text NOT NULL,
  "category" text NOT NULL DEFAULT '',
  "location" text NOT NULL DEFAULT '',
  "phone" text NOT NULL DEFAULT '',
  "website" text NOT NULL DEFAULT '',
  "mapsUrl" text NOT NULL DEFAULT '',
  "signals" text NOT NULL DEFAULT '',
  "aiScore" integer,
  "aiRationale" text NOT NULL DEFAULT '',
  "pitchAngle" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'discovered' CHECK ("status" IN ('discovered','qualified','promoted','rejected')),
  "promotedLeadId" integer,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "leadgen_runs" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "trigger" text NOT NULL DEFAULT 'manual',
  "source" text NOT NULL DEFAULT 'maps_no_website',
  "query" text NOT NULL DEFAULT '',
  "prospectsFound" integer NOT NULL DEFAULT 0,
  "prospectsQualified" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'completed' CHECK ("status" IN ('running','completed','failed')),
  "errorMessage" text NOT NULL DEFAULT '',
  "createdAt" timestamp NOT NULL DEFAULT now()
);


-- =============================================================================
-- Jarvis god-mode orchestrator (audit log + self-improvement memory)
-- =============================================================================

-- Every mutating action Jarvis performs (settings writes, directives, key
-- stores, workflow triggers, lesson saves) is recorded here.
CREATE TABLE IF NOT EXISTS "jarvis_actions" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "tool" text NOT NULL,
  "summary" text NOT NULL DEFAULT '',
  "payload" jsonb NOT NULL DEFAULT '{}',
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jarvis_actions_user ON "jarvis_actions" ("userId", "createdAt" DESC);

-- Jarvis's permanent memory: active lessons are injected into its system
-- prompt on every chat, so corrections persist across sessions.
CREATE TABLE IF NOT EXISTS "jarvis_lessons" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "lesson" text NOT NULL,
  "source" text NOT NULL DEFAULT 'user_feedback' CHECK ("source" IN ('user_feedback','self_reflection')),
  "active" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jarvis_lessons_user ON "jarvis_lessons" ("userId") WHERE "active" = true;

-- =============================================================================
-- Done. 46 tables created.
-- Breakdown: 4 Better Auth + 5 Freelance Funnel + 4 FDE Prep + 7 LinkedIn OS
--          + 11 YouTube Pipeline / Ad Creative / Chat / Edits
--          + 12 Career Intelligence + 3 Jarvis Connections / Money OS
--          + 4 Settings Hub / Lead-Gen Agent
--          + 2 Jarvis Orchestrator (jarvis_actions audit, jarvis_lessons memory)
-- =============================================================================
