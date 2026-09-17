# Stampp API

The API is a Nitro v3 service. It owns authentication, workspace authorization, time tracking, reports, exports, health checks, and audit writes.

Run it from the repository root after creating `apps/api/.env`:

```bash
vp run api dev
```

Useful endpoints:

- `GET /healthz` checks process liveness.
- `GET /readyz` checks PostgreSQL and Valkey.
- `/api/auth/*` is handled by Better Auth.
- `/api/v1/workspaces/:workspaceId/*` contains workspace-scoped product routes.

All environment values are declared in `.env.schema`. Keep secrets in the ignored `.env` file.
