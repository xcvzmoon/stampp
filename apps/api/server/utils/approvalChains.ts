import type { AuthorizedContext } from '@stampp/access';
import type {
  ApprovalChain,
  ApprovalDecision,
  ApprovalRun,
  ApprovalChainStepRow,
} from '@stampp/database';
import type {
  ApprovalChainDto,
  ApprovalChainListResult,
  ApprovalEntityType,
  ApprovalListQuery,
  ApprovalRunDto,
  ApprovalRunListResult,
  CreateApprovalChainInput,
  DecideApprovalInput,
  UpdateApprovalChainInput,
} from '@stampp/shared';
import { approvalChains, approvalDecisions, approvalRuns } from '@stampp/database';
import {
  canAdvanceApproval,
  canApproveStep,
  canCancelApproval,
  canRejectApproval,
  hasPermission,
  isFinalApprovalStep,
  nextApprovalStatusAfterAction,
  nextApprovalStep,
  normalizeApprovalChainSteps,
} from '@stampp/domain';
import { DEFAULT_LIST_LIMIT, ERROR_CODES, approvalListQuerySchema } from '@stampp/shared';
import { and, asc, desc, eq, gt, type SQL } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { isUniqueViolation } from '~/server/utils/catalog.ts';

type ListApprovalOptions = ApprovalListQuery & { limit: number };

function notFound(requestId: string, entity: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, `${entity} not found`, requestId);
}

function invalidChain(requestId: string, message: string) {
  return toApiError(ERROR_CODES.APPROVAL_INVALID_CHAIN, message, requestId);
}

function invalidStep(requestId: string, message: string) {
  return toApiError(ERROR_CODES.APPROVAL_INVALID_STEP, message, requestId);
}

function entityApprovePermission(
  entityType: ApprovalEntityType,
): 'time:approve' | 'timeoff:approve' {
  return entityType === 'timesheet' ? 'time:approve' : 'timeoff:approve';
}

export function toApprovalChainDto(row: ApprovalChain): ApprovalChainDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    entityType: row.entityType,
    active: row.active,
    steps: row.steps,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getDecisionsByRun(
  ctx: AuthorizedContext,
  runIds: string[],
): Promise<Map<string, ApprovalDecision[]>> {
  if (runIds.length === 0) return new Map();
  const rows = await ctx.db.client
    .select()
    .from(approvalDecisions)
    .where(eq(approvalDecisions.workspaceId, ctx.workspaceId))
    .orderBy(asc(approvalDecisions.stepOrder));
  const map = new Map<string, ApprovalDecision[]>();
  const allowed = new Set(runIds);
  for (const row of rows) {
    if (!allowed.has(row.runId)) continue;
    const list = map.get(row.runId);
    if (list) list.push(row);
    else map.set(row.runId, [row]);
  }
  return map;
}

export function toApprovalRunDto(
  row: ApprovalRun,
  chainSteps: ApprovalChainStepRow[],
  decisions: ApprovalDecision[],
  canAct: boolean,
): ApprovalRunDto {
  const decisionByStep = new Map(decisions.map((decision) => [decision.stepOrder, decision]));
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    chainId: row.chainId,
    entityType: row.entityType,
    entityId: row.entityId,
    status: row.status,
    currentStep: row.currentStep,
    stepCount: row.stepCount,
    submittedBy: row.submittedBy,
    submittedAt: row.submittedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedBy: row.decidedBy,
    decisionNote: row.decisionNote,
    canAct,
    steps: chainSteps.map((step) => {
      const decision = decisionByStep.get(step.order);
      return {
        order: step.order,
        approverUserId: step.approverUserId,
        action: decision?.action ?? null,
        decidedAt: decision?.decidedAt.toISOString() ?? null,
        decidedBy: decision?.approverUserId ?? null,
        note: decision?.note ?? null,
      };
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listApprovalChains(
  ctx: AuthorizedContext,
  options: { limit: number; cursor?: string; entityType?: ApprovalEntityType },
): Promise<ApprovalChainListResult> {
  const conditions: SQL[] = [eq(approvalChains.workspaceId, ctx.workspaceId)];
  if (options.entityType) conditions.push(eq(approvalChains.entityType, options.entityType));
  if (options.cursor) conditions.push(gt(approvalChains.id, options.cursor));
  const rows = await ctx.db.client
    .select()
    .from(approvalChains)
    .where(and(...conditions))
    .orderBy(asc(approvalChains.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toApprovalChainDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

async function getActiveChainForEntity(
  ctx: AuthorizedContext,
  entityType: ApprovalEntityType,
): Promise<ApprovalChain | null> {
  const rows = await ctx.db.client
    .select()
    .from(approvalChains)
    .where(
      and(
        eq(approvalChains.workspaceId, ctx.workspaceId),
        eq(approvalChains.entityType, entityType),
        eq(approvalChains.active, true),
      ),
    )
    .orderBy(asc(approvalChains.id))
    .limit(1);
  return rows[0] ?? null;
}

async function getChainRow(
  ctx: AuthorizedContext,
  chainId: string,
  requestId: string,
): Promise<ApprovalChain> {
  const rows = await ctx.db.client
    .select()
    .from(approvalChains)
    .where(and(eq(approvalChains.id, chainId), eq(approvalChains.workspaceId, ctx.workspaceId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId, 'Approval chain');
  return row;
}

export async function createApprovalChain(
  ctx: AuthorizedContext,
  input: CreateApprovalChainInput,
  requestId: string,
): Promise<ApprovalChainDto> {
  let steps: ReturnType<typeof normalizeApprovalChainSteps>;
  try {
    steps = normalizeApprovalChainSteps(input.steps);
  } catch (error) {
    if (error instanceof RangeError) throw invalidChain(requestId, error.message);
    throw error;
  }

  try {
    const rows = await ctx.db.client
      .insert(approvalChains)
      .values({
        workspaceId: ctx.workspaceId,
        name: input.name,
        entityType: input.entityType,
        active: input.active ?? true,
        steps,
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create approval chain', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'approval_chain.created',
      entityType: 'approval_chain',
      entityId: row.id,
      after: row,
    });
    return toApprovalChainDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(
        ERROR_CODES.CONFLICT,
        'An approval chain with that name already exists',
        requestId,
      );
    }
    throw error;
  }
}

export async function updateApprovalChain(
  ctx: AuthorizedContext,
  chainId: string,
  input: UpdateApprovalChainInput,
  requestId: string,
): Promise<ApprovalChainDto> {
  const before = await getChainRow(ctx, chainId, requestId);
  let steps = before.steps;
  if (input.steps) {
    try {
      steps = normalizeApprovalChainSteps(input.steps);
    } catch (error) {
      if (error instanceof RangeError) throw invalidChain(requestId, error.message);
      throw error;
    }
    const pendingRuns = await ctx.db.client
      .select({ id: approvalRuns.id })
      .from(approvalRuns)
      .where(
        and(
          eq(approvalRuns.workspaceId, ctx.workspaceId),
          eq(approvalRuns.chainId, before.id),
          eq(approvalRuns.status, 'pending'),
        ),
      )
      .limit(1);
    if (pendingRuns[0] && steps.length !== before.steps.length) {
      throw invalidChain(requestId, 'Cannot change step count while pending runs exist');
    }
  }

  try {
    const rows = await ctx.db.client
      .update(approvalChains)
      .set({
        name: input.name ?? before.name,
        active: input.active ?? before.active,
        steps,
        updatedAt: new Date(),
      })
      .where(and(eq(approvalChains.id, before.id), eq(approvalChains.workspaceId, ctx.workspaceId)))
      .returning();
    const row = rows[0];
    if (!row) throw notFound(requestId, 'Approval chain');
    await recordAudit(ctx, requestId, {
      action: 'approval_chain.updated',
      entityType: 'approval_chain',
      entityId: row.id,
      before,
      after: row,
    });
    return toApprovalChainDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw toApiError(
        ERROR_CODES.CONFLICT,
        'An approval chain with that name already exists',
        requestId,
      );
    }
    throw error;
  }
}

export async function deleteApprovalChain(
  ctx: AuthorizedContext,
  chainId: string,
  requestId: string,
): Promise<void> {
  const before = await getChainRow(ctx, chainId, requestId);
  try {
    await ctx.db.client
      .delete(approvalChains)
      .where(
        and(eq(approvalChains.id, before.id), eq(approvalChains.workspaceId, ctx.workspaceId)),
      );
  } catch (error) {
    if (isUniqueViolation(error) || isForeignKeyViolation(error)) {
      await ctx.db.client
        .update(approvalChains)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(approvalChains.id, before.id));
      await recordAudit(ctx, requestId, {
        action: 'approval_chain.deactivated',
        entityType: 'approval_chain',
        entityId: before.id,
        before,
      });
      return;
    }
    throw error;
  }
  await recordAudit(ctx, requestId, {
    action: 'approval_chain.deleted',
    entityType: 'approval_chain',
    entityId: before.id,
    before,
  });
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Postgres catch-boundary classifier
function isForeignKeyViolation(error: unknown): boolean {
  const result = v.safeParse(v.object({ code: v.optional(v.string()) }), error);
  return result.success && result.output.code === '23503';
}

export async function startApprovalRun(
  ctx: AuthorizedContext,
  entityType: ApprovalEntityType,
  entityId: string,
  submittedBy: string,
  requestId: string,
): Promise<ApprovalRun | null> {
  const chain = await getActiveChainForEntity(ctx, entityType);
  if (!chain) return null;

  try {
    const rows = await ctx.db.client
      .insert(approvalRuns)
      .values({
        workspaceId: ctx.workspaceId,
        chainId: chain.id,
        entityType,
        entityId,
        status: 'pending',
        currentStep: 1,
        stepCount: chain.steps.length,
        submittedBy,
        submittedAt: new Date(),
      })
      .returning();
    const row = rows[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to start approval run', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'approval_run.started',
      entityType: 'approval_run',
      entityId: row.id,
      after: row,
    });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Already has a pending run; leave it in place.
      return null;
    }
    throw error;
  }
}

export async function getPendingRunForEntity(
  ctx: AuthorizedContext,
  entityType: ApprovalEntityType,
  entityId: string,
): Promise<ApprovalRun | null> {
  const rows = await ctx.db.client
    .select()
    .from(approvalRuns)
    .where(
      and(
        eq(approvalRuns.workspaceId, ctx.workspaceId),
        eq(approvalRuns.entityType, entityType),
        eq(approvalRuns.entityId, entityId),
        eq(approvalRuns.status, 'pending'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function cancelApprovalRun(
  ctx: AuthorizedContext,
  entityType: ApprovalEntityType,
  entityId: string,
  requestId: string,
  reason: string | null,
): Promise<void> {
  const run = await getPendingRunForEntity(ctx, entityType, entityId);
  if (!run || !canCancelApproval(run.status)) return;
  const now = new Date();
  const rows = await ctx.db.client
    .update(approvalRuns)
    .set({
      status: 'canceled',
      decidedAt: now,
      decidedBy: ctx.userId,
      decisionNote: reason,
      updatedAt: now,
    })
    .where(and(eq(approvalRuns.id, run.id), eq(approvalRuns.status, run.status)))
    .returning();
  const row = rows[0];
  if (!row) return;
  await recordAudit(ctx, requestId, {
    action: 'approval_run.canceled',
    entityType: 'approval_run',
    entityId: row.id,
    before: run,
    after: row,
  });
}

export type ChainDecisionResult = {
  run: ApprovalRun;
  isFinalStep: boolean;
};

/**
 * Advance a multi-stage run. Returns the run after the decision.
 * Callers must still apply the entity's final approve/reject side effects
 * when `isFinalStep` is true (or when rejecting).
 */
export async function decideApprovalRun(
  ctx: AuthorizedContext,
  runId: string,
  input: DecideApprovalInput,
  requestId: string,
): Promise<ChainDecisionResult> {
  const runRows = await ctx.db.client
    .select()
    .from(approvalRuns)
    .where(and(eq(approvalRuns.id, runId), eq(approvalRuns.workspaceId, ctx.workspaceId)))
    .limit(1);
  const run = runRows[0];
  if (!run) throw notFound(requestId, 'Approval run');
  if (run.status !== 'pending') {
    throw toApiError(
      ERROR_CODES.APPROVAL_ALREADY_DECIDED,
      'Approval run is not pending',
      requestId,
    );
  }
  if (input.action === 'reject' && !canRejectApproval(run.status)) {
    throw invalidStep(requestId, 'Run cannot be rejected');
  }

  const chainRows = await ctx.db.client
    .select()
    .from(approvalChains)
    .where(eq(approvalChains.id, run.chainId))
    .limit(1);
  const chain = chainRows[0];
  if (!chain) throw notFound(requestId, 'Approval chain');

  const step = chain.steps.find((item) => item.order === run.currentStep);
  if (!step || !canAdvanceApproval(run.status, run.currentStep, run.stepCount)) {
    throw invalidStep(requestId, 'Current approval step is not actionable');
  }
  if (input.action === 'approve' && !canApproveStep(step, ctx.userId, run.submittedBy)) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You are not the approver for this step', requestId);
  }
  if (
    input.action === 'approve' &&
    !hasPermission(ctx.role, entityApprovePermission(run.entityType))
  ) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'Approve permission is required', requestId);
  }

  const now = new Date();
  const finalStep =
    input.action === 'approve' && isFinalApprovalStep(run.currentStep, run.stepCount);
  const nextStep =
    input.action === 'approve' ? nextApprovalStep(run.currentStep, run.stepCount) : null;
  const status = nextApprovalStatusAfterAction(input.action, finalStep);

  const updated = await ctx.db.client.transaction(async (tx) => {
    const decisionRows = await tx
      .insert(approvalDecisions)
      .values({
        workspaceId: ctx.workspaceId,
        runId: run.id,
        stepOrder: run.currentStep,
        action: input.action,
        approverUserId: ctx.userId,
        note: input.note ?? null,
        decidedAt: now,
      })
      .returning();
    if (!decisionRows[0]) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to record approval decision', requestId);
    }

    const runRowsAfter = await tx
      .update(approvalRuns)
      .set({
        status,
        currentStep: nextStep ?? run.currentStep,
        decidedAt: status === 'pending' ? null : now,
        decidedBy: status === 'pending' ? null : ctx.userId,
        decisionNote: status === 'pending' ? null : (input.note ?? null),
        updatedAt: now,
      })
      .where(and(eq(approvalRuns.id, run.id), eq(approvalRuns.status, run.status)))
      .returning();
    const next = runRowsAfter[0];
    if (!next) {
      throw toApiError(ERROR_CODES.CONFLICT, 'Approval run changed concurrently', requestId);
    }
    return next;
  });

  await recordAudit(ctx, requestId, {
    action:
      input.action === 'approve'
        ? finalStep
          ? 'approval_run.approved'
          : 'approval_run.step_approved'
        : 'approval_run.rejected',
    entityType: 'approval_run',
    entityId: updated.id,
    before: run,
    after: updated,
  });

  return { run: updated, isFinalStep: finalStep };
}

export async function listApprovalRuns(
  ctx: AuthorizedContext,
  options: ListApprovalOptions,
): Promise<ApprovalRunListResult> {
  const conditions: SQL[] = [eq(approvalRuns.workspaceId, ctx.workspaceId)];
  if (options.entityType) conditions.push(eq(approvalRuns.entityType, options.entityType));
  if (options.entityId) conditions.push(eq(approvalRuns.entityId, options.entityId));
  if (options.status) conditions.push(eq(approvalRuns.status, options.status));
  if (options.cursor) conditions.push(gt(approvalRuns.id, options.cursor));

  const rows = await ctx.db.client
    .select()
    .from(approvalRuns)
    .where(and(...conditions))
    .orderBy(desc(approvalRuns.submittedAt), asc(approvalRuns.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];

  const chainIds = [...new Set(page.map((row) => row.chainId))];
  const chains = chainIds.length
    ? await ctx.db.client
        .select()
        .from(approvalChains)
        .where(eq(approvalChains.workspaceId, ctx.workspaceId))
    : [];
  const chainById = new Map(chains.map((chain) => [chain.id, chain]));
  const decisions = await getDecisionsByRun(
    ctx,
    page.map((row) => row.id),
  );

  return {
    items: page.map((row) => {
      const chain = chainById.get(row.chainId);
      const stepForActor = chain?.steps.find((step) => step.order === row.currentStep);
      const canAct =
        row.status === 'pending' &&
        canApproveStep(
          stepForActor ?? { order: row.currentStep, approverUserId: null },
          ctx.userId,
          row.submittedBy,
        );
      return toApprovalRunDto(row, chain?.steps ?? [], decisions.get(row.id) ?? [], canAct);
    }),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

export async function getApprovalRun(
  ctx: AuthorizedContext,
  runId: string,
  requestId: string,
): Promise<ApprovalRunDto> {
  const rows = await ctx.db.client
    .select()
    .from(approvalRuns)
    .where(and(eq(approvalRuns.id, runId), eq(approvalRuns.workspaceId, ctx.workspaceId)))
    .limit(1);
  const run = rows[0];
  if (!run) throw notFound(requestId, 'Approval run');
  const chainRows = await ctx.db.client
    .select()
    .from(approvalChains)
    .where(eq(approvalChains.id, run.chainId))
    .limit(1);
  const chain = chainRows[0];
  const decisions = await getDecisionsByRun(ctx, [run.id]);
  const stepForActor = chain?.steps.find((step) => step.order === run.currentStep);
  const canAct =
    run.status === 'pending' &&
    canApproveStep(
      stepForActor ?? { order: run.currentStep, approverUserId: null },
      ctx.userId,
      run.submittedBy,
    );
  return toApprovalRunDto(run, chain?.steps ?? [], decisions.get(run.id) ?? [], canAct);
}

export async function decideApprovalRunFromHandler(
  ctx: AuthorizedContext,
  runId: string,
  input: DecideApprovalInput,
  requestId: string,
): Promise<ApprovalRunDto> {
  const { run } = await decideApprovalRun(ctx, runId, input, requestId);
  return getApprovalRun(ctx, run.id, requestId);
}

export function parseApprovalListQuery(
  query: URLSearchParams,
  requestId: string,
): ListApprovalOptions {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'entityType', 'entityId', 'status']) {
    const value = query.get(key);
    if (value !== null) raw[key] = value;
  }
  const result = v.safeParse(approvalListQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }
  return { ...result.output, limit: result.output.limit ?? DEFAULT_LIST_LIMIT };
}
