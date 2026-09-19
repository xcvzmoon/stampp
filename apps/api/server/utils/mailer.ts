import type { EmailWorker, MailDispatch } from '@stampp/mailer';
import {
  createBullmqEmailQueue,
  createEmailWorker,
  createMailDispatch,
  createQueuedMailDispatch,
  createValkeyConnection,
} from '@stampp/mailer';
import { ENV } from '~/server/utils/env.ts';

let runtime: EmailRuntime | undefined;

export type EmailRuntime = {
  dispatch: MailDispatch;
  worker: EmailWorker | undefined;
  close: () => Promise<void>;
};

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

/** Test runs stay offline; runtime environments enqueue onto Valkey. */
export function resolveMailDispatchMode(appEnv: string | undefined): 'in-process' | 'queue' {
  return appEnv === 'test' ? 'in-process' : 'queue';
}

function toPortNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getEmailRuntime(): EmailRuntime {
  if (runtime) {
    return runtime;
  }

  const mailerEnv = resolveMailerEnv({
    MAIL_FROM: ENV.MAIL_FROM,
    MAIL_MODE: ENV.MAIL_MODE,
    SMTP_HOST: ENV.SMTP_HOST,
    SMTP_PORT: ENV.SMTP_PORT,
  });

  if (resolveMailDispatchMode(ENV.APP_ENV) === 'in-process') {
    runtime = {
      dispatch: createMailDispatch(mailerEnv),
      worker: undefined,
      async close() {},
    };
    return runtime;
  }

  // Queue and worker must not share a Redis connection.
  const queueConnection = createValkeyConnection(ENV.VALKEY_URL);
  const workerConnection = createValkeyConnection(ENV.VALKEY_URL);
  const queue = createBullmqEmailQueue(queueConnection);
  const worker = createEmailWorker(workerConnection, mailerEnv);

  runtime = {
    dispatch: createQueuedMailDispatch(queue),
    worker,
    async close() {
      await worker.close();
      await queue.close();
      workerConnection.disconnect();
      queueConnection.disconnect();
    },
  };
  return runtime;
}

export function getMailDispatch(): MailDispatch {
  return getEmailRuntime().dispatch;
}
