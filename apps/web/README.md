# create-nuxt-app

Nuxt 4 starter template with Nuxt UI, Pinia, VueUse, strict TypeScript, and oxlint/oxfmt — reuse the stack without starting from scratch.

## Stack

| Layer           | Choice                                            |
| --------------- | ------------------------------------------------- |
| Framework       | Nuxt `4.5` (stable)                               |
| UI              | Nuxt UI `4` + Tailwind CSS `4`                    |
| State           | Pinia `4` + `pinia-plugin-persistedstate`         |
| Composables     | VueUse `14` (`@vueuse/nuxt`)                      |
| Runtime deps    | Vue `3.5`, Vue Router `5`                         |
| Language        | TypeScript `6` (project-pinned)                   |
| Lint / format   | oxlint + oxfmt (type-aware lint)                  |
| Package manager | pnpm (`packageManager: pnpm@12.4.0`)              |
| Node            | 26 in CI; `>=20.19` locally is enough for Nuxt UI |

## Create a project from this template

```bash
pnpx giget gh:xcvzmoon/create-nuxt-app nuxt-app
cd nuxt-app
pnpm install
pnpm dev
```

## Develop in this repository

```bash
pnpm install          # postinstall runs `nuxt prepare`
pnpm dev
```

| Script           | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `pnpm dev`       | Dev server                                          |
| `pnpm build`     | Production build                                    |
| `pnpm preview`   | Preview the production build                        |
| `pnpm typecheck` | `nuxt typecheck`                                    |
| `pnpm fmt`       | Format with oxfmt (writes)                          |
| `pnpm lint`      | oxlint                                              |
| `pnpm check`     | `oxfmt --check` + oxlint                            |
| `pnpm test`      | Vitest                                              |
| `pnpm release`   | genbumppush: patch bump + `v*` tag + GitHub Release |

**Verification order (CI / PR):** `check` → `typecheck` → `test` → `build`.

## Project layout

| Path                                   | Role                                          |
| -------------------------------------- | --------------------------------------------- |
| `app/`                                 | Nuxt app source (pages, layouts, app config)  |
| `app/stores/`                          | Pinia stores (create as needed)               |
| `public/`                              | Static assets                                 |
| `nuxt.config.ts`                       | Nuxt config                                   |
| `oxlint.config.ts` / `oxfmt.config.ts` | Lint and format source of truth               |
| `golar.config.ts`                      | Vue language tooling used by `nuxt typecheck` |
| `tools/oxlint/anti-slop/`              | Vendored oxlint plugin (not app code)         |
| `.agents/skills/`                      | Vendored agent skills (not product code)      |

## Customizing the new app

After the giget download:

1. Update `package.json` `name` / `description`.
2. Set the page title in `nuxt.config.ts` (`app.head.title`).
3. Adjust theme colors in `app/app.config.ts`.
4. Drop template-only files you do not need (for example `AGENTS.md`, issue templates).

Keep TypeScript at the pinned major unless you also update the golar/oxlint toolchain. Renovate is configured not to bump TypeScript.

## Release

```bash
cp .env.example .env   # then put GENBUMPPUSH_GITHUB_TOKEN=... in .env
# or: echo "GENBUMPPUSH_GITHUB_TOKEN=$(gh auth token)" > .env
pnpm release
```

`pnpm release` loads `.env` (gitignored; `GENBUMPPUSH_GITHUB_TOKEN` preferred, then `GITHUB_TOKEN` / `GH_TOKEN`), runs `check` / `typecheck` / `test`, bumps the patch version, pushes a `v*` tag, and creates the GitHub Release. A missing token fails _before_ any commit or tag.

Do not put the token in Nuxt `runtimeConfig` — keep it out of the client bundle.

If the GitHub API fails after the tag is pushed, the tag-triggered Release workflow re-runs `genbumppush --retry-github` after verifying `tag == v${package.json.version}` and completing the quality gates.

## Security

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/xcvzmoon/create-nuxt-app/security/advisories/new).
