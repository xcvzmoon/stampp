import { describe, expect, it } from 'vite-plus/test';
import {
  generatePersonalAccessToken,
  hashPersonalAccessToken,
} from '~/server/utils/personalAccessTokens.ts';

describe('personal access tokens', () => {
  it('generates stpp_ tokens with stable hashes', () => {
    const first = generatePersonalAccessToken();
    expect(first.token.startsWith('stpp_')).toBe(true);
    expect(first.hash).toBe(hashPersonalAccessToken(first.token));
    const second = generatePersonalAccessToken();
    expect(second.token).not.toBe(first.token);
  });

  it('hashes tokens deterministically', () => {
    const token = 'stpp_example_token_value';
    expect(hashPersonalAccessToken(token)).toBe(hashPersonalAccessToken(token));
    expect(hashPersonalAccessToken(token)).toHaveLength(64);
  });
});
