import type { H3Event } from 'nitro';

const bodyTextCache = new WeakMap<object, string>();

/**
 * Reads the request body as text once and caches it on the event.
 * Handlers that call `readJsonBody` and middleware that fingerprint the body
 * must share this cache because Web Request bodies are single-read streams.
 */
export async function readCachedBodyText(event: H3Event): Promise<string> {
  const cached = bodyTextCache.get(event);
  if (cached !== undefined) {
    return cached;
  }
  const text = await event.req.text();
  bodyTextCache.set(event, text);
  return text;
}

export function peekCachedBodyText(event: H3Event): string | undefined {
  return bodyTextCache.get(event);
}

export function writeCachedBodyText(event: H3Event, text: string): void {
  bodyTextCache.set(event, text);
}
