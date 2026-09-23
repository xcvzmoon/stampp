CREATE TABLE "custom_roles" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(200),
	"permissions" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "custom_role_id" text;--> statement-breakpoint
CREATE INDEX "custom_roles_workspace_id_idx" ON "custom_roles" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_roles_workspace_name_unique" ON "custom_roles" ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "public"."custom_roles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."custom_roles" FORCE ROW LEVEL SECURITY;
CREATE POLICY "custom_roles_workspace_isolation" ON "public"."custom_roles" USING ("workspace_id" = current_setting('app.workspace_id', true));
