CREATE TABLE "approval_chains" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"entity_type" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"steps" jsonb NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "approval_chains_steps_count_check" CHECK (jsonb_array_length("steps") between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "approval_decisions" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"run_id" text NOT NULL,
	"step_order" integer NOT NULL,
	"action" text NOT NULL,
	"approver_user_id" text NOT NULL,
	"note" varchar(2000),
	"decided_at" timestamp(3) with time zone NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "approval_decisions_step_order_check" CHECK ("step_order" >= 1 and "step_order" <= 5)
);
--> statement-breakpoint
CREATE TABLE "approval_runs" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"chain_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step" integer DEFAULT 1 NOT NULL,
	"step_count" integer NOT NULL,
	"submitted_by" text NOT NULL,
	"submitted_at" timestamp(3) with time zone NOT NULL,
	"decided_at" timestamp(3) with time zone,
	"decided_by" text,
	"decision_note" varchar(2000),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "approval_runs_step_check" CHECK ("current_step" >= 1 and "current_step" <= "step_count"),
	CONSTRAINT "approval_runs_step_count_check" CHECK ("step_count" >= 1 and "step_count" <= 5)
);
--> statement-breakpoint
CREATE INDEX "approval_chains_workspace_id_idx" ON "approval_chains" ("workspace_id");--> statement-breakpoint
CREATE INDEX "approval_chains_workspace_id_entity_type_idx" ON "approval_chains" ("workspace_id","entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_chains_workspace_name_unique" ON "approval_chains" ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "approval_decisions_workspace_id_idx" ON "approval_decisions" ("workspace_id");--> statement-breakpoint
CREATE INDEX "approval_decisions_run_id_idx" ON "approval_decisions" ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_decisions_run_step_unique" ON "approval_decisions" ("run_id","step_order");--> statement-breakpoint
CREATE INDEX "approval_runs_workspace_id_idx" ON "approval_runs" ("workspace_id");--> statement-breakpoint
CREATE INDEX "approval_runs_workspace_id_status_idx" ON "approval_runs" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "approval_runs_workspace_id_entity_type_entity_id_idx" ON "approval_runs" ("workspace_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "approval_runs_open_entity_unique" ON "approval_runs" ("workspace_id","entity_type","entity_id") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "approval_chains" ADD CONSTRAINT "approval_chains_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_run_id_approval_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "approval_runs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_approver_user_id_users_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "approval_runs" ADD CONSTRAINT "approval_runs_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "approval_runs" ADD CONSTRAINT "approval_runs_chain_id_approval_chains_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "approval_chains"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "approval_runs" ADD CONSTRAINT "approval_runs_submitted_by_users_id_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "approval_runs" ADD CONSTRAINT "approval_runs_decided_by_users_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "public"."approval_chains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."approval_chains" FORCE ROW LEVEL SECURITY;
CREATE POLICY "approval_chains_workspace_isolation" ON "public"."approval_chains" USING ("workspace_id" = current_setting('app.workspace_id', true));
--> statement-breakpoint
ALTER TABLE "public"."approval_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."approval_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "approval_runs_workspace_isolation" ON "public"."approval_runs" USING ("workspace_id" = current_setting('app.workspace_id', true));
--> statement-breakpoint
ALTER TABLE "public"."approval_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."approval_decisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "approval_decisions_workspace_isolation" ON "public"."approval_decisions" USING ("workspace_id" = current_setting('app.workspace_id', true));
