CREATE TABLE "sso_providers" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"provider_id" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"issuer" text NOT NULL,
	"client_id" varchar(200) NOT NULL,
	"client_secret" text NOT NULL,
	"scopes" jsonb DEFAULT '["openid","email","profile"]' NOT NULL,
	"allowed_email_domains" jsonb DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "sso_providers_workspace_id_idx" ON "sso_providers" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sso_providers_workspace_provider_unique" ON "sso_providers" ("workspace_id","provider_id");--> statement-breakpoint
ALTER TABLE "sso_providers" ADD CONSTRAINT "sso_providers_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "public"."sso_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."sso_providers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "sso_providers_workspace_isolation" ON "public"."sso_providers" USING ("workspace_id" = current_setting('app.workspace_id', true));
