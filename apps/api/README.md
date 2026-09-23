# Stampp API

Nitro v3 service that owns authentication, workspace authorization, product routes, reports, exports, webhooks, and health checks. The web app and any future client talk to this process only.

## Run

From the repository root, after `vp install` and `vp run env:load` (creates `apps/api/.env` from `.env.schema`):

```bash
vp run api dev
```

Default URL: `http://localhost:3001`. Backing services (PostgreSQL, Valkey) must be up; see [deploy/docker/README.md](../../deploy/docker/README.md).

Other scripts in `apps/api/package.json`:

| Script                        | Purpose                               |
| ----------------------------- | ------------------------------------- |
| `vp run api build`            | Production Nitro build into `.output` |
| `vp run api start`            | Run the built server                  |
| `vp run api preview`          | Preview the build                     |
| `vp run api typecheck`        | TypeScript check                      |
| `vp run api openapi:snapshot` | Refresh `openapi.snapshot.json`       |

## Surface

| Area                          | Path                                |
| ----------------------------- | ----------------------------------- |
| Liveness                      | `GET /healthz`                      |
| Readiness (Postgres + Valkey) | `GET /readyz`                       |
| Better Auth                   | `/api/auth/*`                       |
| Product API                   | `/api/v1/workspaces/:workspaceId/*` |
| OpenAPI document              | `GET /api/v1/openapi.json`          |
| API docs UI                   | `/api/v1/docs`                      |

Product routes cover clients, projects, tasks, tags, time and timer, timesheets, attendance, time off, schedules, kiosk, rates, budgets, expenses, invoices, approvals, roles, members, SSO, SAML, SCIM, audit, webhooks, import, and export.

Auth on `/api/v1` is either a Better Auth session cookie or `Authorization: Bearer stpp_…` (personal access token). Mutations accept an optional `Idempotency-Key`. Each credential has a per-minute rate budget.

## Layout

```text
apps/api/
  .env.schema          # keys, types, defaults (source of truth)
  env.ts               # generated typed env access
  nitro.config.ts
  openapi.snapshot.json
  server/
    api/auth/          # Better Auth handler
    api/v1/            # workspace-scoped product routes
    middleware/
    plugins/
    utils/             # access wiring, errors, rates, mail, audit
  tests/
```

Handlers call `enterWorkspace` from `@stampp/access`, then a domain module from `@stampp/domain` (or a thin service that uses `@stampp/database` and `@stampp/mailer`). Validation schemas come from `@stampp/shared`.

## Configuration

Every key is declared in `.env.schema`. Varlock loads and validates them. Required for local dev: `DATABASE_URL`, `VALKEY_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MAIL_FROM`. Optional OAuth (Google/GitHub), SMTP, and S3 storage keys are documented in the schema file.

Secrets stay in the gitignored `.env`. Do not put them in `NUXT_PUBLIC_*` or any browser-visible config.

## Health and ops

- `GET /healthz` returns 200 when the process is up.
- `GET /readyz` returns 200 only when PostgreSQL and Valkey answer.

Docker Compose uses `/readyz` as the container healthcheck before starting the web app.
