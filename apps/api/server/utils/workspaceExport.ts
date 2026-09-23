import type { AuthorizedContext } from '@stampp/access';
import {
  attendanceRecords,
  auditEvents,
  clients,
  expenses,
  invoiceLines,
  invoicePayments,
  invoices,
  invitations,
  members,
  organizations,
  projects,
  rates,
  tags,
  tasks,
  timeEntries,
  timeEntryTags,
  timesheets,
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
    rateRows,
    timesheetRows,
    attendanceRows,
    expenseRows,
    invoiceRows,
    invoiceLineRows,
    invoicePaymentRows,
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
      .from(rates)
      .where(eq(rates.workspaceId, ctx.workspaceId))
      .orderBy(asc(rates.id)),
    ctx.db.client
      .select()
      .from(timesheets)
      .where(eq(timesheets.workspaceId, ctx.workspaceId))
      .orderBy(asc(timesheets.id)),
    ctx.db.client
      .select()
      .from(attendanceRecords)
      .where(eq(attendanceRecords.workspaceId, ctx.workspaceId))
      .orderBy(asc(attendanceRecords.id)),
    ctx.db.client
      .select()
      .from(expenses)
      .where(eq(expenses.workspaceId, ctx.workspaceId))
      .orderBy(asc(expenses.id)),
    ctx.db.client
      .select()
      .from(invoices)
      .where(eq(invoices.workspaceId, ctx.workspaceId))
      .orderBy(asc(invoices.id)),
    ctx.db.client
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.workspaceId, ctx.workspaceId))
      .orderBy(asc(invoiceLines.id)),
    ctx.db.client
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.workspaceId, ctx.workspaceId))
      .orderBy(asc(invoicePayments.id)),
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
    rates: rateRows,
    timesheets: timesheetRows,
    attendanceRecords: attendanceRows,
    expenses: expenseRows,
    invoices: invoiceRows,
    invoiceLines: invoiceLineRows,
    invoicePayments: invoicePaymentRows,
    auditEvents: auditRows,
  };
}
