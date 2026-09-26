# Changelog

## v0.6.0

[compare changes](https://github.com/xcvzmoon/stampp/compare/v0.5.0...v0.6.0)

### 🚀 Enhancements

- **web:** Redesign public and onboarding pages ([a81299e](https://github.com/xcvzmoon/stampp/commit/a81299e))
- **web:** Organize workspace navigation and time tracking ([3ce9bed](https://github.com/xcvzmoon/stampp/commit/3ce9bed))
- **web:** Polish workspace tools and empty states ([f3cd64c](https://github.com/xcvzmoon/stampp/commit/f3cd64c))

### 🩹 Fixes

- **auth:** Support sessions across the app origin ([1ebd8b2](https://github.com/xcvzmoon/stampp/commit/1ebd8b2))
- **api:** Correct request logging and empty timer responses ([d9d7f65](https://github.com/xcvzmoon/stampp/commit/d9d7f65))

### 📖 Documentation

- Remove PLAN.md and TARGET.md ([bab349d](https://github.com/xcvzmoon/stampp/commit/bab349d))
- Add @stampp/sdk to CONTEXT package vocabulary ([a163ec6](https://github.com/xcvzmoon/stampp/commit/a163ec6))
- Add and expand package READMEs ([3fca0a5](https://github.com/xcvzmoon/stampp/commit/3fca0a5))
- Expand web and api app READMEs ([96488db](https://github.com/xcvzmoon/stampp/commit/96488db))
- Add Docker Compose stack README ([6638a66](https://github.com/xcvzmoon/stampp/commit/6638a66))
- Rewrite root README with how-it-works and client roadmap ([6d2406f](https://github.com/xcvzmoon/stampp/commit/6d2406f))
- **web:** Add product context for the UI redesign ([145dea6](https://github.com/xcvzmoon/stampp/commit/145dea6))
- Add full-app UI snapshot bundle ([07bc93c](https://github.com/xcvzmoon/stampp/commit/07bc93c))

### 🏡 Chore

- **skills:** Add ui skills ([ce14646](https://github.com/xcvzmoon/stampp/commit/ce14646))

### ✅ Tests

- Disable isolation for faster test runs ([4663882](https://github.com/xcvzmoon/stampp/commit/4663882))

### ❤️ Contributors

- Mon Albert Gamil ([@xcvzmoon](https://github.com/xcvzmoon))

## v0.5.0

[compare changes](https://github.com/xcvzmoon/stampp/compare/v0.4.0...v0.5.0)

### 🚀 Enhancements

- **shared:** Add public API platform contracts ([631111e](https://github.com/xcvzmoon/stampp/commit/631111e))
- **api:** Rate limit and idempotency on /api/v1 ([78e88a1](https://github.com/xcvzmoon/stampp/commit/78e88a1))
- **api:** Document PAT auth and platform headers ([971daab](https://github.com/xcvzmoon/stampp/commit/971daab))
- **api:** Add OpenAPI contract snapshot and breaking-change gate ([3de43bd](https://github.com/xcvzmoon/stampp/commit/3de43bd))
- **sdk:** Add typed @stampp/sdk client ([65fa81b](https://github.com/xcvzmoon/stampp/commit/65fa81b))
- **domain:** Add webhook event catalog and signing rules ([879f0fd](https://github.com/xcvzmoon/stampp/commit/879f0fd))
- **shared:** Add webhook contracts and error codes ([64640c8](https://github.com/xcvzmoon/stampp/commit/64640c8))
- **database:** Add webhook subscriptions and deliveries with RLS ([c926d8d](https://github.com/xcvzmoon/stampp/commit/c926d8d))
- **api:** Expose webhooks with HMAC signing and delivery worker ([14878a5](https://github.com/xcvzmoon/stampp/commit/14878a5))
- **web:** Add workspace webhook settings UI ([a59cd61](https://github.com/xcvzmoon/stampp/commit/a59cd61))
- **domain:** Add custom role permission grants ([a344c75](https://github.com/xcvzmoon/stampp/commit/a344c75))
- **shared:** Add custom role and member assignment contracts ([01b1712](https://github.com/xcvzmoon/stampp/commit/01b1712))
- **access:** Resolve built-in and custom role grants ([bb0d12f](https://github.com/xcvzmoon/stampp/commit/bb0d12f))
- **database:** Add custom roles table and member assignment ([62d58a6](https://github.com/xcvzmoon/stampp/commit/62d58a6))
- **api:** Expose custom roles and member assignment ([3f49103](https://github.com/xcvzmoon/stampp/commit/3f49103))
- **web:** Add custom roles settings UI ([b5ff72a](https://github.com/xcvzmoon/stampp/commit/b5ff72a))
- **domain:** Add OIDC provider and email domain rules ([3c34468](https://github.com/xcvzmoon/stampp/commit/3c34468))
- **shared:** Add workspace OIDC provider contracts ([f94f0c9](https://github.com/xcvzmoon/stampp/commit/f94f0c9))
- **database:** Add sso providers table with RLS ([ae2889d](https://github.com/xcvzmoon/stampp/commit/ae2889d))
- **api:** Wire workspace OIDC providers into auth ([18989f0](https://github.com/xcvzmoon/stampp/commit/18989f0))
- **web:** Add workspace SSO settings UI ([290b576](https://github.com/xcvzmoon/stampp/commit/290b576))
- **domain:** Add SAML service-provider rules ([0831cc9](https://github.com/xcvzmoon/stampp/commit/0831cc9))
- **shared:** Add SAML provider contracts ([2231813](https://github.com/xcvzmoon/stampp/commit/2231813))
- **database:** Add saml providers table with RLS ([ca482a1](https://github.com/xcvzmoon/stampp/commit/ca482a1))
- **api:** Add SAML SP metadata login and ACS ([162ff2d](https://github.com/xcvzmoon/stampp/commit/162ff2d))
- **web:** Add workspace SAML settings UI ([78788b4](https://github.com/xcvzmoon/stampp/commit/78788b4))
- **domain:** Add SCIM 2.0 wire helpers ([ce0b6c0](https://github.com/xcvzmoon/stampp/commit/ce0b6c0))
- **shared:** Add SCIM user and token contracts ([b6e5103](https://github.com/xcvzmoon/stampp/commit/b6e5103))
- **database:** Add scim tokens table with RLS ([a9b4fa4](https://github.com/xcvzmoon/stampp/commit/a9b4fa4))
- **api:** Add SCIM 2.0 users groups and token admin ([620b5df](https://github.com/xcvzmoon/stampp/commit/620b5df))
- **web:** Add workspace SCIM settings UI ([d36f15c](https://github.com/xcvzmoon/stampp/commit/d36f15c))
- **domain:** Add CSV import mapping and dry-run preview ([f0d52bc](https://github.com/xcvzmoon/stampp/commit/f0d52bc))
- **shared:** Add import job and preview contracts ([e19710b](https://github.com/xcvzmoon/stampp/commit/e19710b))
- **database:** Add import jobs table with RLS ([a11f91e](https://github.com/xcvzmoon/stampp/commit/a11f91e))
- **api:** Add import preview and job start endpoints ([86b1e3a](https://github.com/xcvzmoon/stampp/commit/86b1e3a))
- **web:** Add workspace import UI ([73de501](https://github.com/xcvzmoon/stampp/commit/73de501))
- **domain:** Add audit retention rules ([65daefc](https://github.com/xcvzmoon/stampp/commit/65daefc))
- **shared:** Add audit browse and retention contracts ([61c86d3](https://github.com/xcvzmoon/stampp/commit/61c86d3))
- **database:** Add audit retention policies with RLS ([fc57f15](https://github.com/xcvzmoon/stampp/commit/fc57f15))
- **api:** Add audit browse export and retention endpoints ([f55e079](https://github.com/xcvzmoon/stampp/commit/f55e079))
- **web:** Add workspace audit log UI ([9b378c3](https://github.com/xcvzmoon/stampp/commit/9b378c3))

### 🩹 Fixes

- **api:** Insert imported time entries in parallel ([d1682a3](https://github.com/xcvzmoon/stampp/commit/d1682a3))

### 📖 Documentation

- Public API quickstart and slice notes ([d51f93b](https://github.com/xcvzmoon/stampp/commit/d51f93b))
- Record webhooks slice in plan and glossary ([14442d3](https://github.com/xcvzmoon/stampp/commit/14442d3))
- Record custom roles slice in plan and glossary ([0bde1ba](https://github.com/xcvzmoon/stampp/commit/0bde1ba))
- Record OIDC sso slice in plan and glossary ([6e3ef4a](https://github.com/xcvzmoon/stampp/commit/6e3ef4a))
- Record SAML slice in plan and glossary ([31fdd76](https://github.com/xcvzmoon/stampp/commit/31fdd76))
- Record SCIM slice in plan and glossary ([a871254](https://github.com/xcvzmoon/stampp/commit/a871254))
- Record import pipeline slice in plan and glossary ([6de653c](https://github.com/xcvzmoon/stampp/commit/6de653c))
- Record audit ui and retention in plan and glossary ([3d4b57b](https://github.com/xcvzmoon/stampp/commit/3d4b57b))

### 🏡 Chore

- Clear remaining lint warnings ([87e4fa9](https://github.com/xcvzmoon/stampp/commit/87e4fa9))

### ❤️ Contributors

- Mon Albert Gamil ([@xcvzmoon](https://github.com/xcvzmoon))

## v0.4.0

[compare changes](https://github.com/xcvzmoon/stampp/compare/v0.3.0...v0.4.0)

### 🚀 Enhancements

- **domain:** Add attendance punch rules and permissions ([67b80e5](https://github.com/xcvzmoon/stampp/commit/67b80e5))
- **shared:** Add attendance contracts and error codes ([c29de61](https://github.com/xcvzmoon/stampp/commit/c29de61))
- **database:** Add attendance_records schema with RLS migration ([10031c5](https://github.com/xcvzmoon/stampp/commit/10031c5))
- **api:** Expose attendance clock-in/out and list endpoints ([83dc3e7](https://github.com/xcvzmoon/stampp/commit/83dc3e7))
- **web:** Add attendance page and workspace nav ([caba932](https://github.com/xcvzmoon/stampp/commit/caba932))
- **domain:** Add time-off rules and permissions ([872f456](https://github.com/xcvzmoon/stampp/commit/872f456))
- **shared:** Add time-off contracts and error codes ([a1e351b](https://github.com/xcvzmoon/stampp/commit/a1e351b))
- **database:** Add time-off tables with RLS migration ([469d0d6](https://github.com/xcvzmoon/stampp/commit/469d0d6))
- **api:** Expose time-off types requests balances and calendar ([6d41ecf](https://github.com/xcvzmoon/stampp/commit/6d41ecf))
- **web:** Add time-off page and workspace nav ([3e3fa24](https://github.com/xcvzmoon/stampp/commit/3e3fa24))
- **domain:** Add scheduling capacity and workload rules ([467c38f](https://github.com/xcvzmoon/stampp/commit/467c38f))
- **shared:** Add scheduling contracts and error codes ([cab48f5](https://github.com/xcvzmoon/stampp/commit/cab48f5))
- **database:** Add capacity and assignment tables with RLS ([1ccbee1](https://github.com/xcvzmoon/stampp/commit/1ccbee1))
- **api:** Expose capacity assignments and workload endpoints ([aee325e](https://github.com/xcvzmoon/stampp/commit/aee325e))
- **web:** Add schedule page and workspace nav ([dd87843](https://github.com/xcvzmoon/stampp/commit/dd87843))
- **domain:** Add kiosk credential and punch rules ([343df97](https://github.com/xcvzmoon/stampp/commit/343df97))
- **shared:** Add kiosk contracts and attendance kiosk source ([bbd802f](https://github.com/xcvzmoon/stampp/commit/bbd802f))
- **database:** Add kiosk devices and member credentials with RLS ([e4c8dfc](https://github.com/xcvzmoon/stampp/commit/e4c8dfc))
- **api:** Expose kiosk devices credentials and attendance punch ([e0f69b1](https://github.com/xcvzmoon/stampp/commit/e0f69b1))
- **web:** Add kiosk admin page and shared punch screen ([f5644e0](https://github.com/xcvzmoon/stampp/commit/f5644e0))
- **domain:** Add multi-stage approval chain rules ([05a06d2](https://github.com/xcvzmoon/stampp/commit/05a06d2))
- **shared:** Add approval chain contracts and error codes ([0bdbeec](https://github.com/xcvzmoon/stampp/commit/0bdbeec))
- **database:** Add approval chain tables with RLS ([4048a67](https://github.com/xcvzmoon/stampp/commit/4048a67))
- **api:** Expose approval chains and wire multi-stage decide ([f7c3a9c](https://github.com/xcvzmoon/stampp/commit/f7c3a9c))
- **web:** Add approval chain config and pending steps UI ([da4c4fa](https://github.com/xcvzmoon/stampp/commit/da4c4fa))

### 📖 Documentation

- Record attendance slice in plan and glossary ([e3c7b67](https://github.com/xcvzmoon/stampp/commit/e3c7b67))
- Record time-off slice in plan and glossary ([524663e](https://github.com/xcvzmoon/stampp/commit/524663e))
- Record scheduling slice in plan and glossary ([94a99bb](https://github.com/xcvzmoon/stampp/commit/94a99bb))
- Record kiosk slice in plan and glossary ([e94929c](https://github.com/xcvzmoon/stampp/commit/e94929c))
- Record approval-chains slice in plan and glossary ([d537a45](https://github.com/xcvzmoon/stampp/commit/d537a45))

### 🏡 Chore

- Bump vite-plus to v1.0.0-rc.0 ([75a7967](https://github.com/xcvzmoon/stampp/commit/75a7967))

### ✅ Tests

- **api:** Cover service flows and cost-report goldens ([1385d9c](https://github.com/xcvzmoon/stampp/commit/1385d9c))

### ❤️ Contributors

- Mon Albert Gamil ([@xcvzmoon](https://github.com/xcvzmoon))

## v0.3.0

[compare changes](https://github.com/xcvzmoon/stampp/compare/v0.2.0...v0.3.0)

### 🚀 Enhancements

- **domain:** Add rate precedence resolution and shared contracts ([d703615](https://github.com/xcvzmoon/stampp/commit/d703615))
- **database:** Add versioned rates schema and migration ([d0a9e64](https://github.com/xcvzmoon/stampp/commit/d0a9e64))
- **api:** Expose rates history and effective resolve endpoints ([76f8ec7](https://github.com/xcvzmoon/stampp/commit/76f8ec7))
- **web:** Add rates settings page and workspace nav ([fe154f3](https://github.com/xcvzmoon/stampp/commit/fe154f3))
- **domain:** Add timesheet approval transitions and shared contracts ([4108840](https://github.com/xcvzmoon/stampp/commit/4108840))
- **database:** Add timesheets approval schema and migration ([73aa20d](https://github.com/xcvzmoon/stampp/commit/73aa20d))
- **api:** Add timesheet submit withdraw and approval endpoints ([60ed1b9](https://github.com/xcvzmoon/stampp/commit/60ed1b9))
- **web:** Add timesheet submit controls and approvals queue ([eb6e918](https://github.com/xcvzmoon/stampp/commit/eb6e918))
- **domain:** Add project budget usage levels and shared contracts ([c64c43a](https://github.com/xcvzmoon/stampp/commit/c64c43a))
- **database:** Add project budget columns and constraints ([ed729df](https://github.com/xcvzmoon/stampp/commit/ed729df))
- **api:** Expose project budget usage and alert endpoints ([075bc8e](https://github.com/xcvzmoon/stampp/commit/075bc8e))
- **web:** Add project budget editor and usage badges ([307436c](https://github.com/xcvzmoon/stampp/commit/307436c))
- **domain:** Add expense rules and receipt guards ([b8cd7d0](https://github.com/xcvzmoon/stampp/commit/b8cd7d0))
- **database:** Add expenses schema and migration ([b79e5be](https://github.com/xcvzmoon/stampp/commit/b79e5be))
- **api:** Expose expenses with optional S3 receipt storage ([eb8e117](https://github.com/xcvzmoon/stampp/commit/eb8e117))
- **web:** Add expenses page and workspace nav ([d6bce01](https://github.com/xcvzmoon/stampp/commit/d6bce01))
- **domain:** Add invoice status machine and totals ([5264b40](https://github.com/xcvzmoon/stampp/commit/5264b40))
- **database:** Add invoices schema and migration ([0dab333](https://github.com/xcvzmoon/stampp/commit/0dab333))
- **api:** Add invoicing generate payments and pdf ([cea35a7](https://github.com/xcvzmoon/stampp/commit/cea35a7))
- **web:** Add invoices page and workspace nav ([3a6894a](https://github.com/xcvzmoon/stampp/commit/3a6894a))
- **domain:** Add profitability and utilization math ([a95ed35](https://github.com/xcvzmoon/stampp/commit/a95ed35))
- **api:** Expose profitability and utilization reports ([2f3ef43](https://github.com/xcvzmoon/stampp/commit/2f3ef43))
- **web:** Show profitability and utilization on reports ([fd4e8eb](https://github.com/xcvzmoon/stampp/commit/fd4e8eb))
- **database:** Add two-factor and personal access token tables ([8febea8](https://github.com/xcvzmoon/stampp/commit/8febea8))
- **api:** Enable 2fa oauth and personal access tokens ([9c94b68](https://github.com/xcvzmoon/stampp/commit/9c94b68))
- **web:** Add security settings and oauth sign-in ([0f8c88d](https://github.com/xcvzmoon/stampp/commit/0f8c88d))
- **mailer:** Add timesheet and invoice notification events ([df04b21](https://github.com/xcvzmoon/stampp/commit/df04b21))
- **api:** Notify managers and members on timesheet and invoice changes ([e62dccc](https://github.com/xcvzmoon/stampp/commit/e62dccc))
- **database:** Enable workspace row level security ([39e3f49](https://github.com/xcvzmoon/stampp/commit/39e3f49))
- **api:** Expose prometheus metrics and apply workspace rls context ([be8a44a](https://github.com/xcvzmoon/stampp/commit/be8a44a))
- **domain:** Add rate as-of window filter helpers ([e7bb37e](https://github.com/xcvzmoon/stampp/commit/e7bb37e))

### 🩹 Fixes

- **api:** Declare STORAGE_REGION in env schema ([acf538f](https://github.com/xcvzmoon/stampp/commit/acf538f))

### 📖 Documentation

- Mark M2 business features done in plan glossary and readme ([5cda3e1](https://github.com/xcvzmoon/stampp/commit/5cda3e1))

### ✅ Tests

- **api:** Cover M2 isolation budgets rates and invoice rules ([ee4e50f](https://github.com/xcvzmoon/stampp/commit/ee4e50f))

### ❤️ Contributors

- Mon Albert Gamil ([@xcvzmoon](https://github.com/xcvzmoon))

## v0.2.0

[compare changes](https://github.com/xcvzmoon/stampp/compare/v0.1.0...v0.2.0)

### 🚀 Enhancements

- **varlock:** Typed ENV, action CI, docker entrypoint, and audit ([15f1eee](https://github.com/xcvzmoon/stampp/commit/15f1eee))
- **web:** Add invite accept and team pages ([2532828](https://github.com/xcvzmoon/stampp/commit/2532828))
- **release:** Publish api and web images via genbumppush ([34066a5](https://github.com/xcvzmoon/stampp/commit/34066a5))
- **mailer:** Add BullMQ email queue and UnEmail worker ([c377048](https://github.com/xcvzmoon/stampp/commit/c377048))
- **api:** Enqueue mail and host the email worker ([275e890](https://github.com/xcvzmoon/stampp/commit/275e890))
- **database:** Add tags and time_entry_tags schema ([a14eaaa](https://github.com/xcvzmoon/stampp/commit/a14eaaa))
- **domain:** Add tag read and manage permissions ([9808f8d](https://github.com/xcvzmoon/stampp/commit/9808f8d))
- **shared:** Add tag schemas and time entry tag contracts ([9c2d308](https://github.com/xcvzmoon/stampp/commit/9c2d308))
- **api:** Expose workspace tags and attach them to time entries ([2b383d9](https://github.com/xcvzmoon/stampp/commit/2b383d9))
- **web:** Add tags page and timer tag picker ([65412f4](https://github.com/xcvzmoon/stampp/commit/65412f4))
- **api:** Enable Nitro OpenAPI at /api/v1/openapi.json ([512e84d](https://github.com/xcvzmoon/stampp/commit/512e84d))
- **api:** Annotate v0.1 routes with OpenAPI metadata ([1cd8724](https://github.com/xcvzmoon/stampp/commit/1cd8724))
- **api:** Add time entry duplicate endpoint and timesheet week entries ([875b5af](https://github.com/xcvzmoon/stampp/commit/875b5af))
- **api:** Instrument Nitro with evlog wide events ([cbcd6c2](https://github.com/xcvzmoon/stampp/commit/cbcd6c2))
- **web:** Wire evlog Nuxt module and local drain ([55c7304](https://github.com/xcvzmoon/stampp/commit/55c7304))

### 🩹 Fixes

- **ci:** Load varlock env in release workflow ([e813c67](https://github.com/xcvzmoon/stampp/commit/e813c67))
- **deploy:** Make compose images build and run ([f5ffac0](https://github.com/xcvzmoon/stampp/commit/f5ffac0))
- **deploy:** Run varlock via vp exec in image builds ([189866e](https://github.com/xcvzmoon/stampp/commit/189866e))

### 💅 Refactors

- Strip descriptive comments and export docs ([078c6b1](https://github.com/xcvzmoon/stampp/commit/078c6b1))

### 📖 Documentation

- Describe mailer as BullMQ queue and UnEmail dispatch ([409ac08](https://github.com/xcvzmoon/stampp/commit/409ac08))

### 🏡 Chore

- **skills:** Add varlock ([c50b41d](https://github.com/xcvzmoon/stampp/commit/c50b41d))
- **varlock:** Align schemas and scripts with skill guidance ([b544114](https://github.com/xcvzmoon/stampp/commit/b544114))
- **varlock:** Pin compose APP_ENV and fail on codegen drift ([488ad86](https://github.com/xcvzmoon/stampp/commit/488ad86))
- Bump genbumppush ([1e8853e](https://github.com/xcvzmoon/stampp/commit/1e8853e))
- **skills:** Add evlog ([b4139a6](https://github.com/xcvzmoon/stampp/commit/b4139a6))

### ✅ Tests

- **api:** Cover numeric SMTP_PORT from typed ENV ([2303227](https://github.com/xcvzmoon/stampp/commit/2303227))
- **api:** Cover v0.1 OpenAPI product operations ([8d6b6e5](https://github.com/xcvzmoon/stampp/commit/8d6b6e5))
- **api:** Cover catalog export and auth tenant isolation ([36d425f](https://github.com/xcvzmoon/stampp/commit/36d425f))

### ❤️ Contributors

- Mon Albert Gamil ([@xcvzmoon](https://github.com/xcvzmoon))

## v0.1.0


### 🚀 Enhancements

- **domain:** Add money, duration, and permission primitives ([8e668a6](https://github.com/xcvzmoon/stampp/commit/8e668a6))
- **shared:** Add api error codes and valibot schemas ([e04ed02](https://github.com/xcvzmoon/stampp/commit/e04ed02))
- **database:** Add scoped drizzle client and schema helpers ([ad37dd4](https://github.com/xcvzmoon/stampp/commit/ad37dd4))
- **access:** Add workspace authorization seam ([39e5d26](https://github.com/xcvzmoon/stampp/commit/39e5d26))
- **mailer:** Add unemail mail dispatch ([3f435ca](https://github.com/xcvzmoon/stampp/commit/3f435ca))
- **api:** Add health endpoints, request-id middleware, and workspace deps ([0fa9973](https://github.com/xcvzmoon/stampp/commit/0fa9973))
- **db:** Add better-auth schema with shared text id and timestamp helpers ([49c28f1](https://github.com/xcvzmoon/stampp/commit/49c28f1))
- **api:** Mount better auth handlers for sign-in, verify, and workspace create ([dbbda03](https://github.com/xcvzmoon/stampp/commit/dbbda03))
- **web:** Add sign-in, sign-up, and workspace create pages ([bc611fd](https://github.com/xcvzmoon/stampp/commit/bc611fd))
- **db:** Add clients, projects, and tasks schema with migration ([dbc64b9](https://github.com/xcvzmoon/stampp/commit/dbc64b9))
- **shared:** Add catalog schemas, list result types, and project error codes ([a9b11fa](https://github.com/xcvzmoon/stampp/commit/a9b11fa))
- **domain:** Add client and project read permissions ([40d2e7a](https://github.com/xcvzmoon/stampp/commit/40d2e7a))
- **api:** Add workspace-scoped catalog CRUD endpoints ([3bd3b08](https://github.com/xcvzmoon/stampp/commit/3bd3b08))
- **web:** Add workspace layout and catalog management pages ([b0e3407](https://github.com/xcvzmoon/stampp/commit/b0e3407))
- **database:** Add time entry storage and constraints ([7bbe910](https://github.com/xcvzmoon/stampp/commit/7bbe910))
- **shared:** Add time entry contracts ([f528649](https://github.com/xcvzmoon/stampp/commit/f528649))
- **api:** Add workspace timer and time entry endpoints ([5cd95ff](https://github.com/xcvzmoon/stampp/commit/5cd95ff))
- **web:** Add timer and time entry screens ([93e067c](https://github.com/xcvzmoon/stampp/commit/93e067c))
- **api:** Add weekly timesheet summaries ([a49f840](https://github.com/xcvzmoon/stampp/commit/a49f840))
- **web:** Add weekly timesheet grid ([9d583bc](https://github.com/xcvzmoon/stampp/commit/9d583bc))
- **reports:** Add scoped reports and CSV exports ([7826b66](https://github.com/xcvzmoon/stampp/commit/7826b66))
- **export:** Add workspace JSON export ([7502d85](https://github.com/xcvzmoon/stampp/commit/7502d85))
- **web:** Add workspace reports page ([f5d4a81](https://github.com/xcvzmoon/stampp/commit/f5d4a81))
- **deploy:** Add self-hosted compose stack ([b39810e](https://github.com/xcvzmoon/stampp/commit/b39810e))
- **api:** Correlate audit events with requests ([3c80b27](https://github.com/xcvzmoon/stampp/commit/3c80b27))

### 🩹 Fixes

- **api:** Resolve auth handler import relative to server root ([36117f3](https://github.com/xcvzmoon/stampp/commit/36117f3))

### 💅 Refactors

- **api:** Adopt workspace path aliases ([5daaa5e](https://github.com/xcvzmoon/stampp/commit/5daaa5e))

### 📖 Documentation

- Add product target, engineering plan, and domain glossary ([e3d48c4](https://github.com/xcvzmoon/stampp/commit/e3d48c4))
- Rewrite readme for self-hosted stampp product ([784f1ef](https://github.com/xcvzmoon/stampp/commit/784f1ef))
- Replace starter documentation ([8bf5a33](https://github.com/xcvzmoon/stampp/commit/8bf5a33))

### 🏡 Chore

- Initialize repository ([36ad3d9](https://github.com/xcvzmoon/stampp/commit/36ad3d9))
- Add agentic rules and skills ([b60160c](https://github.com/xcvzmoon/stampp/commit/b60160c))
- Configure formatter and linter ([0928581](https://github.com/xcvzmoon/stampp/commit/0928581))
- Remove placeholders ([c7188b1](https://github.com/xcvzmoon/stampp/commit/c7188b1))
- **vscode:** Update settings ([bfa0e81](https://github.com/xcvzmoon/stampp/commit/bfa0e81))
- Configure tests runner ([bc68a0a](https://github.com/xcvzmoon/stampp/commit/bc68a0a))
- Update typescript to 6.0.3 ([6fa47a1](https://github.com/xcvzmoon/stampp/commit/6fa47a1))
- Add version manager ([cd4b269](https://github.com/xcvzmoon/stampp/commit/cd4b269))
- **apps:** Initialize web ([e4391cd](https://github.com/xcvzmoon/stampp/commit/e4391cd))
- **github:** Add actions, renovate, templates, and workflows ([403899f](https://github.com/xcvzmoon/stampp/commit/403899f))
- **apps:** Initialize api ([5228acb](https://github.com/xcvzmoon/stampp/commit/5228acb))
- Update scripts ([90fd591](https://github.com/xcvzmoon/stampp/commit/90fd591))
- **vite-config:** Update git pre-hooks ([1728af1](https://github.com/xcvzmoon/stampp/commit/1728af1))
- **workspace:** Pin catalogs, root scripts, and shared tsconfig ([0f214eb](https://github.com/xcvzmoon/stampp/commit/0f214eb))
- **env:** Add varlock schemas and local env examples ([ef6788c](https://github.com/xcvzmoon/stampp/commit/ef6788c))
- **deploy:** Add postgres, valkey, and mailpit compose stack ([0298eaf](https://github.com/xcvzmoon/stampp/commit/0298eaf))
- Bump genbumppush to 0.0.7 ([488af74](https://github.com/xcvzmoon/stampp/commit/488af74))
- **genbumppush:** Remove the release value ([537ac5c](https://github.com/xcvzmoon/stampp/commit/537ac5c))
- Add release script ([3018a4b](https://github.com/xcvzmoon/stampp/commit/3018a4b))

### 🤖 CI

- Load varlock env and start postgres plus valkey ([88f7eca](https://github.com/xcvzmoon/stampp/commit/88f7eca))

### ❤️ Contributors

- Mon Albert Gamil ([@xcvzmoon](https://github.com/xcvzmoon))
