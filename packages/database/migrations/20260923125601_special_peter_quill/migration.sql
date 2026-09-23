CREATE TABLE "member_capacities" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"weekly_hours" numeric(5,2) NOT NULL,
	"note" varchar(500),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "member_capacities_weekly_hours_positive_check" CHECK ("weekly_hours" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"hours_per_week" numeric(5,2) NOT NULL,
	"note" varchar(500),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "project_assignments_range_check" CHECK ("end_date" >= "start_date"),
	CONSTRAINT "project_assignments_hours_positive_check" CHECK ("hours_per_week" > 0)
);
--> statement-breakpoint
CREATE INDEX "member_capacities_workspace_id_idx" ON "member_capacities" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_capacities_workspace_user_unique" ON "member_capacities" ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "project_assignments_workspace_id_idx" ON "project_assignments" ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_assignments_workspace_id_user_id_start_date_idx" ON "project_assignments" ("workspace_id","user_id","start_date");--> statement-breakpoint
CREATE INDEX "project_assignments_workspace_id_project_id_idx" ON "project_assignments" ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "project_assignments_workspace_id_active_idx" ON "project_assignments" ("workspace_id","active");--> statement-breakpoint
ALTER TABLE "member_capacities" ADD CONSTRAINT "member_capacities_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member_capacities" ADD CONSTRAINT "member_capacities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "public"."member_capacities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."member_capacities" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_capacities_workspace_isolation" ON "public"."member_capacities" USING ("workspace_id" = current_setting('app.workspace_id', true));
--> statement-breakpoint
ALTER TABLE "public"."project_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_assignments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "project_assignments_workspace_isolation" ON "public"."project_assignments" USING ("workspace_id" = current_setting('app.workspace_id', true));
