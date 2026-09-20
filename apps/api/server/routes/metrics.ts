import { defineHandler, defineRouteMeta } from 'nitro';
import { renderPrometheusMetrics } from '~/server/utils/metrics.ts';

defineRouteMeta({
  openAPI: {
    tags: ['health'],
    summary: 'Prometheus metrics',
    responses: {
      200: {
        description: 'Prometheus text exposition',
        content: {
          'text/plain': {
            schema: { type: 'string' },
          },
        },
      },
    },
  },
});

export default defineHandler((event) => {
  event.res.headers.set('content-type', 'text/plain; version=0.0.4; charset=utf-8');
  return renderPrometheusMetrics();
});
