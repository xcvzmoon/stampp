<script setup lang="ts">
  const client = useAuthClient();

  const name = ref('');
  const slug = ref('');
  const slugTouched = ref(false);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  watch(name, (value) => {
    if (slugTouched.value) return;
    slug.value = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  });

  async function createWorkspace() {
    loading.value = true;
    errorMessage.value = null;

    const { data, error } = await client.organization.create({
      name: name.value,
      slug: slug.value,
    });

    loading.value = false;

    if (error) {
      errorMessage.value = error.message ?? 'Could not create workspace';
      return;
    }

    if (data?.id) {
      await client.organization.setActive({ organizationId: data.id });
    }

    await navigateTo('/workspaces');
  }
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
    <header class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold text-highlighted">Create workspace</h1>
      <p class="text-sm text-muted">
        Name it after your company or team. You can invite members later.
      </p>
    </header>

    <UCard>
      <form
        class="space-y-4"
        @submit.prevent="createWorkspace"
      >
        <UFormField
          label="Workspace name"
          required
        >
          <UInput
            v-model="name"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField
          label="Slug"
          required
          help="Used in URLs. Lowercase letters, numbers, and hyphens."
        >
          <UInput
            v-model="slug"
            class="w-full"
            required
            @update:model-value="slugTouched = true"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
        >
          Create workspace
        </UButton>
      </form>
    </UCard>

    <p class="text-center text-sm text-muted">
      <ULink
        to="/workspaces"
        class="font-medium text-primary"
      >
        Back to workspaces
      </ULink>
    </p>
  </main>
</template>
