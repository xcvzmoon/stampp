import { ERROR_CODES } from '@stampp/shared';
import { HTTPError } from 'nitro';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import {
  catalogSchemas,
  hasAtLeastOneField,
  isUniqueViolation,
  parseBody,
  parseListQuery,
  toClientDto,
  toProjectDto,
  toTagDto,
  toTaskDto,
} from '~/server/utils/catalog.ts';
import { mapErrorCodeToStatus } from '~/server/utils/errors.ts';

const requestId = 'req_1';

describe('isUniqueViolation', () => {
  it('detects postgres unique_violation code 23505', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
  });

  it('ignores other postgres codes and non-objects', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe('hasAtLeastOneField', () => {
  it('rejects empty patch objects', () => {
    expect(hasAtLeastOneField({})).toBe(false);
  });

  it('accepts patches with explicit nulls', () => {
    expect(hasAtLeastOneField({ email: null })).toBe(true);
    expect(hasAtLeastOneField({ name: 'Acme' })).toBe(true);
  });
});

describe('parseBody', () => {
  it('returns parsed output for valid input', () => {
    const output = parseBody(catalogSchemas.createClient, { name: 'Acme' }, requestId);
    expect(output.name).toBe('Acme');
  });

  it('throws validation errors with issue details', () => {
    try {
      parseBody(catalogSchemas.createClient, { name: '' }, requestId);
      throw new Error('expected validation failure');
    } catch (error) {
      if (!(error instanceof HTTPError)) {
        throw error;
      }
      expect(error.status).toBe(400);
      const parsed = v.safeParse(
        v.object({
          code: v.string(),
          details: v.array(v.unknown()),
        }),
        error.data,
      );
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.output.code).toBe(ERROR_CODES.VALIDATION_FAILED);
      }
    }
  });
});

describe('parseListQuery', () => {
  it('applies default limit when absent', () => {
    const query = parseListQuery(new URLSearchParams(), requestId);
    expect(query.limit).toBe(50);
  });

  it('parses limit and filters', () => {
    const query = parseListQuery(
      new URLSearchParams({ limit: '10', status: 'active', search: 'acme' }),
      requestId,
    );
    expect(query.limit).toBe(10);
    expect(query.status).toBe('active');
    expect(query.search).toBe('acme');
  });

  it('rejects invalid limit values', () => {
    expect(() => parseListQuery(new URLSearchParams({ limit: '0' }), requestId)).toThrow();
    expect(() => parseListQuery(new URLSearchParams({ limit: 'abc' }), requestId)).toThrow();
  });
});

describe('dto mappers', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  it('maps clients to ISO date strings', () => {
    const dto = toClientDto({
      id: 'cli_1',
      workspaceId: 'ws_1',
      name: 'Acme',
      email: null,
      address: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(dto.email).toBeNull();
  });

  it('maps projects and preserves status and billable', () => {
    const dto = toProjectDto({
      id: 'prj_1',
      workspaceId: 'ws_1',
      clientId: null,
      name: 'Website',
      code: 'WEB',
      color: '#112233',
      status: 'archived',
      billable: false,
      notes: null,
      budgetMinutes: 4_800,
      budgetAmountMinor: 1_000_000,
      budgetCurrency: 'USD',
      budgetAlertAtPercent: 80,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    expect(dto.status).toBe('archived');
    expect(dto.billable).toBe(false);
    expect(dto.budgetMinutes).toBe(4_800);
    expect(dto.budgetCurrency).toBe('USD');
    expect(dto.budgetAlertAtPercent).toBe(80);
  });

  it('maps tasks including null estimates', () => {
    const dto = toTaskDto({
      id: 'tsk_1',
      workspaceId: 'ws_1',
      projectId: 'prj_1',
      name: 'Design',
      status: 'active',
      estimateMinutes: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    expect(dto.estimateMinutes).toBeNull();
  });

  it('maps tags to DTO strings', () => {
    const dto = toTagDto({
      id: 'tag_1',
      workspaceId: 'ws_1',
      name: 'billable',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    expect(dto.id).toBe('tag_1');
    expect(dto.name).toBe('billable');
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('mapErrorCodeToStatus', () => {
  it('maps auth, conflict, validation, and business-rule codes', () => {
    expect(mapErrorCodeToStatus(ERROR_CODES.UNAUTHENTICATED)).toBe(401);
    expect(mapErrorCodeToStatus(ERROR_CODES.FORBIDDEN)).toBe(403);
    expect(mapErrorCodeToStatus(ERROR_CODES.NOT_FOUND)).toBe(404);
    expect(mapErrorCodeToStatus(ERROR_CODES.CONFLICT)).toBe(409);
    expect(mapErrorCodeToStatus(ERROR_CODES.VALIDATION_FAILED)).toBe(400);
    expect(mapErrorCodeToStatus(ERROR_CODES.PROJECT_NOT_ACTIVE)).toBe(422);
    expect(mapErrorCodeToStatus(ERROR_CODES.RATE_LIMITED)).toBe(429);
    expect(mapErrorCodeToStatus(ERROR_CODES.INTERNAL)).toBe(500);
  });
});
