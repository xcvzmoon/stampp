import { isValidHttpsUrl, isValidPemCertificate, isValidSamlEntityId } from '@stampp/domain';
import * as v from 'valibot';

export const samlEntityIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((input) => isValidSamlEntityId(input), 'Entity id must be 3-512 characters'),
);

export const samlEntryUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((input) => isValidHttpsUrl(input), 'SSO URL must be https (or localhost http)'),
);

export const samlCertificateSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((input) => isValidPemCertificate(input), 'Certificate must be a PEM X.509 certificate'),
);

export const createSamlProviderInputSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  entityId: samlEntityIdSchema,
  entryPoint: samlEntryUrlSchema,
  certificate: samlCertificateSchema,
  emailAttribute: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  allowedEmailDomains: v.optional(v.string()),
});

export const updateSamlProviderInputSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  entityId: v.optional(samlEntityIdSchema),
  entryPoint: v.optional(samlEntryUrlSchema),
  certificate: v.optional(samlCertificateSchema),
  emailAttribute: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  allowedEmailDomains: v.optional(v.string()),
  status: v.optional(v.picklist(['enabled', 'disabled'])),
});

export const samlProviderDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  name: v.string(),
  entityId: v.string(),
  entryPoint: v.string(),
  emailAttribute: v.string(),
  allowedEmailDomains: v.array(v.string()),
  status: v.picklist(['enabled', 'disabled']),
  metadataUrl: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const samlProviderListResultSchema = v.object({
  items: v.array(samlProviderDtoSchema),
});

export type CreateSamlProviderInput = v.InferOutput<typeof createSamlProviderInputSchema>;
export type UpdateSamlProviderInput = v.InferOutput<typeof updateSamlProviderInputSchema>;
export type SamlProviderDto = v.InferOutput<typeof samlProviderDtoSchema>;
