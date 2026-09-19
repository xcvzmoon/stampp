CREATE TABLE "tags" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"name" varchar(50) NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "time_entry_tags" (
	"workspace_id" text NOT NULL,
	"time_entry_id" text,
	"tag_id" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_entry_tags_pkey" PRIMARY KEY("time_entry_id","tag_id")
);
--> statement-breakpoint
CREATE INDEX "tags_workspace_id_idx" ON "tags" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_workspace_id_name_unique" ON "tags" ("workspace_id","name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "time_entry_tags_workspace_id_tag_id_idx" ON "time_entry_tags" ("workspace_id","tag_id");--> statement-breakpoint
CREATE INDEX "time_entry_tags_workspace_id_time_entry_id_idx" ON "time_entry_tags" ("workspace_id","time_entry_id");--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_entry_tags" ADD CONSTRAINT "time_entry_tags_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_entry_tags" ADD CONSTRAINT "time_entry_tags_time_entry_id_time_entries_id_fkey" FOREIGN KEY ("time_entry_id") REFERENCES "time_entries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "time_entry_tags" ADD CONSTRAINT "time_entry_tags_tag_id_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE;