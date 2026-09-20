CREATE TABLE "rates" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"scope" text NOT NULL,
	"user_id" text,
	"project_id" text,
	"task_id" text,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"effective_from" timestamp(3) with time zone NOT NULL,
	"effective_to" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "rates_amount_minor_nonnegative_check" CHECK ("amount_minor" >= 0),
	CONSTRAINT "rates_scope_targets_check" CHECK ((("scope" = 'org' and "user_id" is null and "project_id" is null and "task_id" is null) or ("scope" = 'user' and "user_id" is not null and "project_id" is null and "task_id" is null) or ("scope" = 'project' and "user_id" is null and "project_id" is not null and "task_id" is null) or ("scope" = 'user_project' and "user_id" is not null and "project_id" is not null and "task_id" is null) or ("scope" = 'task' and "user_id" is null and "project_id" is not null and "task_id" is not null))),
	CONSTRAINT "rates_effective_window_check" CHECK ("effective_to" is null or "effective_to" > "effective_from")
);
--> statement-breakpoint
CREATE INDEX "rates_workspace_id_idx" ON "rates" ("workspace_id");--> statement-breakpoint
CREATE INDEX "rates_workspace_id_kind_effective_from_idx" ON "rates" ("workspace_id","kind","effective_from");--> statement-breakpoint
CREATE INDEX "rates_workspace_id_project_id_idx" ON "rates" ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "rates_workspace_id_user_id_idx" ON "rates" ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rates_open_org_unique" ON "rates" ("workspace_id","kind") WHERE "scope" = 'org' and "effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "rates_open_user_unique" ON "rates" ("workspace_id","kind","user_id") WHERE "scope" = 'user' and "effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "rates_open_project_unique" ON "rates" ("workspace_id","kind","project_id") WHERE "scope" = 'project' and "effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "rates_open_user_project_unique" ON "rates" ("workspace_id","kind","user_id","project_id") WHERE "scope" = 'user_project' and "effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "rates_open_task_unique" ON "rates" ("workspace_id","kind","task_id") WHERE "scope" = 'task' and "effective_to" is null;--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;