CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"webhook_id" text NOT NULL,
	"event" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_status_code" integer,
	"last_error" text,
	"next_attempt_at" timestamp(3) with time zone,
	"completed_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "webhook_deliveries_attempt_count_check" CHECK ("attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"url" text NOT NULL,
	"description" varchar(200),
	"events" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"secret_prefix" varchar(16) NOT NULL,
	"secret" text NOT NULL,
	"last_delivery_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE INDEX "webhook_deliveries_workspace_id_idx" ON "webhook_deliveries" ("workspace_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_id_idx" ON "webhook_deliveries" ("webhook_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries" ("status");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_workspace_id_idx" ON "webhook_subscriptions" ("workspace_id");--> statement-breakpoint
CREATE INDEX "webhook_subscriptions_workspace_status_idx" ON "webhook_subscriptions" ("workspace_id","status");--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhook_subscriptions_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
ALTER TABLE "public"."webhook_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "webhook_subscriptions_workspace_isolation" ON "public"."webhook_subscriptions" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."webhook_deliveries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "webhook_deliveries_workspace_isolation" ON "public"."webhook_deliveries" USING ("workspace_id" = current_setting('app.workspace_id', true));
