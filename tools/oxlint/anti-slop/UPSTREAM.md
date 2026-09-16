# Vendored anti-slop Oxlint plugin

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), via the `install-anti-slop` skill bundle in `.agents/skills/install-anti-slop/`.

- Skill lock source: `dmmulroy/anti-slop`
- Skill lock hash: `4031728fbe75bdcad6ee3208fd52b5d66e167b056fefee1fa9758e9a6cb9c0c8`
- Skill assets path: `.agents/skills/install-anti-slop/assets/anti-slop`
- Installed path: `tools/oxlint/anti-slop/`
- Recoverable upstream commit for this snapshot: **unknown** (skill bundle is the only identity recorded; no commit SHA is present in the bundle)

Installed entry points:

- Generic plugin: `tools/oxlint/anti-slop/index.ts` (`anti-slop`)
- Effect plugin (copied, **not registered**): `tools/oxlint/anti-slop/effect/index.ts` (`anti-slop-effect`)

Nested vendored Stylistic rule: see `vendor/eslint-stylistic/UPSTREAM.md`.

## Local configuration

Registered in `vite.config.ts`:

- `lint.jsPlugins`: `anti-slop` → `./tools/oxlint/anti-slop/index.ts`
- All generic `anti-slop/*` rules enabled at `error`, plus `oxc/no-accumulating-spread`
- Lint and format ignore agent tooling directories and `tools/oxlint/anti-slop/**`
- Effect rules are not enabled; the repo has no direct `effect` package dependency

## Dependencies

- `@oxlint/plugins@1.82.0` (exact), matching installed `oxlint@1.82.0` via Vite+
