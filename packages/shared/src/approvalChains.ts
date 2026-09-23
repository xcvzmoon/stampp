import * as v from 'valibot';
import { idSchema } from './schemas.ts';

export const approvalEntityTypeSchema = v.picklist(['timesheet', 'time_off_request']);
export const approvalRunStatusSchema = v.picklist(['pending', 'approved', 'rejected', 'canceled']);
export const approvalActionSchema = v.picklist(['approve', 'reject']);

export const approvalStepInputSchema = v.object({
  approverUserId: v.optional(v.nullable(idSchema)),
});

export const createApprovalChainInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  entityType: approvalEntityTypeSchema,
  active: v.optional(v.boolean(), true),
  steps: v.pipe(v.array(approvalStepInputSchema), v.minLength(1), v.maxLength(5)),
});

export const updateApprovalChainInputSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  active: v.optional(v.boolean()),
  steps: v.optional(v.pipe(v.array(approvalStepInputSchema), v.minLength(1), v.maxLength(5))),
});

export const decideApprovalInputSchema = v.object({
  action: approvalActionSchema,
  note: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2000))),
});

export const approvalListQuerySchema = v.object({
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
  entityType: v.optional(approvalEntityTypeSchema),
  entityId: v.optional(idSchema),
  status: v.optional(approvalRunStatusSchema),
});

export const approvalChainDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  entityType: approvalEntityTypeSchema,
  active: v.boolean(),
  steps: v.array(
    v.object({
      order: v.number(),
      approverUserId: v.nullable(v.string()),
    }),
  ),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const approvalChainListResultSchema = v.object({
  items: v.array(approvalChainDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export const approvalRunDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  chainId: v.string(),
  entityType: approvalEntityTypeSchema,
  entityId: v.string(),
  status: approvalRunStatusSchema,
  currentStep: v.number(),
  stepCount: v.number(),
  submittedBy: v.string(),
  submittedAt: v.string(),
  decidedAt: v.nullable(v.string()),
  decidedBy: v.nullable(v.string()),
  decisionNote: v.nullable(v.string()),
  canAct: v.boolean(),
  steps: v.array(
    v.object({
      order: v.number(),
      approverUserId: v.nullable(v.string()),
      action: v.nullable(approvalActionSchema),
      decidedAt: v.nullable(v.string()),
      decidedBy: v.nullable(v.string()),
      note: v.nullable(v.string()),
    }),
  ),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const approvalRunListResultSchema = v.object({
  items: v.array(approvalRunDtoSchema),
  nextCursor: v.nullable(v.string()),
});

export type ApprovalEntityType = v.InferOutput<typeof approvalEntityTypeSchema>;
export type ApprovalRunStatus = v.InferOutput<typeof approvalRunStatusSchema>;
export type ApprovalAction = v.InferOutput<typeof approvalActionSchema>;
export type CreateApprovalChainInput = v.InferOutput<typeof createApprovalChainInputSchema>;
export type UpdateApprovalChainInput = v.InferOutput<typeof updateApprovalChainInputSchema>;
export type DecideApprovalInput = v.InferOutput<typeof decideApprovalInputSchema>;
export type ApprovalListQuery = v.InferOutput<typeof approvalListQuerySchema>;
export type ApprovalChainDto = v.InferOutput<typeof approvalChainDtoSchema>;
export type ApprovalChainListResult = v.InferOutput<typeof approvalChainListResultSchema>;
export type ApprovalRunDto = v.InferOutput<typeof approvalRunDtoSchema>;
export type ApprovalRunListResult = v.InferOutput<typeof approvalRunListResultSchema>;
