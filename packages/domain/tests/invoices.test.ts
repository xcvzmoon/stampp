import { describe, expect, it } from 'vite-plus/test';
import {
  canTransitionInvoice,
  computeInvoiceTotals,
  formatInvoiceNumber,
  invoicePaidStatus,
  nextInvoiceStatus,
} from '../src/invoices.ts';

describe('invoice domain', () => {
  it('allows draft to sent/void and paid only from paidable states', () => {
    expect(canTransitionInvoice('send', 'draft')).toBe(true);
    expect(canTransitionInvoice('send', 'sent')).toBe(false);
    expect(canTransitionInvoice('pay', 'sent')).toBe(true);
    expect(canTransitionInvoice('void', 'paid')).toBe(true);
    expect(canTransitionInvoice('void', 'void')).toBe(false);
  });

  it('maps transition actions to statuses', () => {
    expect(nextInvoiceStatus('send')).toBe('sent');
    expect(nextInvoiceStatus('pay')).toBe('paid');
    expect(nextInvoiceStatus('void')).toBe('void');
  });

  it('computes totals with discount and tax basis points', () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 8, unitAmountMinor: 10_000 },
        { quantity: 1, unitAmountMinor: 2_500 },
      ],
      500,
      1_000,
    );
    expect(totals.subtotalMinor).toBe(82_500);
    expect(totals.discountMinor).toBe(500);
    expect(totals.taxMinor).toBe(8_200);
    expect(totals.totalMinor).toBe(90_200);
  });

  it('flags full payment status', () => {
    expect(invoicePaidStatus(100, 100)).toBe('paid');
    expect(invoicePaidStatus(50, 100)).toBeNull();
    expect(invoicePaidStatus(0, 0)).toBe('paid');
  });

  it('formats invoice numbers', () => {
    expect(formatInvoiceNumber(2026, 7)).toBe('INV-2026-0007');
  });
});
