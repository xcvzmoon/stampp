# Stampp web app

Nuxt 4 + Vue 3 UI for Stampp. Nuxt UI and Pinia handle the interface and client state. The app talks to Better Auth and the product API through public URLs only. It never opens a database connection.

## Run

From the repository root, after `vp install` and `vp run env:load` (creates `apps/web/.env` from `.env.schema`):

```bash
vp run web dev
```

Open `http://localhost:3000`. The API must be running at `http://localhost:3001` (or whatever `PUBLIC_API_URL` you set).

Other scripts in `apps/web/package.json`:

| Script                 | Purpose                              |
| ---------------------- | ------------------------------------ |
| `vp run web build`     | Production Nuxt build into `.output` |
| `vp run web start`     | Run the built server                 |
| `vp run web preview`   | Preview the build                    |
| `vp run web generate`  | Static generation                    |
| `vp run web typecheck` | `nuxt typecheck`                     |

## Layout

```text
apps/web/
  .env.schema              # public keys only
  nuxt.config.ts
  app/
    components/            # UI (timesheet grid, reports, shared)
    composables/           # auth + API client helpers
    layouts/
    middleware/            # auth and workspace guards
    pages/
      sign-in.vue, sign-up.vue
      workspaces/          # pick or create workspace, invitations
      w/[workspaceId]/     # time, timesheets via time, projects, clients,
                           # tags, rates, reports, expenses, invoices,
                           # attendance, time-off, schedule, kiosk,
                           # approvals, roles, team, security, sso, saml,
                           # scim, audit, webhooks, import
      kiosk/[workspaceId].vue
    utils/
  public/
  server/
  tests/
```

Workspace UI lives under `/w/:workspaceId`. The kiosk surface is a separate route meant for shared devices.

## Configuration

Browser-visible configuration stays under `NUXT_PUBLIC_*` and `PUBLIC_*` keys declared in `.env.schema`:

| Key                            | Default (local)                  |
| ------------------------------ | -------------------------------- |
| `PUBLIC_APP_URL`               | `http://localhost:3000`          |
| `PUBLIC_API_URL`               | `http://localhost:3001`          |
| `NUXT_PUBLIC_AUTH_BASE_URL`    | `http://localhost:3001/api/auth` |
| `NUXT_PUBLIC_API_BASE_URL`     | `http://localhost:3001/api/v1`   |
| `NUXT_PUBLIC_GOOGLE_CLIENT_ID` | optional, shows Google sign-in   |
| `NUXT_PUBLIC_GITHUB_CLIENT_ID` | optional, shows GitHub sign-in   |

Server secrets belong in the API. If a value must not ship to the browser, it does not belong in this app.

## Future clients

The responsive UI is the base for a PWA shell (installable, offline-friendly timer paths). Desktop (Tauri) and mobile shells will reuse this surface and the same API. See the root [README](../../README.md#future-client-platforms).
