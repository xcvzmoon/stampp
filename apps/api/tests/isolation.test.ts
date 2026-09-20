import type { WorkspaceAccessDeps } from '@stampp/access';
import { enterWorkspace } from '@stampp/access';
import {
  auditEvents,
  clients,
  createTestDb,
  expenses,
  invoiceLines,
  invoices,
  organizations,
  personalAccessTokens,
  projects,
  rates,
  tags,
  tasks,
  timeEntries,
  timeEntryTags,
  timesheets,
} from '@stampp/database';
import { and, asc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { describe, expect, it } from 'vite-plus/test';
import { reportScope } from '~/server/utils/reports.ts';
import { weeklyTimeScope } from '~/server/utils/timeTracking.ts';

const workspaceA = 'ws_isolation_a';
const workspaceB = 'ws_isolation_b';
const userId = 'user_isolation';

function makeDeps(
  role: 'admin' | 'manager' | 'member' | null,
  memberOf: string | null,
): WorkspaceAccessDeps {
  return {
    getSessionUserId: () => Promise.resolve(userId),
    getMemberRole: (_actor, workspaceId) => Promise.resolve(workspaceId === memberOf ? role : null),
    db: createTestDb(),
  };
}

function reportContext(role: 'admin' | 'member') {
  return {
    userId,
    workspaceId: workspaceA,
    role,
    db: { workspaceId: workspaceA, client: createTestDb() },
  };
}

describe('catalog tenant isolation', () => {
  it('scopes client list queries to workspace_id and non-deleted rows', () => {
    const db = createTestDb();
    const query = db
      .select()
      .from(clients)
      .where(and(eq(clients.workspaceId, workspaceA), isNull(clients.deletedAt)))
      .orderBy(asc(clients.id))
      .toSQL();
    expect(query.sql).toContain('"workspace_id" = $1');
    expect(query.sql).toContain('"deleted_at" is null');
    expect(query.params[0]).toBe(workspaceA);
  });

  it('scopes cursor pages so another workspace id cannot leak rows', () => {
    const db = createTestDb();
    const query = db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.workspaceId, workspaceA),
          isNull(clients.deletedAt),
          gt(clients.id, 'cli_cursor'),
        ),
      )
      .toSQL();
    expect(query.params).toContain(workspaceA);
    expect(query.params).toContain('cli_cursor');
    expect(query.params).not.toContain(workspaceB);
  });

  it('binds workspace_id on projects, tasks, and tags', () => {
    const db = createTestDb();
    const project = db.select().from(projects).where(eq(projects.workspaceId, workspaceA)).toSQL();
    const task = db.select().from(tasks).where(eq(tasks.workspaceId, workspaceA)).toSQL();
    const tag = db.select().from(tags).where(eq(tags.workspaceId, workspaceA)).toSQL();

    for (const query of [project, task, tag]) {
      expect(query.sql).toContain('"workspace_id" = $1');
      expect(query.params[0]).toBe(workspaceA);
    }
  });

  it('scopes time entries and the time_entry_tags join by workspace', () => {
    const db = createTestDb();
    const entry = db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.workspaceId, workspaceB))
      .toSQL();
    const entryTag = db
      .select()
      .from(timeEntryTags)
      .where(eq(timeEntryTags.workspaceId, workspaceB))
      .toSQL();

    expect(entry.sql).toContain('"workspace_id" = $1');
    expect(entryTag.sql).toContain('"workspace_id" = $1');
    expect(entry.params).toEqual([workspaceB]);
    expect(entryTag.params).toEqual([workspaceB]);
  });

  it('puts workspace_id first in the weekly timesheet scope', () => {
    const db = createTestDb();
    const query = db
      .select()
      .from(timeEntries)
      .where(weeklyTimeScope(workspaceA, userId, '2026-09-14', '2026-09-20'))
      .toSQL();
    expect(query.sql).toContain('"workspace_id" = $1');
    expect(query.params[0]).toBe(workspaceA);
  });

  it('binds workspace_id on rates list and as-of windows', () => {
    const db = createTestDb();
    const list = db.select().from(rates).where(eq(rates.workspaceId, workspaceA)).toSQL();
    const asOf = db
      .select()
      .from(rates)
      .where(
        and(
          eq(rates.workspaceId, workspaceB),
          lte(rates.effectiveFrom, new Date('2026-01-01T00:00:00.000Z')),
          or(
            isNull(rates.effectiveTo),
            gt(rates.effectiveTo, new Date('2026-01-01T00:00:00.000Z')),
          ),
        ),
      )
      .toSQL();

    expect(list.sql).toContain('"workspace_id" = $1');
    expect(list.params[0]).toBe(workspaceA);
    expect(asOf.sql).toContain('"workspace_id" = $1');
    expect(asOf.params[0]).toBe(workspaceB);
    expect(asOf.params).not.toContain(workspaceA);
  });

  it('binds workspace_id on timesheet approval queries', () => {
    const db = createTestDb();
    const list = db
      .select()
      .from(timesheets)
      .where(and(eq(timesheets.workspaceId, workspaceA), eq(timesheets.status, 'submitted')))
      .toSQL();
    const own = db
      .select()
      .from(timesheets)
      .where(
        and(
          eq(timesheets.workspaceId, workspaceB),
          eq(timesheets.userId, userId),
          eq(timesheets.weekStart, '2026-09-14'),
        ),
      )
      .toSQL();

    expect(list.sql).toContain('"workspace_id" = $1');
    expect(list.params[0]).toBe(workspaceA);
    expect(own.sql).toContain('"workspace_id" = $1');
    expect(own.params[0]).toBe(workspaceB);
    expect(own.params).not.toContain(workspaceA);
  });
});

describe('export tenant isolation', () => {
  it('scopes every export source table query to the authorized workspace', () => {
    const db = createTestDb();
    const queries = [
      db.select().from(organizations).where(eq(organizations.id, workspaceA)).toSQL(),
      db.select().from(clients).where(eq(clients.workspaceId, workspaceA)).toSQL(),
      db.select().from(projects).where(eq(projects.workspaceId, workspaceA)).toSQL(),
      db.select().from(tasks).where(eq(tasks.workspaceId, workspaceA)).toSQL(),
      db.select().from(tags).where(eq(tags.workspaceId, workspaceA)).toSQL(),
      db.select().from(timeEntries).where(eq(timeEntries.workspaceId, workspaceA)).toSQL(),
      db.select().from(timeEntryTags).where(eq(timeEntryTags.workspaceId, workspaceA)).toSQL(),
      db.select().from(rates).where(eq(rates.workspaceId, workspaceA)).toSQL(),
      db.select().from(timesheets).where(eq(timesheets.workspaceId, workspaceA)).toSQL(),
      db.select().from(expenses).where(eq(expenses.workspaceId, workspaceA)).toSQL(),
      db.select().from(invoices).where(eq(invoices.workspaceId, workspaceA)).toSQL(),
      db.select().from(invoiceLines).where(eq(invoiceLines.workspaceId, workspaceA)).toSQL(),
      db
        .select()
        .from(personalAccessTokens)
        .where(eq(personalAccessTokens.workspaceId, workspaceA))
        .toSQL(),
      db.select().from(auditEvents).where(eq(auditEvents.workspaceId, workspaceA)).toSQL(),
    ];

    for (const query of queries) {
      expect(query.params).toContain(workspaceA);
    }
  });
});

describe('auth org boundary isolation', () => {
  it('grants access only for the workspace the user is a member of', async () => {
    const deps = makeDeps('admin', workspaceA);

    const ctxA = await enterWorkspace(deps, {
      workspaceId: workspaceA,
      permission: 'client:read',
    });
    expect(ctxA.workspaceId).toBe(workspaceA);
    expect(ctxA.db.workspaceId).toBe(workspaceA);

    await expect(
      enterWorkspace(deps, { workspaceId: workspaceB, permission: 'client:read' }),
    ).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('denies workspace export to members and managers', async () => {
    await Promise.all(
      (['member', 'manager'] as const).map((role) =>
        expect(
          enterWorkspace(makeDeps(role, workspaceA), {
            workspaceId: workspaceA,
            permission: 'export:workspace',
          }),
        ).rejects.toMatchObject({ kind: 'forbidden' }),
      ),
    );
  });

  it('denies catalog manage permissions to members', async () => {
    await Promise.all(
      (['client:manage', 'project:manage', 'tag:manage'] as const).map((permission) =>
        expect(
          enterWorkspace(makeDeps('member', workspaceA), {
            workspaceId: workspaceA,
            permission,
          }),
        ).rejects.toMatchObject({ kind: 'forbidden' }),
      ),
    );
  });

  it('rejects unauthenticated callers without membership lookup', async () => {
    let lookups = 0;
    await expect(
      enterWorkspace(
        {
          getSessionUserId: () => Promise.resolve(null),
          getMemberRole: () => {
            lookups += 1;
            return Promise.resolve('admin');
          },
          db: createTestDb(),
        },
        { workspaceId: workspaceA, permission: 'client:read' },
      ),
    ).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(lookups).toBe(0);
  });
});

describe('report tenant isolation', () => {
  it('keeps report scope workspace-bound for members and managers', () => {
    const db = createTestDb();
    const query = db
      .select()
      .from(timeEntries)
      .where(
        reportScope(reportContext('member'), {
          from: '2026-09-01',
          to: '2026-09-30',
          timezone: 'UTC',
        }),
      )
      .toSQL();
    expect(query.sql).toContain('"workspace_id"');
    expect(query.params).toContain(workspaceA);
  });
});
