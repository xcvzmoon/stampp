/* oxlint-disable anti-slop/no-unsafe-dictionary-type -- SCIM 2.0 wire payloads are open JSON objects. */
export const SCIM_CONTENT_TYPE = 'application/scim+json';

export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User';
export const SCIM_GROUP_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:Group';
export const SCIM_LIST_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:ListResponse';
export const SCIM_ERROR_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:Error';
export const SCIM_PATCH_OP_SCHEMA = 'urn:ietf:params:scim:api:messages:2.0:PatchOp';

export function isValidScimExternalId(externalId: string): boolean {
  return externalId.trim().length >= 1 && externalId.trim().length <= 128;
}

export function scimUserNameFromEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function scimMeta(
  resourceType: 'User' | 'Group',
  id: string,
  created: Date,
  lastModified: Date,
) {
  return {
    resourceType,
    id,
    created: created.toISOString(),
    lastModified: lastModified.toISOString(),
    location: `/scim/v2/${resourceType}s/${id}`,
  };
}

export type ScimResourceDto = Record<string, unknown>;

export function scimListResponse(
  resourceType: 'User' | 'Group',
  resources: ScimResourceDto[],
  totalResults: number,
  startIndex = 1,
  _count = 100,
) {
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults,
    startIndex,
    count: resources.length,
    Resources: resources,
  };
}

export function scimError(status: number, scimType: string | null, detail: string) {
  return {
    schemas: [SCIM_ERROR_SCHEMA],
    status: String(status),
    scimType,
    detail,
  };
}

/** Very small `filter` support: `userName eq "x"` / `externalId eq "x"` / `emails.value eq "x"`. */
export type ScimUserFilter =
  | { field: 'userName'; value: string }
  | { field: 'externalId'; value: string }
  | { field: 'emails.value'; value: string }
  | null;

export function parseScimUserFilter(filter: string | null | undefined): ScimUserFilter {
  if (!filter) {
    return null;
  }
  const match = /^\s*(userName|externalId|emails\.value)\s+eq\s+"([^"]+)"\s*$/i.exec(filter);
  if (!match) {
    return null;
  }
  const field = (match[1] ?? '').toLowerCase();
  const value = match[2] ?? '';
  if (field === 'username') return { field: 'userName', value };
  if (field === 'externalid') return { field: 'externalId', value };
  return { field: 'emails.value', value };
}
