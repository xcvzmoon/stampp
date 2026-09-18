# Stampp

Stampp is a self-hosted time-tracking app for teams. It covers workspaces, clients, projects, tasks, timers, weekly timesheets, reports, CSV downloads, and workspace exports.

The project is under active development. The repository has not published a stable release yet.

## Run the full stack with Docker

You need Docker with Compose v2.

```bash
cp deploy/docker/.env.example deploy/docker/.env
```

Replace both placeholder secrets in `deploy/docker/.env`. You can generate them with:

```bash
openssl rand -base64 32
```

Start Stampp:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml up --build -d
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml ps
```

Open `http://localhost:3000`. The API listens on `http://localhost:3001`.

Compose waits for PostgreSQL and Valkey, applies pending migrations once, starts the API after `/readyz` succeeds, and then starts the web app. Migration checksums stop startup if an applied migration was edited.

To inspect startup failures:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml logs migrate api web
```

To stop the stack while keeping its data:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml down
```

Add Mailpit when testing SMTP delivery:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml --profile mail up --build -d
```

Set `MAIL_MODE=smtp` in `deploy/docker/.env`, then open `http://localhost:8025`.

For an internet-facing deployment, terminate TLS at a reverse proxy, set `APP_ENV=production`, and set `PUBLIC_APP_URL` and `PUBLIC_API_URL` to their public HTTPS origins. Keep PostgreSQL and Valkey bound to loopback or remove their host ports when the proxy and app share a private container network.

## Develop locally

You need Docker, Vite+, and the runtime selected by `package.json`. Vite+ manages the pinned Node and package-manager versions.

```bash
vp install
cp deploy/docker/.env.example deploy/docker/.env
```

Create gitignored local env files from each app's `.env.schema` (single source of truth for keys, types, and defaults):

```bash
# API — required: DATABASE_URL, VALKEY_URL, BETTER_AUTH_SECRET (openssl rand -base64 32)
# Web — defaults are enough for localhost; override only if your ports differ
vp run env:load
```

Use the same database password in `apps/api/.env`'s `DATABASE_URL` as in `deploy/docker/.env`. Then start PostgreSQL, Valkey, and the migrations:

```bash
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml up -d db valkey migrate
```

Run the API and web app in separate terminals:

```bash
vp run api dev
vp run web dev
```

The API exposes `GET /healthz` for process liveness and `GET /readyz` for PostgreSQL and Valkey readiness.

## Verify changes

Run the same checks used by CI, in this order:

```bash
vp run check
vp run typecheck
vp run test
vp run build
```

## Repository layout

| Path                | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `apps/web`          | Nuxt user interface                          |
| `apps/api`          | Nitro API and health endpoints               |
| `packages/access`   | Workspace authorization boundary             |
| `packages/database` | Drizzle schemas and migrations               |
| `packages/domain`   | Duration, money, and permission rules        |
| `packages/mailer`   | Transactional mail dispatch                  |
| `packages/shared`   | Shared validation schemas and API contracts  |
| `deploy/docker`     | Production images and Docker Compose service |

`PLAN.md` records delivery milestones and architecture decisions. `CONTEXT.md` defines the domain language, and `TARGET.md` describes the long-term product scope.

## Security

Report vulnerabilities through [GitHub Security Advisories](https://github.com/xcvzmoon/stampp/security/advisories/new). Do not include secrets or customer data in a public issue.

## License

No license has been granted yet. The source is visible, but redistribution and reuse remain reserved until a license file is added.
