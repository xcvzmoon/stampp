import { describe, expect, it } from 'vite-plus/test';
import { createStamppClient } from '../src/client.ts';
import { StamppApiError } from '../src/errors.ts';

type JsonBody = {
  code?: string;
  message?: string;
  requestId?: string;
  id?: string;
  workspaceId?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: unknown;
  nextCursor?: string | null;
};

type HeaderMap = {
  authorization?: string;
  accept?: string;
  'content-type'?: string;
  'idempotency-key'?: string;
};

type FetchCall = {
  input: string;
  headers: HeaderMap;
};

function jsonResponse(
  body: JsonBody,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

type MockFetch = {
  fetch: typeof fetch;
  calls: FetchCall[];
};

function headerEntries(headers: HeadersInit | undefined): HeaderMap {
  const headerRecord: HeaderMap = {};
  if (!headers) {
    return headerRecord;
  }
  if (headers instanceof Headers) {
    const auth = headers.get('authorization');
    const idem = headers.get('idempotency-key');
    if (auth) headerRecord.authorization = auth;
    if (idem) headerRecord['idempotency-key'] = idem;
    return headerRecord;
  }
  if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      if (key === 'authorization' || key === 'idempotency-key') {
        headerRecord[key] = value;
      }
    }
    return headerRecord;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key === 'authorization' || key === 'idempotency-key') {
      headerRecord[key] = value;
    }
  }
  return headerRecord;
}

function requestInputUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.href;
  }
  if (input instanceof Request) {
    return input.url;
  }
  return input;
}

function createMockFetch(handler: (call: number) => Response): MockFetch {
  const calls: FetchCall[] = [];
  const fetchImpl = (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      input: requestInputUrl(input),
      headers: headerEntries(init?.headers),
    });
    return Promise.resolve(handler(calls.length));
  };
  return { fetch: fetchImpl, calls };
}

describe('@stampp/sdk client', () => {
  it('sends PAT bearer auth and workspace-scoped paths', async () => {
    const mock = createMockFetch(() => jsonResponse({ items: [], nextCursor: null }));
    const client = createStamppClient({
      baseUrl: 'https://stampp.example',
      workspaceId: 'ws_1',
      token: 'stpp_test',
      fetch: mock.fetch,
    });

    await client.tags.list({ limit: 10 });

    expect(mock.calls).toHaveLength(1);
    expect(mock.calls[0]?.input).toContain('/api/v1/workspaces/ws_1/tags');
    expect(mock.calls[0]?.headers.authorization).toBe('Bearer stpp_test');
  });

  it('adds an Idempotency-Key on mutations and retries 429', async () => {
    const mock = createMockFetch((call) => {
      if (call === 1) {
        return jsonResponse(
          { code: 'rate_limited', message: 'slow down', requestId: 'req_1' },
          429,
          { 'retry-after': '0' },
        );
      }
      return jsonResponse(
        {
          id: 'tag_1',
          workspaceId: 'ws_1',
          name: 'deep-work',
          createdAt: '2026-09-23T00:00:00.000Z',
          updatedAt: '2026-09-23T00:00:00.000Z',
        },
        201,
      );
    });

    const client = createStamppClient({
      baseUrl: 'https://stampp.example',
      workspaceId: 'ws_1',
      token: 'stpp_test',
      fetch: mock.fetch,
      generateIdempotencyKey: () => 'key-1',
      sleep: () => Promise.resolve(),
    });

    const tag = await client.tags.create({ name: 'deep-work' });
    expect(tag.id).toBe('tag_1');
    expect(mock.calls).toHaveLength(2);
    expect(mock.calls.at(-1)?.headers['idempotency-key']).toBe('key-1');
  });

  it('throws StamppApiError with stable codes', async () => {
    const mock = createMockFetch(() =>
      jsonResponse(
        { code: 'idempotency.key_conflict', message: 'mismatch', requestId: 'req_2' },
        409,
      ),
    );

    const client = createStamppClient({
      baseUrl: 'https://stampp.example',
      workspaceId: 'ws_1',
      token: 'stpp_test',
      fetch: mock.fetch,
    });

    await expect(
      client.tags.create({ name: 'x' }, { idempotencyKey: 'dup' }),
    ).rejects.toBeInstanceOf(StamppApiError);

    await expect(
      client.tags.create({ name: 'x' }, { idempotencyKey: 'dup' }),
    ).rejects.toMatchObject({
      code: 'idempotency.key_conflict',
      status: 409,
    });
  });
});
