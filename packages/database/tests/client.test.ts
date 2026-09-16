import { describe, expect, it } from 'vite-plus/test';
import { createScopedDb, createTestDb } from '../src/client.ts';

describe('createScopedDb', () => {
  it('brands the db handle with the workspace id', () => {
    const scoped = createScopedDb(createTestDb(), '01900000-0000-7000-8000-0000000000aa');
    expect(scoped.workspaceId).toBe('01900000-0000-7000-8000-0000000000aa');
  });

  it('exposes the original db client for queries', () => {
    const db = createTestDb();
    const scoped = createScopedDb(db, 'ws_1');
    expect(scoped.client).toBe(db);
  });

  it('does not mutate the original db object', () => {
    const db = createTestDb();
    createScopedDb(db, 'ws_1');
    expect(Object.hasOwn(db, 'workspaceId')).toBe(false);
  });
});
