import { describe, expect, it } from 'vite-plus/test';
import {
  isValidHttpsUrl,
  isValidPemCertificate,
  isValidSamlEntityId,
  normalizePemCertificate,
  samlAcsPath,
} from '../src/saml.ts';

describe('saml domain rules', () => {
  it('validates entity ids and entry points', () => {
    expect(isValidSamlEntityId('urn:example:idp')).toBe(true);
    expect(isValidSamlEntityId('x')).toBe(false);
    expect(isValidHttpsUrl('https://idp.example/sso')).toBe(true);
    expect(isValidHttpsUrl('http://evil.example')).toBe(false);
  });

  it('normalizes PEM certificates', () => {
    const body = 'A'.repeat(80);
    const normalized = normalizePemCertificate(body);
    expect(normalized.startsWith('-----BEGIN CERTIFICATE-----')).toBe(true);
    expect(isValidPemCertificate(normalized)).toBe(true);
    expect(isValidPemCertificate('not-a-cert')).toBe(false);
    expect(samlAcsPath('samlp_1')).toBe('/api/auth/saml/samlp_1/acs');
  });
});
