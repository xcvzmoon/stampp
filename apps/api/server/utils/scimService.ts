import type { JsonValue, ScimGroupInput, ScimPatchInput, ScimUserInput } from '@stampp/shared';
import type { H3Event } from 'nitro';
import { members, organizations, users } from '@stampp/database';
import {
  SCIM_CONTENT_TYPE,
  type ScimResourceDto,
  scimError,
  scimListResponse,
  scimMeta,
  scimUserNameFromEmail,
} from '@stampp/domain';
import { scimGroupSchema, scimPatchSchema, scimUserSchema } from '@stampp/shared';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import * as v from 'valibot';
import { getDb } from '~/server/utils/db.ts';
import { resolveScimWorkspace } from '~/server/utils/scim.ts';

export async function requireScimWorkspace(event: H3Event): Promise<string> {
  const workspaceId = await resolveScimWorkspace(event.req.headers.get('authorization'));
  if (!workspaceId) {
    return scimFail(event, 401, 'unauthorized', 'Invalid SCIM token');
  }
  return workspaceId;
}

export function scimFail(
  event: H3Event,
  status: number,
  scimType: string | undefined,
  detail: string,
): string {
  event.res.status = status;
  event.res.headers.set('content-type', SCIM_CONTENT_TYPE);
  // return value unused when thrown by callers as Response
  void detail;
  void scimType;
  return '';
}

export function scimJson(status: number, body: ScimResourceDto | ScimResourceDto[] | JsonValue) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': SCIM_CONTENT_TYPE },
  });
}

function primaryEmail(input: ScimUserInput): string {
  const emails = input.emails ?? [];
  const primary = emails.find((entry) => entry.primary) ?? emails[0];
  return primary?.value.toLowerCase() ?? scimUserNameFromEmail(input.userName);
}

function displayName(input: ScimUserInput): string {
  const given = input.name?.givenName?.trim() ?? '';
  const family = input.name?.familyName?.trim() ?? '';
  const joined = `${given} ${family}`.trim();
  return joined.length > 0 ? joined : input.userName;
}

export function toScimUser(
  row: typeof users.$inferSelect,
  externalId: string | null,
): ScimResourceDto {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: row.id,
    externalId,
    userName: scimUserNameFromEmail(row.email),
    name: {
      givenName: row.name.split(' ')[0] ?? row.name,
      familyName: row.name.split(' ').slice(1).join(' '),
    },
    emails: [{ value: row.email, type: 'work', primary: true }],
    active: true,
    meta: scimMeta('User', row.id, row.createdAt, row.updatedAt),
  };
}

export function toScimGroup(
  row: typeof organizations.$inferSelect,
  memberIds: string[],
): ScimResourceDto {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: row.id,
    displayName: row.name,
    members: memberIds.map((value) => ({ value })),
    meta: scimMeta('Group', row.id, row.createdAt, row.createdAt),
  };
}

export async function scimListUsers(workspaceId: string): Promise<Response> {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .innerJoin(members, eq(members.userId, users.id))
    .where(eq(members.organizationId, workspaceId));
  const resources = rows.map((row) => toScimUser(row.users, null));
  return scimJson(200, scimListResponse('User', resources, resources.length));
}

export async function scimGetUser(workspaceId: string, userId: string) {
  const db = getDb();
  const rows = await db
    .select({ user: users })
    .from(users)
    .innerJoin(members, eq(members.userId, users.id))
    .where(and(eq(members.organizationId, workspaceId), eq(users.id, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return scimJson(404, scimError(404, null, 'User not found'));
  }
  return scimJson(200, toScimUser(row.user, null));
}

export async function scimCreateUser(workspaceId: string, input: ScimUserInput) {
  const db = getDb();
  const email = primaryEmail(input);
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user = existing[0];
  if (!user) {
    const inserted = await db
      .insert(users)
      .values({
        id: `user_${randomBytes(12).toString('hex')}`,
        name: displayName(input),
        email,
        emailVerified: true,
      })
      .returning();
    user = inserted[0];
    if (!user) {
      return scimJson(500, scimError(500, null, 'Failed to create user'));
    }
  }
  await db
    .insert(members)
    .values({
      id: `member_${randomBytes(12).toString('hex')}`,
      organizationId: workspaceId,
      userId: user.id,
      role: input.active === false ? 'guest' : 'member',
    })
    .onConflictDoNothing();
  return scimJson(201, toScimUser(user, input.externalId ?? null));
}

export async function scimReplaceUser(workspaceId: string, userId: string, input: ScimUserInput) {
  const db = getDb();
  const email = primaryEmail(input);
  const updated = await db
    .update(users)
    .set({ name: displayName(input), email, emailVerified: true })
    .where(eq(users.id, userId))
    .returning();
  const user = updated[0];
  if (!user) {
    return scimJson(404, scimError(404, null, 'User not found'));
  }
  await db
    .update(members)
    .set({ role: input.active === false ? 'guest' : 'member' })
    .where(and(eq(members.organizationId, workspaceId), eq(members.userId, userId)));
  return scimJson(200, toScimUser(user, input.externalId ?? null));
}

export async function scimPatchUser(workspaceId: string, userId: string, input: ScimPatchInput) {
  let active: boolean | undefined;
  let name: string | undefined;
  for (const operation of input.Operations) {
    const parsedValue = v.safeParse(v.union([v.boolean(), v.string()]), operation.value);
    if (!parsedValue.success || operation.op !== 'replace') {
      continue;
    }
    const activeResult = v.safeParse(v.boolean(), parsedValue.output);
    const nameResult = v.safeParse(v.string(), parsedValue.output);
    if (operation.path === 'active' && activeResult.success) {
      active = activeResult.output;
    }
    if (operation.path === 'name.givenName' && nameResult.success) {
      name = nameResult.output;
    }
  }
  const db = getDb();
  if (name !== undefined) {
    await db.update(users).set({ name }).where(eq(users.id, userId));
  }
  if (active !== undefined) {
    await db
      .update(members)
      .set({ role: active ? 'member' : 'guest' })
      .where(and(eq(members.organizationId, workspaceId), eq(members.userId, userId)));
  }
  return scimGetUser(workspaceId, userId);
}

export async function scimDeleteUser(workspaceId: string, userId: string) {
  const db = getDb();
  await db
    .delete(members)
    .where(and(eq(members.organizationId, workspaceId), eq(members.userId, userId)));
  return new Response(null, { status: 204 });
}

export async function scimListGroup(workspaceId: string) {
  const db = getDb();
  const rows = await db.select().from(organizations).where(eq(organizations.id, workspaceId));
  const org = rows[0];
  if (!org) {
    return scimJson(404, scimError(404, null, 'Group not found'));
  }
  const memberRows = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.organizationId, workspaceId));
  return scimJson(
    200,
    toScimGroup(
      org,
      memberRows.map((row) => row.userId),
    ),
  );
}

export async function scimListGroups(workspaceId: string): Promise<Response> {
  const db = getDb();
  const rows = await db.select().from(organizations).where(eq(organizations.id, workspaceId));
  const org = rows[0];
  if (!org) {
    return scimJson(200, scimListResponse('Group', [], 0));
  }
  const memberRows = await db
    .select({ userId: members.userId })
    .from(members)
    .where(eq(members.organizationId, workspaceId));
  const resource = toScimGroup(
    org,
    memberRows.map((row) => row.userId),
  );
  return scimJson(200, scimListResponse('Group', [resource], 1));
}

export async function scimCreateGroup(workspaceId: string, input: ScimGroupInput) {
  const db = getDb();
  const rows = await db.select().from(organizations).where(eq(organizations.id, workspaceId));
  const org = rows[0];
  if (!org) {
    return scimJson(404, scimError(404, null, 'Workspace not found'));
  }
  if (input.members?.length) {
    await Promise.all(
      input.members.map((member) =>
        db
          .insert(members)
          .values({
            id: `member_${randomBytes(12).toString('hex')}`,
            organizationId: workspaceId,
            userId: member.value,
            role: 'member',
          })
          .onConflictDoNothing(),
      ),
    );
  }
  return scimJson(
    201,
    toScimGroup(
      org,
      (input.members ?? []).map((entry) => entry.value),
    ),
  );
}

export async function scimReplaceGroup(workspaceId: string, input: ScimGroupInput) {
  return scimCreateGroup(workspaceId, input);
}

export function scimServiceProviderConfig() {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://github.com/xcvzmoon/stampp',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'SCIM token minted in workspace settings',
        specUri: 'https://www.rfc-editor.org/rfc/rfc6750',
        primary: true,
      },
    ],
    meta: {
      resourceType: 'ServiceProviderConfig',
      location: '/scim/v2/ServiceProviderConfig',
    },
  };
}

export async function handleScimUsers(event: H3Event): Promise<Response> {
  const workspaceId = await requireScimWorkspace(event);
  const method = event.req.method.toUpperCase();
  const userId = event.context.params?.userId;
  if (method === 'GET' && !userId) return scimListUsers(workspaceId);
  if (method === 'GET' && userId) return scimGetUser(workspaceId, userId);
  if (method === 'POST') {
    const parsed = v.safeParse(scimUserSchema, await event.req.json());
    if (!parsed.success) return scimJson(400, scimError(400, 'invalidValue', 'Invalid user'));
    return scimCreateUser(workspaceId, parsed.output);
  }
  if (method === 'PUT' && userId) {
    const parsed = v.safeParse(scimUserSchema, await event.req.json());
    if (!parsed.success) return scimJson(400, scimError(400, 'invalidValue', 'Invalid user'));
    return scimReplaceUser(workspaceId, userId, parsed.output);
  }
  if (method === 'PATCH' && userId) {
    const parsed = v.safeParse(scimPatchSchema, await event.req.json());
    if (!parsed.success) return scimJson(400, scimError(400, 'invalidValue', 'Invalid patch'));
    return scimPatchUser(workspaceId, userId, parsed.output);
  }
  if (method === 'DELETE' && userId) return scimDeleteUser(workspaceId, userId);
  return scimJson(405, scimError(405, null, 'Method not allowed'));
}

export async function handleScimGroups(event: H3Event): Promise<Response> {
  const workspaceId = await requireScimWorkspace(event);
  const method = event.req.method.toUpperCase();
  const groupId = event.context.params?.groupId;
  if (method === 'GET' && !groupId) return scimListGroups(workspaceId);
  if (method === 'GET' && groupId) return scimListGroup(workspaceId);
  if (method === 'POST') {
    const parsed = v.safeParse(scimGroupSchema, await event.req.json());
    if (!parsed.success) return scimJson(400, scimError(400, 'invalidValue', 'Invalid group'));
    return scimCreateGroup(workspaceId, parsed.output);
  }
  if ((method === 'PUT' || method === 'PATCH') && groupId) {
    const parsed = v.safeParse(scimGroupSchema, await event.req.json());
    if (!parsed.success) return scimJson(400, scimError(400, 'invalidValue', 'Invalid group'));
    return scimReplaceGroup(workspaceId, parsed.output);
  }
  return scimJson(405, scimError(405, null, 'Method not allowed'));
}
