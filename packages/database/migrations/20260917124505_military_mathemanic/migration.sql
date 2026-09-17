CREATE TABLE "time_entries" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"task_id" text,
	"description" varchar(1000) DEFAULT '' NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"start_at" timestamp(3) with time zone,
	"end_at" timestamp(3) with time zone,
	"duration_minutes" integer,
	"timezone" varchar(100) NOT NULL,
	"locked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "time_entries_interval_or_duration_check" CHECK ((("start_at" is not null and "duration_minutes" is null and ("end_at" is null or "end_at" > "start_at")) or ("start_at" is null and "end_at" is null and "duration_minutes" > 0))),
	CONSTRAINT "time_entries_task_requires_project_check" CHECK ("task_id" is null or "project_id" is not null)
);
--> statement-breakpoint
CREATE INDEX "time_entries_workspace_id_user_id_start_at_idx" ON "time_entries" ("workspace_id","user_id","start_at");--> statement-breakpoint
CREATE INDEX "time_entries_workspace_id_project_id_start_at_idx" ON "time_entries" ("workspace_id","project_id","start_at");--> statement-breakpoint
CREATE UNIQUE INDEX "time_entries_one_running_per_user_unique" ON "time_entries" ("workspace_id","user_id") WHERE "start_at" is not null and "end_at" is null;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "time_entries"
	ADD CONSTRAINT "time_entries_no_overlapping_intervals"
	EXCLUDE USING gist (
		"workspace_id" WITH =,
		"user_id" WITH =,
		tstzrange("start_at", COALESCE("end_at", 'infinity'::timestamptz), '[)') WITH &&
	)
	WHERE ("start_at" is not null);
