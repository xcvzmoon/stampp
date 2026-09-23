CREATE TABLE "audit_retention_policies" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_retention_policies" ADD CONSTRAINT "audit_retention_policies_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "public"."audit_retention_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_retention_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_retention_policies_workspace_isolation" ON "public"."audit_retention_policies" USING ("workspace_id" = current_setting('app.workspace_id', true));
