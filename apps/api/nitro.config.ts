// oxlint-disable-next-line import/no-unassigned-import
import 'varlock/auto-load';
import { defineConfig } from 'nitro';
import { ENV } from './env.ts';

const appOrigin = ENV.PUBLIC_APP_URL ?? 'http://localhost:3000';

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
