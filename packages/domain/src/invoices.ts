export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void';

export type InvoiceLineKind = 'time' | 'expense' | 'manual';

export type InvoiceTransition = 'send' | 'pay' | 'void';

const ALLOWED: Record<InvoiceTransition, ReadonlySet<InvoiceStatus>> = {
  send: new Set<InvoiceStatus>(['draft']),
  pay: new Set<InvoiceStatus>(['draft', 'sent']),
  void: new Set<InvoiceStatus>(['draft', 'sent', 'paid']),
};

export function canTransitionInvoice(action: InvoiceTransition, current: InvoiceStatus): boolean {
  return ALLOWED[action].has(current);
}

export function nextInvoiceStatus(action: InvoiceTransition): InvoiceStatus {
  switch (action) {
    case 'send':
      return 'sent';
    case 'pay':
      return 'paid';
    case 'void':
      return 'void';
    default: {
      const exhaustive: never = action;
      throw new RangeError(`Unknown invoice transition: ${String(exhaustive)}`);
    }
  }
}

export type InvoiceLineInput = {
  quantity: number;
  unitAmountMinor: number;
};

export type InvoiceTotals = {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export function computeInvoiceTotals(
  lines: InvoiceLineInput[],
  discountMinor: number,
  taxRateBps: number,
): InvoiceTotals {
  let subtotalMinor = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new RangeError('Invoice line quantity must be a non-negative integer');
    }
    if (!Number.isInteger(line.unitAmountMinor) || line.unitAmountMinor < 0) {
      throw new RangeError('Invoice line unit amount must be a non-negative integer');
    }
    subtotalMinor += line.quantity * line.unitAmountMinor;
  }
  if (!Number.isInteger(discountMinor) || discountMinor < 0) {
    throw new RangeError('Discount must be a non-negative integer');
  }
  if (!Number.isInteger(taxRateBps) || taxRateBps < 0) {
    throw new RangeError('Tax rate must be a non-negative integer in basis points');
  }
  const discounted = Math.max(0, subtotalMinor - discountMinor);
  const taxMinor = Math.round((discounted * taxRateBps) / 10_000);
  return {
    subtotalMinor,
    discountMinor,
    taxMinor,
    totalMinor: discounted + taxMinor,
  };
}

export function invoicePaidStatus(paidMinor: number, totalMinor: number): InvoiceStatus | null {
  if (totalMinor <= 0) return 'paid';
  if (paidMinor >= totalMinor) return 'paid';
  return null;
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('Invoice sequence must be a positive integer');
  }
  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
}
