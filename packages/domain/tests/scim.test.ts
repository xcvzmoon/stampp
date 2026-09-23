import { describe, expect, it } from 'vite-plus/test';
import {
  parseScimUserFilter,
  scimListResponse,
  scimMeta,
  scimUserNameFromEmail,
} from '../src/scim.ts';

describe('scim domain rules', () => {
  it('maps names and metadata', () => {
    expect(scimUserNameFromEmail('  Ada@Example.com ')).toBe('ada@example.com');
    const meta = scimMeta(
      'User',
      'u1',
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-01-02T00:00:00Z'),
    );
    expect(meta.resourceType).toBe('User');
    expect(meta.location).toBe('/scim/v2/Users/u1');
  });

  it('builds list envelopes and parses eq filters', () => {
    const list = scimListResponse('User', [{ id: 'u1' }], 1, 1, 10);
    expect(list.schemas[0]).toContain('ListResponse');
    expect(list.Resources).toHaveLength(1);
    expect(parseScimUserFilter('userName eq "ada@example.com"')).toEqual({
      field: 'userName',
      value: 'ada@example.com',
    });
    expect(parseScimUserFilter('name eq "x"')).toBeNull();
  });
});
