import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';
import {
  acceptInvitationResultSchema,
  invitationDetailSchema,
  invitationListSchema,
  memberListSchema,
} from '../src/organization.ts';

describe('organization schemas', () => {
  it('parses a get-invitation payload', () => {
    const parsed = v.safeParse(invitationDetailSchema, {
      id: 'inv_1',
      email: 'ada@example.com',
      role: 'member',
      organizationId: 'org_1',
      organizationName: 'Acme',
      organizationSlug: 'acme',
      inviterEmail: 'owner@example.com',
      status: 'pending',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects a non-pending invitation status', () => {
    const parsed = v.safeParse(invitationDetailSchema, {
      id: 'inv_1',
      email: 'ada@example.com',
      role: 'member',
      organizationId: 'org_1',
      status: 'expired',
    });
    expect(parsed.success).toBe(false);
  });

  it('parses list-members and list-invitations payloads', () => {
    const members = v.safeParse(memberListSchema, {
      members: [
        {
          id: 'mem_1',
          role: 'owner',
          userId: 'user_1',
          user: { id: 'user_1', name: 'Ada', email: 'ada@example.com' },
        },
      ],
      total: 1,
    });
    const invitations = v.safeParse(invitationListSchema, [
      { id: 'inv_1', email: 'bob@example.com', role: 'admin', status: 'pending' },
    ]);
    const accept = v.safeParse(acceptInvitationResultSchema, { organizationId: 'org_1' });
    expect(members.success).toBe(true);
    expect(invitations.success).toBe(true);
    expect(accept.success).toBe(true);
  });
});
