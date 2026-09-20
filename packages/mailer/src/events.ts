import * as v from 'valibot';

/** Call sites pass these events, not raw SMTP payloads. */
export type MailEvent =
  | {
      type: 'workspace.invite';
      email: string;
      inviterName: string;
      workspaceName: string;
      inviteUrl: string;
    }
  | {
      type: 'auth.verify';
      email: string;
      verifyUrl: string;
    }
  | {
      type: 'auth.password-reset';
      email: string;
      resetUrl: string;
    }
  | {
      type: 'timesheet.submitted';
      email: string;
      memberName: string;
      workspaceName: string;
      weekStart: string;
      timesheetUrl: string;
    }
  | {
      type: 'timesheet.approved';
      email: string;
      workspaceName: string;
      weekStart: string;
      timesheetUrl: string;
    }
  | {
      type: 'timesheet.rejected';
      email: string;
      workspaceName: string;
      weekStart: string;
      note: string;
      timesheetUrl: string;
    }
  | {
      type: 'invoice.status';
      email: string;
      workspaceName: string;
      invoiceNumber: string;
      status: string;
      invoiceUrl: string;
    };

/** Untrusted BullMQ job body before schema validation. */
export type EmailJobWire = {
  type: string;
  email?: string | undefined;
  inviterName?: string | undefined;
  workspaceName?: string | undefined;
  inviteUrl?: string | undefined;
  verifyUrl?: string | undefined;
  resetUrl?: string | undefined;
  memberName?: string | undefined;
  weekStart?: string | undefined;
  timesheetUrl?: string | undefined;
  note?: string | undefined;
  invoiceNumber?: string | undefined;
  status?: string | undefined;
  invoiceUrl?: string | undefined;
};

export const mailEventSchema = v.variant('type', [
  v.object({
    type: v.literal('workspace.invite'),
    email: v.pipe(v.string(), v.email()),
    inviterName: v.pipe(v.string(), v.minLength(1)),
    workspaceName: v.pipe(v.string(), v.minLength(1)),
    inviteUrl: v.pipe(v.string(), v.url()),
  }),
  v.object({
    type: v.literal('auth.verify'),
    email: v.pipe(v.string(), v.email()),
    verifyUrl: v.pipe(v.string(), v.url()),
  }),
  v.object({
    type: v.literal('auth.password-reset'),
    email: v.pipe(v.string(), v.email()),
    resetUrl: v.pipe(v.string(), v.url()),
  }),
  v.object({
    type: v.literal('timesheet.submitted'),
    email: v.pipe(v.string(), v.email()),
    memberName: v.pipe(v.string(), v.minLength(1)),
    workspaceName: v.pipe(v.string(), v.minLength(1)),
    weekStart: v.pipe(v.string(), v.minLength(1)),
    timesheetUrl: v.pipe(v.string(), v.url()),
  }),
  v.object({
    type: v.literal('timesheet.approved'),
    email: v.pipe(v.string(), v.email()),
    workspaceName: v.pipe(v.string(), v.minLength(1)),
    weekStart: v.pipe(v.string(), v.minLength(1)),
    timesheetUrl: v.pipe(v.string(), v.url()),
  }),
  v.object({
    type: v.literal('timesheet.rejected'),
    email: v.pipe(v.string(), v.email()),
    workspaceName: v.pipe(v.string(), v.minLength(1)),
    weekStart: v.pipe(v.string(), v.minLength(1)),
    note: v.pipe(v.string(), v.minLength(1)),
    timesheetUrl: v.pipe(v.string(), v.url()),
  }),
  v.object({
    type: v.literal('invoice.status'),
    email: v.pipe(v.string(), v.email()),
    workspaceName: v.pipe(v.string(), v.minLength(1)),
    invoiceNumber: v.pipe(v.string(), v.minLength(1)),
    status: v.pipe(v.string(), v.minLength(1)),
    invoiceUrl: v.pipe(v.string(), v.url()),
  }),
]);

export type RenderedMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function formatMailEventIssues(issues: readonly { message: string }[]): string {
  const messages: string[] = [];
  for (const issue of issues) {
    messages.push(issue.message);
  }
  return messages.join('; ');
}

export function renderMailEvent(event: MailEvent): RenderedMail {
  if (event.type === 'workspace.invite') {
    return {
      to: event.email,
      subject: `You are invited to ${event.workspaceName} on Stampp`,
      text: `${event.inviterName} invited you to join ${event.workspaceName}.\n\nAccept: ${event.inviteUrl}`,
      html: `<p>${escapeHtml(event.inviterName)} invited you to join <strong>${escapeHtml(event.workspaceName)}</strong>.</p><p><a href="${escapeAttr(event.inviteUrl)}">Accept invite</a></p>`,
    };
  }

  if (event.type === 'auth.verify') {
    return {
      to: event.email,
      subject: 'Verify your Stampp email',
      text: `Confirm your email address:\n\n${event.verifyUrl}`,
      html: `<p>Confirm your email address.</p><p><a href="${escapeAttr(event.verifyUrl)}">Verify email</a></p>`,
    };
  }

  if (event.type === 'auth.password-reset') {
    return {
      to: event.email,
      subject: 'Reset your Stampp password',
      text: `Reset your password:\n\n${event.resetUrl}`,
      html: `<p>Reset your password.</p><p><a href="${escapeAttr(event.resetUrl)}">Reset password</a></p>`,
    };
  }

  if (event.type === 'timesheet.submitted') {
    return {
      to: event.email,
      subject: `${event.memberName} submitted a timesheet in ${event.workspaceName}`,
      text: `${event.memberName} submitted the week starting ${event.weekStart} in ${event.workspaceName}.\n\nReview: ${event.timesheetUrl}`,
      html: `<p><strong>${escapeHtml(event.memberName)}</strong> submitted the week starting <strong>${escapeHtml(event.weekStart)}</strong> in ${escapeHtml(event.workspaceName)}.</p><p><a href="${escapeAttr(event.timesheetUrl)}">Review approvals</a></p>`,
    };
  }

  if (event.type === 'timesheet.approved') {
    return {
      to: event.email,
      subject: `Timesheet approved in ${event.workspaceName}`,
      text: `Your timesheet for the week starting ${event.weekStart} was approved.\n\nOpen: ${event.timesheetUrl}`,
      html: `<p>Your timesheet for the week starting <strong>${escapeHtml(event.weekStart)}</strong> was approved in ${escapeHtml(event.workspaceName)}.</p><p><a href="${escapeAttr(event.timesheetUrl)}">Open timesheet</a></p>`,
    };
  }

  if (event.type === 'timesheet.rejected') {
    return {
      to: event.email,
      subject: `Timesheet rejected in ${event.workspaceName}`,
      text: `Your timesheet for the week starting ${event.weekStart} was rejected.\n\nReason: ${event.note}\n\nOpen: ${event.timesheetUrl}`,
      html: `<p>Your timesheet for the week starting <strong>${escapeHtml(event.weekStart)}</strong> was rejected in ${escapeHtml(event.workspaceName)}.</p><p>Reason: ${escapeHtml(event.note)}</p><p><a href="${escapeAttr(event.timesheetUrl)}">Open timesheet</a></p>`,
    };
  }

  return {
    to: event.email,
    subject: `Invoice ${event.invoiceNumber} is ${event.status}`,
    text: `Invoice ${event.invoiceNumber} in ${event.workspaceName} is now ${event.status}.\n\nOpen: ${event.invoiceUrl}`,
    html: `<p>Invoice <strong>${escapeHtml(event.invoiceNumber)}</strong> in ${escapeHtml(event.workspaceName)} is now <strong>${escapeHtml(event.status)}</strong>.</p><p><a href="${escapeAttr(event.invoiceUrl)}">Open invoices</a></p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
