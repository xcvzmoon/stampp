import { defineConfig } from 'nitro';

const appOrigin = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';

export default defineConfig({
  alias: {
    '~': import.meta.dirname,
  },
  compatibilityDate: '2026-09-16',
  serverDir: './server',
  routeRules: {
    '/api/auth/**': {
      cors: {
        origin: [appOrigin],
        credentials: true,
      },
    },
    '/api/v1/**': {
      cors: {
        origin: [appOrigin],
        credentials: true,
      },
    },
  },
});
