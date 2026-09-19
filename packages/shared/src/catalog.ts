import * as v from 'valibot';

export const entityNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Name is required'),
  v.maxLength(200),
);

export const projectCodeSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.maxLength(64),
  v.regex(/^[A-Za-z0-9._-]+$/, 'Code may contain letters, numbers, dots, underscores, and hyphens'),
);

export const hexColorSchema = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value like #3B82F6'),
);

export const projectStatusSchema = v.picklist(['active', 'archived']);
export const taskStatusSchema = v.picklist(['active', 'archived']);

export const optionalEmailSchema = v.optional(
  v.pipe(v.string(), v.trim(), v.email('Enter a valid email'), v.maxLength(320)),
);

export const nullableEmailSchema = v.optional(
  v.nullable(v.pipe(v.string(), v.trim(), v.email('Enter a valid email'), v.maxLength(320))),
);

export const createClientInputSchema = v.object({
  name: entityNameSchema,
  email: optionalEmailSchema,
  address: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(2000))),
  notes: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(5000))),
});

export const updateClientInputSchema = v.object({
  name: v.optional(entityNameSchema),
  email: nullableEmailSchema,
  address: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(2000)))),
  notes: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5000)))),
});

export const createProjectInputSchema = v.object({
  name: entityNameSchema,
  clientId: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))),
  code: v.optional(v.nullable(projectCodeSchema)),
  color: v.optional(v.nullable(hexColorSchema)),
  billable: v.optional(v.boolean()),
  notes: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(5000))),
});

export const updateProjectInputSchema = v.object({
  name: v.optional(entityNameSchema),
  clientId: v.optional(v.nullable(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))),
  code: v.optional(v.nullable(projectCodeSchema)),
  color: v.optional(v.nullable(hexColorSchema)),
  status: v.optional(projectStatusSchema),
  billable: v.optional(v.boolean()),
  notes: v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(5000)))),
});

export const createTaskInputSchema = v.object({
  name: entityNameSchema,
  estimateMinutes: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
});

export const updateTaskInputSchema = v.object({
  name: v.optional(entityNameSchema),
  status: v.optional(taskStatusSchema),
  estimateMinutes: v.optional(v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))),
});

export const tagNameSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1, 'Name is required'),
  v.maxLength(50),
);

export const createTagInputSchema = v.object({
  name: tagNameSchema,
});

export const updateTagInputSchema = v.object({
  name: tagNameSchema,
});

export const MAX_TIME_ENTRY_TAGS = 20;

export const tagIdsSchema = v.pipe(
  v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(128))),
  v.maxLength(MAX_TIME_ENTRY_TAGS),
  v.check((ids) => new Set(ids).size === ids.length, 'Tag ids must be unique'),
);

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 200;

export const listQuerySchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.transform((input) => Number(input)),
      v.integer('limit must be an integer'),
      v.minValue(1),
      v.maxValue(MAX_LIST_LIMIT),
    ),
  ),
  cursor: v.optional(v.pipe(v.string(), v.maxLength(128))),
  status: v.optional(v.picklist(['active', 'archived'])),
  clientId: v.optional(v.pipe(v.string(), v.maxLength(128))),
  search: v.optional(v.pipe(v.string(), v.maxLength(200))),
});

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const jsonValueSchema: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.array(jsonValueSchema),
    v.record(v.string(), jsonValueSchema),
  ]),
);

export type CreateClientInput = v.InferOutput<typeof createClientInputSchema>;
export type UpdateClientInput = v.InferOutput<typeof updateClientInputSchema>;
export type CreateProjectInput = v.InferOutput<typeof createProjectInputSchema>;
export type UpdateProjectInput = v.InferOutput<typeof updateProjectInputSchema>;
export type CreateTaskInput = v.InferOutput<typeof createTaskInputSchema>;
export type UpdateTaskInput = v.InferOutput<typeof updateTaskInputSchema>;
export type CreateTagInput = v.InferOutput<typeof createTagInputSchema>;
export type UpdateTagInput = v.InferOutput<typeof updateTagInputSchema>;
export type ListQuery = v.InferOutput<typeof listQuerySchema>;

export const clientDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  email: v.nullable(v.string()),
  address: v.nullable(v.string()),
  notes: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const projectDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  clientId: v.nullable(v.string()),
  name: v.string(),
  code: v.nullable(v.string()),
  color: v.nullable(v.string()),
  status: v.picklist(['active', 'archived']),
  billable: v.boolean(),
  notes: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const taskDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  projectId: v.string(),
  name: v.string(),
  status: v.picklist(['active', 'archived']),
  estimateMinutes: v.nullable(v.number()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const tagDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export function listResultSchema<TSchema extends v.GenericSchema>(itemSchema: TSchema) {
  return v.object({
    items: v.array(itemSchema),
    nextCursor: v.nullable(v.string()),
  });
}

export type ClientDto = v.InferOutput<typeof clientDtoSchema>;
export type ProjectDto = v.InferOutput<typeof projectDtoSchema>;
export type TaskDto = v.InferOutput<typeof taskDtoSchema>;
export type TagDto = v.InferOutput<typeof tagDtoSchema>;
export type ListResult<T> = {
  items: T[];
  nextCursor: string | null;
};
