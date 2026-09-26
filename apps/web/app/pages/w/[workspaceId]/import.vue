<script setup lang="ts">
  import type { ImportJobDto } from '@stampp/shared';
  import { importJobListResultSchema, importPreviewSchema } from '@stampp/shared';
  import * as v from 'valibot';

  definePageMeta({ layout: 'workspace' });

  const route = useRoute();
  const workspaceId = computed(() => String(route.params.workspaceId));
  const { apiFetch, apiSend } = useApi();

  const jobs = shallowRef<ImportJobDto[]>([]);
  const errorMessage = shallowRef('');
  const preview = shallowRef<v.InferOutput<typeof importPreviewSchema> | null>(null);
  const source = shallowRef<'csv' | 'clockify' | 'toggl' | 'harvest'>('csv');
  const csv = shallowRef('');

  async function load() {
    errorMessage.value = '';
    try {
      const result = await apiFetch(
        importJobListResultSchema,
        `/workspaces/${workspaceId.value}/import`,
      );
      jobs.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load import jobs';
    }
  }

  async function previewCsv() {
    try {
      preview.value = await apiFetch(
        importPreviewSchema,
        `/workspaces/${workspaceId.value}/import?mode=preview`,
        {
          method: 'POST',
          body: JSON.stringify({ source: source.value, csv: csv.value }),
        },
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Preview failed';
    }
  }

  async function startImport() {
    try {
      await apiSend(`/workspaces/${workspaceId.value}/import`, {
        method: 'POST',
        body: JSON.stringify({
          source: source.value,
          csv: csv.value,
          skipInvalidRows: true,
        }),
      });
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Import failed';
    }
  }

  onMounted(load);
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Import</h1>
      <p class="text-sm text-muted">
        Bring time entries from a CSV file. Preview the rows before importing.
      </p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Upload CSV</h2>
      </template>
      <div class="space-y-3">
        <UFormField label="Source">
          <USelect
            v-model="source"
            :items="[
              { label: 'CSV', value: 'csv' },
              { label: 'Clockify', value: 'clockify' },
              { label: 'Toggl', value: 'toggl' },
              { label: 'Harvest', value: 'harvest' },
            ]"
          />
        </UFormField>
        <UFormField label="CSV (id, description, start, end)">
          <UTextarea
            v-model="csv"
            class="w-full"
            :rows="8"
            placeholder="id,description,start,end"
          />
        </UFormField>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="previewCsv"
          >
            Dry-run preview
          </UButton>
          <UButton
            color="primary"
            @click="startImport"
          >
            Start import
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard v-if="preview">
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">
          Preview · {{ preview.validRows }} valid / {{ preview.totalRows }} rows
        </h2>
      </template>
      <ul class="divide-y divide-default">
        <li
          v-for="(row, index) in preview.rows"
          :key="`${row.externalId ?? index}`"
          class="py-2 text-sm"
        >
          <p class="font-medium text-highlighted">{{ row.name }}</p>
          <p class="text-xs text-muted">
            {{ row.startDate }} → {{ row.endDate }} · {{ row.durationMinutes }}m
          </p>
          <p
            v-if="row.issues.length"
            class="text-xs text-error"
          >
            {{ row.issues.join('; ') }}
          </p>
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Jobs</h2>
      </template>
      <p
        v-if="!jobs.length"
        class="text-sm text-muted"
      >
        No import jobs yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="job in jobs"
          :key="job.id"
          class="py-3 text-sm"
        >
          <p class="font-medium text-highlighted">{{ job.source }} · {{ job.status }}</p>
          <p class="text-xs text-muted">
            {{ job.importedRows }} imported · {{ job.skippedRows }} skipped ·
            {{ job.totalRows }} total
          </p>
          <p
            v-if="job.error"
            class="text-xs text-error"
          >
            {{ job.error }}
          </p>
        </li>
      </ul>
    </UCard>
  </div>
</template>
