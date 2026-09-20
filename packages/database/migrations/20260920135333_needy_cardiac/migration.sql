CREATE TABLE "invoice_lines" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"kind" text NOT NULL,
	"source_id" text,
	"description" varchar(500) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_amount_minor" integer NOT NULL,
	"amount_minor" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"paid_at" timestamp(3) with time zone NOT NULL,
	"method" varchar(64),
	"notes" text,
	"created_by" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "invoice_payments_amount_positive_check" CHECK ("amount_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY,
	"workspace_id" text NOT NULL,
	"client_id" text,
	"project_id" text,
	"number" varchar(32) NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"currency" varchar(3) NOT NULL,
	"subtotal_minor" integer DEFAULT 0 NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"paid_minor" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp(3) with time zone,
	CONSTRAINT "invoices_amounts_nonnegative_check" CHECK ("subtotal_minor" >= 0 and "discount_minor" >= 0 and "tax_minor" >= 0 and "total_minor" >= 0 and "paid_minor" >= 0)
);
--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines" ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_lines_workspace_id_idx" ON "invoice_lines" ("workspace_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_id_idx" ON "invoice_payments" ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_workspace_id_idx" ON "invoice_payments" ("workspace_id");--> statement-breakpoint
CREATE INDEX "invoices_workspace_id_idx" ON "invoices" ("workspace_id");--> statement-breakpoint
CREATE INDEX "invoices_workspace_id_status_idx" ON "invoices" ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_workspace_number_unique" ON "invoices" ("workspace_id","number");--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_organizations_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;