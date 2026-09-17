import { describe, expect, it } from 'vite-plus/test';
import { createAuditEvent } from '~/server/utils/audit.ts';

describe('createAuditEvent', () => {
  const actor = { userId: 'user_1', workspaceId: 'workspace_1' };

  it('binds the actor, workspace, entity, and request correlation metadata', () => {
    expect(
      createAuditEvent(actor, 'request_1', {
        action: 'time_entry.updated',
        entityType: 'time_entry',
        entityId: 'entry_1',
        before: { durationMinutes: 30 },
        after: { durationMinutes: 45 },
      }),
    ).toEqual({
      workspaceId: 'workspace_1',
      actorUserId: 'user_1',
      action: 'time_entry.updated',
      entityType: 'time_entry',
      entityId: 'entry_1',
      before: { durationMinutes: 30 },
      after: { durationMinutes: 45 },
      metadata: { requestId: 'request_1' },
    });
  });

  it('stores absent snapshots as null for create and delete events', () => {
    const created = createAuditEvent(actor, 'request_create', {
      action: 'client.created',
      entityType: 'client',
      entityId: 'client_1',
      after: { name: 'Acme' },
    });
    const deleted = createAuditEvent(actor, 'request_delete', {
      action: 'time_entry.deleted',
      entityType: 'time_entry',
      entityId: 'entry_1',
      before: { durationMinutes: 30 },
    });

    expect(created.before).toBeNull();
    expect(created.after).toEqual({ name: 'Acme' });
    expect(deleted.before).toEqual({ durationMinutes: 30 });
    expect(deleted.after).toBeNull();
  });

  it('preserves false, zero, and empty-string snapshot values', () => {
    const event = createAuditEvent(actor, 'request_falsy', {
      action: 'entity.updated',
      entityType: 'entity',
      entityId: 'entity_1',
      before: false,
      after: 0,
    });
    const empty = createAuditEvent(actor, 'request_empty', {
      action: 'entity.updated',
      entityType: 'entity',
      entityId: 'entity_1',
      after: '',
    });

    expect(event.before).toBe(false);
    expect(event.after).toBe(0);
    expect(empty.after).toBe('');
  });
});
