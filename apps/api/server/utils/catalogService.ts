import type { AuthorizedContext } from '@stampp/access';
import type {
  ClientDto,
  CreateClientInput,
  CreateProjectInput,
  CreateTagInput,
  CreateTaskInput,
  ListResult,
  ProjectDto,
  TagDto,
  TaskDto,
  UpdateClientInput,
  UpdateProjectInput,
  UpdateTagInput,
  UpdateTaskInput,
} from '@stampp/shared';
import { clients, projects, tags, tasks } from '@stampp/database';
import { ERROR_CODES } from '@stampp/shared';
import { and, asc, eq, gt, ilike, isNull } from 'drizzle-orm';
import { toApiError } from '~/server/middleware/request-id.ts';
import { recordAudit } from '~/server/utils/audit.ts';
import {
  hasAtLeastOneField,
  isUniqueViolation,
  toClientDto,
  toProjectDto,
  toTagDto,
  toTaskDto,
} from '~/server/utils/catalog.ts';

type ListOptions = {
  limit: number;
  cursor?: string | undefined;
  search?: string | undefined;
};

type ProjectListOptions = ListOptions & {
  status?: 'active' | 'archived' | undefined;
  clientId?: string | undefined;
};

type CursorRow = {
  id: string;
};

function notFound(requestId: string, entity: string) {
  return toApiError(ERROR_CODES.NOT_FOUND, `${entity} not found`, requestId);
}

function conflict(requestId: string, message: string) {
  return toApiError(ERROR_CODES.CONFLICT, message, requestId);
}

function emptyUpdate(requestId: string) {
  return toApiError(ERROR_CODES.BAD_REQUEST, 'At least one field is required', requestId);
}

async function listWithCursor<TRow extends CursorRow>(
  options: ListOptions & { run: (cursorId: string | undefined) => Promise<TRow[]> },
): Promise<ListResult<TRow>> {
  const rows = await options.run(options.cursor);
  const page = rows.slice(0, options.limit);
  const last = page[page.length - 1];
  const nextCursor = rows.length > options.limit && last ? last.id : null;
  return { items: page, nextCursor };
}

export async function listClients(
  ctx: AuthorizedContext,
  options: ListOptions,
): Promise<ListResult<ClientDto>> {
  return listWithCursor({
    limit: options.limit,
    cursor: options.cursor,
    search: options.search,
    async run(cursorId) {
      const conditions = [eq(clients.workspaceId, ctx.workspaceId), isNull(clients.deletedAt)];
      if (cursorId) {
        conditions.push(gt(clients.id, cursorId));
      }
      if (options.search) {
        conditions.push(ilike(clients.name, `%${options.search}%`));
      }
      const rows = await ctx.db.client
        .select()
        .from(clients)
        .where(and(...conditions))
        .orderBy(asc(clients.id))
        .limit(options.limit + 1);
      return rows.map(toClientDto);
    },
  });
}

export async function getClient(
  ctx: AuthorizedContext,
  clientId: string,
  requestId: string,
): Promise<ClientDto> {
  const rows = await ctx.db.client
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, ctx.workspaceId),
        eq(clients.id, clientId),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw notFound(requestId, 'Client');
  }
  return toClientDto(row);
}

export async function createClient(
  ctx: AuthorizedContext,
  input: CreateClientInput,
  requestId: string,
): Promise<ClientDto> {
  try {
    const inserted = await ctx.db.client
      .insert(clients)
      .values({
        workspaceId: ctx.workspaceId,
        name: input.name,
        email: input.email ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create client', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'client.created',
      entityType: 'client',
      entityId: row.id,
      after: row,
    });
    return toClientDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(requestId, 'Client already exists');
    }
    throw error;
  }
}

export async function updateClient(
  ctx: AuthorizedContext,
  clientId: string,
  input: UpdateClientInput,
  requestId: string,
): Promise<ClientDto> {
  if (!hasAtLeastOneField(input)) {
    throw emptyUpdate(requestId);
  }

  const before = await getClient(ctx, clientId, requestId);

  const patch: Partial<typeof clients.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.email !== undefined) patch.email = input.email;
  if (input.address !== undefined) patch.address = input.address;
  if (input.notes !== undefined) patch.notes = input.notes;

  const updated = await ctx.db.client
    .update(clients)
    .set(patch)
    .where(
      and(
        eq(clients.workspaceId, ctx.workspaceId),
        eq(clients.id, clientId),
        isNull(clients.deletedAt),
      ),
    )
    .returning();
  const row = updated[0];
  if (!row) {
    throw notFound(requestId, 'Client');
  }

  await recordAudit(ctx, requestId, {
    action: 'client.updated',
    entityType: 'client',
    entityId: row.id,
    before,
    after: row,
  });
  return toClientDto(row);
}

export async function archiveClient(
  ctx: AuthorizedContext,
  clientId: string,
  requestId: string,
): Promise<void> {
  const before = await getClient(ctx, clientId, requestId);
  const updated = await ctx.db.client
    .update(clients)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(clients.workspaceId, ctx.workspaceId),
        eq(clients.id, clientId),
        isNull(clients.deletedAt),
      ),
    )
    .returning({ id: clients.id });
  if (!updated[0]) {
    throw notFound(requestId, 'Client');
  }
  await recordAudit(ctx, requestId, {
    action: 'client.archived',
    entityType: 'client',
    entityId: clientId,
    before,
  });
}

export async function listProjects(
  ctx: AuthorizedContext,
  options: ProjectListOptions,
): Promise<ListResult<ProjectDto>> {
  return listWithCursor({
    limit: options.limit,
    cursor: options.cursor,
    search: options.search,
    async run(cursorId) {
      const conditions = [eq(projects.workspaceId, ctx.workspaceId), isNull(projects.deletedAt)];
      if (cursorId) {
        conditions.push(gt(projects.id, cursorId));
      }
      if (options.status) {
        conditions.push(eq(projects.status, options.status));
      }
      if (options.clientId) {
        conditions.push(eq(projects.clientId, options.clientId));
      }
      if (options.search) {
        conditions.push(ilike(projects.name, `%${options.search}%`));
      }
      const rows = await ctx.db.client
        .select()
        .from(projects)
        .where(and(...conditions))
        .orderBy(asc(projects.id))
        .limit(options.limit + 1);
      return rows.map(toProjectDto);
    },
  });
}

export async function getProject(
  ctx: AuthorizedContext,
  projectId: string,
  requestId: string,
): Promise<ProjectDto> {
  const rows = await ctx.db.client
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw notFound(requestId, 'Project');
  }
  return toProjectDto(row);
}

async function assertClientExists(
  ctx: AuthorizedContext,
  clientId: string,
  requestId: string,
): Promise<void> {
  const rows = await ctx.db.client
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.workspaceId, ctx.workspaceId),
        eq(clients.id, clientId),
        isNull(clients.deletedAt),
      ),
    )
    .limit(1);
  if (!rows[0]) {
    throw notFound(requestId, 'Client');
  }
}

export async function createProject(
  ctx: AuthorizedContext,
  input: CreateProjectInput,
  requestId: string,
): Promise<ProjectDto> {
  if (input.clientId) {
    await assertClientExists(ctx, input.clientId, requestId);
  }

  try {
    const inserted = await ctx.db.client
      .insert(projects)
      .values({
        workspaceId: ctx.workspaceId,
        clientId: input.clientId ?? null,
        name: input.name,
        code: input.code ?? null,
        color: input.color ?? null,
        billable: input.billable ?? true,
        notes: input.notes ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create project', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'project.created',
      entityType: 'project',
      entityId: row.id,
      after: row,
    });
    return toProjectDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(requestId, 'Project code already exists in this workspace');
    }
    throw error;
  }
}

export async function updateProject(
  ctx: AuthorizedContext,
  projectId: string,
  input: UpdateProjectInput,
  requestId: string,
): Promise<ProjectDto> {
  if (!hasAtLeastOneField(input)) {
    throw emptyUpdate(requestId);
  }

  const before = await getProject(ctx, projectId, requestId);
  if (input.clientId) {
    await assertClientExists(ctx, input.clientId, requestId);
  }

  const patch: Partial<typeof projects.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.clientId !== undefined) patch.clientId = input.clientId;
  if (input.code !== undefined) patch.code = input.code;
  if (input.color !== undefined) patch.color = input.color;
  if (input.status !== undefined) patch.status = input.status;
  if (input.billable !== undefined) patch.billable = input.billable;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.budgetMinutes !== undefined) patch.budgetMinutes = input.budgetMinutes;
  if (input.budgetAmountMinor !== undefined) patch.budgetAmountMinor = input.budgetAmountMinor;
  if (input.budgetCurrency !== undefined) patch.budgetCurrency = input.budgetCurrency;
  if (input.budgetAlertAtPercent !== undefined) {
    patch.budgetAlertAtPercent = input.budgetAlertAtPercent;
  }

  try {
    const updated = await ctx.db.client
      .update(projects)
      .set(patch)
      .where(
        and(
          eq(projects.workspaceId, ctx.workspaceId),
          eq(projects.id, projectId),
          isNull(projects.deletedAt),
        ),
      )
      .returning();
    const row = updated[0];
    if (!row) {
      throw notFound(requestId, 'Project');
    }
    await recordAudit(ctx, requestId, {
      action: 'project.updated',
      entityType: 'project',
      entityId: row.id,
      before,
      after: row,
    });
    return toProjectDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(requestId, 'Project code already exists in this workspace');
    }
    throw error;
  }
}

export async function archiveProject(
  ctx: AuthorizedContext,
  projectId: string,
  requestId: string,
): Promise<void> {
  const before = await getProject(ctx, projectId, requestId);
  const updated = await ctx.db.client
    .update(projects)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(projects.workspaceId, ctx.workspaceId),
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
      ),
    )
    .returning({ id: projects.id });
  if (!updated[0]) {
    throw notFound(requestId, 'Project');
  }
  await recordAudit(ctx, requestId, {
    action: 'project.archived',
    entityType: 'project',
    entityId: projectId,
    before,
  });
}

export async function listProjectTasks(
  ctx: AuthorizedContext,
  projectId: string,
  options: ListOptions,
  requestId: string,
): Promise<ListResult<TaskDto>> {
  await getProject(ctx, projectId, requestId);

  return listWithCursor({
    limit: options.limit,
    cursor: options.cursor,
    search: options.search,
    async run(cursorId) {
      const conditions = [
        eq(tasks.workspaceId, ctx.workspaceId),
        eq(tasks.projectId, projectId),
        isNull(tasks.deletedAt),
      ];
      if (cursorId) {
        conditions.push(gt(tasks.id, cursorId));
      }
      if (options.search) {
        conditions.push(ilike(tasks.name, `%${options.search}%`));
      }
      const rows = await ctx.db.client
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(asc(tasks.id))
        .limit(options.limit + 1);
      return rows.map(toTaskDto);
    },
  });
}

async function assertProjectActive(
  ctx: AuthorizedContext,
  projectId: string,
  requestId: string,
): Promise<ProjectDto> {
  const project = await getProject(ctx, projectId, requestId);
  if (project.status !== 'active') {
    throw toApiError(
      ERROR_CODES.PROJECT_NOT_ACTIVE,
      'Project is archived and cannot accept task changes',
      requestId,
    );
  }
  return project;
}

export async function createTask(
  ctx: AuthorizedContext,
  projectId: string,
  input: CreateTaskInput,
  requestId: string,
): Promise<TaskDto> {
  await assertProjectActive(ctx, projectId, requestId);

  try {
    const inserted = await ctx.db.client
      .insert(tasks)
      .values({
        workspaceId: ctx.workspaceId,
        projectId,
        name: input.name,
        estimateMinutes: input.estimateMinutes ?? null,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create task', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'task.created',
      entityType: 'task',
      entityId: row.id,
      after: row,
    });
    return toTaskDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(requestId, 'Task name already exists in this project');
    }
    throw error;
  }
}

async function getTask(
  ctx: AuthorizedContext,
  taskId: string,
  requestId: string,
): Promise<TaskDto> {
  const rows = await ctx.db.client
    .select()
    .from(tasks)
    .where(
      and(eq(tasks.workspaceId, ctx.workspaceId), eq(tasks.id, taskId), isNull(tasks.deletedAt)),
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw notFound(requestId, 'Task');
  }
  return toTaskDto(row);
}

export async function updateTask(
  ctx: AuthorizedContext,
  taskId: string,
  input: UpdateTaskInput,
  requestId: string,
): Promise<TaskDto> {
  if (!hasAtLeastOneField(input)) {
    throw emptyUpdate(requestId);
  }

  const before = await getTask(ctx, taskId, requestId);
  if (input.status === 'active') {
    await assertProjectActive(ctx, before.projectId, requestId);
  }

  const patch: Partial<typeof tasks.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.status !== undefined) patch.status = input.status;
  if (input.estimateMinutes !== undefined) patch.estimateMinutes = input.estimateMinutes;

  try {
    const updated = await ctx.db.client
      .update(tasks)
      .set(patch)
      .where(
        and(eq(tasks.workspaceId, ctx.workspaceId), eq(tasks.id, taskId), isNull(tasks.deletedAt)),
      )
      .returning();
    const row = updated[0];
    if (!row) {
      throw notFound(requestId, 'Task');
    }
    await recordAudit(ctx, requestId, {
      action: 'task.updated',
      entityType: 'task',
      entityId: row.id,
      before,
      after: row,
    });
    return toTaskDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(requestId, 'Task name already exists in this project');
    }
    throw error;
  }
}

export async function archiveTask(
  ctx: AuthorizedContext,
  taskId: string,
  requestId: string,
): Promise<void> {
  const before = await getTask(ctx, taskId, requestId);
  const updated = await ctx.db.client
    .update(tasks)
    .set({ deletedAt: new Date() })
    .where(
      and(eq(tasks.workspaceId, ctx.workspaceId), eq(tasks.id, taskId), isNull(tasks.deletedAt)),
    )
    .returning({ id: tasks.id });
  if (!updated[0]) {
    throw notFound(requestId, 'Task');
  }
  await recordAudit(ctx, requestId, {
    action: 'task.archived',
    entityType: 'task',
    entityId: taskId,
    before,
  });
}

export async function listTags(
  ctx: AuthorizedContext,
  options: ListOptions,
): Promise<ListResult<TagDto>> {
  return listWithCursor({
    limit: options.limit,
    cursor: options.cursor,
    search: options.search,
    async run(cursorId) {
      const conditions = [eq(tags.workspaceId, ctx.workspaceId), isNull(tags.deletedAt)];
      if (cursorId) {
        conditions.push(gt(tags.id, cursorId));
      }
      if (options.search) {
        conditions.push(ilike(tags.name, `%${options.search}%`));
      }
      const rows = await ctx.db.client
        .select()
        .from(tags)
        .where(and(...conditions))
        .orderBy(asc(tags.id))
        .limit(options.limit + 1);
      return rows.map(toTagDto);
    },
  });
}

export async function getTag(
  ctx: AuthorizedContext,
  tagId: string,
  requestId: string,
): Promise<TagDto> {
  const rows = await ctx.db.client
    .select()
    .from(tags)
    .where(and(eq(tags.workspaceId, ctx.workspaceId), eq(tags.id, tagId), isNull(tags.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw notFound(requestId, 'Tag');
  }
  return toTagDto(row);
}

export async function createTag(
  ctx: AuthorizedContext,
  input: CreateTagInput,
  requestId: string,
): Promise<TagDto> {
  try {
    const inserted = await ctx.db.client
      .insert(tags)
      .values({
        workspaceId: ctx.workspaceId,
        name: input.name,
      })
      .returning();
    const row = inserted[0];
    if (!row) {
      throw toApiError(ERROR_CODES.INTERNAL, 'Failed to create tag', requestId);
    }
    await recordAudit(ctx, requestId, {
      action: 'tag.created',
      entityType: 'tag',
      entityId: row.id,
      after: row,
    });
    return toTagDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(requestId, 'Tag name already exists in this workspace');
    }
    throw error;
  }
}

export async function updateTag(
  ctx: AuthorizedContext,
  tagId: string,
  input: UpdateTagInput,
  requestId: string,
): Promise<TagDto> {
  if (!hasAtLeastOneField(input)) {
    throw emptyUpdate(requestId);
  }

  const before = await getTag(ctx, tagId, requestId);
  try {
    const updated = await ctx.db.client
      .update(tags)
      .set({ name: input.name })
      .where(and(eq(tags.workspaceId, ctx.workspaceId), eq(tags.id, tagId), isNull(tags.deletedAt)))
      .returning();
    const row = updated[0];
    if (!row) {
      throw notFound(requestId, 'Tag');
    }
    await recordAudit(ctx, requestId, {
      action: 'tag.updated',
      entityType: 'tag',
      entityId: row.id,
      before,
      after: row,
    });
    return toTagDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(requestId, 'Tag name already exists in this workspace');
    }
    throw error;
  }
}

export async function archiveTag(
  ctx: AuthorizedContext,
  tagId: string,
  requestId: string,
): Promise<void> {
  const before = await getTag(ctx, tagId, requestId);
  const updated = await ctx.db.client
    .update(tags)
    .set({ deletedAt: new Date() })
    .where(and(eq(tags.workspaceId, ctx.workspaceId), eq(tags.id, tagId), isNull(tags.deletedAt)))
    .returning({ id: tags.id });
  if (!updated[0]) {
    throw notFound(requestId, 'Tag');
  }
  await recordAudit(ctx, requestId, {
    action: 'tag.archived',
    entityType: 'tag',
    entityId: tagId,
    before,
  });
}
