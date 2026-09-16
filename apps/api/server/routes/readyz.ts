import { createDb, pingDb } from '@stampp/database';
import { defineHandler } from 'nitro';

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

  const databaseUrl = process.env.DATABASE_URL;
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

  const valkeyUrl = process.env.VALKEY_URL;
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
