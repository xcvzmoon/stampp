import type { Money } from './money.ts';

export type RateKind = 'billable' | 'cost';

/** Fixed precedence order — most specific first. Not workspace-configurable. */
export type RateScope = 'task' | 'project' | 'user_project' | 'user' | 'org';

export type RateSource = RateScope | 'none';

export type RateTarget = {
  userId?: string | null | undefined;
  projectId?: string | null | undefined;
  taskId?: string | null | undefined;
};

export type RateCandidate = {
  scope: RateScope;
  amountMinor: number;
  currency: string;
  userId?: string | null | undefined;
  projectId?: string | null | undefined;
  taskId?: string | null | undefined;
};

export type ResolvedRate = {
  scope: RateSource;
  money: Money | null;
};

export type EffectiveRates = {
  billable: Money | null;
  cost: Money | null;
  currency: string;
  source: RateSource;
};

const PRECEDENCE: readonly RateScope[] = ['task', 'project', 'user_project', 'user', 'org'];

function matchesScope(candidate: RateCandidate, target: RateTarget): boolean {
  switch (candidate.scope) {
    case 'task':
      return Boolean(
        target.taskId &&
        candidate.taskId === target.taskId &&
        candidate.projectId != null &&
        (!target.projectId || candidate.projectId === target.projectId),
      );
    case 'project':
      return Boolean(target.projectId && candidate.projectId === target.projectId);
    case 'user_project':
      return Boolean(
        target.userId &&
        target.projectId &&
        candidate.userId === target.userId &&
        candidate.projectId === target.projectId,
      );
    case 'user':
      return Boolean(target.userId && candidate.userId === target.userId);
    case 'org':
      return true;
    default:
      return false;
  }
}

function resolveOne(candidates: RateCandidate[], target: RateTarget): ResolvedRate {
  for (const scope of PRECEDENCE) {
    const match = candidates.find(
      (candidate) => candidate.scope === scope && matchesScope(candidate, target),
    );
    if (match) {
      return {
        scope: match.scope,
        money: { amountMinor: match.amountMinor, currency: match.currency.toUpperCase() },
      };
    }
  }
  return { scope: 'none', money: null };
}

function pickCurrency(billable: Money | null, cost: Money | null): string {
  if (billable) return billable.currency;
  if (cost) return cost.currency;
  return '';
}

function scopeRank(scope: RateSource): number {
  if (scope === 'none') return Number.MAX_SAFE_INTEGER;
  const index = PRECEDENCE.indexOf(scope);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function pickSource(billableScope: RateSource, costScope: RateSource): RateSource {
  return scopeRank(billableScope) <= scopeRank(costScope) ? billableScope : costScope;
}

/**
 * Resolve billable and cost rates for a point in time.
 * Callers pass only candidates already filtered by workspace and as-of window.
 * Precedence: task → project → user_project → user → org.
 */
export function resolveEffectiveRates(
  billableCandidates: RateCandidate[],
  costCandidates: RateCandidate[],
  target: RateTarget,
): EffectiveRates {
  const billable = resolveOne(billableCandidates, target);
  const cost = resolveOne(costCandidates, target);

  if (billable.money && cost.money && billable.money.currency !== cost.money.currency) {
    throw new RangeError(
      `Rate currency mismatch: billable ${billable.money.currency} vs cost ${cost.money.currency}`,
    );
  }

  return {
    billable: billable.money,
    cost: cost.money,
    currency: pickCurrency(billable.money, cost.money),
    source: pickSource(billable.scope, cost.scope),
  };
}

export type RateWindow = {
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

/** Historical integrity: closed windows stay valid only for times in their half-open interval. */
export function rateWindowIncludes(window: RateWindow, at: Date): boolean {
  if (window.effectiveFrom > at) {
    return false;
  }
  if (window.effectiveTo && window.effectiveTo <= at) {
    return false;
  }
  return true;
}

export function filterRateCandidatesAsOf<T extends RateWindow>(rows: readonly T[], at: Date): T[] {
  const active: T[] = [];
  for (const row of rows) {
    if (rateWindowIncludes(row, at)) {
      active.push(row);
    }
  }
  return active;
}
