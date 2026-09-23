import { describe, expect, it } from 'vite-plus/test';
import {
  emailMatchesAllowedDomains,
  isValidIssuerUrl,
  isValidSsoProviderId,
  normalizeAllowedEmailDomains,
  ssoDiscoveryUrl,
} from '../src/sso.ts';

describe('sso domain rules', () => {
  it('validates provider ids and issuers', () => {
    expect(isValidSsoProviderId('okta-acme')).toBe(true);
    expect(isValidSsoProviderId('Okta')).toBe(false);
    expect(isValidIssuerUrl('https://dev-123.okta.com')).toBe(true);
    expect(isValidIssuerUrl('http://localhost:8080')).toBe(true);
    expect(isValidIssuerUrl('http://evil.example')).toBe(false);
    expect(ssoDiscoveryUrl('https://issuer.example/')).toBe(
      'https://issuer.example/.well-known/openid-configuration',
    );
  });

  it('normalizes and matches allowed email domains', () => {
    expect(normalizeAllowedEmailDomains(['Acme.COM', 'acme.com', 'ACME.io'])).toEqual([
      'acme.com',
      'acme.io',
    ]);
    expect(emailMatchesAllowedDomains('a@acme.com', [])).toBe(true);
    expect(emailMatchesAllowedDomains('a@acme.com', ['acme.com'])).toBe(true);
    expect(emailMatchesAllowedDomains('a@other.com', ['acme.com'])).toBe(false);
  });
});
