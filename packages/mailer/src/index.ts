import { createEmail } from 'unemail';
import mock from 'unemail/drivers/mock';
import smtp from 'unemail/drivers/smtp';
import { withCircuitBreaker, withLogger } from 'unemail/middleware';

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

export type MailerEnv = {
  from: string;
  /** `mock` records in-process (tests/dev). `smtp` talks to Mailpit or a provider. */
  mode: 'mock' | 'smtp';
  smtpHost?: string;
  smtpPort?: number;
};

export type RenderedMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Queue retries belong to BullMQ, not UnEmail. */
export function createMailer(env: MailerEnv) {
  const driver =
    env.mode === 'mock'
      ? mock()
      : smtp({
          host: env.smtpHost ?? 'localhost',
          port: env.smtpPort ?? 1025,
          secure: false,
          rejectUnauthorized: false,
        });

  return createEmail({
    driver,
    defaults: { from: env.from },
    use: [withLogger(), withCircuitBreaker({ threshold: 5 })],
  });
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

/** Product handlers use this instead of `createMailer`. */
export type MailDispatch = {
  notify: (event: MailEvent) => Promise<void>;
};

export function createMailDispatch(env: MailerEnv): MailDispatch {
  const email = createMailer(env);

  return {
    async notify(event) {
      const message = renderMailEvent(event);
      const { error } = await email.send(message);
      if (error) {
        throw new Error(`Mail send failed: ${error.code} ${error.message}`);
      }
    },
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
