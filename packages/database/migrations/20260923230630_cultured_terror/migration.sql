CREATE TABLE "import_jobs" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"imported_rows" integer DEFAULT 0 NOT NULL,
	"skipped_rows" integer DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"error" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "import_jobs_workspace_id_idx" ON "import_jobs" ("workspace_id");--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."import_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "import_jobs_workspace_isolation" ON "public"."import_jobs" USING ("workspace_id" = current_setting('app.workspace_id', true));
