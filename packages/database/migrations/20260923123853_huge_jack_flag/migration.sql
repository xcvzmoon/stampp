CREATE TABLE "holidays" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "time_off_requests" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"time_off_type_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"days" numeric(5,2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" varchar(2000),
	"decided_at" timestamp(3) with time zone,
	"decided_by" text,
	"decision_note" varchar(2000),
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "time_off_requests_range_check" CHECK ("end_date" >= "start_date"),
	CONSTRAINT "time_off_requests_days_positive_check" CHECK (("days") > 0),
	CONSTRAINT "time_off_requests_decided_requires_fields_check" CHECK (("status" in ('pending', 'canceled')) or ("status" in ('approved', 'rejected') and "decided_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "time_off_types" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(7),
	"paid" boolean DEFAULT true NOT NULL,
	"annual_allowance_days" numeric(5,2),
	"requires_approval" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "time_off_types_allowance_non_negative_check" CHECK ("annual_allowance_days" is null or "annual_allowance_days" >= 0)
);
--> statement-breakpoint
CREATE INDEX "holidays_workspace_id_idx" ON "holidays" ("workspace_id");--> statement-breakpoint
CREATE INDEX "holidays_workspace_id_date_idx" ON "holidays" ("workspace_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "holidays_workspace_name_date_unique" ON "holidays" ("workspace_id","name","date");--> statement-breakpoint
CREATE INDEX "time_off_requests_workspace_id_idx" ON "time_off_requests" ("workspace_id");--> statement-breakpoint
CREATE INDEX "time_off_requests_workspace_id_status_idx" ON "time_off_requests" ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "time_off_requests_workspace_id_user_id_start_date_idx" ON "time_off_requests" ("workspace_id","user_id","start_date");--> statement-breakpoint
CREATE INDEX "time_off_requests_workspace_id_type_id_idx" ON "time_off_requests" ("workspace_id","time_off_type_id");--> statement-breakpoint
CREATE INDEX "time_off_types_workspace_id_idx" ON "time_off_types" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "time_off_types_workspace_name_unique" ON "time_off_types" ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_time_off_type_id_time_off_types_id_fkey" FOREIGN KEY ("time_off_type_id") REFERENCES "time_off_types"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD CONSTRAINT "time_off_requests_decided_by_users_id_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "time_off_types" ADD CONSTRAINT "time_off_types_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "public"."holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."holidays" FORCE ROW LEVEL SECURITY;
CREATE POLICY "holidays_workspace_isolation" ON "public"."holidays" USING ("workspace_id" = current_setting('app.workspace_id', true));
--> statement-breakpoint
ALTER TABLE "public"."time_off_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."time_off_types" FORCE ROW LEVEL SECURITY;
CREATE POLICY "time_off_types_workspace_isolation" ON "public"."time_off_types" USING ("workspace_id" = current_setting('app.workspace_id', true));
--> statement-breakpoint
ALTER TABLE "public"."time_off_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."time_off_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "time_off_requests_workspace_isolation" ON "public"."time_off_requests" USING ("workspace_id" = current_setting('app.workspace_id', true));
