import { definePlugin } from 'nitro';
import { resetAuth } from '~/server/utils/auth.ts';
import { ENV } from '~/server/utils/env.ts';
import { loadEnabledSsoProviderConfigs } from '~/server/utils/ssoStore.ts';

export default definePlugin(() => {
  if (ENV.APP_ENV === 'test') {
    return;
  }
  void loadEnabledSsoProviderConfigs()
    .then(() => {
      resetAuth();
    })
    .catch((error) => {
      console.error('[sso] provider preload failed: %s', error);
    });
});
