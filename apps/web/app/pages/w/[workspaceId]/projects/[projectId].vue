<script setup lang="ts">
  import type { ProjectDto, TaskDto } from '@stampp/shared';
  import { listResultSchema, projectDtoSchema, taskDtoSchema } from '@stampp/shared';

  definePageMeta({ layout: 'workspace' });

  const tasksListSchema = listResultSchema(taskDtoSchema);

  const { apiFetch, apiSend } = useApi();

  const workspaceId = useRouteParam('workspaceId');
  const projectId = useRouteParam('projectId');

  const project = ref<ProjectDto | null>(null);
  const tasks = ref<TaskDto[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const taskName = ref('');
  const taskEstimate = ref<string>('');
  const taskLoading = ref(false);
  const taskError = ref<string | null>(null);

  async function loadProject() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [projectResult, taskResult] = await Promise.all([
        apiFetch(projectDtoSchema, `/workspaces/${workspaceId.value}/projects/${projectId.value}`),
        apiFetch(
          tasksListSchema,
          `/workspaces/${workspaceId.value}/projects/${projectId.value}/tasks?limit=100`,
        ),
      ]);
      project.value = projectResult;
      tasks.value = taskResult.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load project';
    } finally {
      loading.value = false;
    }
  }

  async function createTask() {
    if (!project.value) return;
    taskLoading.value = true;
    taskError.value = null;
    try {
      const estimate = taskEstimate.value.trim();
      await apiFetch(
        taskDtoSchema,
        `/workspaces/${workspaceId.value}/projects/${projectId.value}/tasks`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: taskName.value,
            estimateMinutes: estimate ? Number(estimate) : null,
          }),
        },
      );
      taskName.value = '';
      taskEstimate.value = '';
      await loadProject();
    } catch (error) {
      taskError.value = error instanceof Error ? error.message : 'Could not create task';
    } finally {
      taskLoading.value = false;
    }
  }

  async function archiveTask(task: TaskDto) {
    taskError.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/tasks/${task.id}`, {
        method: 'DELETE',
      });
      await loadProject();
    } catch (error) {
      taskError.value = error instanceof Error ? error.message : 'Could not archive task';
    }
  }

  async function setStatus(status: 'active' | 'archived') {
    if (!project.value) return;
    errorMessage.value = null;
    try {
      project.value = await apiFetch(
        projectDtoSchema,
        `/workspaces/${workspaceId.value}/projects/${projectId.value}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not update project';
    }
  }

  onMounted(loadProject);
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm">
      <ULink
        :to="`/w/${workspaceId}/projects`"
        class="text-muted"
      >
        ← Projects
      </ULink>
    </p>

    <p
      v-if="loading"
      class="text-sm text-muted"
    >
      Loading project…
    </p>

    <UAlert
      v-else-if="errorMessage && !project"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />

    <template v-else-if="project">
      <header class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-semibold text-highlighted">{{ project.name }}</h1>
            <UBadge
              v-if="project.code"
              color="neutral"
              variant="subtle"
            >
              {{ project.code }}
            </UBadge>
            <UBadge
              :color="project.status === 'active' ? 'primary' : 'neutral'"
              variant="subtle"
            >
              {{ project.status }}
            </UBadge>
            <UBadge
              color="neutral"
              variant="subtle"
            >
              {{ project.billable ? 'Billable' : 'Non-billable' }}
            </UBadge>
          </div>
          <p
            v-if="project.notes"
            class="text-sm text-muted"
          >
            {{ project.notes }}
          </p>
        </div>
        <UButton
          v-if="project.status === 'active'"
          color="neutral"
          variant="soft"
          @click="setStatus('archived')"
        >
          Archive project
        </UButton>
        <UButton
          v-else
          @click="setStatus('active')"
        >
          Restore project
        </UButton>
      </header>

      <UAlert
        v-if="errorMessage"
        color="error"
        variant="subtle"
        :title="errorMessage"
      />

      <section class="space-y-4">
        <h2 class="text-lg font-medium text-highlighted">Tasks</h2>

        <UCard v-if="project.status === 'active'">
          <form
            class="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
            @submit.prevent="createTask"
          >
            <UFormField
              label="Task name"
              required
            >
              <UInput
                v-model="taskName"
                class="w-full"
                required
              />
            </UFormField>
            <UFormField label="Estimate (minutes)">
              <UInput
                v-model="taskEstimate"
                type="number"
                min="0"
                step="1"
                class="w-full"
              />
            </UFormField>
            <UButton
              type="submit"
              :loading="taskLoading"
            >
              Add task
            </UButton>
          </form>
          <UAlert
            v-if="taskError"
            class="mt-3"
            color="error"
            variant="subtle"
            :title="taskError"
          />
        </UCard>

        <p
          v-if="tasks.length === 0"
          class="text-sm text-muted"
        >
          No tasks yet.
        </p>

        <ul
          v-else
          class="divide-y divide-default rounded-lg border border-default"
        >
          <li
            v-for="task in tasks"
            :key="task.id"
            class="flex items-center justify-between gap-4 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="truncate font-medium text-highlighted">{{ task.name }}</p>
              <p class="text-sm text-muted">
                {{ task.estimateMinutes != null ? `${task.estimateMinutes} min` : 'No estimate' }}
                ·
                {{ task.status }}
              </p>
            </div>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              @click="archiveTask(task)"
            >
              Archive
            </UButton>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
