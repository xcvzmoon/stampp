export const EXPENSE_CATEGORIES = [
  'travel',
  'meals',
  'lodging',
  'software',
  'equipment',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseStatus = 'open' | 'approved' | 'rejected';

export const RECEIPT_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type ReceiptContentType = (typeof RECEIPT_CONTENT_TYPES)[number];

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export function isAllowedReceiptContentType(value: string): value is ReceiptContentType {
  for (const allowed of RECEIPT_CONTENT_TYPES) {
    if (allowed === value) {
      return true;
    }
  }
  return false;
}

export function assertReceiptSize(sizeBytes: number): boolean {
  return Number.isInteger(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_RECEIPT_BYTES;
}

export function receiptObjectKey(
  workspaceId: string,
  expenseId: string,
  extension: string,
): string {
  return `workspaces/${workspaceId}/expenses/${expenseId}/receipt${extension}`;
}

export function receiptExtensionFor(contentType: ReceiptContentType): string {
  switch (contentType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'application/pdf':
      return '.pdf';
    default: {
      const exhaustive: never = contentType;
      throw new RangeError(`Unknown receipt type: ${String(exhaustive)}`);
    }
  }
}

export function sumExpenseMinor(amounts: number[]): number {
  let total = 0;
  for (const amount of amounts) {
    if (!Number.isInteger(amount)) {
      throw new RangeError('Expense amounts must be integer minor units');
    }
    total += amount;
  }
  return total;
}
