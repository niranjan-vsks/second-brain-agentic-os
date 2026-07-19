CREATE TABLE "automation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"automationId" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automations" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'n8n' NOT NULL,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"analysis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'imported' NOT NULL,
	"n8nWorkflowId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"targetAgents" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
