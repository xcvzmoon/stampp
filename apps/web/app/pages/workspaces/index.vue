<script setup lang="ts">
  type Workspace = {
    id: string;
    name: string;
    slug: string;
  };

  const client = useAuthClient();
  const { data: session } = await client.useSession(useFetch);
  const organizations = client.useListOrganizations();

  const workspaces = computed(() => organizations.value.data ?? []);
  const listError = computed(() => organizations.value.error?.message ?? null);

  const activeWorkspaceId = computed(() => {
    const sessionData = session.value;
    if (!sessionData?.session) return null;
    return sessionData.session.activeOrganizationId ?? null;
  });

  async function enterWorkspace(workspace: Workspace) {
    await client.organization.setActive({ organizationId: workspace.id });
    await navigateTo(`/w/${workspace.id}/projects`);
  }

  async function signOut() {
    await client.signOut();
    await navigateTo('/sign-in');
  }
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-8 px-4 py-12">
    <header class="flex items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">Workspaces</h1>
        <p class="text-sm text-muted">Signed in as {{ session?.user?.email }}.</p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        @click="signOut"
      >
        Sign out
      </UButton>
    </header>

    <UAlert
      v-if="listError"
      color="error"
      variant="subtle"
      title="Could not load workspaces"
      :description="listError"
    />

    <section
      v-if="workspaces.length === 0 && !listError"
      class="space-y-4"
    >
      <UCard>
        <div class="space-y-3">
          <h2 class="text-lg font-medium text-highlighted">Create your first workspace</h2>
          <p class="text-sm text-muted">
            Bring your projects, clients, and time entries together in one place.
          </p>
          <UButton to="/workspaces/new"> Create workspace </UButton>
        </div>
      </UCard>
    </section>

    <section
      v-else
      class="space-y-3"
    >
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-muted">Your workspaces</h2>
        <UButton
          to="/workspaces/new"
          size="sm"
          variant="soft"
        >
          New workspace
        </UButton>
      </div>

      <ul class="divide-y divide-default rounded-lg border border-default">
        <li
          v-for="workspace in workspaces"
          :key="workspace.id"
          class="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium text-highlighted">
              {{ workspace.name }}
            </p>
            <p class="truncate text-sm text-muted">
              {{ workspace.slug }}
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <UBadge
              v-if="workspace.id === activeWorkspaceId"
              color="primary"
              variant="subtle"
            >
              Active
            </UBadge>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              @click="enterWorkspace(workspace)"
            >
              Open
            </UButton>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
