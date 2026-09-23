# Docker Compose stack

Production-shaped local stack for Stampp: PostgreSQL, Valkey, migrations, API, and web. Optional profiles add Mailpit (SMTP testing) and MinIO (S3 receipts).

## Services

| Service   | Image                   | Port (host)             | Role                                                 |
| --------- | ----------------------- | ----------------------- | ---------------------------------------------------- |
| `db`      | `postgres:16-alpine`    | `127.0.0.1:5433` → 5432 | Primary database                                     |
| `migrate` | `postgres:16-alpine`    | none                    | Applies SQL migrations once, then exits              |
| `valkey`  | `valkey/valkey:8`       | `127.0.0.1:6380` → 6379 | Cache and BullMQ broker (AOF on)                     |
| `api`     | build `api.Dockerfile`  | `3001`                  | Nitro API, health checks, product routes             |
| `web`     | build `web.Dockerfile`  | `3000`                  | Nuxt UI                                              |
| `minio`   | `minio/minio:latest`    | `9000`, `9001`          | Optional S3-compatible storage (`--profile storage`) |
| `mailpit` | `axllent/mailpit:v1.27` | `1025`, `8025`          | Optional SMTP sink (`--profile mail`)                |

Startup order: `db` healthy → `migrate` completes successfully → `valkey` healthy → `api` `/readyz` ok → `web`. API and web containers run read-only with `no-new-privileges` and a tmpfs `/tmp`.

## Configure

```bash
cp deploy/docker/.env.example deploy/docker/.env
openssl rand -base64 32   # set POSTGRES_PASSWORD and BETTER_AUTH_SECRET
```

| Variable                  | Required | Purpose                                                         |
| ------------------------- | -------- | --------------------------------------------------------------- |
| `POSTGRES_PASSWORD`       | yes      | Database password; also used in `DATABASE_URL` for local dev    |
| `BETTER_AUTH_SECRET`      | yes      | Better Auth signing secret (≥ 32 chars)                         |
| `APP_ENV`                 | no       | `development` or `production`                                   |
| `PUBLIC_APP_URL`          | no       | Browser origin of the web app (default `http://localhost:3000`) |
| `PUBLIC_API_URL`          | no       | Browser origin of the API (default `http://localhost:3001`)     |
| `MAIL_FROM` / `MAIL_MODE` | no       | From-address and `mock` or `smtp` transport                     |
| `SMTP_HOST` / `SMTP_PORT` | no       | SMTP endpoint when `MAIL_MODE=smtp`                             |
| `STORAGE_*`               | no       | S3-compatible receipt storage (MinIO profile)                   |

## Run

From the repository root:

```bash
# full stack
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml up --build -d

# backing services only (local `vp run api dev` / `vp run web dev`)
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml up -d db valkey migrate

# profiles
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml --profile mail up --build -d
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml --profile storage up --build -d

# status and logs
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml ps
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml logs migrate api web

# stop (keep volumes)
docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml down
```

Root `package.json` shortcuts: `vp run services:up`, `vp run services:down`, `vp run services:mail`.

## Migrations

`migrate.sh` creates `stampp_migrations`, then applies each `packages/database/migrations/*/migration.sql` in name order inside a single transaction. It records a SHA-256 checksum. If a previously applied file changes, the job fails and refuses to continue. Add new migration directories only; never edit an applied one.

## Images

Both app images are multi-stage:

1. Build on `ghcr.io/voidzero-dev/vite-plus` with a frozen lockfile, flatten env with Varlock, and run `vp run --filter <app> build`.
2. Runtime on `node:26-bookworm-slim` with only `.output` and the flattened schema. Entry is `varlock run -- node server/index.mjs` so compose-injected env is validated before boot.

## Internet-facing deploys

1. Terminate TLS at a reverse proxy and forward to ports 3000 and 3001 (or publish only the proxy).
2. Set `APP_ENV=production`, `PUBLIC_APP_URL`, and `PUBLIC_API_URL` to the public HTTPS origins.
3. Point `BETTER_AUTH_URL` at the public app origin (cookies).
4. Keep PostgreSQL and Valkey on loopback or remove their host ports on a private Docker network.
5. Use real secrets. Do not reuse the example values.
6. Set `MAIL_MODE=smtp` against your provider. Use the `mail` profile only for testing.

## Volumes

| Volume          | Contents                          |
| --------------- | --------------------------------- |
| `postgres-data` | Database files                    |
| `valkey-data`   | Cache and queue state             |
| `minio-data`    | Receipt objects (storage profile) |

`docker compose down -v` deletes them. Do that only when you intend to wipe local data.
