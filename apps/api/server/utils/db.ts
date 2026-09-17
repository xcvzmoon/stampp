import type { Db } from '@stampp/database';
import { createDb } from '@stampp/database';
import { ENV } from '~/server/utils/env.ts';

let db: Db | undefined;

export function getDb(): Db {
  if (db) {
    return db;
  }

  const connectionString = ENV.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  db = createDb({ connectionString });
  return db;
}
