import { ERROR_CODES, createInvoiceInputSchema } from '@stampp/shared';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';
import { toInvoiceDto } from '~/server/utils/invoices.ts';

describe('createInvoiceInputSchema', () => {
  it('accepts a draft invoice with lines', () => {
    const result = v.safeParse(createInvoiceInputSchema, {
      issueDate: '2026-09-20',
      currency: 'usd',
      lines: [
        {
          kind: 'manual',
          description: 'Consulting',
          quantity: 8,
          unitAmountMinor: 15_000,
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.currency).toBe('USD');
    }
  });

  it('rejects empty lines', () => {
    const result = v.safeParse(createInvoiceInputSchema, {
      issueDate: '2026-09-20',
      currency: 'USD',
      lines: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('toInvoiceDto', () => {
  it('computes remaining balance', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    const dto = toInvoiceDto(
      {
        id: 'inv_1',
        workspaceId: 'ws_1',
        clientId: null,
        projectId: null,
        number: 'INV-2026-0001',
        status: 'sent',
        issueDate: '2026-09-20',
        dueDate: null,
        currency: 'USD',
        subtotalMinor: 10_000,
        discountMinor: 0,
        taxRateBps: 0,
        taxMinor: 0,
        totalMinor: 10_000,
        paidMinor: 2_500,
        notes: null,
        createdBy: 'user_1',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      [],
      [],
    );
    expect(dto.balanceMinor).toBe(7_500);
  });
});

describe('invoice error status mapping', () => {
  it('maps invoice business rules to 422', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.INVOICE_INVALID_TRANSITION)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.INVOICE_EMPTY)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.INVOICE_OVERPAYMENT)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.INVOICE_NOT_DRAFT)).toBe(422);
  });
});
