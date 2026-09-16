import { describe, expect, it } from 'vite-plus/test';
import { getDb } from '../server/utils/db.ts';

describe('getDb', () => {
  it('throws when DATABASE_URL is missing', () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(() => getDb()).toThrow('DATABASE_URL is required');
    } finally {
      if (previous === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previous;
      }
    }
  });
});
