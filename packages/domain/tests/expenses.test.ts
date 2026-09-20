import { describe, expect, it } from 'vite-plus/test';
import {
  assertReceiptSize,
  EXPENSE_CATEGORIES,
  isAllowedReceiptContentType,
  MAX_RECEIPT_BYTES,
  receiptExtensionFor,
  receiptObjectKey,
  sumExpenseMinor,
} from '../src/expenses.ts';

describe('expense domain', () => {
  it('exposes stable categories', () => {
    expect(EXPENSE_CATEGORIES).toContain('travel');
    expect(EXPENSE_CATEGORIES).toContain('other');
  });

  it('allows only receipt content types in the allowlist', () => {
    expect(isAllowedReceiptContentType('image/jpeg')).toBe(true);
    expect(isAllowedReceiptContentType('application/pdf')).toBe(true);
    expect(isAllowedReceiptContentType('text/html')).toBe(false);
  });

  it('caps receipts at 5MB', () => {
    expect(assertReceiptSize(1)).toBe(true);
    expect(assertReceiptSize(MAX_RECEIPT_BYTES)).toBe(true);
    expect(assertReceiptSize(MAX_RECEIPT_BYTES + 1)).toBe(false);
    expect(assertReceiptSize(0)).toBe(false);
  });

  it('maps content types to object key extensions', () => {
    expect(receiptExtensionFor('image/png')).toBe('.png');
    expect(receiptExtensionFor('application/pdf')).toBe('.pdf');
    expect(receiptObjectKey('ws_1', 'exp_1', '.pdf')).toBe(
      'workspaces/ws_1/expenses/exp_1/receipt.pdf',
    );
  });

  it('sums integer minor amounts', () => {
    expect(sumExpenseMinor([100, 250])).toBe(350);
    expect(() => sumExpenseMinor([1.5])).toThrow(RangeError);
  });
});
