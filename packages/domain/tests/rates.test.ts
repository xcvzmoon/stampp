import { describe, expect, it } from 'vite-plus/test';
import { resolveEffectiveRates, type RateCandidate } from '../src/rates.ts';

const orgBillable: RateCandidate = {
  scope: 'org',
  amountMinor: 10_000,
  currency: 'USD',
};
const userBillable: RateCandidate = {
  scope: 'user',
  amountMinor: 12_000,
  currency: 'USD',
  userId: 'u1',
};
const projectBillable: RateCandidate = {
  scope: 'project',
  amountMinor: 15_000,
  currency: 'USD',
  projectId: 'p1',
};
const userProjectBillable: RateCandidate = {
  scope: 'user_project',
  amountMinor: 14_000,
  currency: 'USD',
  userId: 'u1',
  projectId: 'p1',
};
const taskBillable: RateCandidate = {
  scope: 'task',
  amountMinor: 20_000,
  currency: 'USD',
  projectId: 'p1',
  taskId: 't1',
};

describe('resolveEffectiveRates', () => {
  it('returns empty resolution when no candidates match', () => {
    const result = resolveEffectiveRates([], [], { userId: 'u1' });
    expect(result.billable).toBeNull();
    expect(result.cost).toBeNull();
    expect(result.currency).toBe('');
    expect(result.source).toBe('none');
  });

  it('falls back to org when only org rates exist', () => {
    const result = resolveEffectiveRates([orgBillable], [], {});
    expect(result.billable).toEqual({ amountMinor: 10_000, currency: 'USD' });
    expect(result.source).toBe('org');
  });

  it('prefers user over org', () => {
    const result = resolveEffectiveRates([orgBillable, userBillable], [], { userId: 'u1' });
    expect(result.billable?.amountMinor).toBe(12_000);
    expect(result.source).toBe('user');
  });

  it('prefers project over user_project and user', () => {
    const result = resolveEffectiveRates(
      [orgBillable, userBillable, projectBillable, userProjectBillable],
      [],
      { userId: 'u1', projectId: 'p1' },
    );
    expect(result.billable?.amountMinor).toBe(15_000);
    expect(result.source).toBe('project');
  });

  it('prefers task over project', () => {
    const result = resolveEffectiveRates([orgBillable, projectBillable, taskBillable], [], {
      projectId: 'p1',
      taskId: 't1',
    });
    expect(result.billable?.amountMinor).toBe(20_000);
    expect(result.source).toBe('task');
  });

  it('uses user_project when no project-level rate exists', () => {
    const result = resolveEffectiveRates([orgBillable, userBillable, userProjectBillable], [], {
      userId: 'u1',
      projectId: 'p1',
    });
    expect(result.billable?.amountMinor).toBe(14_000);
    expect(result.source).toBe('user_project');
  });

  it('ignores user_project when project is missing from target', () => {
    const result = resolveEffectiveRates([userProjectBillable, userBillable], [], { userId: 'u1' });
    expect(result.billable?.amountMinor).toBe(12_000);
    expect(result.source).toBe('user');
  });

  it('resolves billable and cost independently', () => {
    const costOrg: RateCandidate = { scope: 'org', amountMinor: 5_000, currency: 'USD' };
    const result = resolveEffectiveRates([projectBillable], [costOrg], { projectId: 'p1' });
    expect(result.billable?.amountMinor).toBe(15_000);
    expect(result.cost?.amountMinor).toBe(5_000);
    expect(result.source).toBe('project');
  });

  it('throws when billable and cost currencies differ', () => {
    const costEur: RateCandidate = { scope: 'org', amountMinor: 5_000, currency: 'EUR' };
    expect(() => resolveEffectiveRates([orgBillable], [costEur], {})).toThrow(RangeError);
  });

  it('normalizes currency to uppercase', () => {
    const result = resolveEffectiveRates(
      [{ scope: 'org', amountMinor: 1, currency: 'usd' }],
      [],
      {},
    );
    expect(result.billable?.currency).toBe('USD');
  });
});
