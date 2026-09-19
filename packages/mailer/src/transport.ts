import { createEmail } from 'unemail';
import mock from 'unemail/drivers/mock';
import smtp from 'unemail/drivers/smtp';
import { withCircuitBreaker, withLogger } from 'unemail/middleware';
import { renderMailEvent, type MailEvent } from './events.ts';

export type MailerEnv = {
  from: string;
  /** `mock` records in-process (tests/dev). `smtp` talks to Mailpit or a provider. */
  mode: 'mock' | 'smtp';
  smtpHost?: string;
  smtpPort?: number;
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

export async function sendMailEvent(event: MailEvent, env: MailerEnv): Promise<void> {
  const email = createMailer(env);
  const message = renderMailEvent(event);
  const { error } = await email.send(message);
  if (error) {
    throw new Error(`Mail send failed: ${error.code} ${error.message}`);
  }
}
