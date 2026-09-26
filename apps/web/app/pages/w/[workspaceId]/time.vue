<script setup lang="ts">
  import type {
    OwnTimesheetState,
    ProjectDto,
    TimeEntryDto,
    WeeklyTimeSummary,
  } from '@stampp/shared';
  import {
    copyPreviousWeekResultSchema,
    listResultSchema,
    ownTimesheetStateSchema,
    projectDtoSchema,
    timeEntryDtoSchema,
    timesheetDtoSchema,
    weeklyTimeSummarySchema,
  } from '@stampp/shared';
  import WeeklyTimesheetGrid from '~/components/timesheet/WeeklyTimesheetGrid.vue';
  import {
    addCalendarDays,
    calendarDateInTimezone,
    formatMinutes,
    mondayForDate,
    parseDuration,
  } from '~/utils/week';

  definePageMeta({ layout: 'workspace' });

  const projectsListSchema = listResultSchema(projectDtoSchema);
  const { apiFetch, apiSend } = useApi();
  const workspaceId = useRouteParam('workspaceId');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const weekStart = shallowRef(mondayForDate(calendarDateInTimezone(new Date(), timezone)));
  const summary = shallowRef<WeeklyTimeSummary | null>(null);
  const ownState = shallowRef<OwnTimesheetState | null>(null);
  const projects = shallowRef<ProjectDto[]>([]);
  const loading = shallowRef(true);
  const copying = shallowRef(false);
  const submitting = shallowRef(false);
  const withdrawing = shallowRef(false);
  const savingCell = shallowRef<string | null>(null);
  const duplicatingEntry = shallowRef<string | null>(null);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);

  const weekEditable = computed(() => ownState.value?.editable ?? true);
  const timesheetStatus = computed(() => ownState.value?.status ?? null);

  const statusLabel = computed(() => {
    switch (timesheetStatus.value) {
      case 'submitted':
        return 'Submitted';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Draft';
    }
  });

  const statusColor = computed(() => {
    switch (timesheetStatus.value) {
      case 'submitted':
        return 'info' as const;
      case 'approved':
        return 'success' as const;
      case 'rejected':
        return 'error' as const;
      default:
        return 'neutral' as const;
    }
  });

  const weekLabel = computed(() => {
    if (!summary.value) return '';
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${formatter.format(new Date(`${summary.value.weekStart}T12:00:00.000Z`))} - ${formatter.format(new Date(`${summary.value.weekEnd}T12:00:00.000Z`))}`;
  });

  const weekEntries = computed(() => {
    if (!summary.value) return [];
    const items: TimeEntryDto[] = [];
    for (const project of summary.value.projects) {
      for (const entry of project.entries) {
        items.push(entry);
      }
    }
    items.sort(
      (left, right) =>
        right.workDate.localeCompare(left.workDate) || left.id.localeCompare(right.id),
    );
    return items;
  });

  const projectNameById = computed(() => {
    const map = new Map<string, string>();
    for (const project of projects.value) map.set(project.id, project.name);
    return map;
  });

  function projectLabel(entry: TimeEntryDto): string {
    if (!entry.projectId) return 'No project';
    return projectNameById.value.get(entry.projectId) ?? 'Archived project';
  }

  function canDuplicate(entry: TimeEntryDto): boolean {
    return (
      weekEditable.value &&
      entry.lockedAt === null &&
      (entry.durationMinutes !== null || entry.endAt !== null)
    );
  }

  async function duplicateEntry(entry: TimeEntryDto): Promise<void> {
    if (!weekEditable.value) {
      errorMessage.value = 'This week is submitted or approved and cannot be edited.';
      return;
    }
    duplicatingEntry.value = entry.id;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      await apiFetch(
        timeEntryDtoSchema,
        `/workspaces/${workspaceId.value}/time-entries/${entry.id}/duplicate`,
        { method: 'POST' },
      );
      successMessage.value = 'Entry duplicated.';
      await loadPage();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not duplicate entry';
    } finally {
      duplicatingEntry.value = null;
    }
  }

  function weeklyPath(): string {
    const params = new URLSearchParams({ weekStart: weekStart.value, timezone });
    return `/workspaces/${workspaceId.value}/time-entries/weekly?${params.toString()}`;
  }

  function ownStatePath(): string {
    const params = new URLSearchParams({ weekStart: weekStart.value });
    return `/workspaces/${workspaceId.value}/timesheets/own?${params.toString()}`;
  }

  async function loadPage(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [weeklySummary, projectResult, stateResult] = await Promise.all([
        apiFetch(weeklyTimeSummarySchema, weeklyPath()),
        apiFetch(
          projectsListSchema,
          `/workspaces/${workspaceId.value}/projects?limit=200&status=active`,
        ),
        apiFetch(ownTimesheetStateSchema, ownStatePath()),
      ]);
      summary.value = weeklySummary;
      projects.value = projectResult.items;
      ownState.value = stateResult;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load the timesheet';
    } finally {
      loading.value = false;
    }
  }

  async function submitWeek(): Promise<void> {
    submitting.value = true;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      await apiFetch(timesheetDtoSchema, `/workspaces/${workspaceId.value}/timesheets/submit`, {
        method: 'POST',
        body: JSON.stringify({ weekStart: weekStart.value }),
      });
      successMessage.value = 'Timesheet submitted for approval.';
      await loadPage();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not submit timesheet';
    } finally {
      submitting.value = false;
    }
  }

  async function withdrawWeek(): Promise<void> {
    withdrawing.value = true;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/timesheets/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ weekStart: weekStart.value }),
      });
      successMessage.value = 'Submission withdrawn. The week is editable again.';
      await loadPage();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not withdraw timesheet';
    } finally {
      withdrawing.value = false;
    }
  }

  async function changeWeek(days: number): Promise<void> {
    weekStart.value = addCalendarDays(weekStart.value, days);
    successMessage.value = null;
    await loadPage();
  }

  function entryMinutes(entry: TimeEntryDto): number {
    if (entry.durationMinutes !== null) return entry.durationMinutes;
    if (!entry.startAt) return 0;
    return Math.max(
      0,
      Math.round(
        (Date.parse(entry.endAt ?? new Date().toISOString()) - Date.parse(entry.startAt)) / 60_000,
      ),
    );
  }

  async function saveCell(projectId: string | null, date: string, value: string): Promise<void> {
    if (!weekEditable.value) {
      errorMessage.value = 'This week is submitted or approved and cannot be edited.';
      return;
    }
    const desiredMinutes = parseDuration(value);
    if (desiredMinutes === null) {
      errorMessage.value = 'Enter time as hours (7.5) or hours and minutes (7:30).';
      return;
    }
    const currentSummary = summary.value;
    if (!currentSummary) return;
    const group = currentSummary.projects.find((item) => item.projectId === projectId);
    const entries = group?.entries.filter((entry) => entry.workDate === date) ?? [];
    const editableDurations = entries.filter(
      (entry) => entry.durationMinutes !== null && entry.lockedAt === null,
    );
    let fixedMinutes = 0;
    for (const entry of entries) {
      if (!editableDurations.includes(entry)) fixedMinutes += entryMinutes(entry);
    }
    if (desiredMinutes < fixedMinutes) {
      errorMessage.value = `This cell includes ${formatMinutes(fixedMinutes)} of timer or locked time.`;
      return;
    }

    const editableMinutes = desiredMinutes - fixedMinutes;
    const key = `${projectId ?? 'unassigned'}:${date}`;
    savingCell.value = key;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      const first = editableDurations[0];
      if (first && editableMinutes > 0) {
        await apiFetch(
          timeEntryDtoSchema,
          `/workspaces/${workspaceId.value}/time-entries/${first.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ durationMinutes: editableMinutes, workDate: date }),
          },
        );
      } else if (!first && editableMinutes > 0) {
        const project = projectId
          ? projects.value.find((item) => item.id === projectId)
          : undefined;
        await apiFetch(timeEntryDtoSchema, `/workspaces/${workspaceId.value}/time-entries`, {
          method: 'POST',
          body: JSON.stringify({
            kind: 'duration',
            projectId,
            durationMinutes: editableMinutes,
            workDate: date,
            timezone,
            billable: project?.billable ?? true,
          }),
        });
      }
      const entriesToDelete =
        first && editableMinutes > 0 ? editableDurations.slice(1) : editableDurations;
      await Promise.all(
        entriesToDelete.map((entry) =>
          apiSend(`/workspaces/${workspaceId.value}/time-entries/${entry.id}`, {
            method: 'DELETE',
          }),
        ),
      );
      await loadPage();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not save time';
      await loadPage();
    } finally {
      savingCell.value = null;
    }
  }

  async function copyPreviousWeek(): Promise<void> {
    if (!weekEditable.value) {
      errorMessage.value = 'This week is submitted or approved and cannot be edited.';
      return;
    }
    copying.value = true;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      const result = await apiFetch(
        copyPreviousWeekResultSchema,
        `/workspaces/${workspaceId.value}/time-entries/copy-previous-week`,
        {
          method: 'POST',
          body: JSON.stringify({ weekStart: weekStart.value, timezone }),
        },
      );
      successMessage.value =
        result.copiedEntries === 0
          ? 'The previous week has no completed entries to copy.'
          : `Copied ${result.copiedEntries} ${result.copiedEntries === 1 ? 'entry' : 'entries'}.`;
      await loadPage();
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Could not copy the previous week';
    } finally {
      copying.value = false;
    }
  }

  onMounted(loadPage);
</script>

<template>
  <div class="workspace-page space-y-7">
    <header class="flex flex-wrap items-start justify-between gap-5">
      <div class="max-w-xl space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Timesheet</h1>
          <UBadge
            :color="statusColor"
            variant="subtle"
            size="sm"
          >
            {{ statusLabel }}
          </UBadge>
        </div>
        <p class="text-sm text-muted">
          Enter hours by project and day. Submit the week when it is ready for review.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="timesheetStatus === 'submitted'"
          color="warning"
          variant="soft"
          :loading="withdrawing"
          :disabled="loading"
          @click="withdrawWeek"
        >
          Withdraw
        </UButton>
        <UButton
          v-else-if="timesheetStatus !== 'approved'"
          :loading="submitting"
          :disabled="loading || (summary?.totalMinutes ?? 0) === 0"
          @click="submitWeek"
        >
          Submit week
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-copy"
          :loading="copying"
          :disabled="loading || !weekEditable || (summary?.totalMinutes ?? 0) > 0"
          @click="copyPreviousWeek"
        >
          Copy previous week
        </UButton>
      </div>
    </header>

    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default pb-4">
      <p class="font-medium text-highlighted">{{ weekLabel }}</p>
      <div class="flex items-center gap-2">
        <UButton
          aria-label="Previous week"
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="soft"
          @click="changeWeek(-7)"
        />
        <UButton
          color="neutral"
          variant="soft"
          @click="changeWeek(7)"
        >
          Next week
        </UButton>
      </div>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />
    <UAlert
      v-if="successMessage"
      color="success"
      variant="subtle"
      :title="successMessage"
    />
    <UAlert
      v-if="!weekEditable && !loading"
      color="info"
      variant="subtle"
      :title="
        timesheetStatus === 'approved'
          ? 'This week is approved and locked.'
          : 'This week is submitted. Withdraw to edit, or wait for a decision.'
      "
    />

    <div
      v-if="loading"
      role="status"
      aria-label="Loading timesheet"
      class="space-y-6"
    >
      <div class="grid grid-cols-3 gap-4">
        <USkeleton
          v-for="item in 3"
          :key="item"
          class="h-16 w-full"
        />
      </div>
      <USkeleton class="h-64 w-full" />
    </div>

    <template v-else-if="summary">
      <dl
        class="grid grid-cols-3 gap-4 py-2"
        aria-label="Weekly totals"
      >
        <div>
          <dt class="text-xs font-medium text-muted">Logged</dt>
          <dd
            class="mt-1 font-mono text-xl font-semibold text-highlighted tabular-nums sm:text-2xl"
          >
            {{ formatMinutes(summary.totalMinutes) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-muted">Expected</dt>
          <dd
            class="mt-1 font-mono text-xl font-semibold text-highlighted tabular-nums sm:text-2xl"
          >
            {{ formatMinutes(summary.expectedMinutes) }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-medium text-muted">Missing</dt>
          <dd
            class="mt-1 font-mono text-xl font-semibold tabular-nums sm:text-2xl"
            :class="summary.missingMinutes > 0 ? 'text-warning' : 'text-success'"
          >
            {{ formatMinutes(summary.missingMinutes) }}
          </dd>
        </div>
      </dl>

      <WeeklyTimesheetGrid
        :summary="summary"
        :projects="projects"
        :saving-cell="savingCell"
        :readonly="!weekEditable"
        @save="saveCell"
      />

      <section
        v-if="weekEntries.length > 0"
        class="space-y-3"
      >
        <div>
          <h2 class="text-sm font-semibold text-highlighted">Week entries</h2>
          <p class="text-sm text-muted">Duplicate a completed entry when you repeat work.</p>
        </div>
        <div class="divide-y divide-default">
          <div
            v-for="entry in weekEntries"
            :key="entry.id"
            class="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div class="min-w-0 flex-1 space-y-1">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ entry.description || 'No description' }}
              </p>
              <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                <span>{{ projectLabel(entry) }}</span>
                <span>{{ entry.workDate }}</span>
                <span>{{ formatMinutes(entryMinutes(entry)) }}</span>
                <span
                  v-for="tag in entry.tags"
                  :key="tag.id"
                  >{{ tag.name }}</span
                >
              </p>
            </div>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              icon="i-lucide-copy"
              :disabled="!canDuplicate(entry)"
              :loading="duplicatingEntry === entry.id"
              @click="duplicateEntry(entry)"
            >
              Duplicate
            </UButton>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
