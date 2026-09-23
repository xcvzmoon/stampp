import type {
  ApprovalChain,
  ApprovalChainStepRow,
  ApprovalDecision,
  ApprovalRun,
} from '@stampp/database';
import {
  canApproveStep,
  isFinalApprovalStep,
  nextApprovalStatusAfterAction,
  normalizeApprovalChainSteps,
} from '@stampp/domain';
import { ERROR_CODES } from '@stampp/shared';
import { describe, expect, it } from 'vite-plus/test';
import { toApprovalChainDto, toApprovalRunDto } from '~/server/utils/approvalChains.ts';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';

describe('approval error status mapping', () => {
  it('maps invalid step/chain to 422 and already decided to 409', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.APPROVAL_INVALID_STEP)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.APPROVAL_INVALID_CHAIN)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.APPROVAL_ALREADY_DECIDED)).toBe(409);
  });
});

function makeChain(partial: Partial<ApprovalChain> = {}): ApprovalChain {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'ach_1',
    workspaceId: 'ws_1',
    name: 'Timesheet multi-stage',
    entityType: 'timesheet',
    active: true,
    steps: normalizeApprovalChainSteps([
      { approverUserId: 'approver_1' },
      { approverUserId: null },
    ]),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

function makeRun(partial: Partial<ApprovalRun> = {}): ApprovalRun {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 'arn_1',
    workspaceId: 'ws_1',
    chainId: 'ach_1',
    entityType: 'timesheet',
    entityId: 'ts_1',
    status: 'pending',
    currentStep: 1,
    stepCount: 2,
    submittedBy: 'submitter',
    submittedAt: now,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

function makeDecision(partial: Partial<ApprovalDecision> = {}): ApprovalDecision {
  const now = new Date('2026-01-02T00:00:00.000Z');
  return {
    id: 'adn_1',
    workspaceId: 'ws_1',
    runId: 'arn_1',
    stepOrder: 1,
    action: 'approve',
    approverUserId: 'approver_1',
    note: 'ok',
    decidedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

describe('approval service helpers', () => {
  it('maps chain steps without secrets', () => {
    const dto = toApprovalChainDto(makeChain());
    expect(dto.entityType).toBe('timesheet');
    expect(dto.steps).toHaveLength(2);
    expect(dto.steps[0]?.approverUserId).toBe('approver_1');
    expect(dto.steps[1]?.approverUserId).toBeNull();
  });

  it('maps runs with step decisions and canAct', () => {
    const steps: ApprovalChainStepRow[] = normalizeApprovalChainSteps([
      { approverUserId: 'approver_1' },
      {},
    ]);
    const dto = toApprovalRunDto(makeRun(), steps, [makeDecision()], true);
    expect(dto.canAct).toBe(true);
    expect(dto.stepCount).toBe(2);
    expect(dto.steps[0]?.action).toBe('approve');
    expect(dto.steps[1]?.action).toBeNull();
  });

  it('finalizes only on the last step', () => {
    expect(isFinalApprovalStep(1, 2)).toBe(false);
    expect(isFinalApprovalStep(2, 2)).toBe(true);
    expect(nextApprovalStatusAfterAction('approve', false)).toBe('pending');
    expect(nextApprovalStatusAfterAction('approve', true)).toBe('approved');
    expect(canApproveStep({ order: 1, approverUserId: null }, 'manager', 'submitter')).toBe(true);
    expect(canApproveStep({ order: 1, approverUserId: null }, 'submitter', 'submitter')).toBe(
      false,
    );
  });
});
