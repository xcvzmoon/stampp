-- Enable Postgres row-level security on workspace-scoped tables.
-- App queries also filter workspace_id; RLS fails closed without app.workspace_id.

ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "audit_events_workspace_isolation" ON "public"."audit_events" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."clients" FORCE ROW LEVEL SECURITY;
CREATE POLICY "clients_workspace_isolation" ON "public"."clients" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."expenses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "expenses_workspace_isolation" ON "public"."expenses" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoice_lines" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invoice_lines_workspace_isolation" ON "public"."invoice_lines" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."invoice_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoice_payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invoice_payments_workspace_isolation" ON "public"."invoice_payments" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "invoices_workspace_isolation" ON "public"."invoices" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."projects" FORCE ROW LEVEL SECURITY;
CREATE POLICY "projects_workspace_isolation" ON "public"."projects" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rates_workspace_isolation" ON "public"."rates" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tags_workspace_isolation" ON "public"."tags" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tasks_workspace_isolation" ON "public"."tasks" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."time_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."time_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "time_entries_workspace_isolation" ON "public"."time_entries" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."time_entry_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."time_entry_tags" FORCE ROW LEVEL SECURITY;
CREATE POLICY "time_entry_tags_workspace_isolation" ON "public"."time_entry_tags" USING ("workspace_id" = current_setting('app.workspace_id', true));

ALTER TABLE "public"."timesheets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."timesheets" FORCE ROW LEVEL SECURITY;
CREATE POLICY "timesheets_workspace_isolation" ON "public"."timesheets" USING ("workspace_id" = current_setting('app.workspace_id', true));
