import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import { TIMESTAMP_CONFIG, generateEntityId, generateTimestamps } from './_helpers.ts';
import { organizations, users } from './auth.ts';

export type ApprovalEntityType = 'timesheet' | 'time_off_request';
export type ApprovalRunStatus = 'pending' | 'approved' | 'rejected' | 'canceled';
export type ApprovalAction = 'approve' | 'reject';

export type ApprovalChainStepRow = {
  order: number;
  approverUserId: string | null;
};

/** Workspace-configured ordered multi-stage approval chain. */
export const approvalChains = pgTable(
  'approval_chains',
  {
    id: generateEntityId('ach'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 80 }).notNull(),
    entityType: text('entity_type').$type<ApprovalEntityType>().notNull(),
    active: boolean('active').notNull().default(true),
    steps: jsonb('steps').$type<ApprovalChainStepRow[]>().notNull(),
    ...generateTimestamps(),
  },
  (table) => [
    index('approval_chains_workspace_id_idx').on(table.workspaceId),
    index('approval_chains_workspace_id_entity_type_idx').on(table.workspaceId, table.entityType),
    uniqueIndex('approval_chains_workspace_name_unique').on(table.workspaceId, table.name),
    check(
      'approval_chains_steps_count_check',
      sql`jsonb_array_length(${table.steps}) between 1 and 5`,
    ),
  ],
);

/** One run per submitted entity while a chain is active. */
export const approvalRuns = pgTable(
  'approval_runs',
  {
    id: generateEntityId('arn'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    chainId: text('chain_id')
      .notNull()
      .references(() => approvalChains.id, { onDelete: 'restrict' }),
    entityType: text('entity_type').$type<ApprovalEntityType>().notNull(),
    entityId: text('entity_id').notNull(),
    status: text('status').$type<ApprovalRunStatus>().notNull().default('pending'),
    currentStep: integer('current_step').notNull().default(1),
    stepCount: integer('step_count').notNull(),
    submittedBy: text('submitted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', TIMESTAMP_CONFIG).notNull(),
    decidedAt: timestamp('decided_at', TIMESTAMP_CONFIG),
    decidedBy: text('decided_by').references(() => users.id, { onDelete: 'set null' }),
    decisionNote: varchar('decision_note', { length: 2000 }),
    ...generateTimestamps(),
  },
  (table) => [
    index('approval_runs_workspace_id_idx').on(table.workspaceId),
    index('approval_runs_workspace_id_status_idx').on(table.workspaceId, table.status),
    index('approval_runs_workspace_id_entity_type_entity_id_idx').on(
      table.workspaceId,
      table.entityType,
      table.entityId,
    ),
    uniqueIndex('approval_runs_open_entity_unique')
      .on(table.workspaceId, table.entityType, table.entityId)
      .where(sql`${table.status} = 'pending'`),
    check(
      'approval_runs_step_check',
      sql`${table.currentStep} >= 1 and ${table.currentStep} <= ${table.stepCount}`,
    ),
    check(
      'approval_runs_step_count_check',
      sql`${table.stepCount} >= 1 and ${table.stepCount} <= 5`,
    ),
  ],
);

export const approvalDecisions = pgTable(
  'approval_decisions',
  {
    id: generateEntityId('adn'),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    runId: text('run_id')
      .notNull()
      .references(() => approvalRuns.id, { onDelete: 'cascade' }),
    stepOrder: integer('step_order').notNull(),
    action: text('action').$type<'approve' | 'reject'>().notNull(),
    approverUserId: text('approver_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    note: varchar('note', { length: 2000 }),
    decidedAt: timestamp('decided_at', TIMESTAMP_CONFIG).notNull(),
    ...generateTimestamps(),
  },
  (table) => [
    index('approval_decisions_workspace_id_idx').on(table.workspaceId),
    index('approval_decisions_run_id_idx').on(table.runId),
    uniqueIndex('approval_decisions_run_step_unique').on(table.runId, table.stepOrder),
    check(
      'approval_decisions_step_order_check',
      sql`${table.stepOrder} >= 1 and ${table.stepOrder} <= 5`,
    ),
  ],
);

export type ApprovalChain = typeof approvalChains.$inferSelect;
export type NewApprovalChain = typeof approvalChains.$inferInsert;
export type ApprovalRun = typeof approvalRuns.$inferSelect;
export type NewApprovalRun = typeof approvalRuns.$inferInsert;
export type ApprovalDecision = typeof approvalDecisions.$inferSelect;
export type NewApprovalDecision = typeof approvalDecisions.$inferInsert;
