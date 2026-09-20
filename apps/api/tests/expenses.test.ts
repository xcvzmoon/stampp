import { ERROR_CODES, createExpenseInputSchema } from '@stampp/shared';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';
import { toExpenseDto } from '~/server/utils/expenses.ts';

describe('createExpenseInputSchema', () => {
  it('accepts a valid expense', () => {
    const result = v.safeParse(createExpenseInputSchema, {
      expenseDate: '2026-09-20',
      amountMinor: 2500,
      currency: 'usd',
      category: 'meals',
      description: 'Client lunch',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.currency).toBe('USD');
    }
  });

  it('rejects zero amounts', () => {
    const result = v.safeParse(createExpenseInputSchema, {
      expenseDate: '2026-09-20',
      amountMinor: 0,
      currency: 'USD',
      category: 'other',
      description: 'x',
    });
    expect(result.success).toBe(false);
  });
});

describe('toExpenseDto', () => {
  it('maps receipt metadata and defaults', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    const dto = toExpenseDto({
      id: 'exp_1',
      workspaceId: 'ws_1',
      userId: 'user_1',
      projectId: null,
      expenseDate: '2026-09-20',
      amountMinor: 1200,
      currency: 'USD',
      category: 'travel',
      description: 'Train',
      notes: null,
      billable: false,
      status: 'open',
      receiptKey: 'workspaces/ws_1/expenses/exp_1/receipt.pdf',
      receiptFilename: 'receipt.pdf',
      receiptContentType: 'application/pdf',
      receiptSizeBytes: 1000,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    expect(dto.hasReceipt).toBe(true);
    expect(dto.status).toBe('open');
  });
});

describe('expense error status mapping', () => {
  it('maps unconfigured storage to 503', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.STORAGE_NOT_CONFIGURED)).toBe(503);
  });
});
