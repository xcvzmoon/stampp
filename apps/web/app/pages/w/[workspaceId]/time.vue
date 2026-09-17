<script setup lang="ts">
  import type { ProjectDto, TimeEntryDto } from '@stampp/shared';
  import {
    listResultSchema,
    projectDtoSchema,
    timeEntryDtoSchema,
    timeEntryListResultSchema,
  } from '@stampp/shared';

  definePageMeta({ layout: 'workspace' });

  const projectsListSchema = listResultSchema(projectDtoSchema);
  const { apiFetch, apiSend } = useApi();
  const workspaceId = useRouteParam('workspaceId');

  const entries = ref<TimeEntryDto[]>([]);
  const projects = ref<ProjectDto[]>([]);
  const loading = ref<boolean>(true);
  const saving = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);
  const description = ref<string>('');
  const projectId = ref<string | undefined>();
  const durationMinutes = ref<number>(60);
  const billable = ref<boolean>(true);

  const projectNameById = computed<Map<string, string>>(() => {
    const names = new Map<string, string>();
    for (const project of projects.value) names.set(project.id, project.name);
    return names;
  });

  function entryDuration(entry: TimeEntryDto): string {
    let minutes = entry.durationMinutes ?? 0;
    if (entry.startAt && entry.endAt) {
      minutes = Math.max(
        0,
        Math.round((Date.parse(entry.endAt) - Date.parse(entry.startAt)) / 60_000),
      );
    }
    if (entry.startAt && !entry.endAt) return 'Running';
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
  }

  function entryDate(entry: TimeEntryDto): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(entry.startAt ?? entry.createdAt),
    );
  }

  async function loadPage() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [entryResult, projectResult] = await Promise.all([
        apiFetch(
          timeEntryListResultSchema,
          `/workspaces/${workspaceId.value}/time-entries?limit=100`,
        ),
        apiFetch(
          projectsListSchema,
          `/workspaces/${workspaceId.value}/projects?limit=100&status=active`,
        ),
      ]);
      entries.value = entryResult.items.toReversed();
      projects.value = projectResult.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load time entries';
    } finally {
      loading.value = false;
    }
  }

  async function addEntry() {
    saving.value = true;
    errorMessage.value = null;
    try {
      await apiFetch(timeEntryDtoSchema, `/workspaces/${workspaceId.value}/time-entries`, {
        method: 'POST',
        body: JSON.stringify({
          kind: 'duration',
          projectId: projectId.value ?? null,
          description: description.value,
          durationMinutes: durationMinutes.value,
          billable: billable.value,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      description.value = '';
      durationMinutes.value = 60;
      await loadPage();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not add time entry';
    } finally {
      saving.value = false;
    }
  }

  async function removeEntry(entry: TimeEntryDto) {
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/time-entries/${entry.id}`, {
        method: 'DELETE',
      });
      await loadPage();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not remove time entry';
    }
  }

  onMounted(loadPage);
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-highlighted">Time</h1>
      <p class="text-sm text-muted">Track work with the timer or add a duration manually.</p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />

    <UCard>
      <form
        class="grid items-end gap-4 md:grid-cols-[1fr_14rem_8rem_auto_auto]"
        @submit.prevent="addEntry"
      >
        <UFormField label="Description">
          <UInput
            v-model="description"
            class="w-full"
            maxlength="1000"
            placeholder="Work completed"
          />
        </UFormField>
        <UFormField label="Project">
          <USelect
            v-model="projectId"
            class="w-full"
            :items="[
              { label: 'No project', value: undefined },
              ...projects.map((project) => ({ label: project.name, value: project.id })),
            ]"
            value-key="value"
          />
        </UFormField>
        <UFormField
          label="Minutes"
          required
        >
          <UInputNumber
            v-model="durationMinutes"
            class="w-full"
            :min="1"
            :step="15"
            required
          />
        </UFormField>
        <UCheckbox
          v-model="billable"
          label="Billable"
        />
        <UButton
          type="submit"
          :loading="saving"
        >
          Add time
        </UButton>
      </form>
    </UCard>

    <p
      v-if="loading"
      class="text-sm text-muted"
    >
      Loading time entries…
    </p>

    <p
      v-else-if="entries.length === 0"
      class="text-sm text-muted"
    >
      No time entries yet.
    </p>

    <ul
      v-else
      class="divide-y divide-default rounded-lg border border-default"
    >
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="flex flex-wrap items-center justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0">
          <p class="truncate font-medium text-highlighted">
            {{ entry.description || 'Untitled entry' }}
          </p>
          <p class="text-sm text-muted">
            {{ projectNameById.get(entry.projectId ?? '') ?? 'No project' }}
            · {{ entryDate(entry) }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <UBadge
            v-if="entry.billable"
            color="success"
            variant="subtle"
          >
            Billable
          </UBadge>
          <span class="min-w-20 text-right font-mono text-sm font-semibold">
            {{ entryDuration(entry) }}
          </span>
          <UButton
            v-if="!entry.lockedAt && entry.endAt !== null"
            size="sm"
            color="neutral"
            variant="ghost"
            @click="removeEntry(entry)"
          >
            Delete
          </UButton>
        </div>
      </li>
    </ul>
  </div>
</template>
