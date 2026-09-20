import { describe, expect, it } from 'vite-plus/test';
import { renderMailEvent } from '../src/index.ts';

describe('renderMailEvent', () => {
  it('renders timesheet submitted mail for managers', () => {
    const mail = renderMailEvent({
      type: 'timesheet.submitted',
      email: 'manager@example.com',
      memberName: 'Ada',
      workspaceName: 'Acme Studio',
      weekStart: '2026-09-14',
      timesheetUrl: 'https://stampp.example/w/ws_1/approvals',
    });
    expect(mail.to).toBe('manager@example.com');
    expect(mail.subject).toContain('Ada submitted a timesheet');
    expect(mail.text).toContain('2026-09-14');
  });

  it('renders timesheet rejected mail with reason', () => {
    const mail = renderMailEvent({
      type: 'timesheet.rejected',
      email: 'ada@example.com',
      workspaceName: 'Acme Studio',
      weekStart: '2026-09-14',
      note: 'Missing project labels',
      timesheetUrl: 'https://stampp.example/w/ws_1/time',
    });
    expect(mail.subject).toContain('rejected');
    expect(mail.text).toContain('Missing project labels');
  });

  it('renders invoice status mail', () => {
    const mail = renderMailEvent({
      type: 'invoice.status',
      email: 'billing@example.com',
      workspaceName: 'Acme Studio',
      invoiceNumber: 'INV-2026-0001',
      status: 'paid',
      invoiceUrl: 'https://stampp.example/w/ws_1/invoices',
    });
    expect(mail.subject).toContain('INV-2026-0001');
    expect(mail.subject).toContain('paid');
  });

  it('renders a workspace invite to the invitee', () => {
    const mail = renderMailEvent({
      type: 'workspace.invite',
      email: 'ada@example.com',
      inviterName: 'Grace',
      workspaceName: 'Acme Studio',
      inviteUrl: 'https://stampp.example/invite/abc',
    });

    expect(mail.to).toBe('ada@example.com');
    expect(mail.subject).toBe('You are invited to Acme Studio on Stampp');
    expect(mail.text).toContain('Grace invited you to join Acme Studio');
    expect(mail.text).toContain('https://stampp.example/invite/abc');
  });

  it('escapes HTML in invite names and workspace titles', () => {
    const mail = renderMailEvent({
      type: 'workspace.invite',
      email: 'ada@example.com',
      inviterName: 'Ada <Admin>',
      workspaceName: 'Acme & Co',
      inviteUrl: "https://stampp.example/invite/a'b",
    });

    expect(mail.html).toContain('&lt;Admin&gt;');
    expect(mail.html).toContain('Acme &amp; Co');
    expect(mail.html).toContain('a&#39;b');
  });

  it('renders email verification mail with the verify link', () => {
    const mail = renderMailEvent({
      type: 'auth.verify',
      email: 'bob@example.com',
      verifyUrl: 'https://stampp.example/verify?token=abc',
    });

    expect(mail.to).toBe('bob@example.com');
    expect(mail.subject).toBe('Verify your Stampp email');
    expect(mail.text).toContain('https://stampp.example/verify?token=abc');
    expect(mail.html).toContain('Verify email');
  });

  it('renders password reset mail with the reset link', () => {
    const mail = renderMailEvent({
      type: 'auth.password-reset',
      email: 'cee@example.com',
      resetUrl: 'https://stampp.example/reset?token=xyz',
    });

    expect(mail.to).toBe('cee@example.com');
    expect(mail.subject).toBe('Reset your Stampp password');
    expect(mail.text).toContain('https://stampp.example/reset?token=xyz');
    expect(mail.html).toContain('Reset password');
  });

  it('always produces both text and html bodies', () => {
    const mail = renderMailEvent({
      type: 'auth.verify',
      email: 'dave@example.com',
      verifyUrl: 'https://stampp.example/verify?token=1',
    });

    expect(mail.text.length).toBeGreaterThan(0);
    expect(mail.html.length).toBeGreaterThan(0);
  });
});
