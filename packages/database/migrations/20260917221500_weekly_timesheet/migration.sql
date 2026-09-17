ALTER TABLE "time_entries" ADD COLUMN "work_date" date;--> statement-breakpoint
UPDATE "time_entries"
SET "work_date" = (
  COALESCE("start_at", "created_at") AT TIME ZONE CASE
    WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = "time_entries"."timezone")
      THEN "timezone"
    ELSE 'UTC'
  END
)::date;--> statement-breakpoint
ALTER TABLE "time_entries" ALTER COLUMN "work_date" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "time_entries_workspace_id_user_id_work_date_idx" ON "time_entries" ("workspace_id", "user_id", "work_date");
