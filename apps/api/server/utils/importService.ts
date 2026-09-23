import type { AuthorizedContext } from '@stampp/access';
import type { ImportJob } from '@stampp/database';
import type { ImportSource } from '@stampp/domain';
import type { ImportJobDto, StartImportInput } from '@stampp/shared';
import { importJobs, timeEntries, users } from '@stampp/database';
import { mapCsvTimeEntries, mapVendorCsv } from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { and, eq, isNull } from 'drizzle-orm';
import * as v from 'valibot';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import { getDb } from '~/server/utils/db.ts';

export type ImportQueue = {
  enqueue: (job: { jobId: string; workspaceId: string }) => Promise<void>;
};

export function toImportJobDto(row: ImportJob): ImportJobDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    source: row.source,
    status: row.status,
    totalRows: row.totalRows,
    importedRows: row.importedRows,
    skippedRows: row.skippedRows,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function buildImportPreview(
  source: ImportSource,
  csv: string,
  startDate?: string,
  endDate?: string,
) {
  return source === 'csv'
    ? mapCsvTimeEntries(csv, { startDate, endDate })
    : mapVendorCsv(source, csv);
}

export async function listImportJobs(ctx: AuthorizedContext): Promise<{ items: ImportJobDto[] }> {
  const rows = await ctx.db.client
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.workspaceId, ctx.workspaceId), isNull(importJobs.deletedAt)))
    .orderBy(importJobs.createdAt);
  return { items: rows.map(toImportJobDto) };
}

export async function startImportJob(
  ctx: AuthorizedContext,
  input: StartImportInput,
  requestId: string,
  enqueue: ImportQueue['enqueue'],
): Promise<ImportJobDto> {
  const preview = buildImportPreview(input.source, input.csv, input.startDate, input.endDate);
  if (preview.validRows === 0) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'No valid rows to import',
      requestId,
      preview.rows.slice(0, 5),
    );
  }

  const inserted = await ctx.db.client
    .insert(importJobs)
    .values({
      workspaceId: ctx.workspaceId,
      source: input.source,
      status: 'pending',
      totalRows: preview.totalRows,
      importedRows: 0,
      skippedRows: 0,
      payload: {
        csv: input.csv,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        skipInvalidRows: input.skipInvalidRows ?? true,
      },
    })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create import job', requestId);
  }

  await recordAudit(ctx, requestId, {
    action: 'import.started',
    entityType: 'import_job',
    entityId: row.id,
    after: { ...row, payload: undefined },
  });
  await enqueue({ jobId: row.id, workspaceId: ctx.workspaceId });
  return toImportJobDto(row);
}

const importPayloadSchema = v.object({
  csv: v.string(),
  startDate: v.nullable(v.string()),
  endDate: v.nullable(v.string()),
  skipInvalidRows: v.boolean(),
});

type ImportPayload = {
  csv: string;
  startDate: string | null;
  endDate: string | null;
  skipInvalidRows: boolean;
};

export async function runImportJob(jobId: string, workspaceId: string): Promise<void> {
  const db = getDb();
  await db.update(importJobs).set({ status: 'running' }).where(eq(importJobs.id, jobId));

  const rows = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1);
  const job = rows[0];
  if (!job) {
    return;
  }

  const parsedPayload = v.safeParse(importPayloadSchema, job.payload);
  const payload: ImportPayload = parsedPayload.success
    ? parsedPayload.output
    : { csv: '', startDate: null, endDate: null, skipInvalidRows: true };
  const preview = buildImportPreview(
    job.source,
    payload.csv ?? '',
    payload.startDate ?? undefined,
    payload.endDate ?? undefined,
  );

  if (!payload.skipInvalidRows && preview.invalidRows > 0) {
    await db
      .update(importJobs)
      .set({
        status: 'failed',
        error: `${preview.invalidRows} rows failed validation`,
      })
      .where(eq(importJobs.id, jobId));
    return;
  }

  const actor = await db.select().from(users).limit(1);
  const actorUserId = actor[0]?.id;
  if (!actorUserId) {
    await db
      .update(importJobs)
      .set({ status: 'failed', error: 'No actor available for import' })
      .where(eq(importJobs.id, jobId));
    return;
  }

  const validRows = preview.rows.filter(
    (row) => row.issues.length === 0 && row.startDate && row.endDate,
  );
  const skipped = preview.rows.length - validRows.length;
  await Promise.all(
    validRows.map((row) =>
      db.insert(timeEntries).values({
        workspaceId,
        userId: actorUserId,
        projectId: null,
        taskId: null,
        description: row.name,
        billable: true,
        startAt: new Date(row.startDate ?? ''),
        endAt: new Date(row.endDate ?? ''),
        durationMinutes: row.durationMinutes,
        workDate: (row.startDate ?? '').slice(0, 10),
        timezone: 'UTC',
      }),
    ),
  );
  const imported = validRows.length;

  await db
    .update(importJobs)
    .set({
      status: 'completed',
      importedRows: imported,
      skippedRows: skipped,
    })
    .where(eq(importJobs.id, jobId));
}
