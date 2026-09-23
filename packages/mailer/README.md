# @stampp/mailer

Transactional mail for Stampp: event types, BullMQ queue, UnEmail transport, and the `MailDispatch` seam product code calls. UnEmail is transport only. Durable delivery belongs to BullMQ on Valkey.

## Seams

```ts
import {
  createQueuedMailDispatch,
  createBullmqEmailQueue,
  createValkeyConnection,
  startEmailWorker,
} from '@stampp/mailer';

const connection = createValkeyConnection(process.env.VALKEY_URL);
const queue = createBullmqEmailQueue(connection);
const mail: MailDispatch = createQueuedMailDispatch(queue);

await mail.notify({ type: 'workspace.invite' /* ... */ });
```

| Export                                               | Role                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `MailDispatch`                                       | `{ notify(event) }` used by product modules                                |
| `createQueuedMailDispatch`                           | Enqueue for async delivery (production path)                               |
| `createMailDispatch`                                 | Send immediately (tests or tiny installs)                                  |
| `createBullmqEmailQueue` / `createBullmqEmailWorker` | Queue and worker                                                           |
| `MailEvent`                                          | Discriminated union of invite, timesheet, invoice, and other notifications |
| `renderMailEvent`                                    | Subject/text/html for a given event                                        |

## Reliability defaults

- Queue name `email`, job name `send`.
- 5 attempts with exponential backoff (1s base).
- Completed jobs kept 1 hour (max 1000); failed jobs 1 day (max 500).
- Invalid events fail parse and do not enqueue.

BullMQ workers need `maxRetriesPerRequest: null` on the Redis client. `createValkeyConnection` already sets that.

## Transport

`MAIL_MODE=mock` renders without network. `MAIL_MODE=smtp` uses UnEmail's SMTP driver (`SMTP_HOST`, `SMTP_PORT`). Compose can run Mailpit under `--profile mail` for local SMTP testing. From-address is `MAIL_FROM`.

## Rules

- Product code calls `notify`. Do not import UnEmail or BullMQ from handlers.
- New notification types: extend `MailEvent` and the Valibot variant schema together.
- Never log full mail bodies with personal data at info level.

## Test

```bash
vp run test
vp run typecheck
```
