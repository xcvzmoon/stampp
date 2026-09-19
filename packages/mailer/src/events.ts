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

  return {
    to: event.email,
    subject: 'Reset your Stampp password',
    text: `Reset your password:\n\n${event.resetUrl}`,
    html: `<p>Reset your password.</p><p><a href="${escapeAttr(event.resetUrl)}">Reset password</a></p>`,
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
