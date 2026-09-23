import * as v from 'valibot';

export const scimUserSchema = v.looseObject({
  schemas: v.array(v.string()),
  externalId: v.optional(v.string()),
  userName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  name: v.optional(
    v.object({
      givenName: v.optional(v.string()),
      familyName: v.optional(v.string()),
    }),
  ),
  emails: v.optional(
    v.array(
      v.object({
        value: v.pipe(v.string(), v.email()),
        type: v.optional(v.string()),
        primary: v.optional(v.boolean()),
      }),
    ),
  ),
  active: v.optional(v.boolean()),
});

export const scimGroupSchema = v.looseObject({
  schemas: v.array(v.string()),
  externalId: v.optional(v.string()),
  displayName: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
  members: v.optional(
    v.array(
      v.object({
        value: v.string(),
        display: v.optional(v.string()),
      }),
    ),
  ),
});

export const scimPatchSchema = v.looseObject({
  schemas: v.array(v.string()),
  Operations: v.array(
    v.object({
      op: v.picklist(['add', 'replace', 'remove']),
      path: v.optional(v.string()),
      value: v.optional(v.unknown()),
    }),
  ),
});

export const scimTokenCreateInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
});

export const scimTokenDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  prefix: v.string(),
  lastUsedAt: v.nullable(v.string()),
  revokedAt: v.nullable(v.string()),
  createdAt: v.string(),
});

export const scimTokenCreatedSchema = v.object({
  token: v.string(),
  tokenDto: scimTokenDtoSchema,
});

export const scimTokenListResultSchema = v.object({
  items: v.array(scimTokenDtoSchema),
});

export type ScimUserInput = v.InferOutput<typeof scimUserSchema>;
export type ScimGroupInput = v.InferOutput<typeof scimGroupSchema>;
export type ScimPatchInput = v.InferOutput<typeof scimPatchSchema>;
export type ScimTokenCreateInput = v.InferOutput<typeof scimTokenCreateInputSchema>;
export type ScimTokenDto = v.InferOutput<typeof scimTokenDtoSchema>;
export type ScimTokenCreated = v.InferOutput<typeof scimTokenCreatedSchema>;
