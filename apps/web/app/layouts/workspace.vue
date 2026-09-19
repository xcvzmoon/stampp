<script setup lang="ts">
  const route = useRoute();
  const client = useAuthClient();
  const { data: session } = await client.useSession(useFetch);

  const workspaceId = useRouteParam('workspaceId');

  const navItems = computed(() => [
    {
      label: 'Time',
      to: `/w/${workspaceId.value}/time`,
      active: route.path.startsWith(`/w/${workspaceId.value}/time`),
    },
    {
      label: 'Projects',
      to: `/w/${workspaceId.value}/projects`,
      active: route.path.startsWith(`/w/${workspaceId.value}/projects`),
    },
    {
      label: 'Clients',
      to: `/w/${workspaceId.value}/clients`,
      active: route.path.startsWith(`/w/${workspaceId.value}/clients`),
    },
    {
      label: 'Tags',
      to: `/w/${workspaceId.value}/tags`,
      active: route.path.startsWith(`/w/${workspaceId.value}/tags`),
    },
    {
      label: 'Team',
      to: `/w/${workspaceId.value}/team`,
      active: route.path.startsWith(`/w/${workspaceId.value}/team`),
    },
    {
      label: 'Reports',
      to: `/w/${workspaceId.value}/reports`,
      active: route.path.startsWith(`/w/${workspaceId.value}/reports`),
    },
  ]);

  async function signOut() {
    await client.signOut();
    await navigateTo('/sign-in');
  }
</script>

<template>
  <div class="min-h-svh bg-default">
    <header class="border-b border-default">
      <div class="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <div class="flex min-w-0 items-center gap-6">
          <ULink
            to="/workspaces"
            class="shrink-0 text-sm font-semibold text-highlighted"
          >
            Stampp
          </ULink>
          <nav class="flex items-center gap-1">
            <UButton
              v-for="item in navItems"
              :key="item.to"
              :to="item.to"
              size="sm"
              color="neutral"
              :variant="item.active ? 'soft' : 'ghost'"
            >
              {{ item.label }}
            </UButton>
          </nav>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <p class="hidden text-sm text-muted sm:block">{{ session?.user?.email }}</p>
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            @click="signOut"
          >
            Sign out
          </UButton>
        </div>
      </div>
    </header>

    <GlobalTimer :workspace-id="workspaceId" />

    <main class="mx-auto w-full max-w-6xl px-4 py-8">
      <NuxtPage />
    </main>
  </div>
</template>
