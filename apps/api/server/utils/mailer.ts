import type { MailDispatch } from '@stampp/mailer';
import { createMailDispatch } from '@stampp/mailer';

let mail: MailDispatch | undefined;

export function resolveMailerEnv(env: {
  MAIL_FROM?: string | undefined;
  MAIL_MODE?: string | undefined;
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: string | undefined;
}) {
  const smtpPortRaw = env.SMTP_PORT;
  return {
    from: env.MAIL_FROM ?? 'Stampp <hello@localhost>',
    mode: env.MAIL_MODE === 'smtp' ? ('smtp' as const) : ('mock' as const),
    smtpHost: env.SMTP_HOST,
    smtpPort: smtpPortRaw ? Number.parseInt(smtpPortRaw, 10) : undefined,
  };
}

export function getMailDispatch(): MailDispatch {
  if (mail) {
    return mail;
  }

  mail = createMailDispatch(resolveMailerEnv(process.env));
  return mail;
}
