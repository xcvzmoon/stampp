import { describe, expect, it } from 'vite-plus/test';
import { filterRateCandidatesAsOf, rateWindowIncludes } from '../src/rates.ts';

describe('rate historical windows', () => {
  const open = {
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: null,
  };
  const closed = {
    effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-02-01T00:00:00.000Z'),
  };

  it('includes times before close and excludes future versions', () => {
    const jan15 = new Date('2026-01-15T00:00:00.000Z');
    const feb = new Date('2026-02-01T00:00:00.000Z');
    const future = new Date('2026-03-01T00:00:00.000Z');
    expect(rateWindowIncludes(closed, jan15)).toBe(true);
    expect(rateWindowIncludes(closed, feb)).toBe(false);
    expect(rateWindowIncludes(open, future)).toBe(true);
    expect(rateWindowIncludes({ effectiveFrom: future, effectiveTo: null }, jan15)).toBe(false);
  });

  it('keeps only the as-of version in filters', () => {
    const at = new Date('2026-01-20T00:00:00.000Z');
    const active = filterRateCandidatesAsOf([open, closed], at);
    expect(active).toHaveLength(2);
    expect(filterRateCandidatesAsOf([closed], new Date('2026-03-01T00:00:00.000Z'))).toHaveLength(
      0,
    );
  });
});
