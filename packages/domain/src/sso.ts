export type SsoProviderStatus = 'enabled' | 'disabled';

/** Stable OAuth/OIDC provider id used in sign-in callbacks. */
export function isValidSsoProviderId(providerId: string): boolean {
  return /^[a-z][a-z0-9-]{2,39}$/.test(providerId);
}

export function isValidIssuerUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url.hostname));
}

export function normalizeAllowedEmailDomains(input: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const raw of input) {
    const domain = raw.trim().toLowerCase();
    if (domain.length === 0) continue;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
      continue;
    }
    unique.add(domain);
  }
  return [...unique];
}

/** Empty allow-list means any email domain may sign in through this provider. */
export function emailMatchesAllowedDomains(
  email: string,
  allowedDomains: readonly string[],
): boolean {
  if (allowedDomains.length === 0) {
    return true;
  }
  const at = email.lastIndexOf('@');
  if (at < 0) {
    return false;
  }
  const domain = email.slice(at + 1).toLowerCase();
  return allowedDomains.includes(domain);
}

export function ssoDiscoveryUrl(issuer: string): string {
  return `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
}

function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
