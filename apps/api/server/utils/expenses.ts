import type { AuthorizedContext } from '@stampp/access';
import type { Expense } from '@stampp/database';
import type {
  CreateExpenseInput,
  ExpenseDto,
  ExpenseListQuery,
  UpdateExpenseInput,
} from '@stampp/shared';
import { expenses, projects } from '@stampp/database';
import {
  assertReceiptSize,
  hasPermission,
  isAllowedReceiptContentType,
  receiptExtensionFor,
  receiptObjectKey,
} from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, eq, gt, gte, isNull, lte } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import {
  getReceiptObject,
  isStorageConfigured,
  putReceiptObject,
  StorageNotConfiguredError,
} from '~/server/utils/storage.ts';
import { emitWebhookEvent } from '~/server/utils/webhookEvents.ts';

function notFound(requestId: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, 'Expense not found', requestId);
}

export function toExpenseDto(row: Expense): ExpenseDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    projectId: row.projectId,
    expenseDate: row.expenseDate,
    amountMinor: row.amountMinor,
    currency: row.currency,
    category: row.category,
    description: row.description,
    notes: row.notes,
    billable: row.billable,
    status: row.status,
    receiptFilename: row.receiptFilename,
    receiptContentType: row.receiptContentType,
    receiptSizeBytes: row.receiptSizeBytes,
    hasReceipt: row.receiptKey !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertProjectExists(
  ctx: AuthorizedContext,
  projectId: string,
  requestId: string,
): Promise<void> {
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
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Project not found', requestId);
  }
}

export async function listExpenses(
  ctx: AuthorizedContext,
  options: ExpenseListQuery & { limit: number },
): Promise<{ items: ExpenseDto[]; nextCursor: string | null }> {
  const conditions = [eq(expenses.workspaceId, ctx.workspaceId)];
  const canReadAny = hasPermission(ctx.permissions, 'expense:read:any');
  if (!canReadAny) {
    conditions.push(eq(expenses.userId, ctx.userId));
  } else if (options.userId) {
    conditions.push(eq(expenses.userId, options.userId));
  }
  if (options.cursor) conditions.push(gt(expenses.id, options.cursor));
  if (options.projectId) conditions.push(eq(expenses.projectId, options.projectId));
  if (options.category) conditions.push(eq(expenses.category, options.category));
  if (options.status) conditions.push(eq(expenses.status, options.status));
  if (options.from) conditions.push(gte(expenses.expenseDate, options.from));
  if (options.to) conditions.push(lte(expenses.expenseDate, options.to));

  const rows = await ctx.db.client
    .select()
    .from(expenses)
    .where(and(...conditions))
    .orderBy(asc(expenses.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toExpenseDto),
    nextCursor: rows.length > options.limit && last ? last.id : null,
  };
}

async function getExpenseRow(
  ctx: AuthorizedContext,
  expenseId: string,
  requestId: string,
): Promise<Expense> {
  const rows = await ctx.db.client
    .select()
    .from(expenses)
    .where(and(eq(expenses.workspaceId, ctx.workspaceId), eq(expenses.id, expenseId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound(requestId);
  return row;
}

export async function createExpense(
  ctx: AuthorizedContext,
  input: CreateExpenseInput,
  requestId: string,
): Promise<ExpenseDto> {
  if (input.projectId) {
    await assertProjectExists(ctx, input.projectId, requestId);
  }
  const inserted = await ctx.db.client
    .insert(expenses)
    .values({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      projectId: input.projectId ?? null,
      expenseDate: input.expenseDate,
      amountMinor: input.amountMinor,
      currency: input.currency,
      category: input.category,
      description: input.description,
      notes: input.notes ?? null,
      billable: input.billable ?? false,
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create expense', requestId);
  }
  await recordAudit(ctx, requestId, {
    action: 'expense.created',
    entityType: 'expense',
    entityId: row.id,
    after: row,
  });
  await emitWebhookEvent(ctx, 'expense.created', { expenseId: row.id });
  return toExpenseDto(row);
}

export async function updateExpense(
  ctx: AuthorizedContext,
  expenseId: string,
  input: UpdateExpenseInput,
  requestId: string,
): Promise<ExpenseDto> {
  const before = await getExpenseRow(ctx, expenseId, requestId);
  if (before.userId !== ctx.userId && !hasPermission(ctx.permissions, 'expense:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You can only edit your own expenses', requestId);
  }
  if (input.projectId) {
    await assertProjectExists(ctx, input.projectId, requestId);
  }
  if (Object.keys(input).length === 0) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'At least one field is required', requestId);
  }

  const patch: Partial<typeof expenses.$inferInsert> = {};
  if (input.projectId !== undefined) patch.projectId = input.projectId;
  if (input.expenseDate !== undefined) patch.expenseDate = input.expenseDate;
  if (input.amountMinor !== undefined) patch.amountMinor = input.amountMinor;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.billable !== undefined) patch.billable = input.billable;
  if (input.status !== undefined) {
    if (before.userId !== ctx.userId && !hasPermission(ctx.permissions, 'expense:manage')) {
      throw toApiError(ERROR_CODES.FORBIDDEN, 'Only managers can change expense status', requestId);
    }
    patch.status = input.status;
  }

  const updated = await ctx.db.client
    .update(expenses)
    .set(patch)
    .where(and(eq(expenses.workspaceId, ctx.workspaceId), eq(expenses.id, expenseId)))
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);
  await recordAudit(ctx, requestId, {
    action: 'expense.updated',
    entityType: 'expense',
    entityId: row.id,
    before,
    after: row,
  });
  await emitWebhookEvent(ctx, 'expense.updated', { expenseId: row.id });
  return toExpenseDto(row);
}

export async function archiveExpense(
  ctx: AuthorizedContext,
  expenseId: string,
  requestId: string,
): Promise<void> {
  const before = await getExpenseRow(ctx, expenseId, requestId);
  if (before.userId !== ctx.userId && !hasPermission(ctx.permissions, 'expense:manage')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You can only delete your own expenses', requestId);
  }
  const deleted = await ctx.db.client
    .delete(expenses)
    .where(and(eq(expenses.workspaceId, ctx.workspaceId), eq(expenses.id, expenseId)))
    .returning({ id: expenses.id });
  if (!deleted[0]) throw notFound(requestId);
  await recordAudit(ctx, requestId, {
    action: 'expense.deleted',
    entityType: 'expense',
    entityId: expenseId,
    before,
  });
}

export async function uploadExpenseReceipt(
  ctx: AuthorizedContext,
  expenseId: string,
  file: { filename: string; contentType: string; bytes: Uint8Array },
  requestId: string,
): Promise<ExpenseDto> {
  const before = await getExpenseRow(ctx, expenseId, requestId);
  if (before.userId !== ctx.userId && !hasPermission(ctx.permissions, 'expense:manage')) {
    throw toApiError(
      ERROR_CODES.FORBIDDEN,
      'You can only upload receipts on your own expenses',
      requestId,
    );
  }
  if (!isAllowedReceiptContentType(file.contentType)) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Receipt must be JPEG, PNG, WebP, or PDF', requestId);
  }
  if (!assertReceiptSize(file.bytes.byteLength)) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Receipt must be at most 5MB', requestId);
  }
  if (!isStorageConfigured()) {
    throw toApiError(
      ERROR_CODES.STORAGE_NOT_CONFIGURED,
      'Object storage is not configured for receipt uploads',
      requestId,
    );
  }

  const contentType = file.contentType;
  const objectKey = receiptObjectKey(ctx.workspaceId, expenseId, receiptExtensionFor(contentType));
  try {
    await putReceiptObject(objectKey, file.bytes, contentType);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      throw toApiError(
        ERROR_CODES.STORAGE_NOT_CONFIGURED,
        'Object storage is not configured for receipt uploads',
        requestId,
      );
    }
    throw toApiError(ERROR_CODES.INTERNAL, 'Receipt upload failed', requestId);
  }

  const updated = await ctx.db.client
    .update(expenses)
    .set({
      receiptKey: objectKey,
      receiptFilename: file.filename.slice(0, 255),
      receiptContentType: contentType,
      receiptSizeBytes: file.bytes.byteLength,
      updatedAt: new Date(),
    })
    .where(and(eq(expenses.workspaceId, ctx.workspaceId), eq(expenses.id, expenseId)))
    .returning();
  const row = updated[0];
  if (!row) throw notFound(requestId);
  await recordAudit(ctx, requestId, {
    action: 'expense.receipt_uploaded',
    entityType: 'expense',
    entityId: expenseId,
    before,
    after: row,
  });
  return toExpenseDto(row);
}

export async function downloadExpenseReceipt(
  ctx: AuthorizedContext,
  expenseId: string,
  requestId: string,
): Promise<{ bytes: Uint8Array; contentType: string; filename: string }> {
  const row = await getExpenseRow(ctx, expenseId, requestId);
  if (row.userId !== ctx.userId && !hasPermission(ctx.permissions, 'expense:read:any')) {
    throw toApiError(ERROR_CODES.FORBIDDEN, 'You can only download your own receipts', requestId);
  }
  if (!row.receiptKey || !row.receiptContentType || !row.receiptFilename) {
    throw toApiError(ERROR_CODES.NOT_FOUND, 'Expense has no receipt', requestId);
  }
  try {
    const bytes = await getReceiptObject(row.receiptKey, row.receiptContentType);
    return { bytes, contentType: row.receiptContentType, filename: row.receiptFilename };
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      throw toApiError(
        ERROR_CODES.STORAGE_NOT_CONFIGURED,
        'Object storage is not configured',
        requestId,
      );
    }
    throw toApiError(ERROR_CODES.INTERNAL, 'Receipt download failed', requestId);
  }
}

export async function listExpensesForExport(ctx: AuthorizedContext): Promise<Expense[]> {
  return ctx.db.client
    .select()
    .from(expenses)
    .where(eq(expenses.workspaceId, ctx.workspaceId))
    .orderBy(asc(expenses.id));
}
