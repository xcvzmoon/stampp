import { createEmail } from 'unemail';
import mock from 'unemail/drivers/mock';
import smtp from 'unemail/drivers/smtp';
import { withCircuitBreaker, withLogger } from 'unemail/middleware';

/**
 * Typed transactional events. Call sites use these, not raw SMTP payloads.
 *
 * @example
 * ```ts
 * const event: MailEvent = {
 *   type: 'workspace.invite',
 *   email: 'ada@example.com',
 *   inviterName: 'Grace',
 *   workspaceName: 'Acme Studio',
 *   inviteUrl: 'https://stampp.example/invite/abc',
 * };
 * ```
 */
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

/**
 * Mail transport settings.
 *
 * `mode: 'mock'` records sends in-process (tests, default dev). `mode: 'smtp'` talks to Mailpit or a real provider.
 *
 * @example
 * ```ts
 * const env: MailerEnv = {
 *   from: 'Stampp <hello@stampp.example>',
 *   mode: 'mock',
 * };
 *
 * const smtpEnv: MailerEnv = {
 *   from: 'Stampp <hello@stampp.example>',
 *   mode: 'smtp',
 *   smtpHost: 'localhost',
 *   smtpPort: 1025,
 * };
 * ```
 */
export type MailerEnv = {
  from: string;
  mode: 'mock' | 'smtp';
  smtpHost?: string;
  smtpPort?: number;
};

/**
 * Normalized message ready for UnEmail `send`.
 *
 * @example
 * ```ts
 * const mail = renderMailEvent({
 *   type: 'auth.verify',
 *   email: 'bob@example.com',
 *   verifyUrl: 'https://stampp.example/verify?token=abc',
 * });
 * mail.subject; // 'Verify your Stampp email'
 * ```
 */
export type RenderedMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Builds an UnEmail client for the given env.
 *
 * Includes logger and circuit breaker middleware. Queue retries belong to BullMQ, not UnEmail.
 *
 * @example
 * ```ts
 * const email = createMailer({
 *   from: 'Stampp <hello@stampp.example>',
 *   mode: 'mock',
 * });
 *
 * const { error } = await email.send(
 *   renderMailEvent({
 *     type: 'auth.verify',
 *     email: 'ada@example.com',
 *     verifyUrl: 'https://stampp.example/verify?token=abc',
 *   }),
 * );
 * ```
 */
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

/**
 * Turns a {@link MailEvent} into subject/body. HTML values are escaped.
 *
 * @example
 * ```ts
 * const mail = renderMailEvent({
 *   type: 'workspace.invite',
 *   email: 'ada@example.com',
 *   inviterName: 'Ada <Admin>',
 *   workspaceName: 'Acme & Co',
 *   inviteUrl: 'https://stampp.example/invite/abc',
 * });
 * mail.html.includes('&amp;'); // true
 * ```
 */
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

/**
 * Call-site API for product code. Prefer this over `createMailer` in handlers.
 *
 * @example
 * ```ts
 * const mail = createMailDispatch({
 *   from: 'Stampp <hello@stampp.example>',
 *   mode: 'mock',
 * });
 *
 * await mail.notify({
 *   type: 'auth.verify',
 *   email: 'ada@example.com',
 *   verifyUrl: 'https://stampp.example/verify?token=abc',
 * });
 * ```
 */
export type MailDispatch = {
  notify: (event: MailEvent) => Promise<void>;
};

/**
 * Creates a {@link MailDispatch} that renders and sends through UnEmail.
 *
 * Throws when the transport rejects the message (invalid from, provider error).
 *
 * @example
 * ```ts
 * const dispatch = createMailDispatch({
 *   from: 'Stampp <hello@stampp.example>',
 *   mode: 'mock',
 * });
 *
 * await dispatch.notify({
 *   type: 'workspace.invite',
 *   email: 'bob@example.com',
 *   inviterName: 'Ada',
 *   workspaceName: 'Acme',
 *   inviteUrl: 'https://stampp.example/invite/1',
 * });
 * ```
 */
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
