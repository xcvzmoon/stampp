import { describe, expect, it } from 'vite-plus/test';
import { mapCsvTimeEntries, mapVendorCsv, parseCsv } from '../src/import.ts';

const csv = [
  'id,description,start,end',
  'a1,Draft brief,2026-09-01T09:00:00.000Z,2026-09-01T10:30:00.000Z',
  'a2,,2026-09-01T11:00:00.000Z,2026-09-01T11:30:00.000Z',
  'a3,Bad range,2026-09-01T12:00:00.000Z,2026-09-01T11:00:00.000Z',
].join('\n');

describe('import mapping', () => {
  it('parses quoted CSV cells', () => {
    expect(parseCsv('a,b\n"x,1",y\n')).toEqual([
      ['a', 'b'],
      ['x,1', 'y'],
    ]);
  });

  it('produces dry-run preview rows with issues', () => {
    const preview = mapCsvTimeEntries(csv);
    expect(preview.totalRows).toBe(3);
    expect(preview.validRows).toBe(1);
    expect(preview.invalidRows).toBe(2);
    expect(preview.rows[0]?.durationMinutes).toBe(90);
    expect(preview.rows[1]?.issues).toContain('description is required');
  });

  it('stamps vendor source for clockify-like CSV', () => {
    expect(mapVendorCsv('clockify', csv).source).toBe('clockify');
  });
});
