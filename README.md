# Stampp

Open-source work-time platform. No seat pricing, no feature gates, fully self-hostable.

Track billable project time, manage clients and projects, and keep everything on infrastructure you control.

## Stack

| Layer         | Choice                                        |
| ------------- | --------------------------------------------- |
| Web           | Nuxt 4 + Nuxt UI                              |
| API           | Nitro v3                                      |
| Auth          | Better Auth (workspace = organization)        |
| Database      | PostgreSQL + Drizzle ORM 1.0 RC + postgres.js |
| Cache / queue | Valkey + BullMQ                               |
| Mail          | UnEmail transport (mock / SMTP)               |
| Env           | Varlock `.env.schema`                         |
| IDs           | UUID v7 with entity prefixes                  |

## Monorepo layout

```text
apps/web          Nuxt product UI
apps/api          Nitro HTTP API + health endpoints
packages/domain   Pure money/duration/permissions
packages/shared   Valibot schemas + API error codes
packages/database Drizzle schemas, scoped db, migrations
packages/access   WorkspaceAccess seam
packages/mailer   MailDispatch + UnEmail
deploy/docker     Compose stack (Postgres, Valkey, optional Mailpit)
```

## Quickstart

Requirements: Node 24+, pnpm (via Vite+), Docker.

```bash
vp install
cp apps/api/.env.example apps/api/.env   # after you create local values
vp run services:up
vp run env:load
vp run api
vp run web
```

Service stack:

```bash
# Postgres + Valkey
pnpm services:up

# Add Mailpit on :8025 when you need a mail catcher
pnpm services:mail
```

Health endpoints:

- `GET /healthz` — process liveness
- `GET /readyz` — Postgres + Valkey readiness (503 when degraded)

## Development

```bash
vp run check
vp run typecheck
vp run test
vp run build
```

Env is declared in committed `.env.schema` files (Varlock). Secrets live in gitignored `.env` / `.env.local` only.

## Product docs

- `PLAN.md` — architecture, milestones, locked decisions
- `CONTEXT.md` — domain glossary
- `TARGET.md` — full feature target (long-term)
