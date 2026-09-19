import { UnrecoverableError } from 'bullmq';
import { describe, expect, it } from 'vite-plus/test';
import {
  createMailDispatch,
  createQueuedMailDispatch,
  processEmailJob,
  type MailEvent,
} from '../src/index.ts';

const from = 'Stampp <hello@stampp.example>';

const verifyEvent: MailEvent = {
  type: 'auth.verify',
  email: 'ada@example.com',
  verifyUrl: 'https://stampp.example/verify?token=abc',
};

describe('createMailDispatch', () => {
  it('delivers verify mail through the mock transport', async () => {
    const dispatch = createMailDispatch({ from, mode: 'mock' });

    await expect(dispatch.notify(verifyEvent)).resolves.toBeUndefined();
  });

  it('delivers invite mail through the mock transport', async () => {
    const dispatch = createMailDispatch({ from, mode: 'mock' });

    await expect(
      dispatch.notify({
        type: 'workspace.invite',
        email: 'bob@example.com',
        inviterName: 'Ada',
        workspaceName: 'Acme',
        inviteUrl: 'https://stampp.example/invite/1',
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects an invalid from address at send time', async () => {
    const dispatch = createMailDispatch({
      from: 'Stampp <not-an-email>',
      mode: 'mock',
    });

    await expect(dispatch.notify(verifyEvent)).rejects.toThrow(/Mail send failed/);
  });
});

describe('createQueuedMailDispatch', () => {
  it('enqueues the mail event without sending in-process', async () => {
    const enqueued: MailEvent[] = [];
    const dispatch = createQueuedMailDispatch({
      enqueue(event) {
        enqueued.push(event);
        return Promise.resolve();
      },
      close() {
        return Promise.resolve();
      },
    });

    await dispatch.notify(verifyEvent);

    expect(enqueued).toEqual([verifyEvent]);
  });

  it('propagates enqueue failures to the caller', async () => {
    const dispatch = createQueuedMailDispatch({
      enqueue() {
        return Promise.reject(new Error('valkey unavailable'));
      },
      close() {
        return Promise.resolve();
      },
    });

    await expect(dispatch.notify(verifyEvent)).rejects.toThrow('valkey unavailable');
  });
});

describe('processEmailJob', () => {
  it('sends valid jobs through the mock transport', async () => {
    await expect(processEmailJob(verifyEvent, { from, mode: 'mock' })).resolves.toBeUndefined();
  });

  it('marks incomplete payloads as unrecoverable', async () => {
    await expect(
      processEmailJob({ type: 'auth.verify' }, { from, mode: 'mock' }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('marks unknown event types as unrecoverable', async () => {
    await expect(
      processEmailJob({ type: 'mail.bomb', email: 'a@b.co' }, { from, mode: 'mock' }),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('surfaces transport failures for BullMQ retries', async () => {
    await expect(
      processEmailJob(verifyEvent, { from: 'Stampp <not-an-email>', mode: 'mock' }),
    ).rejects.toThrow(/Mail send failed/);
  });
});
