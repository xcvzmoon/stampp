<script setup lang="ts">
  import type { ClientDto, ProjectDto, SummaryReport } from '@stampp/shared';
  import {
    clientDtoSchema,
    listResultSchema,
    projectDtoSchema,
    summaryReportSchema,
  } from '@stampp/shared';
  import { addCalendarDays, calendarDateInTimezone } from '~/utils/week';

  definePageMeta({ layout: 'workspace' });

  const { apiFetch } = useApi();
  const config = useRuntimeConfig();
  const workspaceId = useRouteParam('workspaceId');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = calendarDateInTimezone(new Date(), timezone);

  const from = shallowRef(addCalendarDays(today, -29));
  const to = shallowRef(today);
  const projectId = shallowRef('');
  const clientId = shallowRef('');
  const userId = shallowRef('');
  const billable = shallowRef('');
  const groupBy = shallowRef('project');
  const projects = shallowRef<ProjectDto[]>([]);
  const clients = shallowRef<ClientDto[]>([]);
  const report = shallowRef<SummaryReport | null>(null);
  const loading = shallowRef(true);
  const exporting = shallowRef(false);
  const errorMessage = shallowRef<string | null>(null);

  const projectOptions = computed(() => [
    { label: 'All projects', value: '' },
    ...projects.value.map((project) => ({ label: project.name, value: project.id })),
  ]);
  const clientOptions = computed(() => [
    { label: 'All clients', value: '' },
    ...clients.value.map((client) => ({ label: client.name, value: client.id })),
  ]);

  function reportParameters(format = 'json'): URLSearchParams {
    const parameters = new URLSearchParams({
      from: from.value,
      to: to.value,
      timezone,
      groupBy: groupBy.value,
      format,
    });
    if (projectId.value) parameters.set('projectId', projectId.value);
    if (clientId.value) parameters.set('clientId', clientId.value);
    if (userId.value) parameters.set('userId', userId.value);
    if (billable.value) parameters.set('billable', billable.value);
    return parameters;
  }

  async function loadReport(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;
    try {
      report.value = await apiFetch(
        summaryReportSchema,
        `/workspaces/${workspaceId.value}/reports/summary?${reportParameters().toString()}`,
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load the report';
    } finally {
      loading.value = false;
    }
  }

  async function download(path: string, filename: string): Promise<void> {
    const response = await fetch(`${config.public.apiBaseURL}${path}`, {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('The export could not be created');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCsv(): Promise<void> {
    errorMessage.value = null;
    try {
      await download(
        `/workspaces/${workspaceId.value}/reports/summary?${reportParameters('csv').toString()}`,
        'summary-report.csv',
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not download CSV';
    }
  }

  async function exportWorkspace(): Promise<void> {
    exporting.value = true;
    errorMessage.value = null;
    try {
      await download(
        `/workspaces/${workspaceId.value}/export`,
        `stampp-workspace-${workspaceId.value}.json`,
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not export workspace';
    } finally {
      exporting.value = false;
    }
  }

  onMounted(async () => {
    try {
      const [projectResult, clientResult] = await Promise.all([
        apiFetch(
          listResultSchema(projectDtoSchema),
          `/workspaces/${workspaceId.value}/projects?limit=200`,
        ),
        apiFetch(
          listResultSchema(clientDtoSchema),
          `/workspaces/${workspaceId.value}/clients?limit=200`,
        ),
      ]);
      projects.value = projectResult.items;
      clients.value = clientResult.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load filters';
    }
    await loadReport();
  });
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">Reports</h1>
        <p class="text-sm text-muted">Review tracked time and its billable split.</p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-database-backup"
        :loading="exporting"
        @click="exportWorkspace"
      >
        Export workspace
      </UButton>
    </header>

    <ReportFilters
      v-model:from="from"
      v-model:to="to"
      v-model:project-id="projectId"
      v-model:client-id="clientId"
      v-model:user-id="userId"
      v-model:billable="billable"
      v-model:group-by="groupBy"
      :project-options="projectOptions"
      :client-options="clientOptions"
      :loading="loading"
      @apply="loadReport"
      @download-csv="downloadCsv"
    />

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />

    <p
      v-if="loading && !report"
      class="text-sm text-muted"
    >
      Loading report…
    </p>
    <UEmpty
      v-else-if="report?.groups.length === 0"
      icon="i-lucide-chart-no-axes-column"
      title="No time matches these filters"
      description="Try a wider date range or remove a filter."
    />
    <ReportSummary
      v-else-if="report"
      :report="report"
    />
  </div>
</template>
