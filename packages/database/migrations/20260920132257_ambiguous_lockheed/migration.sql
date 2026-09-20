ALTER TABLE "projects" ADD COLUMN "budget_minutes" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_amount_minor" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_currency" varchar(3);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "budget_alert_at_percent" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_budget_minutes_nonnegative_check" CHECK ("budget_minutes" is null or "budget_minutes" > 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_budget_amount_nonnegative_check" CHECK ("budget_amount_minor" is null or "budget_amount_minor" >= 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_budget_currency_with_amount_check" CHECK (("budget_amount_minor" is null and "budget_currency" is null) or ("budget_amount_minor" is not null and "budget_currency" is not null));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_budget_alert_percent_check" CHECK ("budget_alert_at_percent" > 0 and "budget_alert_at_percent" <= 100);