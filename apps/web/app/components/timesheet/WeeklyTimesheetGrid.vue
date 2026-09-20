<script setup lang="ts">
  import type { ProjectDto, WeeklyTimeSummary } from '@stampp/shared';
  import { formatMinutes } from '~/utils/week';

  type TimesheetRow = {
    key: string;
    projectId: string | null;
    name: string;
    color: string;
    dailyMinutes: number[];
    totalMinutes: number;
  };

  const props = defineProps<{
    summary: WeeklyTimeSummary;
    projects: ProjectDto[];
    savingCell: string | null;
    readonly?: boolean;
  }>();

  const emit = defineEmits<{
    save: [projectId: string | null, date: string, value: string];
  }>();

  const values = reactive<Record<string, string>>({});

  const projectById = computed(() => {
    const result = new Map<string, ProjectDto>();
    for (const project of props.projects) result.set(project.id, project);
    return result;
  });

  const rows = computed<TimesheetRow[]>(() => {
    const result: TimesheetRow[] = [];
    const seen = new Set<string>();
    for (const project of props.summary.projects) {
      const key = project.projectId ?? 'unassigned';
      const catalogProject = project.projectId
        ? projectById.value.get(project.projectId)
        : undefined;
      result.push({
        key,
        projectId: project.projectId,
        name: catalogProject?.name ?? (project.projectId ? 'Archived project' : 'No project'),
        color: catalogProject?.color ?? '#94A3B8',
        dailyMinutes: project.dailyMinutes,
        totalMinutes: project.totalMinutes,
      });
      seen.add(key);
    }
    for (const project of props.projects) {
      if (seen.has(project.id)) continue;
      result.push({
        key: project.id,
        projectId: project.id,
        name: project.name,
        color: project.color ?? '#94A3B8',
        dailyMinutes: Array.from({ length: 7 }, () => 0),
        totalMinutes: 0,
      });
    }
    if (!seen.has('unassigned')) {
      result.push({
        key: 'unassigned',
        projectId: null,
        name: 'No project',
        color: '#94A3B8',
        dailyMinutes: Array.from({ length: 7 }, () => 0),
        totalMinutes: 0,
      });
    }
    return result;
  });

  function cellKey(projectId: string | null, date: string): string {
    return `${projectId ?? 'unassigned'}:${date}`;
  }

  function syncValues(): void {
    for (const row of rows.value) {
      for (const [index, day] of props.summary.days.entries()) {
        values[cellKey(row.projectId, day.date)] = formatMinutes(row.dailyMinutes[index] ?? 0);
      }
    }
  }

  watch(() => props.summary, syncValues, { immediate: true });

  function save(row: TimesheetRow, date: string): void {
    if (props.readonly) return;
    const key = cellKey(row.projectId, date);
    emit('save', row.projectId, date, values[key] ?? '');
  }

  function blurOnEnter(event: KeyboardEvent): void {
    if (event.currentTarget instanceof HTMLInputElement) event.currentTarget.blur();
  }

  function dayLabel(date: string): string {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
      new Date(`${date}T12:00:00.000Z`),
    );
  }

  function dateLabel(date: string): string {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
      new Date(`${date}T12:00:00.000Z`),
    );
  }
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-default bg-default">
    <table class="w-full min-w-[880px] border-collapse text-sm">
      <thead>
        <tr class="border-b border-default bg-elevated/40">
          <th class="w-56 px-4 py-3 text-left font-medium text-muted">Project</th>
          <th
            v-for="day in summary.days"
            :key="day.date"
            class="w-24 px-2 py-3 text-center font-medium"
          >
            <span class="block text-highlighted">{{ dayLabel(day.date) }}</span>
            <span class="block text-xs text-muted">{{ dateLabel(day.date) }}</span>
          </th>
          <th class="w-24 px-4 py-3 text-right font-medium text-muted">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.key"
          class="border-b border-default last:border-b-0"
        >
          <th class="px-4 py-3 text-left font-medium text-highlighted">
            <span class="flex items-center gap-2">
              <span
                class="size-2.5 shrink-0 rounded-full"
                :style="{ backgroundColor: row.color }"
              />
              <span class="truncate">{{ row.name }}</span>
            </span>
          </th>
          <td
            v-for="day in summary.days"
            :key="day.date"
            class="px-2 py-2"
          >
            <UInput
              v-model="values[cellKey(row.projectId, day.date)]"
              :aria-label="`${row.name}, ${day.date}`"
              class="w-full"
              inputmode="decimal"
              placeholder="0:00"
              :disabled="readonly"
              :loading="savingCell === cellKey(row.projectId, day.date)"
              @blur="save(row, day.date)"
              @keydown.enter.prevent="blurOnEnter"
            />
          </td>
          <td class="px-4 py-3 text-right font-mono font-semibold text-highlighted">
            {{ formatMinutes(row.totalMinutes) }}
          </td>
        </tr>
      </tbody>
      <tfoot class="border-t border-default bg-elevated/40">
        <tr>
          <th class="px-4 py-3 text-left font-medium text-muted">Daily total</th>
          <td
            v-for="day in summary.days"
            :key="day.date"
            class="px-2 py-3 text-center"
          >
            <span class="block font-mono font-semibold text-highlighted">
              {{ formatMinutes(day.totalMinutes) }}
            </span>
            <span
              v-if="day.missingMinutes > 0"
              class="mt-0.5 block text-xs text-warning"
            >
              {{ formatMinutes(day.missingMinutes) }} short
            </span>
          </td>
          <td class="px-4 py-3 text-right font-mono font-semibold text-highlighted">
            {{ formatMinutes(summary.totalMinutes) }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
