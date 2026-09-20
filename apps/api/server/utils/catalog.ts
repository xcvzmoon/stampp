import type { Client, Project, Tag, Task } from '@stampp/database';
import type {
  ClientDto,
  ListQuery,
  ProjectDto,
  TagDto,
  TaskDto,
  UpdateClientInput,
  UpdateProjectInput,
  UpdateTagInput,
  UpdateTaskInput,
} from '@stampp/shared';
import type { H3Event } from 'nitro';
import {
  createClientInputSchema,
  createProjectInputSchema,
  createTagInputSchema,
  createTaskInputSchema,
  DEFAULT_LIST_LIMIT,
  ERROR_CODES,
  listQuerySchema,
  updateClientInputSchema,
  updateProjectInputSchema,
  updateTagInputSchema,
  updateTaskInputSchema,
} from '@stampp/shared';
import * as v from 'valibot';
import { readEventRequestId, toApiError } from '~/server/middleware/request-id.ts';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

const databaseErrorSchema = v.object({
  code: v.optional(v.string()),
});

const jsonValueSchema: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.array(jsonValueSchema),
    v.record(v.string(), jsonValueSchema),
  ]),
);

export function getRequestId(event: H3Event): string {
  return readEventRequestId(event);
}

export function parseBody<TSchema extends v.GenericSchema>(
  schema: TSchema,
  input: JsonValue,
  requestId: string,
): v.InferOutput<TSchema> {
  const result = v.safeParse(schema, input);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Request body failed validation',
      requestId,
      result.issues,
    );
  }
  return result.output;
}

export function parseListQuery(
  query: URLSearchParams,
  requestId: string,
): Required<Pick<ListQuery, 'limit'>> & ListQuery {
  const raw: Record<string, string> = {};
  for (const key of ['limit', 'cursor', 'status', 'clientId', 'search']) {
    const value = query.get(key);
    if (value !== null) {
      raw[key] = value;
    }
  }

  const result = v.safeParse(listQuerySchema, raw);
  if (!result.success) {
    throw toApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'Query failed validation',
      requestId,
      result.issues,
    );
  }

  return {
    ...result.output,
    limit: result.output.limit ?? DEFAULT_LIST_LIMIT,
  };
}

export async function readJsonBody(event: { req: Request }, requestId: string): Promise<JsonValue> {
  let parsed: unknown;
  try {
    parsed = await event.req.json();
  } catch {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON body', requestId);
  }

  const result = v.safeParse(jsonValueSchema, parsed);
  if (!result.success) {
    throw toApiError(ERROR_CODES.BAD_REQUEST, 'Invalid JSON body', requestId);
  }
  return result.output;
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- Postgres catch-boundary classifier
export function isUniqueViolation(error: unknown): boolean {
  const result = v.safeParse(databaseErrorSchema, error);
  return result.success && result.output.code === '23505';
}

export function toClientDto(row: Client): ClientDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toProjectDto(row: Project): ProjectDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    clientId: row.clientId,
    name: row.name,
    code: row.code,
    color: row.color,
    status: row.status,
    billable: row.billable,
    notes: row.notes,
    budgetMinutes: row.budgetMinutes,
    budgetAmountMinor: row.budgetAmountMinor,
    budgetCurrency: row.budgetCurrency,
    budgetAlertAtPercent: row.budgetAlertAtPercent,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTaskDto(row: Task): TaskDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    name: row.name,
    status: row.status,
    estimateMinutes: row.estimateMinutes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toTagDto(row: Tag): TagDto {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function hasAtLeastOneField(
  input: UpdateClientInput | UpdateProjectInput | UpdateTaskInput | UpdateTagInput,
): boolean {
  return Object.keys(input).length > 0;
}

export const catalogSchemas = {
  createClient: createClientInputSchema,
  updateClient: updateClientInputSchema,
  createProject: createProjectInputSchema,
  updateProject: updateProjectInputSchema,
  createTask: createTaskInputSchema,
  updateTask: updateTaskInputSchema,
  createTag: createTagInputSchema,
  updateTag: updateTagInputSchema,
} as const;
