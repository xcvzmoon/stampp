import type { EmailQueue } from './dispatch.ts';
import type { MailerEnv } from './transport.ts';
import { Queue, UnrecoverableError, Worker, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import * as v from 'valibot';
import { formatMailEventIssues, mailEventSchema, type EmailJobWire } from './events.ts';
import { sendMailEvent } from './transport.ts';

export const EMAIL_QUEUE_NAME = 'email';
export const EMAIL_JOB_NAME = 'send';

export const emailJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: 'exponential',
    delay: 1_000,
  },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 86_400, count: 500 },
};

export type EmailWorker = Worker<EmailJobWire>;

/** BullMQ workers require maxRetriesPerRequest: null. */
export function createValkeyConnection(url: string): Redis {
  return new Redis(url, {
    maxRetriesPerRequest: null,
  });
}

export function createBullmqEmailQueue(connection: Redis): EmailQueue {
  const queue = new Queue<EmailJobWire>(EMAIL_QUEUE_NAME, {
    connection,
    defaultJobOptions: emailJobOptions,
  });

  return {
    async enqueue(event) {
      const parsed = v.safeParse(mailEventSchema, event);
      if (!parsed.success) {
        throw new Error(`email.event.invalid: ${formatMailEventIssues(parsed.issues)}`);
      }
      await queue.add(EMAIL_JOB_NAME, parsed.output);
    },
    async close() {
      await queue.close();
    },
  };
}

/** Invalid job payloads must fail permanently so poison messages are not retried. */
export async function processEmailJob(wire: EmailJobWire, mailer: MailerEnv): Promise<void> {
  const parsed = v.safeParse(mailEventSchema, wire);
  if (!parsed.success) {
    throw new UnrecoverableError(`email.job.invalid: ${formatMailEventIssues(parsed.issues)}`);
  }
  await sendMailEvent(parsed.output, mailer);
}

export function createEmailWorker(connection: Redis, mailer: MailerEnv): EmailWorker {
  return new Worker<EmailJobWire>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await processEmailJob(job.data, mailer);
    },
    { connection },
  );
}
