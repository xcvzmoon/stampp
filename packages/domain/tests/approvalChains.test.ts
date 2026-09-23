import { describe, expect, it } from 'vite-plus/test';
import {
  canAdvanceApproval,
  canApproveStep,
  canCancelApproval,
  canRejectApproval,
  isFinalApprovalStep,
  isValidApprovalChainSteps,
  MAX_APPROVAL_CHAIN_STEPS,
  nextApprovalStatusAfterAction,
  nextApprovalStep,
  normalizeApprovalChainSteps,
} from '../src/approvalChains.ts';

describe('approval chain steps', () => {
  it('accepts 1 to max steps and rejects empty or oversized chains', () => {
    expect(isValidApprovalChainSteps([{}])).toBe(true);
    expect(
      isValidApprovalChainSteps(Array.from({ length: MAX_APPROVAL_CHAIN_STEPS }, () => ({}))),
    ).toBe(true);
    expect(isValidApprovalChainSteps([])).toBe(false);
    expect(
      isValidApprovalChainSteps(Array.from({ length: MAX_APPROVAL_CHAIN_STEPS + 1 }, () => ({}))),
    ).toBe(false);
  });

  it('normalizes steps to sequential orders', () => {
    const steps = normalizeApprovalChainSteps([
      { approverUserId: 'user_a' },
      { approverUserId: null },
      {},
    ]);
    expect(steps).toEqual([
      { order: 1, approverUserId: 'user_a' },
      { order: 2, approverUserId: null },
      { order: 3, approverUserId: null },
    ]);
  });

  it('throws when normalizing invalid step lists', () => {
    expect(() => normalizeApprovalChainSteps([])).toThrow(RangeError);
  });
});

describe('approval run progression', () => {
  it('advances pending runs until the final step', () => {
    expect(canAdvanceApproval('pending', 1, 3)).toBe(true);
    expect(canAdvanceApproval('approved', 1, 3)).toBe(false);
    expect(isFinalApprovalStep(3, 3)).toBe(true);
    expect(isFinalApprovalStep(2, 3)).toBe(false);
    expect(nextApprovalStep(1, 3)).toBe(2);
    expect(nextApprovalStep(3, 3)).toBeNull();
  });

  it('maps actions to run statuses', () => {
    expect(nextApprovalStatusAfterAction('reject', false)).toBe('rejected');
    expect(nextApprovalStatusAfterAction('approve', true)).toBe('approved');
    expect(nextApprovalStatusAfterAction('approve', false)).toBe('pending');
  });

  it('allows reject and cancel only while pending', () => {
    expect(canRejectApproval('pending')).toBe(true);
    expect(canRejectApproval('approved')).toBe(false);
    expect(canCancelApproval('pending')).toBe(true);
    expect(canCancelApproval('rejected')).toBe(false);
  });

  it('gates step approvers and forbids self-approval', () => {
    const openStep = { order: 1, approverUserId: null };
    const assignedStep = { order: 2, approverUserId: 'approver_1' };
    expect(canApproveStep(openStep, 'manager_1', 'submitter')).toBe(true);
    expect(canApproveStep(openStep, 'submitter', 'submitter')).toBe(false);
    expect(canApproveStep(assignedStep, 'approver_1', 'submitter')).toBe(true);
    expect(canApproveStep(assignedStep, 'other_manager', 'submitter')).toBe(false);
  });
});
