<script setup lang="ts">
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');

  onMounted(async () => {
    if (workspaceId.value) {
      await client.organization.setActive({ organizationId: workspaceId.value });
    }
    await navigateTo(`/w/${workspaceId.value}/time`);
  });
</script>

<template>
  <main class="flex min-h-svh items-center justify-center">
    <p class="text-sm text-muted">Opening workspace…</p>
  </main>
</template>
