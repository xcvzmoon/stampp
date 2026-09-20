import type { AuthorizedContext } from '@stampp/access';
import type { Rate } from '@stampp/database';
import type { RateKind, RateCandidate } from '@stampp/domain';
import type {
  CreateRateInput,
  EffectiveRatesDto,
  RateDto,
  RateListQuery,
  RateScope,
} from '@stampp/shared';
import { members, projects, rates, tasks } from '@stampp/database';
import { resolveEffectiveRates } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, type SQL } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Rate not found', requestId);
}

function invalidTarget(requestId: string, message: string) {
  return toApiError(ERROR_CODES.RATE_INVALID_TARGET, message, requestId);
}

export function toRateDto(row: Rate): RateDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    scope: row.scope,
    userId: row.userId,
    projectId: row.projectId,
    taskId: row.taskId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function openVersionKey(input: {
  workspaceId: string;
  kind: RateKind;
  scope: RateScope;
  userId: string | null;
  projectId: string | null;
  taskId: string | null;
}) {
  return and(
    eq(rates.workspaceId, input.workspaceId),
    eq(rates.kind, input.kind),
    eq(rates.scope, input.scope),
    input.userId === null ? isNull(rates.userId) : eq(rates.userId, input.userId),
    input.projectId === null ? isNull(rates.projectId) : eq(rates.projectId, input.projectId),
    input.taskId === null ? isNull(rates.taskId) : eq(rates.taskId, input.taskId),
    isNull(rates.effectiveTo),
  );
}

function scopeTargetsMatch(
  scope: RateScope,
  userId: string | null,
  projectId: string | null,
  taskId: string | null,
): boolean {
  switch (scope) {
    case 'org':
      return userId === null && projectId === null && taskId === null;
    case 'user':
      return userId !== null && projectId === null && taskId === null;
    case 'project':
      return userId === null && projectId !== null && taskId === null;
    case 'user_project':
      return userId !== null && projectId !== null && taskId === null;
    case 'task':
      return userId === null && projectId !== null && taskId !== null;
    default:
      return false;
  }
}

async function assertTargets(
  ctx: AuthorizedContext,
  input: CreateRateInput,
  requestId: string,
): Promise<{ userId: string | null; projectId: string | null; taskId: string | null }> {
  const userId = input.userId ?? null;
  const projectId = input.projectId ?? null;
  const taskId = input.taskId ?? null;

  if (!scopeTargetsMatch(input.scope, userId, projectId, taskId)) {
    throw invalidTarget(
      requestId,
      `Scope ${input.scope} does not match the provided user/project/task targets`,
    );
  }

  if (userId) {
    const rows = await ctx.db.client
      .select({ id: members.userId })
      .from(members)
      .where(and(eq(members.userId, userId), eq(members.organizationId, ctx.workspaceId)))
      .limit(1);
    if (!rows[0]) {
      throw invalidTarget(requestId, 'User is not a member of this workspace');
    }
  }

  if (projectId) {
    const rows = await ctx.db.client
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, ctx.workspaceId),
          eq(projects.id, projectId),
          isNull(projects.deletedAt),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      throw invalidTarget(requestId, 'Project not found');
    }
  }

  if (taskId) {
    if (!projectId) {
      throw invalidTarget(requestId, 'A task rate requires a project');
    }
    const scopedProjectId: string = projectId;
    const rows = await ctx.db.client
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.workspaceId, ctx.workspaceId),
          eq(tasks.projectId, scopedProjectId),
          eq(tasks.id, taskId),
          isNull(tasks.deletedAt),
        ),
      )
      .limit(1);
    if (!rows[0]) {
      throw invalidTarget(requestId, 'Task not found');
    }
  }

  return { userId, projectId, taskId };
}

export async function listRates(
  ctx: AuthorizedContext,
  options: RateListQuery & { limit: number },
): Promise<{ items: RateDto[]; nextCursor: string | null }> {
  const conditions: SQL[] = [eq(rates.workspaceId, ctx.workspaceId)];
  if (options.cursor) conditions.push(gt(rates.id, options.cursor));
  if (options.kind) conditions.push(eq(rates.kind, options.kind));
  if (options.scope) conditions.push(eq(rates.scope, options.scope));
  if (options.projectId) conditions.push(eq(rates.projectId, options.projectId));
  if (options.userId) conditions.push(eq(rates.userId, options.userId));

  const rows = await ctx.db.client
    .select()
    .from(rates)
    .where(and(...conditions))
    .orderBy(asc(rates.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toRateDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function createRate(
  ctx: AuthorizedContext,
  input: CreateRateInput,
  requestId: string,
): Promise<RateDto> {
  const targets = await assertTargets(ctx, input, requestId);
  const effectiveFrom = new Date(input.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'effectiveFrom must be a valid timestamp', requestId);
  }

  const key = {
    workspaceId: ctx.workspaceId,
    kind: input.kind,
    scope: input.scope,
    ...targets,
  };

  const row = await ctx.db.client.transaction(async (tx) => {
    const openRows = await tx
      .select()
      .from(rates)
      .where(openVersionKey(key))
      .orderBy(desc(rates.effectiveFrom));

    const closedAt = new Date();
    const toClose: string[] = [];
    for (const open of openRows) {
      if (open.effectiveFrom.getTime() >= effectiveFrom.getTime()) {
        throw toApiError(
          ERROR_CODES.CONFLICT,
          'A rate version already starts at or after effectiveFrom for this target',
          requestId,
        );
      }
      toClose.push(open.id);
    }
    if (toClose.length > 0) {
      await tx
        .update(rates)
        .set({ effectiveTo: effectiveFrom, updatedAt: closedAt })
        .where(and(inArray(rates.id, toClose), isNull(rates.effectiveTo)));
    }

    const inserted = await tx
      .insert(rates)
      .values({
        workspaceId: ctx.workspaceId,
        kind: input.kind,
        scope: input.scope,
        userId: targets.userId,
        projectId: targets.projectId,
        taskId: targets.taskId,
        amountMinor: input.amountMinor,
        currency: input.currency,
        effectiveFrom,
      })
      .returning();
    const created = inserted[0];
    if (!created) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create rate', requestId);
    }
    return created;
  });

  await recordAudit(ctx, requestId, {
    action: 'rate.created',
    entityType: 'rate',
    entityId: row.id,
    after: row,
  });
  return toRateDto(row);
}

async function getRateRow(
  ctx: AuthorizedContext,
  rateId: string,
  requestId: string,
): Promise<Rate> {
  const rows = await ctx.db.client
    .select()
    .from(rates)
    .where(and(eq(rates.workspaceId, ctx.workspaceId), eq(rates.id, rateId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

/** Closes the open version so the rate stops applying going forward. History stays. */
export async function revokeRate(
  ctx: AuthorizedContext,
  rateId: string,
  requestId: string,
): Promise<RateDto> {
  const before = await getRateRow(ctx, rateId, requestId);
  if (before.effectiveTo) {
    throw toApiError(ERROR_CODES.RATE_NOT_REVOCABLE, 'Rate version is already closed', requestId);
  }
  const now = new Date();
  if (before.effectiveFrom.getTime() >= now.getTime()) {
    throw toApiError(
      ERROR_CODES.RATE_NOT_REVOCABLE,
      'Future rate versions cannot be revoked after they are scheduled; create a superseding version instead',
      requestId,
    );
  }

  const updated = await ctx.db.client
    .update(rates)
    .set({ effectiveTo: now, updatedAt: now })
    .where(
      and(eq(rates.workspaceId, ctx.workspaceId), eq(rates.id, rateId), isNull(rates.effectiveTo)),
    )
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);

  await recordAudit(ctx, requestId, {
    action: 'rate.revoked',
    entityType: 'rate',
    entityId: rateId,
    before,
    after: row,
  });
  return toRateDto(row);
}

function asOfWindow(at: Date): SQL {
  const window = and(
    lte(rates.effectiveFrom, at),
    or(isNull(rates.effectiveTo), gt(rates.effectiveTo, at)),
  );
  // SAFETY: and() with two non-null clauses always returns SQL.
  if (!window) {
    throw new Error('as-of window predicate is empty');
  }
  return window;
}

function toCandidate(row: Rate): RateCandidate {
  return {
    scope: row.scope,
    amountMinor: row.amountMinor,
    currency: row.currency,
    userId: row.userId,
    projectId: row.projectId,
    taskId: row.taskId,
  };
}

export async function resolveRates(
  ctx: AuthorizedContext,
  query: {
    at?: string | undefined;
    userId?: string | undefined;
    projectId?: string | undefined;
    taskId?: string | undefined;
  },
  requestId: string,
): Promise<EffectiveRatesDto> {
  const at = query.at ? new Date(query.at) : new Date();
  if (Number.isNaN(at.getTime())) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'at must be a valid timestamp', requestId);
  }
  const userId = query.userId ?? null;
  const projectId = query.projectId ?? null;
  const taskId = query.taskId ?? null;
  if (taskId && !projectId) {
    throw invalidTarget(requestId, 'taskId requires projectId');
  }

  const rows = await ctx.db.client
    .select()
    .from(rates)
    .where(and(eq(rates.workspaceId, ctx.workspaceId), asOfWindow(at)));

  const billableCandidates: RateCandidate[] = [];
  const costCandidates: RateCandidate[] = [];
  for (const row of rows) {
    const candidate = toCandidate(row);
    if (row.kind === 'billable') {
      billableCandidates.push(candidate);
    } else {
      costCandidates.push(candidate);
    }
  }

  let effective;
  try {
    effective = resolveEffectiveRates(billableCandidates, costCandidates, {
      userId,
      projectId,
      taskId,
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw toApiError(ERROR_CODES.RATE_CURRENCY_MISMATCH, error.message, requestId);
    }
    throw error;
  }

  return {
    billable: effective.billable,
    cost: effective.cost,
    currency: effective.currency,
    source: effective.source,
    at: at.toISOString(),
    userId,
    projectId,
    taskId,
  };
}

export async function listRatesForExport(ctx: AuthorizedContext): Promise<Rate[]> {
  return ctx.db.client
    .select()
    .from(rates)
    .where(eq(rates.workspaceId, ctx.workspaceId))
    .orderBy(asc(rates.id));
}
