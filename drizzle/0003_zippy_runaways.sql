CREATE TABLE "job_hunt_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"node" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"found" integer DEFAULT 0 NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
