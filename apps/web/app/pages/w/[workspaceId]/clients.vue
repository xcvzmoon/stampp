<script setup lang="ts">
  import type { ClientDto } from '@stampp/shared';
  import { clientDtoSchema, listResultSchema } from '@stampp/shared';
  import WorkspaceEmptyState from '~/components/workspace/WorkspaceEmptyState.vue';
  import WorkspaceLoadingState from '~/components/workspace/WorkspaceLoadingState.vue';

  definePageMeta({ layout: 'workspace' });

  const clientsListSchema = listResultSchema(clientDtoSchema);

  const { apiFetch, apiSend } = useApi();

  const workspaceId = useRouteParam('workspaceId');

  const clients = ref<ClientDto[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const createOpen = ref(false);
  const createLoading = ref(false);
  const createError = ref<string | null>(null);
  const name = ref('');
  const email = ref('');
  const address = ref('');
  const notes = ref('');

  async function loadClients() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const result = await apiFetch(
        clientsListSchema,
        `/workspaces/${workspaceId.value}/clients?limit=100`,
      );
      clients.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load clients';
    } finally {
      loading.value = false;
    }
  }

  async function createClient() {
    createLoading.value = true;
    createError.value = null;
    try {
      await apiFetch(clientDtoSchema, `/workspaces/${workspaceId.value}/clients`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.value,
          email: email.value || undefined,
          address: address.value || undefined,
          notes: notes.value || undefined,
        }),
      });
      createOpen.value = false;
      name.value = '';
      email.value = '';
      address.value = '';
      notes.value = '';
      await loadClients();
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not create client';
    } finally {
      createLoading.value = false;
    }
  }

  async function archiveClient(client: ClientDto) {
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/clients/${client.id}`, {
        method: 'DELETE',
      });
      await loadClients();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not archive client';
    }
  }

  onMounted(loadClients);
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Clients</h1>
        <p class="text-sm text-muted">External customers that own projects in this workspace.</p>
      </div>
      <UButton @click="createOpen = true">New client</UButton>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />

    <UCard v-if="createOpen">
      <form
        class="space-y-4"
        @submit.prevent="createClient"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="name"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField label="Email">
            <UInput
              v-model="email"
              type="email"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Address">
          <UInput
            v-model="address"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Notes">
          <UTextarea
            v-model="notes"
            class="w-full"
            :rows="3"
          />
        </UFormField>
        <UAlert
          v-if="createError"
          color="error"
          variant="subtle"
          :title="createError"
        />
        <div class="flex gap-2">
          <UButton
            type="submit"
            :loading="createLoading"
          >
            Create client
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            @click="createOpen = false"
          >
            Cancel
          </UButton>
        </div>
      </form>
    </UCard>

    <WorkspaceLoadingState
      v-if="loading"
      label="Loading clients"
    />

    <WorkspaceEmptyState
      v-else-if="clients.length === 0 && !errorMessage"
      title="No clients yet"
      description="Create a client to group the projects you do for them."
      icon="i-lucide-building-2"
    />

    <ul
      v-else
      class="divide-y divide-default rounded-lg border border-default"
    >
      <li
        v-for="client in clients"
        :key="client.id"
        class="flex items-start justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0 space-y-1">
          <p class="truncate font-medium text-highlighted">{{ client.name }}</p>
          <p
            v-if="client.email"
            class="truncate text-sm text-muted"
          >
            {{ client.email }}
          </p>
          <p
            v-if="client.address"
            class="truncate text-sm text-muted"
          >
            {{ client.address }}
          </p>
        </div>
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          @click="archiveClient(client)"
        >
          Archive
        </UButton>
      </li>
    </ul>
  </div>
</template>
