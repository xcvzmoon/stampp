import { createDb, pingDb } from '@stampp/database';
import { defineHandler, defineRouteMeta } from 'nitro';
import { ENV } from '~/server/utils/env.ts';

defineRouteMeta({
  openAPI: {
    tags: ['health'],
    summary: 'Readiness probe',
    description: 'Reports PostgreSQL and Valkey reachability.',
    responses: {
      200: {
        description: 'All required dependencies are ready',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Readiness',
            },
          },
        },
      },
      503: {
        description: 'One or more dependencies are unavailable',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Readiness',
            },
          },
        },
      },
    },
    $global: {
      components: {
        schemas: {
          Readiness: {
            type: 'object',
            required: ['status', 'dependencies'],
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded'] },
              dependencies: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['name', 'ok'],
                  properties: {
                    name: { type: 'string' },
                    ok: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});

type DependencyStatus = {
  name: string;
  ok: boolean;
};

async function checkValkey(url: string): Promise<boolean> {
  const { default: Redis } = await import('ioredis');
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_500,
  });
  try {
    await client.connect();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

export default defineHandler(async (event) => {
  const dependencies: DependencyStatus[] = [];

  const databaseUrl = ENV.DATABASE_URL;
  if (databaseUrl) {
    const db = createDb({
      connectionString: databaseUrl,
      max: 1,
    });
    dependencies.push({
      name: 'postgres',
      ok: await pingDb(db),
    });
  } else {
    dependencies.push({ name: 'postgres', ok: false });
  }

  const valkeyUrl = ENV.VALKEY_URL;
  if (valkeyUrl) {
    dependencies.push({
      name: 'valkey',
      ok: await checkValkey(valkeyUrl),
    });
  } else {
    dependencies.push({ name: 'valkey', ok: false });
  }

  const ready = dependencies.every((dependency) => dependency.ok);
  event.res.status = ready ? 200 : 503;
  return {
    status: ready ? ('ok' as const) : ('degraded' as const),
    dependencies,
  };
});
