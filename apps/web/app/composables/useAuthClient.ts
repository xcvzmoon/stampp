import { organizationClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';

export function useAuthClient() {
  const config = useRuntimeConfig();
  return createAuthClient({
    baseURL: config.public.authBaseURL,
    fetchOptions: {
      credentials: 'include',
      headers: import.meta.server ? useRequestHeaders(['cookie']) : undefined,
    },
    plugins: [organizationClient(), twoFactorClient()],
  });
}
