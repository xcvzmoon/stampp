CREATE TABLE "expenses" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"expense_date" date NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"category" text NOT NULL,
	"description" varchar(500) NOT NULL,
	"notes" text,
	"billable" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"receipt_key" text,
	"receipt_filename" varchar(255),
	"receipt_content_type" varchar(100),
	"receipt_size_bytes" integer,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "expenses_amount_minor_positive_check" CHECK ("amount_minor" > 0)
);
--> statement-breakpoint
CREATE INDEX "expenses_workspace_id_idx" ON "expenses" ("workspace_id");--> statement-breakpoint
CREATE INDEX "expenses_workspace_id_user_id_expense_date_idx" ON "expenses" ("workspace_id","user_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_workspace_id_project_id_idx" ON "expenses" ("workspace_id","project_id");--> statement-breakpoint
CREATE INDEX "expenses_workspace_id_status_idx" ON "expenses" ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;