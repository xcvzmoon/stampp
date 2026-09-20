<script setup lang="ts">
  import type {
    ClientDto,
    ProjectDto,
    ProfitabilityReport,
    SummaryReport,
    UtilizationReport,
  } from '@stampp/shared';
  import {
    clientDtoSchema,
    listResultSchema,
    profitabilityReportSchema,
    projectDtoSchema,
    summaryReportSchema,
    utilizationReportSchema,
  } from '@stampp/shared';
  import { formatRateAmount } from '~/utils/rates';
  import { addCalendarDays, calendarDateInTimezone, formatMinutes } from '~/utils/week';

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
  const profitability = shallowRef<ProfitabilityReport | null>(null);
  const utilization = shallowRef<UtilizationReport | null>(null);
  const loading = shallowRef(true);
  const exporting = shallowRef(false);
  const errorMessage = shallowRef<string | null>(null);

  function percent(value: number | null): string {
    return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
  }

  async function loadReport(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;
    try {
      const params = reportParameters().toString();
      const utilParams = new URLSearchParams({
        from: from.value,
        to: to.value,
        timezone,
        groupBy: groupBy.value === 'client' ? 'project' : groupBy.value,
      });
      const [summary, profit, util] = await Promise.all([
        apiFetch(summaryReportSchema, `/workspaces/${workspaceId.value}/reports/summary?${params}`),
        apiFetch(
          profitabilityReportSchema,
          `/workspaces/${workspaceId.value}/reports/profitability?${params}`,
        ).catch(() => null),
        apiFetch(
          utilizationReportSchema,
          `/workspaces/${workspaceId.value}/reports/utilization?${utilParams.toString()}`,
        ).catch(() => null),
      ]);
      report.value = summary;
      profitability.value = profit;
      utilization.value = util;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load the report';
    } finally {
      loading.value = false;
    }
  }

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

    <section
      v-if="profitability"
      class="space-y-3"
    >
      <h2 class="text-lg font-medium text-highlighted">Profitability</h2>
      <div class="grid gap-3 sm:grid-cols-4">
        <UCard>
          <p class="text-xs font-medium tracking-wide text-muted uppercase">Revenue</p>
          <p class="mt-1 font-mono text-xl font-semibold text-highlighted">
            {{ formatRateAmount(profitability.totals.revenueMinor, profitability.currency) }}
          </p>
        </UCard>
        <UCard>
          <p class="text-xs font-medium tracking-wide text-muted uppercase">Labor cost</p>
          <p class="mt-1 font-mono text-xl font-semibold text-highlighted">
            {{ formatRateAmount(profitability.totals.laborCostMinor, profitability.currency) }}
          </p>
        </UCard>
        <UCard>
          <p class="text-xs font-medium tracking-wide text-muted uppercase">Expenses</p>
          <p class="mt-1 font-mono text-xl font-semibold text-highlighted">
            {{ formatRateAmount(profitability.totals.expenseMinor, profitability.currency) }}
          </p>
        </UCard>
        <UCard>
          <p class="text-xs font-medium tracking-wide text-muted uppercase">Profit / margin</p>
          <p
            class="mt-1 font-mono text-xl font-semibold"
            :class="profitability.totals.profitMinor < 0 ? 'text-error' : 'text-success'"
          >
            {{ formatRateAmount(profitability.totals.profitMinor, profitability.currency) }}
          </p>
          <p class="text-sm text-muted">{{ percent(profitability.totals.marginRatio) }}</p>
        </UCard>
      </div>
      <div
        v-if="profitability.groups.length"
        class="divide-y divide-default rounded-lg border border-default"
      >
        <div
          v-for="group in profitability.groups"
          :key="group.id ?? group.name"
          class="grid gap-2 px-4 py-3 sm:grid-cols-5"
        >
          <p class="font-medium text-highlighted">{{ group.name }}</p>
          <p class="text-sm text-muted">
            Rev {{ formatRateAmount(group.revenueMinor, profitability.currency) }}
          </p>
          <p class="text-sm text-muted">
            Cost {{ formatRateAmount(group.laborCostMinor, profitability.currency) }}
          </p>
          <p class="text-sm text-muted">
            Profit {{ formatRateAmount(group.profitMinor, profitability.currency) }}
          </p>
          <p class="text-sm text-muted">{{ percent(group.marginRatio) }}</p>
        </div>
      </div>
    </section>

    <section
      v-if="utilization"
      class="space-y-3"
    >
      <h2 class="text-lg font-medium text-highlighted">Utilization</h2>
      <UCard>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-medium tracking-wide text-muted uppercase">
              Billable utilization
            </p>
            <p class="mt-1 font-mono text-2xl font-semibold text-highlighted">
              {{ percent(utilization.totals.utilizationRatio) }}
            </p>
          </div>
          <p class="text-sm text-muted">
            {{ formatMinutes(utilization.totals.billableMinutes) }} billable /
            {{ formatMinutes(utilization.totals.totalMinutes) }} total
          </p>
        </div>
      </UCard>
      <div
        v-if="utilization.groups.length"
        class="divide-y divide-default rounded-lg border border-default"
      >
        <div
          v-for="group in utilization.groups"
          :key="group.id ?? group.name"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div>
            <p class="font-medium text-highlighted">{{ group.name }}</p>
            <p class="text-sm text-muted">
              {{ formatMinutes(group.billableMinutes) }} / {{ formatMinutes(group.totalMinutes) }}
            </p>
          </div>
          <p class="font-mono text-sm font-semibold text-highlighted">
            {{ percent(group.utilizationRatio) }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
