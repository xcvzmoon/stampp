import * as v from 'valibot';
import { idSchema } from './schemas.ts';

export const createPersonalAccessTokenInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  expiresAt: v.optional(v.nullable(v.string())),
});

export const personalAccessTokenDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  userId: v.string(),
  name: v.string(),
  lastUsedAt: v.nullable(v.string()),
  expiresAt: v.nullable(v.string()),
  revokedAt: v.nullable(v.string()),
  createdAt: v.string(),
});

export const personalAccessTokenCreatedSchema = v.object({
  token: v.string(),
  tokenDto: personalAccessTokenDtoSchema,
});

export const personalAccessTokenListSchema = v.object({
  items: v.array(personalAccessTokenDtoSchema),
});

export const revokePersonalAccessTokenParamsSchema = v.object({
  tokenId: idSchema,
});

export type CreatePersonalAccessTokenInput = v.InferOutput<
  typeof createPersonalAccessTokenInputSchema
>;
export type PersonalAccessTokenDto = v.InferOutput<typeof personalAccessTokenDtoSchema>;
export type PersonalAccessTokenCreated = v.InferOutput<typeof personalAccessTokenCreatedSchema>;
