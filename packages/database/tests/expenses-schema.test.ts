import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vite-plus/test';
import { expenses } from '../src/schemas/expenses.ts';

describe('expenses schema', () => {
  it('uses plural snake_case table name', () => {
    expect(getTableConfig(expenses).name).toBe('expenses');
  });

  it('requires workspace, user, date, amount, and currency', () => {
    const columns = getTableConfig(expenses).columns;
    for (const name of [
      'workspace_id',
      'user_id',
      'expense_date',
      'amount_minor',
      'currency',
      'category',
      'status',
    ]) {
      const column = columns.find((entry) => entry.name === name);
      expect(column?.notNull).toBe(true);
    }
  });

  it('indexes workspace and owner lookups', () => {
    const indexes = getTableConfig(expenses).indexes.map((entry) => entry.config.name);
    expect(indexes).toContain('expenses_workspace_id_idx');
    expect(indexes).toContain('expenses_workspace_id_user_id_expense_date_idx');
    expect(indexes).toContain('expenses_workspace_id_status_idx');
  });
});
