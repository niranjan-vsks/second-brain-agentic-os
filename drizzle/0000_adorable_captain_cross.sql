CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ad_creatives" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"dealId" text,
	"creativeType" text DEFAULT 'ad_video' NOT NULL,
	"premise" text DEFAULT '' NOT NULL,
	"script" text DEFAULT '' NOT NULL,
	"generationJobId" text,
	"outputBlobUrl" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"provider" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"encryptedKey" text NOT NULL,
	"lastFour" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_config" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"dealId" integer,
	"type" text DEFAULT 'proposal' NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'prompt' NOT NULL,
	"buildType" text DEFAULT 'general' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "autopays" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"instrumentId" text,
	"merchant" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rail" text DEFAULT 'upi_mandate' NOT NULL,
	"amountINR" numeric(12, 2),
	"cadence" text DEFAULT 'monthly' NOT NULL,
	"nextChargeDate" date,
	"status" text DEFAULT 'active' NOT NULL,
	"reminderDaysBefore" integer DEFAULT 3 NOT NULL,
	"lastRemindedAt" timestamp,
	"cancellationNotes" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"jobApplicationId" text,
	"company" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'recruiter' NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "career_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"enabledRoleFamilies" text DEFAULT '' NOT NULL,
	"enabledGeographies" text DEFAULT '' NOT NULL,
	"remotePreferences" text DEFAULT '' NOT NULL,
	"compFloorDomesticINR" integer DEFAULT 3000000 NOT NULL,
	"compStretchDomesticINR" integer DEFAULT 7500000 NOT NULL,
	"compFloorIntlMonthly" integer DEFAULT 5000 NOT NULL,
	"compStretchIntlMonthly" integer DEFAULT 10000 NOT NULL,
	"compIntlCurrency" text DEFAULT 'USD' NOT NULL,
	"companyAllowlist" text DEFAULT '' NOT NULL,
	"companyDenylist" text DEFAULT '' NOT NULL,
	"portfolioUrl" text DEFAULT '' NOT NULL,
	"portfolioLive" boolean DEFAULT false NOT NULL,
	"autoTailorOnMatch" boolean DEFAULT false NOT NULL,
	"autoSendOutreach" boolean DEFAULT false NOT NULL,
	"autoSubmitApplications" boolean DEFAULT false NOT NULL,
	"autoShortlistThreshold" numeric(2, 1) DEFAULT '3.5' NOT NULL,
	"batchSizeLimit" integer DEFAULT 5 NOT NULL,
	"redFlagTerms" text DEFAULT '' NOT NULL,
	"toneVoiceNotes" text DEFAULT '' NOT NULL,
	"dailyColdEmailLimit" integer DEFAULT 10 NOT NULL,
	"followUpCadenceDays" integer DEFAULT 5 NOT NULL,
	"extra" text DEFAULT '{}' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "company_research" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"company" text NOT NULL,
	"researchNotes" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connected_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"provider" text NOT NULL,
	"accountEmail" text DEFAULT '' NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"tokenExpiry" timestamp,
	"status" text DEFAULT 'connected' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cover_letter_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"coverLetterId" text NOT NULL,
	"versionNumber" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"changeExplanation" text DEFAULT '' NOT NULL,
	"pdfBlobUrl" text,
	"isCurrent" boolean DEFAULT true NOT NULL,
	"createdBy" text DEFAULT 'ai' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cover_letters" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"jobApplicationId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deal_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"dealId" integer NOT NULL,
	"stage" text NOT NULL,
	"item" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"client" text DEFAULT '' NOT NULL,
	"stage" text DEFAULT 'lead' NOT NULL,
	"buildType" text DEFAULT 'custom' NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"nextAction" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "draft_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"postId" integer NOT NULL,
	"revisionNumber" integer NOT NULL,
	"content" text NOT NULL,
	"editedBy" text DEFAULT 'owner' NOT NULL,
	"editedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drills" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"topicId" integer,
	"question" text NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'unanswered' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edit_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"videoProjectId" text NOT NULL,
	"sourceType" text DEFAULT 'generation_job' NOT NULL,
	"sourceBlobUrl" text DEFAULT '' NOT NULL,
	"editPrompt" text NOT NULL,
	"remotionSpec" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"outputBlobUrl" text,
	"renderJobId" text,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "edit_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"videoProjectId" text NOT NULL,
	"versionNumber" integer NOT NULL,
	"editRequestId" text NOT NULL,
	"blobUrl" text NOT NULL,
	"isCurrent" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evaluation_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"jobApplicationId" text NOT NULL,
	"blockA_roleSummary" text DEFAULT '' NOT NULL,
	"blockB_cvMatch" text DEFAULT '' NOT NULL,
	"blockC_levelStrategy" text DEFAULT '' NOT NULL,
	"blockD_compDemand" text DEFAULT '' NOT NULL,
	"blockE_personalizationPlan" text DEFAULT '' NOT NULL,
	"blockF_interviewPlan" text DEFAULT '' NOT NULL,
	"blockH_draftAnswers" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"videoProjectId" text NOT NULL,
	"higgsfieldJobId" text,
	"promptSent" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"outputUrlTemp" text,
	"blobUrl" text,
	"lastPolledAt" timestamp,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "interview_stories" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"situation" text DEFAULT '' NOT NULL,
	"task" text DEFAULT '' NOT NULL,
	"action" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"reflection" text DEFAULT '' NOT NULL,
	"relatedRequirementTags" text DEFAULT '' NOT NULL,
	"usedInJobApplicationIds" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jarvis_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"tool" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jarvis_lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"lesson" text NOT NULL,
	"source" text DEFAULT 'user_feedback' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"company" text NOT NULL,
	"roleTitle" text NOT NULL,
	"roleFamily" text DEFAULT '' NOT NULL,
	"archetype" text DEFAULT '' NOT NULL,
	"jobUrl" text DEFAULT '' NOT NULL,
	"portalSource" text DEFAULT '' NOT NULL,
	"geography" text DEFAULT '' NOT NULL,
	"compensationRange" text DEFAULT '' NOT NULL,
	"jobDescription" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'discovered' NOT NULL,
	"evaluationScore" numeric(2, 1),
	"legitimacyTier" text,
	"legitimacySignals" text,
	"extractedKeywords" text,
	"evaluationReportId" text,
	"bypassApproval" boolean DEFAULT false NOT NULL,
	"autoSubmitted" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leadgen_prospects" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"source" text DEFAULT 'maps_no_website' NOT NULL,
	"businessName" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"mapsUrl" text DEFAULT '' NOT NULL,
	"signals" text DEFAULT '' NOT NULL,
	"aiScore" integer,
	"aiRationale" text DEFAULT '' NOT NULL,
	"pitchAngle" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'discovered' NOT NULL,
	"promotedLeadId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leadgen_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"source" text DEFAULT 'maps_no_website' NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"prospectsFound" integer DEFAULT 0 NOT NULL,
	"prospectsQualified" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"errorMessage" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"company" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'linkedin' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"lastTouch" timestamp,
	"nextFollowUp" timestamp,
	"notes" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "linkedin_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"trendItemId" integer,
	"claimStatus" text DEFAULT 'insight' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"reviewedAt" timestamp,
	"scheduledFor" timestamp,
	"postedAt" timestamp,
	"linkedinPostId" text,
	"likeCount" integer,
	"commentCount" integer,
	"shareCount" integer,
	"impressionCount" integer,
	"metricsUpdatedAt" timestamp,
	"metricsSource" text DEFAULT 'manual' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"type" text DEFAULT 'new_draft' NOT NULL,
	"relatedPostId" integer,
	"message" text NOT NULL,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"delivered" boolean DEFAULT true NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "os_chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"channel" text DEFAULT 'web' NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sqlExecuted" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outreach_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"contactId" text NOT NULL,
	"jobApplicationId" text,
	"messageType" text DEFAULT 'cold_email' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_instruments" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"label" text NOT NULL,
	"instrumentType" text NOT NULL,
	"issuer" text DEFAULT '' NOT NULL,
	"network" text DEFAULT '' NOT NULL,
	"lastFour" text DEFAULT '' NOT NULL,
	"upiHandle" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"contentDomain" text DEFAULT '' NOT NULL,
	"toneVoiceNotes" text DEFAULT '' NOT NULL,
	"redFlagTerms" text DEFAULT '' NOT NULL,
	"defaultBypassApproval" boolean DEFAULT false NOT NULL,
	"videoFormatDefault" text DEFAULT 'shorts' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "post_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"postId" integer NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"topicId" integer,
	"title" text NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'article' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resume_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"resumeId" text NOT NULL,
	"jobApplicationId" text,
	"versionNumber" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"changeExplanation" text DEFAULT '' NOT NULL,
	"atsKeywordScore" integer,
	"atsKeywordsMatched" text DEFAULT '' NOT NULL,
	"atsKeywordsMissing" text DEFAULT '' NOT NULL,
	"pdfBlobUrl" text,
	"isCurrent" boolean DEFAULT true NOT NULL,
	"createdBy" text DEFAULT 'ai' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resumes" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"label" text NOT NULL,
	"baseContent" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scan_history" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"url" text NOT NULL,
	"firstSeen" timestamp DEFAULT now() NOT NULL,
	"portalSource" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'added' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"topicId" integer,
	"weekStart" date NOT NULL,
	"day" text DEFAULT 'mon' NOT NULL,
	"plannedMinutes" integer DEFAULT 60 NOT NULL,
	"actualMinutes" integer DEFAULT 0 NOT NULL,
	"focus" text DEFAULT '' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"track" text DEFAULT 'system-design' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'not-started' NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trend_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"discoveredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"channelId" text NOT NULL,
	"topic" text NOT NULL,
	"premise" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"videoFormat" text DEFAULT 'shorts' NOT NULL,
	"batchId" text,
	"bypassApproval" boolean DEFAULT false NOT NULL,
	"autoPublished" boolean DEFAULT false NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"videoProjectId" text NOT NULL,
	"revisionNumber" integer NOT NULL,
	"scriptText" text NOT NULL,
	"shotBreakdown" text DEFAULT '' NOT NULL,
	"createdBy" text DEFAULT 'ai' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voice_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"preferenceText" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"addedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "writing_samples" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"sampleText" text NOT NULL,
	"tag" text DEFAULT '' NOT NULL,
	"addedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_channels" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"channelName" text NOT NULL,
	"youtubeChannelId" text DEFAULT '' NOT NULL,
	"oauthRefreshToken" text,
	"oauthAccessToken" text,
	"oauthTokenExpiry" timestamp,
	"status" text DEFAULT 'needs_reauth' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"youtubeVideoId" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"watchTimeMinutes" integer DEFAULT 0 NOT NULL,
	"polledAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"videoProjectId" text NOT NULL,
	"channelId" text NOT NULL,
	"youtubeVideoId" text,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"thumbnailBlobUrl" text,
	"uploadStatus" text DEFAULT 'pending' NOT NULL,
	"publishedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;