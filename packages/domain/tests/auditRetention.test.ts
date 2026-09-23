import { describe, expect, it } from 'vite-plus/test';
import {
  auditCsvCell,
  auditPurgeCutoff,
  DEFAULT_AUDIT_RETENTION_DAYS,
  isValidRetentionDays,
} from '../src/auditRetention.ts';

describe('audit retention rules', () => {
  it('validates retention windows', () => {
    expect(isValidRetentionDays(DEFAULT_AUDIT_RETENTION_DAYS)).toBe(true);
    expect(isValidRetentionDays(0)).toBe(false);
    expect(isValidRetentionDays(10_000)).toBe(false);
  });

  it('computes purge cutoff and CSV escaping', () => {
    const cutoff = auditPurgeCutoff(7, new Date('2026-09-23T00:00:00Z'));
    expect(cutoff.toISOString()).toBe('2026-09-16T00:00:00.000Z');
    expect(auditCsvCell('plain')).toBe('plain');
    expect(auditCsvCell('a,b')).toBe('"a,b"');
  });
});
