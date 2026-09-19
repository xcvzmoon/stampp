import type { AuthorizedContext } from '@stampp/access';
import {
  auditEvents,
  clients,
  invitations,
  members,
  organizations,
  projects,
  tags,
  tasks,
  timeEntries,
  timeEntryTags,
  users,
} from '@stampp/database';
import { asc, eq } from 'drizzle-orm';

export async function exportWorkspace(ctx: AuthorizedContext) {
  const [
    workspaceRows,
    memberRows,
    invitationRows,
    clientRows,
    projectRows,
    taskRows,
    tagRows,
    entryRows,
    entryTagRows,
    auditRows,
  ] = await Promise.all([
    ctx.db.client
      .select()
      .from(organizations)
      .where(eq(organizations.id, ctx.workspaceId))
      .limit(1),
    ctx.db.client
      .select({
        id: members.id,
        userId: members.userId,
        role: members.role,
        createdAt: members.createdAt,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.organizationId, ctx.workspaceId))
      .orderBy(asc(members.id)),
    ctx.db.client
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, ctx.workspaceId))
      .orderBy(asc(invitations.id)),
    ctx.db.client
      .select()
      .from(clients)
      .where(eq(clients.workspaceId, ctx.workspaceId))
      .orderBy(asc(clients.id)),
    ctx.db.client
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, ctx.workspaceId))
      .orderBy(asc(projects.id)),
    ctx.db.client
      .select()
      .from(tasks)
      .where(eq(tasks.workspaceId, ctx.workspaceId))
      .orderBy(asc(tasks.id)),
    ctx.db.client
      .select()
      .from(tags)
      .where(eq(tags.workspaceId, ctx.workspaceId))
      .orderBy(asc(tags.id)),
    ctx.db.client
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.workspaceId, ctx.workspaceId))
      .orderBy(asc(timeEntries.id)),
    ctx.db.client
      .select()
      .from(timeEntryTags)
      .where(eq(timeEntryTags.workspaceId, ctx.workspaceId))
      .orderBy(asc(timeEntryTags.timeEntryId), asc(timeEntryTags.tagId)),
    ctx.db.client
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.workspaceId, ctx.workspaceId))
      .orderBy(asc(auditEvents.createdAt), asc(auditEvents.id)),
  ]);

  return {
    format: 'stampp-workspace-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace: workspaceRows[0] ?? null,
    members: memberRows,
    invitations: invitationRows,
    clients: clientRows,
    projects: projectRows,
    tasks: taskRows,
    tags: tagRows,
    timeEntries: entryRows,
    timeEntryTags: entryTagRows,
    auditEvents: auditRows,
  };
}
