<script setup lang="ts">
  import type { ScimTokenDto } from '@stampp/shared';
  import { scimTokenCreatedSchema, scimTokenListResultSchema } from '@stampp/shared';

  const route = useRoute();
  const workspaceId = computed(() => String(route.params.workspaceId));
  const { apiFetch, apiSend } = useApi();

  const tokens = shallowRef<ScimTokenDto[]>([]);
  const errorMessage = shallowRef('');
  const createdToken = shallowRef('');
  const name = shallowRef('');

  async function load() {
    errorMessage.value = '';
    try {
      const result = await apiFetch(
        scimTokenListResultSchema,
        `/workspaces/${workspaceId.value}/scim/tokens`,
      );
      tokens.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load SCIM tokens';
    }
  }

  async function createToken() {
    try {
      const result = await apiFetch(
        scimTokenCreatedSchema,
        `/workspaces/${workspaceId.value}/scim/tokens`,
        {
          method: 'POST',
          body: JSON.stringify({ name: name.value }),
        },
      );
      createdToken.value = result.token;
      name.value = '';
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not create SCIM token';
    }
  }

  async function revokeToken(token: ScimTokenDto) {
    try {
      await apiSend(`/workspaces/${workspaceId.value}/scim/tokens/${token.id}`, {
        method: 'DELETE',
      });
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not revoke SCIM token';
    }
  }

  onMounted(load);
</script>

<template>
  <UContainer class="space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-highlighted">SCIM</h1>
      <p class="text-sm text-muted">
        SCIM 2.0 provisioning endpoint at <code>/scim/v2</code>. Point your IdP at this workspace
        with a SCIM token. Users map to workspace members; Groups map to the workspace roster.
      </p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UAlert
      v-if="createdToken"
      color="warning"
      title="Copy this SCIM token now"
      :description="createdToken"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Create token</h2>
      </template>
      <form
        class="flex flex-wrap items-end gap-3"
        @submit.prevent="createToken"
      >
        <UFormField
          label="Name"
          class="min-w-64"
        >
          <UInput
            v-model="name"
            class="w-full"
            placeholder="Okta SCIM"
            required
          />
        </UFormField>
        <UButton
          type="submit"
          color="primary"
        >
          Create SCIM token
        </UButton>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Tokens</h2>
      </template>
      <p
        v-if="!tokens.length"
        class="text-sm text-muted"
      >
        No SCIM tokens yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="token in tokens"
          :key="token.id"
          class="flex items-center justify-between gap-3 py-3"
        >
          <div>
            <p class="font-medium text-highlighted">{{ token.name }}</p>
            <p class="text-xs text-muted">{{ token.prefix }}… · created {{ token.createdAt }}</p>
          </div>
          <UButton
            color="error"
            variant="soft"
            @click="revokeToken(token)"
          >
            Revoke
          </UButton>
        </li>
      </ul>
    </UCard>
  </UContainer>
</template>
