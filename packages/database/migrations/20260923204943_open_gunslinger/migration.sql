CREATE TABLE "saml_providers" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"entity_id" text NOT NULL,
	"entry_point" text NOT NULL,
	"certificate" text NOT NULL,
	"email_attribute" varchar(80) DEFAULT 'email' NOT NULL,
	"allowed_email_domains" jsonb DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'enabled' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "saml_providers_workspace_id_idx" ON "saml_providers" ("workspace_id");--> statement-breakpoint
ALTER TABLE "saml_providers" ADD CONSTRAINT "saml_providers_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;

ALTER TABLE "public"."saml_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."saml_providers" FORCE ROW LEVEL SECURITY;
CREATE POLICY "saml_providers_workspace_isolation" ON "public"."saml_providers" USING ("workspace_id" = current_setting('app.workspace_id', true));
