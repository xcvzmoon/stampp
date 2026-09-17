import { describe, expect, it } from 'vite-plus/test';
import { resolveAuthEnv } from '~/server/utils/auth.ts';
import { resolveMailerEnv } from '~/server/utils/mailer.ts';

const longSecret = 'a'.repeat(32);

describe('resolveAuthEnv', () => {
  it('returns secret and base URL when both are present', () => {
    const env = resolveAuthEnv({
      BETTER_AUTH_SECRET: longSecret,
      BETTER_AUTH_URL: 'http://localhost:3000',
    });
    expect(env).toEqual({
      secret: longSecret,
      baseURL: 'http://localhost:3000',
    });
  });

  it('falls back to PUBLIC_APP_URL for base URL', () => {
    const env = resolveAuthEnv({
      BETTER_AUTH_SECRET: longSecret,
      PUBLIC_APP_URL: 'http://localhost:3000',
    });
    expect(env.baseURL).toBe('http://localhost:3000');
  });

  it('prefers BETTER_AUTH_URL over PUBLIC_APP_URL', () => {
    const env = resolveAuthEnv({
      BETTER_AUTH_SECRET: longSecret,
      BETTER_AUTH_URL: 'https://auth.example',
      PUBLIC_APP_URL: 'http://localhost:3000',
    });
    expect(env.baseURL).toBe('https://auth.example');
  });

  it('rejects a missing or short secret', () => {
    expect(() => resolveAuthEnv({ BETTER_AUTH_URL: 'http://localhost:3000' })).toThrow(
      'BETTER_AUTH_SECRET',
    );
    expect(() =>
      resolveAuthEnv({
        BETTER_AUTH_SECRET: 'too-short',
        BETTER_AUTH_URL: 'http://localhost:3000',
      }),
    ).toThrow('BETTER_AUTH_SECRET');
  });

  it('rejects a missing base URL', () => {
    expect(() => resolveAuthEnv({ BETTER_AUTH_SECRET: longSecret })).toThrow('BETTER_AUTH_URL');
  });
});

describe('resolveMailerEnv', () => {
  it('defaults to mock transport and localhost from address', () => {
    expect(resolveMailerEnv({})).toEqual({
      from: 'Stampp <hello@localhost>',
      mode: 'mock',
      smtpHost: undefined,
      smtpPort: undefined,
    });
  });

  it('maps MAIL_MODE=smtp with host and port', () => {
    expect(
      resolveMailerEnv({
        MAIL_FROM: 'Stampp <hello@example.com>',
        MAIL_MODE: 'smtp',
        SMTP_HOST: 'mailpit',
        SMTP_PORT: '1025',
      }),
    ).toEqual({
      from: 'Stampp <hello@example.com>',
      mode: 'smtp',
      smtpHost: 'mailpit',
      smtpPort: 1025,
    });
  });

  it('treats unknown MAIL_MODE as mock', () => {
    expect(resolveMailerEnv({ MAIL_MODE: 'sendgrid' }).mode).toBe('mock');
  });
});
