import { describe, expect, it } from 'vite-plus/test';
import { createMailDispatch } from '../src/index.ts';

const from = 'Stampp <hello@stampp.example>';

describe('createMailDispatch', () => {
  it('delivers verify mail through the mock transport', async () => {
    const dispatch = createMailDispatch({ from, mode: 'mock' });

    await expect(
      dispatch.notify({
        type: 'auth.verify',
        email: 'ada@example.com',
        verifyUrl: 'https://stampp.example/verify?token=abc',
      }),
    ).resolves.toBeUndefined();
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

    await expect(
      dispatch.notify({
        type: 'auth.verify',
        email: 'ada@example.com',
        verifyUrl: 'https://stampp.example/verify?token=abc',
      }),
    ).rejects.toThrow(/Mail send failed/);
  });
});
