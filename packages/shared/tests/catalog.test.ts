import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import {
  createClientInputSchema,
  createProjectInputSchema,
  createTagInputSchema,
  createTaskInputSchema,
  DEFAULT_LIST_LIMIT,
  entityNameSchema,
  hexColorSchema,
  listQuerySchema,
  projectCodeSchema,
  tagNameSchema,
  tagIdsSchema,
  updateClientInputSchema,
  updateProjectInputSchema,
  updateTagInputSchema,
  updateTaskInputSchema,
} from '../src/catalog.ts';

type ParseCandidate = Parameters<typeof v.safeParse>[1];

function expectFail(schema: v.GenericSchema, input: ParseCandidate) {
  const result = v.safeParse(schema, input);
  expect(result.success).toBe(false);
}

function expectPass(schema: v.GenericSchema, input: ParseCandidate) {
  const result = v.safeParse(schema, input);
  expect(result.success).toBe(true);
}

describe('entityNameSchema', () => {
  it('trims surrounding whitespace', () => {
    const result = v.safeParse(entityNameSchema, '  Acme  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toBe('Acme');
    }
  });

  it('rejects empty and whitespace-only names', () => {
    expectFail(entityNameSchema, '');
    expectFail(entityNameSchema, '   ');
  });

  it('rejects names longer than 200 characters', () => {
    expectPass(entityNameSchema, 'x'.repeat(200));
    expectFail(entityNameSchema, 'x'.repeat(201));
  });
});

describe('projectCodeSchema', () => {
  it('accepts alphanumeric codes with dots, underscores, and hyphens', () => {
    expectPass(projectCodeSchema, 'ACME-01');
    expectPass(projectCodeSchema, 'web_v2.1');
  });

  it('rejects spaces and empty codes', () => {
    expectFail(projectCodeSchema, 'has space');
    expectFail(projectCodeSchema, '');
  });
});

describe('hexColorSchema', () => {
  it('accepts six-digit hex colors with or without case', () => {
    expectPass(hexColorSchema, '#3B82F6');
    expectPass(hexColorSchema, '#abcdef');
  });

  it('rejects shorthand, missing hash, and invalid hex', () => {
    expectFail(hexColorSchema, '#fff');
    expectFail(hexColorSchema, '3B82F6');
    expectFail(hexColorSchema, '#GGGGGG');
  });
});

describe('createClientInputSchema', () => {
  it('requires a name and accepts optional contact fields', () => {
    expectPass(createClientInputSchema, { name: 'Acme' });
    expectPass(createClientInputSchema, {
      name: 'Acme',
      email: 'billing@acme.test',
      address: '1 Main St',
      notes: 'Key account',
    });
    expectFail(createClientInputSchema, {});
  });

  it('rejects invalid email formats', () => {
    expectFail(createClientInputSchema, { name: 'Acme', email: 'not-an-email' });
  });

  it('treats empty optional strings as invalid rather than silent blanks', () => {
    expectFail(createClientInputSchema, { name: 'Acme', email: '' });
  });
});

describe('updateClientInputSchema', () => {
  it('allows partial updates including explicit nulls', () => {
    expectPass(updateClientInputSchema, {});
    expectPass(updateClientInputSchema, { name: 'Acme Two' });
    expectPass(updateClientInputSchema, { email: null });
    expectPass(updateClientInputSchema, { notes: null, address: '2 Side St' });
  });

  it('rejects invalid email on partial update', () => {
    expectFail(updateClientInputSchema, { email: 'bad' });
  });
});

describe('createProjectInputSchema', () => {
  it('defaults nothing client-side beyond optional fields', () => {
    const result = v.safeParse(createProjectInputSchema, { name: 'Website' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.billable).toBeUndefined();
      expect(result.output.clientId).toBeUndefined();
    }
  });

  it('accepts optional client, code, color, and billable', () => {
    expectPass(createProjectInputSchema, {
      name: 'Website',
      clientId: 'cli_1',
      code: 'WEB',
      color: '#112233',
      billable: false,
    });
  });

  it('rejects invalid color values', () => {
    expectFail(createProjectInputSchema, { name: 'Website', color: 'blue' });
  });
});

describe('updateProjectInputSchema', () => {
  it('supports clearing client, code, color, and notes', () => {
    expectPass(updateProjectInputSchema, {
      clientId: null,
      code: null,
      color: null,
      notes: null,
    });
  });

  it('accepts status transitions', () => {
    expectPass(updateProjectInputSchema, { status: 'archived' });
    expectPass(updateProjectInputSchema, { status: 'active' });
    expectFail(updateProjectInputSchema, { status: 'deleted' });
  });
});

describe('task input schemas', () => {
  it('accepts estimate minutes as non-negative integers only', () => {
    expectPass(createTaskInputSchema, { name: 'Design', estimateMinutes: 0 });
    expectPass(createTaskInputSchema, { name: 'Design', estimateMinutes: 90 });
    expectFail(createTaskInputSchema, { name: 'Design', estimateMinutes: -1 });
    expectFail(createTaskInputSchema, { name: 'Design', estimateMinutes: 1.5 });
    expectPass(updateTaskInputSchema, { estimateMinutes: null });
  });

  it('accepts task status transitions', () => {
    expectPass(updateTaskInputSchema, { status: 'archived' });
    expectFail(updateTaskInputSchema, { status: 'done' });
  });
});

describe('listQuerySchema', () => {
  it('parses numeric limit strings and optional filters', () => {
    const result = v.safeParse(listQuerySchema, {
      limit: '25',
      status: 'active',
      clientId: 'cli_1',
      search: 'acme',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.limit).toBe(25);
      expect(result.output.status).toBe('active');
    }
  });

  it('omits limit when absent so callers can apply DEFAULT_LIST_LIMIT', () => {
    const result = v.safeParse(listQuerySchema, {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.limit).toBeUndefined();
      expect(DEFAULT_LIST_LIMIT).toBe(50);
    }
  });

  it('rejects out-of-range and non-integer limits', () => {
    expectFail(listQuerySchema, { limit: '0' });
    expectFail(listQuerySchema, { limit: '201' });
    expectFail(listQuerySchema, { limit: '12.5' });
    expectFail(listQuerySchema, { limit: 'abc' });
  });

  it('rejects unknown status values', () => {
    expectFail(listQuerySchema, { status: 'paused' });
  });
});

describe('tag schemas', () => {
  it('trims tag names and enforces length bounds', () => {
    const result = v.safeParse(tagNameSchema, '  billable  ');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toBe('billable');
    }
    expectPass(tagNameSchema, 'x'.repeat(50));
    expectFail(tagNameSchema, 'x'.repeat(51));
    expectFail(tagNameSchema, '');
  });

  it('requires a single name on create and update', () => {
    expectPass(createTagInputSchema, { name: 'design' });
    expectFail(createTagInputSchema, {});
    expectPass(updateTagInputSchema, { name: 'ops' });
    expectFail(updateTagInputSchema, { name: '' });
  });

  it('rejects duplicate and oversized tag id lists', () => {
    expectPass(tagIdsSchema, ['tag_1', 'tag_2']);
    expectFail(tagIdsSchema, ['tag_1', 'tag_1']);
    expectFail(
      tagIdsSchema,
      Array.from({ length: 21 }, (_value, index) => `tag_${index}`),
    );
  });
});
