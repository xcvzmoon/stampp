import { defineConfig } from 'genbumppush';

export default defineConfig({
  hooks: {
    before: ['vp run fmt', 'vp run lint', 'vp run check'],
  },
  github: {
    enabled: true,
  },
  docker: {
    enabled: true,
    // Source images must already exist locally:
    // docker compose --env-file deploy/docker/.env -f deploy/docker/compose.yaml build api web
    tags: ['{{version}}', '{{tag}}'],
    images: [
      {
        source: 'ghcr.io/xcvzmoon/stampp-api:local',
        image: 'ghcr.io/xcvzmoon/stampp-api',
      },
      {
        source: 'ghcr.io/xcvzmoon/stampp-web:local',
        image: 'ghcr.io/xcvzmoon/stampp-web',
      },
    ],
  },
});
