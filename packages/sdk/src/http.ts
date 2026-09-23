import type { ApiError } from '@stampp/shared';
import * as v from 'valibot';
import { StamppApiError } from './errors.ts';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RequestOptions = {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export type ClientConfig = {
  baseUrl: string;
  /** Workspace personal access token (`stpp_…`). */
  token: string;
  workspaceId: string;
  fetch?: typeof fetch;
  /** Send `Idempotency-Key` on mutations. Defaults to true. */
  autoIdempotency?: boolean;
  /** Max attempts for 429/503 responses. Defaults to 3. */
  maxAttempts?: number;
  generateIdempotencyKey?: () => string;
  sleep?: (ms: number) => Promise<void>;
};

export type ApiTransport = {
  request<TSchema extends v.GenericSchema>(
    schema: TSchema,
    method: HttpMethod,
    path: string,
    options?: RequestOptions,
  ): Promise<v.InferOutput<TSchema>>;
  requestEmpty(method: HttpMethod, path: string, options?: RequestOptions): Promise<void>;
  workspaceId: string;
};

const MUTATING = new Set<HttpMethod>(['POST', 'PATCH', 'PUT', 'DELETE']);

const apiErrorSchema = v.object({
  code: v.string(),
  message: v.string(),
  details: v.optional(v.unknown()),
  requestId: v.string(),
});

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function buildUrl(baseUrl: string, path: string, query: RequestOptions['query']): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) {
    return null;
  }
  const seconds = Number(headerValue);
  return Number.isFinite(seconds) ? seconds : null;
}

async function parseApiError(response: Response): Promise<StamppApiError> {
  const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
  const text = await response.text();
  const parsed = v.safeParse(apiErrorSchema, text.length === 0 ? null : JSON.parse(text));
  if (parsed.success) {
    const error: ApiError = {
      code: parsed.output.code,
      message: parsed.output.message,
      details: parsed.output.details,
      requestId: parsed.output.requestId,
    };
    return new StamppApiError(response.status, error, retryAfterSeconds);
  }

  const fallback: ApiError = {
    code: 'internal',
    message: `Request failed with status ${response.status}`,
    requestId: response.headers.get('x-request-id') ?? 'unknown',
  };
  return new StamppApiError(response.status, fallback, retryAfterSeconds);
}

export function createTransport(config: ClientConfig): ApiTransport {
  const fetchImpl = config.fetch ?? ((input, init) => globalThis.fetch(input, init));
  const sleep = config.sleep ?? defaultSleep;
  const maxAttempts = config.maxAttempts ?? 3;
  const autoIdempotency = config.autoIdempotency ?? true;
  const generateIdempotencyKey = config.generateIdempotencyKey ?? defaultIdempotencyKey;
  const base = config.baseUrl;

  async function send(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
  ): Promise<Response> {
    const url = buildUrl(base, path, options.query);
    const headers = new Headers({
      authorization: `Bearer ${config.token}`,
      accept: 'application/json',
    });
    if (options.headers) {
      for (const [key, value] of Object.entries(options.headers)) {
        headers.set(key, value);
      }
    }

    let bodyText: string | undefined;
    if (options.body !== undefined) {
      headers.set('content-type', 'application/json');
      bodyText = JSON.stringify(options.body);
    }

    if (MUTATING.has(method) && autoIdempotency) {
      headers.set('idempotency-key', options.idempotencyKey ?? generateIdempotencyKey());
    } else if (options.idempotencyKey) {
      headers.set('idempotency-key', options.idempotencyKey);
    }

    const init: RequestInit = {
      method,
      headers,
    };
    if (bodyText !== undefined) {
      init.body = bodyText;
    }
    if (options.signal) {
      init.signal = options.signal;
    }
    return fetchImpl(url, init);
  }

  async function sendWithRetry(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
    attempt: number,
  ): Promise<Response> {
    const response = await send(method, path, options);
    const retriable = response.status === 429 || response.status === 503;
    if (!retriable || attempt >= maxAttempts) {
      return response;
    }
    const error = await parseApiError(response);
    await sleep((error.retryAfterSeconds ?? 1) * 1000);
    return sendWithRetry(method, path, options, attempt + 1);
  }

  async function request<TSchema extends v.GenericSchema>(
    schema: TSchema,
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<v.InferOutput<TSchema>> {
    const response = await sendWithRetry(method, path, options, 1);
    if (!response.ok) {
      throw await parseApiError(response);
    }
    const text = await response.text();
    const result = v.safeParse(schema, text.length === 0 ? null : JSON.parse(text));
    if (!result.success) {
      throw new StamppApiError(
        response.status,
        {
          code: 'internal',
          message: 'Response payload failed schema validation',
          requestId: response.headers.get('x-request-id') ?? 'unknown',
          details: result.issues,
        },
        null,
      );
    }
    return result.output;
  }

  async function requestEmpty(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<void> {
    const response = await sendWithRetry(method, path, options, 1);
    if (!response.ok) {
      throw await parseApiError(response);
    }
  }

  return {
    request: (schema, method, path, options) => request(schema, method, path, options),
    requestEmpty: (method, path, options) => requestEmpty(method, path, options),
    workspaceId: config.workspaceId,
  };
}
