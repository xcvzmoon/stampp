import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { projects } from '../src/schemas/projects.ts';

describe('projects budget columns', () => {
  it('includes budget fields on projects', () => {
    const columns = getTableConfig(projects).columns.map((column) => column.name);
    expect(columns).toContain('budget_minutes');
    expect(columns).toContain('budget_amount_minor');
    expect(columns).toContain('budget_currency');
    expect(columns).toContain('budget_alert_at_percent');
  });

  it('defaults alert threshold to 80', () => {
    const alert = getTableConfig(projects).columns.find(
      (column) => column.name === 'budget_alert_at_percent',
    );
    expect(alert?.notNull).toBe(true);
  });
});
