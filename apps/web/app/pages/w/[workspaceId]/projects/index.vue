<script setup lang="ts">
  import type { ClientDto, ProjectDto } from '@stampp/shared';
  import { clientDtoSchema, listResultSchema, projectDtoSchema } from '@stampp/shared';
  import WorkspaceEmptyState from '~/components/workspace/WorkspaceEmptyState.vue';
  import WorkspaceLoadingState from '~/components/workspace/WorkspaceLoadingState.vue';

  definePageMeta({ layout: 'workspace' });

  const projectsListSchema = listResultSchema(projectDtoSchema);
  const clientsListSchema = listResultSchema(clientDtoSchema);

  const { apiFetch, apiSend } = useApi();

  const workspaceId = useRouteParam('workspaceId');

  const projects = ref<ProjectDto[]>([]);
  const clients = ref<ClientDto[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const createOpen = ref(false);
  const createLoading = ref(false);
  const createError = ref<string | null>(null);
  const name = ref('');
  const code = ref('');
  const clientId = ref<string | undefined>();
  const billable = ref(true);
  const color = ref('#3B82F6');

  const clientNameById = computed(() => {
    const map = new Map<string, string>();
    for (const client of clients.value) {
      map.set(client.id, client.name);
    }
    return map;
  });

  async function loadPage() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [projectResult, clientResult] = await Promise.all([
        apiFetch(
          projectsListSchema,
          `/workspaces/${workspaceId.value}/projects?limit=100&status=active`,
        ),
        apiFetch(clientsListSchema, `/workspaces/${workspaceId.value}/clients?limit=100`),
      ]);
      projects.value = projectResult.items;
      clients.value = clientResult.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load projects';
    } finally {
      loading.value = false;
    }
  }

  async function createProject() {
    createLoading.value = true;
    createError.value = null;
    try {
      const created = await apiFetch(
        projectDtoSchema,
        `/workspaces/${workspaceId.value}/projects`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.value,
            code: code.value || undefined,
            clientId: clientId.value || null,
            billable: billable.value,
            color: color.value || undefined,
          }),
        },
      );
      createOpen.value = false;
      name.value = '';
      code.value = '';
      clientId.value = undefined;
      billable.value = true;
      await navigateTo(`/w/${workspaceId.value}/projects/${created.id}`);
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not create project';
    } finally {
      createLoading.value = false;
    }
  }

  async function archiveProject(project: ProjectDto) {
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/projects/${project.id}`, {
        method: 'DELETE',
      });
      await loadPage();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not archive project';
    }
  }

  onMounted(loadPage);
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Projects</h1>
        <p class="text-sm text-muted">
          Organize work by client and project. Add tasks to keep time entries specific.
        </p>
      </div>
      <UButton @click="createOpen = true">New project</UButton>
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
        @submit.prevent="createProject"
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
          <UFormField
            label="Code"
            help="Optional short code, unique in this workspace."
          >
            <UInput
              v-model="code"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Client">
            <USelect
              v-model="clientId"
              class="w-full"
              :items="[
                { label: 'No client', value: undefined },
                ...clients.map((client) => ({ label: client.name, value: client.id })),
              ]"
              value-key="value"
            />
          </UFormField>
          <UFormField label="Color">
            <UInput
              v-model="color"
              type="color"
              class="h-9 w-full"
            />
          </UFormField>
        </div>
        <UCheckbox
          v-model="billable"
          label="Billable by default"
        />
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
            Create project
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
      label="Loading projects"
    />

    <WorkspaceEmptyState
      v-else-if="projects.length === 0 && !errorMessage"
      title="No active projects"
      description="Create a project to organize time and tasks."
      icon="i-lucide-folders"
    />

    <ul
      v-else
      class="divide-y divide-default rounded-lg border border-default"
    >
      <li
        v-for="project in projects"
        :key="project.id"
        class="flex items-start justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2">
            <span
              class="inline-block size-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: project.color ?? '#94A3B8' }"
            />
            <ULink
              :to="`/w/${workspaceId}/projects/${project.id}`"
              class="truncate font-medium text-highlighted"
            >
              {{ project.name }}
            </ULink>
            <UBadge
              v-if="project.code"
              color="neutral"
              variant="subtle"
            >
              {{ project.code }}
            </UBadge>
          </div>
          <p class="text-sm text-muted">
            {{ clientNameById.get(project.clientId ?? '') ?? 'No client' }}
            ·
            {{ project.billable ? 'Billable' : 'Non-billable' }}
          </p>
        </div>
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          @click="archiveProject(project)"
        >
          Archive
        </UButton>
      </li>
    </ul>
  </div>
</template>
