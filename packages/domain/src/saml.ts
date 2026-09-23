/** SAML service-provider rules shared by admin and ACS endpoints. */

export function isValidSamlEntityId(entityId: string): boolean {
  return entityId.trim().length >= 3 && entityId.trim().length <= 512;
}

export function isValidHttpsUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url.hostname));
}

/** PEM X.509 certificate (with or without armor) used to verify IdP signatures. */
export function isValidPemCertificate(value: string): boolean {
  const normalized = value.trim();
  if (normalized.includes('-----BEGIN CERTIFICATE-----')) {
    return /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(normalized);
  }
  return /^[A-Za-z0-9+/=\s]{64,8000}$/.test(normalized);
}

export function normalizePemCertificate(value: string): string {
  const trimmed = value.trim();
  if (trimmed.includes('-----BEGIN CERTIFICATE-----')) {
    return trimmed;
  }
  const body = trimmed.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

export function samlAcsPath(providerRowId: string): string {
  return `/api/auth/saml/${providerRowId}/acs`;
}

export function samlMetadataPath(providerRowId: string): string {
  return `/api/auth/saml/${providerRowId}/metadata`;
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
