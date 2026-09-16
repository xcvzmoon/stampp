import type { Db } from '@stampp/database';
import { createDb } from '@stampp/database';

let db: Db | undefined;

export function getDb(): Db {
  if (db) {
    return db;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  db = createDb({ connectionString });
  return db;
}
