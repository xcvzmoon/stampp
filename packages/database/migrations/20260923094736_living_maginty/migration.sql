CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"clock_in_at" timestamp(3) with time zone NOT NULL,
	"clock_out_at" timestamp(3) with time zone,
	"duration_minutes" integer,
	"work_date" date NOT NULL,
	"timezone" varchar(100) NOT NULL,
	"source" text DEFAULT 'clock' NOT NULL,
	"note" varchar(500),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "attendance_records_interval_check" CHECK (("clock_out_at" is null and "duration_minutes" is null) or ("clock_out_at" is not null and "clock_out_at" > "clock_in_at" and "duration_minutes" is not null and "duration_minutes" >= 0))
);
--> statement-breakpoint
CREATE INDEX "attendance_records_workspace_id_idx" ON "attendance_records" ("workspace_id");--> statement-breakpoint
CREATE INDEX "attendance_records_workspace_id_user_id_clock_in_at_idx" ON "attendance_records" ("workspace_id","user_id","clock_in_at");--> statement-breakpoint
CREATE INDEX "attendance_records_workspace_id_work_date_idx" ON "attendance_records" ("workspace_id","work_date");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_one_open_per_user_unique" ON "attendance_records" ("workspace_id","user_id") WHERE "clock_out_at" is null;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "public"."attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "attendance_records_workspace_isolation" ON "public"."attendance_records" USING ("workspace_id" = current_setting('app.workspace_id', true));