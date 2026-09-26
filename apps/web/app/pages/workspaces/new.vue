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
  <main
    class="auth-page mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-7 px-4 py-12 sm:px-6"
  >
    <ULink
      to="/"
      class="flex w-fit items-center gap-2.5 text-highlighted"
    >
      <span
        class="brand-mark"
        aria-hidden="true"
        >S</span
      >
      <span class="text-base font-semibold tracking-tight">Stampp</span>
    </ULink>
    <header class="space-y-2 text-center">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Create workspace</h1>
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
