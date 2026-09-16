import type { JsonValue } from '@stampp/shared';
import { jsonValueSchema } from '@stampp/shared';
import * as v from 'valibot';

const apiErrorBodySchema = v.object({
  code: v.optional(v.string()),
  message: v.optional(v.string()),
  details: v.optional(v.unknown()),
  requestId: v.optional(v.string()),
});

type ApiErrorBody = v.InferOutput<typeof apiErrorBodySchema>;

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.message ?? 'Request failed');
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body?.code ?? 'internal';
    this.details = body?.details ?? null;
    this.requestId = body?.requestId ?? null;
  }
}

function parseApiErrorBody(payload: string): ApiErrorBody | null {
  if (!payload) {
    return null;
  }
  try {
    const result = v.safeParse(apiErrorBodySchema, JSON.parse(payload));
    return result.success ? result.output : null;
  } catch {
    return null;
  }
}

function parseJsonPayload(text: string): JsonValue | undefined {
  if (!text) {
    return undefined;
  }
  const result = v.safeParse(jsonValueSchema, JSON.parse(text));
  if (!result.success) {
    throw new ApiRequestError(500, {
      code: 'internal',
      message: 'Response is not valid JSON',
    });
  }
  return result.output;
}

export function useApi() {
  const config = useRuntimeConfig();
  const baseURL = config.public.apiBaseURL;

  async function request(path: string, init?: RequestInit): Promise<string> {
    const headers = new Headers({ accept: 'application/json' });
    if (init?.body !== undefined) {
      headers.set('content-type', 'application/json');
    }
    if (init?.headers) {
      const incoming = new Headers(init.headers);
      incoming.forEach((value, key) => {
        headers.set(key, value);
      });
    }

    const response = await fetch(`${baseURL}${path}`, {
      credentials: 'include',
      ...init,
      headers,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ApiRequestError(response.status, parseApiErrorBody(text));
    }
    return text;
  }

  async function apiFetch<TSchema extends v.GenericSchema>(
    schema: TSchema,
    path: string,
    init?: RequestInit,
  ): Promise<v.InferOutput<TSchema>> {
    const text = await request(path, init);
    const result = v.safeParse(schema, parseJsonPayload(text));
    if (!result.success) {
      throw new ApiRequestError(500, {
        code: 'internal',
        message: 'Response payload failed validation',
      });
    }
    return result.output;
  }

  async function apiSend(path: string, init?: RequestInit): Promise<void> {
    await request(path, init);
  }

  return { apiFetch, apiSend };
}
