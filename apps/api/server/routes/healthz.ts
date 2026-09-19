import { defineHandler, defineRouteMeta } from 'nitro';

defineRouteMeta({
  openAPI: {
    tags: ['health'],
    summary: 'Liveness probe',
    responses: {
      200: {
        description: 'Process is alive',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['status'],
              properties: {
                status: { type: 'string', enum: ['ok'] },
              },
            },
          },
        },
      },
    },
  },
});

export default defineHandler(() => {
  return {
    status: 'ok' as const,
  };
});
