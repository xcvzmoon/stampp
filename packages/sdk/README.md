# @stampp/sdk

Typed client for the Stampp public API (`/api/v1`). Authenticate with a workspace personal access token.

## Install

This package is a workspace package (`@stampp/sdk`). From another app in the monorepo:

```ts
import { createStamppClient } from '@stampp/sdk';
```

## Quickstart

```ts
import { createStamppClient, isStamppApiError } from '@stampp/sdk';

const client = createStamppClient({
  baseUrl: 'https://stampp.example',
  workspaceId: process.env.STAMPP_WORKSPACE_ID,
  token: process.env.STAMPP_TOKEN, // stpp_…
});

const project = await client.projects.create({
  name: 'Website redesign',
  clientId: null,
});

const entry = await client.time.createEntry({
  kind: 'duration',
  projectId: project.id,
  description: 'Kickoff notes',
  billable: true,
  durationMinutes: 90,
  workDate: '2026-09-23',
  timezone: 'Europe/Berlin',
});
```

## Auth

Send the token as `Authorization: Bearer stpp_…`. Create tokens in the workspace UI under tokens, or with `client.tokens.create({ name })` while authenticated another way.

## Retries and idempotency

Mutations send an `Idempotency-Key` by default so a network retry cannot double-create rows. Pass `options.idempotencyKey` to pin your own key (required when you retry the same logical operation yourself).

`429` and `503` responses are retried (default 3 attempts) using `Retry-After`.

Errors throw `StamppApiError` with `code`, `status`, `requestId`, and `retryAfterSeconds`.

## Surface

| Group        | Methods                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `clients`    | `list` `create` `get` `update` `remove`                                                                                                      |
| `projects`   | `list` `create` `get` `update` `remove` `listTasks` `createTask` `updateTask` `removeTask`                                                   |
| `tags`       | `list` `create` `update` `remove`                                                                                                            |
| `time`       | `listEntries` `createEntry` `updateEntry` `deleteEntry` `listWeekly` `copyPreviousWeek` `duplicateEntry` `getTimer` `startTimer` `stopTimer` |
| `timesheets` | `list` `submit` `withdraw` `approve` `reject`                                                                                                |
| `rates`      | `list` `create` `revoke` `resolveEffective`                                                                                                  |
| `tokens`     | `list` `create` `revoke`                                                                                                                     |
| `request`    | escape hatch for any documented path                                                                                                         |

Full contract: `GET /api/v1/openapi.json` (Scalar UI at `/api/v1/docs`).

## Rate limits

Each credential has a per-minute budget. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. When limited, the API returns `429` with code `rate_limited` and `Retry-After`.
