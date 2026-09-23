CREATE TABLE "scim_tokens" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"prefix" varchar(16) NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp(3) with time zone,
	"revoked_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "scim_tokens_workspace_id_idx" ON "scim_tokens" ("workspace_id");--> statement-breakpoint
CREATE INDEX "scim_tokens_token_hash_idx" ON "scim_tokens" ("token_hash");--> statement-breakpoint
ALTER TABLE "scim_tokens" ADD CONSTRAINT "scim_tokens_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "public"."scim_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."scim_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY "scim_tokens_workspace_isolation" ON "public"."scim_tokens" USING ("workspace_id" = current_setting('app.workspace_id', true));
