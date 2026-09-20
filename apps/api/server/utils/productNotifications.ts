import type { AuthorizedContext } from '@stampp/access';
import type { MailEvent } from '@stampp/mailer';
import { members, organizations, users } from '@stampp/database';
import { and, eq, inArray } from 'drizzle-orm';
import { ENV } from '~/server/utils/env.ts';
import { getMailDispatch } from '~/server/utils/mailer.ts';

const MANAGER_ROLES = ['owner', 'admin', 'manager'];

async function workspaceName(ctx: AuthorizedContext): Promise<string> {
  const rows = await ctx.db.client
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, ctx.workspaceId))
    .limit(1);
  return rows[0]?.name ?? 'Workspace';
}

async function userContact(
  ctx: AuthorizedContext,
  userId: string,
): Promise<{ email: string; name: string } | null> {
  const rows = await ctx.db.client
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { email: row.email, name: row.name || row.email };
}

async function managerEmails(ctx: AuthorizedContext): Promise<string[]> {
  const rows = await ctx.db.client
    .select({ email: users.email })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .where(and(eq(members.organizationId, ctx.workspaceId), inArray(members.role, MANAGER_ROLES)));
  return rows.map((row) => row.email);
}

function appUrl(): string {
  return (ENV.PUBLIC_APP_URL ?? ENV.BETTER_AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

async function notifyAll(events: MailEvent[]): Promise<void> {
  if (events.length === 0) return;
  const mail = getMailDispatch();
  await Promise.all(events.map((event) => mail.notify(event)));
}

export async function notifyTimesheetSubmitted(
  ctx: AuthorizedContext,
  input: { memberUserId: string; weekStart: string; workspaceId: string },
): Promise<void> {
  const [name, contact, emails] = await Promise.all([
    workspaceName(ctx),
    userContact(ctx, input.memberUserId),
    managerEmails(ctx),
  ]);
  if (!contact) return;
  const timesheetUrl = `${appUrl()}/w/${input.workspaceId}/approvals`;
  const events: MailEvent[] = [];
  for (const email of emails) {
    if (email === contact.email) continue;
    events.push({
      type: 'timesheet.submitted',
      email,
      memberName: contact.name,
      workspaceName: name,
      weekStart: input.weekStart,
      timesheetUrl,
    });
  }
  await notifyAll(events);
}

export async function notifyTimesheetDecision(
  ctx: AuthorizedContext,
  input: {
    memberUserId: string;
    weekStart: string;
    workspaceId: string;
    decision: 'approved' | 'rejected';
    note?: string | undefined;
  },
): Promise<void> {
  const [name, contact] = await Promise.all([
    workspaceName(ctx),
    userContact(ctx, input.memberUserId),
  ]);
  if (!contact) return;
  const timesheetUrl = `${appUrl()}/w/${input.workspaceId}/time`;
  if (input.decision === 'approved') {
    await notifyAll([
      {
        type: 'timesheet.approved',
        email: contact.email,
        workspaceName: name,
        weekStart: input.weekStart,
        timesheetUrl,
      },
    ]);
    return;
  }
  await notifyAll([
    {
      type: 'timesheet.rejected',
      email: contact.email,
      workspaceName: name,
      weekStart: input.weekStart,
      note: input.note ?? 'Rejected',
      timesheetUrl,
    },
  ]);
}

export async function notifyInvoiceStatus(
  ctx: AuthorizedContext,
  input: { userId: string; invoiceNumber: string; status: string; workspaceId: string },
): Promise<void> {
  const [name, contact] = await Promise.all([workspaceName(ctx), userContact(ctx, input.userId)]);
  if (!contact) return;
  await notifyAll([
    {
      type: 'invoice.status',
      email: contact.email,
      workspaceName: name,
      invoiceNumber: input.invoiceNumber,
      status: input.status,
      invoiceUrl: `${appUrl()}/w/${input.workspaceId}/invoices`,
    },
  ]);
}
