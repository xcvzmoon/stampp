import type { MailDispatch } from '@stampp/mailer';
import { createMailDispatch } from '@stampp/mailer';
import { ENV } from '~/server/utils/env.ts';

let mail: MailDispatch | undefined;

export function resolveMailerEnv(env: {
  MAIL_FROM?: string | undefined;
  MAIL_MODE?: string | undefined;
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: string | number | undefined;
}) {
  return {
    from: env.MAIL_FROM ?? 'Stampp <hello@localhost>',
    mode: env.MAIL_MODE === 'smtp' ? ('smtp' as const) : ('mock' as const),
    smtpHost: env.SMTP_HOST,
    smtpPort: toPortNumber(env.SMTP_PORT),
  };
}

function toPortNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getMailDispatch(): MailDispatch {
  if (mail) {
    return mail;
  }

  mail = createMailDispatch(
    resolveMailerEnv({
      MAIL_FROM: ENV.MAIL_FROM,
      MAIL_MODE: ENV.MAIL_MODE,
      SMTP_HOST: ENV.SMTP_HOST,
      SMTP_PORT: ENV.SMTP_PORT,
    }),
  );
  return mail;
}
