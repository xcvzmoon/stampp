/** Outbound product events delivered to workspace webhook subscriptions. */
export const WEBHOOK_EVENT_TYPES = [
  'time_entry.created',
  'time_entry.updated',
  'time_entry.deleted',
  'timer.started',
  'timer.stopped',
  'timesheet.submitted',
  'timesheet.approved',
  'timesheet.rejected',
  'invoice.created',
  'invoice.status_changed',
  'invoice.payment_recorded',
  'attendance.clocked_in',
  'attendance.clocked_out',
  'time_off.requested',
  'time_off.approved',
  'time_off.rejected',
  'expense.created',
  'expense.updated',
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed' | 'dead';

export type WebhookSignatureHeader = {
  timestamp: number;
  v1: string;
};

export const WEBHOOK_SIGNATURE_HEADER = 'x-stampp-signature';
export const WEBHOOK_EVENT_HEADER = 'x-stampp-event';
export const WEBHOOK_DELIVERY_HEADER = 'x-stampp-delivery';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-stampp-timestamp';

/** `whsec_` + 32-byte base64url secret, shown once at create/rotate. */
export function isWebhookSecret(secret: string): boolean {
  return /^whsec_[A-Za-z0-9_-]{43}$/.test(secret);
}

export function isValidWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  // Local integrators need plain HTTP against localhost during development.
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
}

export function formatWebhookSignature(timestamp: number, digest: string): string {
  return `t=${timestamp},v1=${digest}`;
}

export function parseWebhookSignature(header: string): WebhookSignatureHeader | null {
  const parts = header.split(',');
  let timestamp: number | null = null;
  let v1: string | null = null;
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || value === undefined) {
      continue;
    }
    if (key.trim() === 't') {
      const parsed = Number(value.trim());
      if (!Number.isFinite(parsed)) {
        return null;
      }
      timestamp = parsed;
    }
    if (key.trim() === 'v1') {
      v1 = value.trim();
    }
  }
  if (timestamp === null || !v1) {
    return null;
  }
  return { timestamp, v1 };
}

/**
 * Signed payload is `${timestamp}.${rawBody}` so receivers can reject replays
 * outside a tolerance window without trusting the body alone.
 */
export function webhookSignedPayload(timestamp: number, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function maxWebhookAttempts(): number {
  return 5;
}

export function shouldRetryWebhookDelivery(attempt: number, statusCode: number | null): boolean {
  if (attempt >= maxWebhookAttempts()) {
    return false;
  }
  if (statusCode === null) {
    return true;
  }
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

export function webhookBackoffMs(attempt: number): number {
  const base = 1_000;
  const factor = 3 ** Math.max(attempt - 1, 0);
  return Math.min(base * factor, 15 * 60_000);
}
