# Changelog

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
