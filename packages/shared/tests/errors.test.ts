import { describe, expect, it } from 'vite-plus/test';
import { ERROR_CODES } from '../src/errors.ts';

describe('ERROR_CODES', () => {
  it('uses dotted stable codes for time domain conflicts', () => {
    expect(ERROR_CODES.TIME_ENTRY_OVERLAP).toBe('time_entry.overlap');
    expect(ERROR_CODES.TIME_ENTRY_LOCKED).toBe('time_entry.locked');
    expect(ERROR_CODES.TIMER_ALREADY_RUNNING).toBe('timer.already_running');
  });

  it('keeps authn and authz codes distinct', () => {
    expect(ERROR_CODES.UNAUTHENTICATED).not.toBe(ERROR_CODES.FORBIDDEN);
  });

  it('exports unique string values', () => {
    const values = Object.values(ERROR_CODES);
    expect(new Set(values).size).toBe(values.length);
  });
});
