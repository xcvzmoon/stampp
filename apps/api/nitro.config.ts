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
  experimental: {
    openAPI: true,
  },
  openAPI: {
    meta: {
      title: 'Stampp API',
      description:
        'Workspace-scoped work-time API. Session auth is Better Auth at /api/auth/*; product routes live under /api/v1.',
      version: '0.1.0',
    },
    route: '/api/v1/openapi.json',
    production: 'prerender',
    ui: {
      scalar: {
        route: '/api/v1/docs',
      },
      swagger: false,
    },
  },
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
