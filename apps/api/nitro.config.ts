// oxlint-disable-next-line import/no-unassigned-import
import 'varlock/auto-load';
import evlog from 'evlog/nitro/v3';
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
        'Workspace-scoped work-time API. Authenticate with a Better Auth session cookie or a personal access token (Authorization: Bearer stpp_…). Product routes live under /api/v1. Mutations accept an optional Idempotency-Key header; all /api/v1 calls are rate limited per credential.',
      version: '1.0.0',
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
  modules: [
    evlog({
      env: { service: 'stampp-api' },
      include: ['/api/**', '/healthz', '/readyz'],
      exclude: ['/healthz', '/readyz'],
    }),
  ],
});
