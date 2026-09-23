import * as v from 'valibot';

export const importSourceSchema = v.picklist(['csv', 'clockify', 'toggl', 'harvest']);
export const importJobStatusSchema = v.picklist(['pending', 'running', 'completed', 'failed']);
export const importEntityKindSchema = v.picklist(['client', 'project', 'tag', 'time_entry']);

export const importPreviewRowSchema = v.object({
  kind: importEntityKindSchema,
  externalId: v.nullable(v.string()),
  name: v.string(),
  startDate: v.nullable(v.string()),
  endDate: v.nullable(v.string()),
  durationMinutes: v.nullable(v.number()),
  issues: v.array(v.string()),
});

export const importPreviewSchema = v.object({
  source: importSourceSchema,
  totalRows: v.number(),
  validRows: v.number(),
  invalidRows: v.number(),
  rows: v.array(importPreviewRowSchema),
});

export const createImportPreviewInputSchema = v.object({
  source: importSourceSchema,
  csv: v.pipe(v.string(), v.minLength(1)),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
});

export const startImportInputSchema = v.object({
  source: importSourceSchema,
  csv: v.pipe(v.string(), v.minLength(1)),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  /** Skip preview-invalid rows instead of failing the job. */
  skipInvalidRows: v.optional(v.boolean()),
});

export const importJobDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  source: importSourceSchema,
  status: importJobStatusSchema,
  totalRows: v.number(),
  importedRows: v.number(),
  skippedRows: v.number(),
  error: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const importJobListResultSchema = v.object({
  items: v.array(importJobDtoSchema),
});

export type ImportPreviewInput = v.InferOutput<typeof createImportPreviewInputSchema>;
export type StartImportInput = v.InferOutput<typeof startImportInputSchema>;
export type ImportJobDto = v.InferOutput<typeof importJobDtoSchema>;
