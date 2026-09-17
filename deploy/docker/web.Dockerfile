# syntax=docker/dockerfile:1

FROM ghcr.io/voidzero-dev/vite-plus:0.3.2 AS build
WORKDIR /app

COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml vite.config.ts ./
COPY --chown=vp:vp apps/api/package.json apps/api/package.json
COPY --chown=vp:vp apps/web/package.json apps/web/package.json
COPY --chown=vp:vp packages/access/package.json packages/access/package.json
COPY --chown=vp:vp packages/database/package.json packages/database/package.json
COPY --chown=vp:vp packages/domain/package.json packages/domain/package.json
COPY --chown=vp:vp packages/mailer/package.json packages/mailer/package.json
COPY --chown=vp:vp packages/shared/package.json packages/shared/package.json
RUN vp install --frozen-lockfile --ignore-scripts

COPY --chown=vp:vp . .
RUN APP_ENV=production \
    PUBLIC_APP_URL=http://localhost:3000 \
    PUBLIC_API_URL=http://localhost:3001 \
    NUXT_PUBLIC_AUTH_BASE_URL=http://localhost:3001/api/auth \
    NUXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1 \
    vp run --filter web build

FROM node:26-bookworm-slim AS runtime
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /app/apps/web/.output ./

USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
