import type { Db } from './client.ts';
import { sql } from 'drizzle-orm';

export const WORKSPACE_RLS_SETTING = 'app.workspace_id';

/**
 * Defense-in-depth for workspace isolation. Product handlers must still
 * filter by `workspace_id`; RLS fails closed when the GUC is missing.
 */
export const WORKSPACE_RLS_TABLES = [
  'approval_chains',
  'approval_decisions',
  'approval_runs',
  'attendance_records',
  'audit_events',
  'clients',
  'expenses',
  'holidays',
  'invoice_lines',
  'invoice_payments',
  'invoices',
  'kiosk_devices',
  'kiosk_member_credentials',
  'member_capacities',
  'project_assignments',
  'projects',
  'rates',
  'tags',
  'tasks',
  'time_entries',
  'time_entry_tags',
  'time_off_requests',
  'time_off_types',
  'timesheets',
  'webhook_deliveries',
  'webhook_subscriptions',
] as const;

export function buildWorkspaceRlsPolicySql(tableName: string): string {
  return `CREATE POLICY "${tableName}_workspace_isolation" ON "public"."${tableName}" USING ("workspace_id" = current_setting('app.workspace_id', true));`;
}

export function buildWorkspaceRlsEnableSql(tableName: string): string {
  return [
    `ALTER TABLE "public"."${tableName}" ENABLE ROW LEVEL SECURITY;`,
    `ALTER TABLE "public"."${tableName}" FORCE ROW LEVEL SECURITY;`,
    buildWorkspaceRlsPolicySql(tableName),
  ].join('\n');
}

export async function applyWorkspaceRlsContext(db: Db, workspaceId: string): Promise<void> {
  await db.execute(sql`select set_config(${WORKSPACE_RLS_SETTING}, ${workspaceId}, false)`);
}

export function renderWorkspaceRlsMigration(): string {
  const parts: string[] = [
    '-- Enable Postgres row-level security on workspace-scoped tables.',
    '-- App queries also filter workspace_id; RLS fails closed without app.workspace_id.',
  ];
  for (const tableName of WORKSPACE_RLS_TABLES) {
    parts.push(buildWorkspaceRlsEnableSql(tableName));
  }
  return `${parts.join('\n\n')}\n`;
}
