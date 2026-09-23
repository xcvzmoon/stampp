CREATE TABLE "kiosk_devices" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"key_prefix" varchar(16) NOT NULL,
	"device_key_hash" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_used_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "kiosk_member_credentials" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"pin_hash" text,
	"pin_salt" text,
	"qr_token_hash" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "kiosk_member_credentials_has_method_check" CHECK ((("pin_hash" is not null and "pin_salt" is not null) or "qr_token_hash" is not null))
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ADD COLUMN "kiosk_device_id" text;--> statement-breakpoint
CREATE INDEX "kiosk_devices_workspace_id_idx" ON "kiosk_devices" ("workspace_id");--> statement-breakpoint
CREATE INDEX "kiosk_devices_workspace_id_status_idx" ON "kiosk_devices" ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "kiosk_devices_workspace_name_unique" ON "kiosk_devices" ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "kiosk_devices_key_hash_unique" ON "kiosk_devices" ("device_key_hash");--> statement-breakpoint
CREATE INDEX "kiosk_member_credentials_workspace_id_idx" ON "kiosk_member_credentials" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kiosk_member_credentials_workspace_user_unique" ON "kiosk_member_credentials" ("workspace_id","user_id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_kiosk_device_id_kiosk_devices_id_fkey" FOREIGN KEY ("kiosk_device_id") REFERENCES "kiosk_devices"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "kiosk_devices" ADD CONSTRAINT "kiosk_devices_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "kiosk_member_credentials" ADD CONSTRAINT "kiosk_member_credentials_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "kiosk_member_credentials" ADD CONSTRAINT "kiosk_member_credentials_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "public"."kiosk_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kiosk_devices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "kiosk_devices_workspace_isolation" ON "public"."kiosk_devices" USING ("workspace_id" = current_setting('app.workspace_id', true));
--> statement-breakpoint
ALTER TABLE "public"."kiosk_member_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."kiosk_member_credentials" FORCE ROW LEVEL SECURITY;
CREATE POLICY "kiosk_member_credentials_workspace_isolation" ON "public"."kiosk_member_credentials" USING ("workspace_id" = current_setting('app.workspace_id', true));
