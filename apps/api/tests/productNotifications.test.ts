import { mailEventSchema, renderMailEvent } from '@stampp/mailer';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';

describe('product mail events', () => {
  it('validates timesheet submitted payloads', () => {
    const result = v.safeParse(mailEventSchema, {
      type: 'timesheet.submitted',
      email: 'manager@example.com',
      memberName: 'Ada',
      workspaceName: 'Acme',
      weekStart: '2026-09-14',
      timesheetUrl: 'https://example.com/approvals',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invoice status events without a number', () => {
    const result = v.safeParse(mailEventSchema, {
      type: 'invoice.status',
      email: 'a@b.co',
      workspaceName: 'Acme',
      invoiceNumber: '',
      status: 'paid',
      invoiceUrl: 'https://example.com/invoices',
    });
    expect(result.success).toBe(false);
  });

  it('renders approved timesheet mail', () => {
    const mail = renderMailEvent({
      type: 'timesheet.approved',
      email: 'ada@example.com',
      workspaceName: 'Acme',
      weekStart: '2026-09-14',
      timesheetUrl: 'https://example.com/time',
    });
    expect(mail.subject).toContain('approved');
  });
});
