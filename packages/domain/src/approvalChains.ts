export type ApprovalEntityType = 'timesheet' | 'time_off_request';

export type ApprovalRunStatus = 'pending' | 'approved' | 'rejected' | 'canceled';

export type ApprovalAction = 'approve' | 'reject';

export type ApprovalChainStepInput = {
  /** When set, only this member may act on the step. Open steps accept any eligible approver. */
  approverUserId?: string | null;
};

export type ApprovalChainStep = {
  order: number;
  approverUserId: string | null;
};

export const MAX_APPROVAL_CHAIN_STEPS = 5;

export function isValidApprovalChainSteps(steps: readonly ApprovalChainStepInput[]): boolean {
  if (steps.length < 1 || steps.length > MAX_APPROVAL_CHAIN_STEPS) return false;
  return true;
}

export function normalizeApprovalChainSteps(
  steps: readonly ApprovalChainStepInput[],
): ApprovalChainStep[] {
  if (!isValidApprovalChainSteps(steps)) {
    throw new RangeError(`Chain must have 1 to ${MAX_APPROVAL_CHAIN_STEPS} steps`);
  }
  return steps.map((step, index) => ({
    order: index + 1,
    approverUserId: step.approverUserId ?? null,
  }));
}

export function canAdvanceApproval(
  status: ApprovalRunStatus,
  currentStep: number,
  stepCount: number,
): boolean {
  return status === 'pending' && currentStep >= 1 && currentStep <= stepCount;
}

export function isFinalApprovalStep(currentStep: number, stepCount: number): boolean {
  return currentStep === stepCount;
}

export function nextApprovalStep(currentStep: number, stepCount: number): number | null {
  if (!canAdvanceApproval('pending', currentStep, stepCount)) return null;
  if (isFinalApprovalStep(currentStep, stepCount)) return null;
  return currentStep + 1;
}

/** Open steps allow any eligible approver; assigned steps only the named member. */
export function canApproveStep(
  step: ApprovalChainStep,
  actorUserId: string,
  entityOwnerUserId: string,
): boolean {
  if (actorUserId === entityOwnerUserId) return false;
  if (step.approverUserId === null) return true;
  return step.approverUserId === actorUserId;
}

export function canRejectApproval(status: ApprovalRunStatus): boolean {
  return status === 'pending';
}

export function canCancelApproval(status: ApprovalRunStatus): boolean {
  return status === 'pending';
}

export function nextApprovalStatusAfterAction(
  action: ApprovalAction,
  wasFinalStep: boolean,
): ApprovalRunStatus {
  if (action === 'reject') return 'rejected';
  if (wasFinalStep) return 'approved';
  return 'pending';
}
