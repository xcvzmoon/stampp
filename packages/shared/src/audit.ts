import {
  isValidRetentionDays,
  MAX_AUDIT_RETENTION_DAYS,
  MIN_AUDIT_RETENTION_DAYS,
} from '@stampp/domain';
import * as v from 'valibot';
import { idSchema } from './schemas.ts';

export const auditListQuerySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) => Number(input)),
      v.integer('limit must be an integer'),
      v.minValue(1),
      v.maxValue(200),
    ),
  ),
  cursor: v.optional(idSchema),
  action: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(128))),
  entityType: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(64))),
  entityId: v.optional(idSchema),
  actorUserId: v.optional(idSchema),
  from: v.optional(
    v.pipe(
      v.string(),
      v.isoTimestamp(() => 'from must be ISO-8601'),
    ),
  ),
  to: v.optional(
    v.pipe(
      v.string(),
      v.isoTimestamp(() => 'to must be ISO-8601'),
    ),
  ),
});

export const auditEventDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  actorUserId: v.nullable(v.string()),
  action: v.string(),
  entityType: v.string(),
  entityId: v.string(),
  createdAt: v.string(),
});

export const auditEventDetailSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  actorUserId: v.nullable(v.string()),
  action: v.string(),
  entityType: v.string(),
  entityId: v.string(),
  createdAt: v.string(),
  before: v.nullable(v.unknown()),
  after: v.nullable(v.unknown()),
  metadata: v.unknown(),
});

export const auditEventListResultSchema = v.object({
  items: v.array(auditEventDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const updateAuditRetentionInputSchema = v.object({
  retentionDays: v.pipe(
    v.number(),
    v.integer(),
    v.check(
      (days) => isValidRetentionDays(days),
      `retentionDays must be between ${MIN_AUDIT_RETENTION_DAYS} and ${MAX_AUDIT_RETENTION_DAYS}`,
    ),
  ),
});

export const auditRetentionDtoSchema = v.object({
  workspaceId: v.string(),
  retentionDays: v.number(),
  updatedAt: v.string(),
});

export type AuditListQuery = v.InferOutput<typeof auditListQuerySchema>;
export type AuditEventDto = v.InferOutput<typeof auditEventDtoSchema>;
export type AuditEventDetail = v.InferOutput<typeof auditEventDetailSchema>;
export type UpdateAuditRetentionInput = v.InferOutput<typeof updateAuditRetentionInputSchema>;
export type AuditRetentionDto = v.InferOutput<typeof auditRetentionDtoSchema>;
