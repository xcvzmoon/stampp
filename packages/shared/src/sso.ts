import {
  emailMatchesAllowedDomains,
  isValidIssuerUrl,
  isValidSsoProviderId,
  normalizeAllowedEmailDomains,
} from '@stampp/domain';
import * as v from 'valibot';

export const ssoProviderIdSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check(
    (input) => isValidSsoProviderId(input),
    'Provider id must be 3-40 lowercase letters, digits, or dashes',
  ),
);

export const ssoIssuerSchema = v.pipe(
  v.string(),
  v.trim(),
  v.check((input) => isValidIssuerUrl(input), 'Issuer must be https (or localhost http)'),
);

export const allowedEmailDomainsSchema = v.pipe(
  v.string(),
  v.transform((input) =>
    input
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  ),
  v.check((domains) => {
    const normalized = normalizeAllowedEmailDomains(domains);
    return domains.length === 0 || normalized.length === domains.length;
  }, 'Allowed email domains must be valid hostnames'),
  v.transform((domains) => normalizeAllowedEmailDomains(domains)),
);

export const createSsoProviderInputSchema = v.object({
  providerId: ssoProviderIdSchema,
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  issuer: ssoIssuerSchema,
  clientId: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  clientSecret: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(400)),
  scopes: v.optional(
    v.pipe(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), v.maxLength(20)),
  ),
  allowedEmailDomains: v.optional(allowedEmailDomainsSchema),
});

export const updateSsoProviderInputSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  issuer: v.optional(ssoIssuerSchema),
  clientId: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
  clientSecret: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(400))),
  scopes: v.optional(
    v.pipe(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), v.maxLength(20)),
  ),
  allowedEmailDomains: v.optional(allowedEmailDomainsSchema),
  status: v.optional(v.picklist(['enabled', 'disabled'])),
});

export const ssoProviderDtoSchema = v.object({
  id: v.string(),
  workspaceId: v.string(),
  providerId: v.string(),
  name: v.string(),
  issuer: v.string(),
  clientId: v.string(),
  scopes: v.array(v.string()),
  allowedEmailDomains: v.array(v.string()),
  status: v.picklist(['enabled', 'disabled']),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export const ssoProviderListResultSchema = v.object({
  items: v.array(ssoProviderDtoSchema),
});

export type CreateSsoProviderInput = v.InferOutput<typeof createSsoProviderInputSchema>;
export type UpdateSsoProviderInput = v.InferOutput<typeof updateSsoProviderInputSchema>;
export type SsoProviderDto = v.InferOutput<typeof ssoProviderDtoSchema>;

export { emailMatchesAllowedDomains };
