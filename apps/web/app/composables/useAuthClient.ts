import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/vue';

export function useAuthClient() {
  const config = useRuntimeConfig();
  return createAuthClient({
    baseURL: config.public.authBaseURL,
    plugins: [organizationClient()],
  });
}
