import { describe, expect, it } from 'vite-plus/test';
import {
  buildWorkspaceRlsPolicySql,
  renderWorkspaceRlsMigration,
  WORKSPACE_RLS_TABLES,
} from '../src/rls.ts';

describe('workspace rls sql', () => {
  it('enables and forces row level security with fail-closed policies', () => {
    const sql = renderWorkspaceRlsMigration();
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("current_setting('app.workspace_id', true)");
  });

  it('covers core workspace-scoped product tables', () => {
    expect(WORKSPACE_RLS_TABLES).toContain('clients');
    expect(WORKSPACE_RLS_TABLES).toContain('time_entries');
    expect(WORKSPACE_RLS_TABLES).toContain('expenses');
    expect(WORKSPACE_RLS_TABLES).toContain('invoices');
    expect(WORKSPACE_RLS_TABLES).not.toContain('personal_access_tokens');
  });

  it('builds a named policy per table', () => {
    expect(buildWorkspaceRlsPolicySql('clients')).toContain('clients_workspace_isolation');
  });
});
