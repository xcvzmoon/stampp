CREATE TABLE "clients" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(320),
	"address" text,
	"notes" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"client_id" text,
	"name" varchar(200) NOT NULL,
	"code" varchar(64),
	"color" varchar(7),
	"status" text DEFAULT 'active' NOT NULL,
	"billable" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"project_id" text NOT NULL,
	"name" varchar(200) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"estimate_minutes" integer,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "clients_workspace_id_idx" ON "clients" ("workspace_id");--> statement-breakpoint
CREATE INDEX "clients_workspace_id_deleted_at_idx" ON "clients" ("workspace_id","deleted_at");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_idx" ON "projects" ("workspace_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_status_idx" ON "projects" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_client_id_idx" ON "projects" ("workspace_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_workspace_id_code_unique" ON "projects" ("workspace_id","code") WHERE "deleted_at" is null and "code" is not null;--> statement-breakpoint
CREATE INDEX "tasks_workspace_id_idx" ON "tasks" ("workspace_id");--> statement-breakpoint
CREATE INDEX "tasks_workspace_id_project_id_idx" ON "tasks" ("workspace_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_project_id_name_unique" ON "tasks" ("project_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;