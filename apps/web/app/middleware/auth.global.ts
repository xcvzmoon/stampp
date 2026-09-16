export default defineNuxtRouteMiddleware(async (to) => {
  const isPublic = to.path === '/sign-in' || to.path === '/sign-up' || to.path === '/';
  if (isPublic) {
    return;
  }

  const client = useAuthClient();
  const { data } = await client.useSession(useFetch);
  if (!data.value) {
    return navigateTo({ path: '/sign-in', query: { next: to.fullPath } });
  }
});
