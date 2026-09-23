export type ImportSource = 'csv' | 'clockify' | 'toggl' | 'harvest';

export type ImportJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ImportEntityKind = 'client' | 'project' | 'tag' | 'time_entry';

export type ImportPreviewRow = {
  kind: ImportEntityKind;
  externalId: string | null;
  name: string;
  startDate: string | null;
  endDate: string | null;
  durationMinutes: number | null;
  issues: string[];
};

export type ImportPreview = {
  source: ImportSource;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ImportPreviewRow[];
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += char ?? '';
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }
  return rows;
}

export function mapCsvTimeEntries(
  text: string,
  options: { startDate?: string | undefined; endDate?: string | undefined } = {},
): ImportPreview {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  const columns = header.map((cell) => cell.trim().toLowerCase());
  const required = ['description', 'start', 'end'];
  const missing = required.filter((name) => !columns.includes(name));
  const previewRows: ImportPreviewRow[] = [];

  if (missing.length > 0) {
    return {
      source: 'csv',
      totalRows: Math.max(rows.length - 1, 0),
      validRows: 0,
      invalidRows: Math.max(rows.length - 1, 0),
      rows: [
        {
          kind: 'time_entry',
          externalId: null,
          name: 'header',
          startDate: null,
          endDate: null,
          durationMinutes: null,
          issues: [`Missing required columns: ${missing.join(', ')}`],
        },
      ],
    };
  }

  for (const line of rows.slice(1)) {
    const record: Record<string, string> = {};
    for (const [index, name] of columns.entries()) {
      record[name] = line[index] ?? '';
    }
    const start = new Date(record.start ?? '');
    const end = new Date(record.end ?? '');
    const issues: string[] = [];
    if (!record.description?.trim()) {
      issues.push('description is required');
    }
    if (Number.isNaN(start.getTime())) {
      issues.push('start must be a valid timestamp');
    }
    if (Number.isNaN(end.getTime())) {
      issues.push('end must be a valid timestamp');
    }
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) {
      issues.push('end must be after start');
    }
    if (
      options.startDate &&
      !Number.isNaN(start.getTime()) &&
      start < new Date(options.startDate)
    ) {
      issues.push('start is before the selected import window');
    }
    if (options.endDate && !Number.isNaN(end.getTime()) && end > new Date(options.endDate)) {
      issues.push('end is after the selected import window');
    }

    previewRows.push({
      kind: 'time_entry',
      externalId: record.id && record.id.length > 0 ? record.id : null,
      name: record.description ?? '',
      startDate: Number.isNaN(start.getTime()) ? null : start.toISOString(),
      endDate: Number.isNaN(end.getTime()) ? null : end.toISOString(),
      durationMinutes:
        Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
          ? null
          : Math.round((end.getTime() - start.getTime()) / 60_000),
      issues,
    });
  }

  const validRows = previewRows.filter((row) => row.issues.length === 0).length;
  return {
    source: 'csv',
    totalRows: previewRows.length,
    validRows,
    invalidRows: previewRows.length - validRows,
    rows: previewRows,
  };
}

/** Clockify/Toggl/Harvest share a generic CSV shape; adapters only rename source. */
export function mapVendorCsv(source: ImportSource, text: string): ImportPreview {
  const preview = mapCsvTimeEntries(text);
  return { ...preview, source };
}
