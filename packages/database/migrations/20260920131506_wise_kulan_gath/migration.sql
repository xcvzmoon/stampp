CREATE TABLE "timesheets" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"week_start" date NOT NULL,
	"status" text NOT NULL,
	"submitted_at" timestamp(3) with time zone,
	"submit_note" varchar(2000),
	"decided_at" timestamp(3) with time zone,
	"decided_by" text,
	"decision_note" varchar(2000),
	"locked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "timesheets_week_start_monday_check" CHECK (extract(dow from "week_start"::date) = 1),
	CONSTRAINT "timesheets_approved_requires_lock_check" CHECK (("status" = 'approved' and "locked_at" is not null and "decided_at" is not null) or ("status" <> 'approved'))
);
--> statement-breakpoint
CREATE INDEX "timesheets_workspace_id_idx" ON "timesheets" ("workspace_id");--> statement-breakpoint
CREATE INDEX "timesheets_workspace_id_status_idx" ON "timesheets" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "timesheets_workspace_id_user_id_week_start_idx" ON "timesheets" ("workspace_id","user_id","week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "timesheets_workspace_user_week_unique" ON "timesheets" ("workspace_id","user_id","week_start");--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_decided_by_users_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL;