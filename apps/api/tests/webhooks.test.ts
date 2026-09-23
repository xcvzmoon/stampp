import {
  formatWebhookSignature,
  isWebhookSecret,
  isValidWebhookUrl,
  parseWebhookSignature,
  shouldRetryWebhookDelivery,
  webhookBackoffMs,
  webhookSignedPayload,
  WEBHOOK_EVENT_TYPES,
} from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';
import { generateWebhookSecret, signWebhookBody } from '~/server/utils/webhooks.ts';

describe('webhook domain rules', () => {
  it('accepts https and localhost http only', () => {
    expect(isValidWebhookUrl('https://example.com/hook')).toBe(true);
    expect(isValidWebhookUrl('http://localhost:3000/hook')).toBe(true);
    expect(isValidWebhookUrl('http://127.0.0.1/hook')).toBe(true);
    expect(isValidWebhookUrl('http://example.com/hook')).toBe(false);
    expect(isValidWebhookUrl('ftp://example.com')).toBe(false);
    expect(isValidWebhookUrl('not a url')).toBe(false);
  });

  it('parses and formats signature headers', () => {
    const header = formatWebhookSignature(1_700_000_000, 'abc123');
    expect(header).toBe('t=1700000000,v1=abc123');
    expect(parseWebhookSignature(header)).toEqual({ timestamp: 1_700_000_000, v1: 'abc123' });
    expect(parseWebhookSignature('v1=abc')).toBeNull();
  });

  it('signs timestamp-prefixed bodies and validates secrets', () => {
    const generated = generateWebhookSecret();
    expect(isWebhookSecret(generated.secret)).toBe(true);
    expect(generated.secretPrefix.startsWith('whsec_')).toBe(true);
    const body = JSON.stringify({ hello: 'world' });
    const signature = signWebhookBody(generated.secret, 10, body);
    const parsed = parseWebhookSignature(signature);
    expect(parsed?.v1).toHaveLength(64);
    expect(webhookSignedPayload(10, body)).toBe(`10.${body}`);
  });

  it('retries transient failures with capped backoff', () => {
    expect(shouldRetryWebhookDelivery(1, 500)).toBe(true);
    expect(shouldRetryWebhookDelivery(1, 429)).toBe(true);
    expect(shouldRetryWebhookDelivery(1, 400)).toBe(false);
    expect(shouldRetryWebhookDelivery(5, 500)).toBe(false);
    expect(webhookBackoffMs(1)).toBe(1_000);
    expect(webhookBackoffMs(10)).toBe(15 * 60_000);
  });

  it('maps invalid url to 422 and keeps catalog stable', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.WEBHOOK_INVALID_URL)).toBe(422);
    expect(WEBHOOK_EVENT_TYPES).toContain('invoice.status_changed');
    expect(new Set(WEBHOOK_EVENT_TYPES).size).toBe(WEBHOOK_EVENT_TYPES.length);
  });
});
