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

# Collapse monorepo @import graph so the runtime image can validate without repo root files.
# Drop generated-types codegen: runtime containers are read-only.
RUN cd apps/api && pnpm exec varlock flatten \
    && sed -i '/@generateTsTypes/d' .env-flat/.env.schema

RUN export APP_ENV=production \
    PUBLIC_APP_URL=http://localhost:3000 \
    DATABASE_URL=postgres://build:build@localhost:5432/build \
    VALKEY_URL=redis://localhost:6379 \
    BETTER_AUTH_SECRET=build-only-secret-with-at-least-32-characters \
    BETTER_AUTH_URL=http://localhost:3001 \
    MAIL_FROM='Stampp <hello@localhost>' \
    MAIL_MODE=mock \
    && pnpm exec varlock load --path apps/api \
    && vp run --filter api build

FROM node:26-bookworm-slim AS runtime
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app

# GHCR varlock image is musl-linked; Debian runtime needs the npm build.
RUN npm install -g varlock@1.19.0
COPY --from=build --chown=node:node /app/apps/api/.output ./
# Overlay flattened schema (no local secrets) so `varlock run` can validate compose-injected env.
COPY --from=build --chown=node:node /app/apps/api/.env-flat/ ./

USER node
EXPOSE 3001
ENTRYPOINT ["varlock", "run", "--"]
CMD ["node", "server/index.mjs"]
