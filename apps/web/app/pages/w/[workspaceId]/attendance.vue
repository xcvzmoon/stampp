<script setup lang="ts">
  import type { AttendanceDto, CreateAttendanceInput, CurrentAttendance } from '@stampp/shared';
  import {
    attendanceDtoSchema,
    currentAttendanceSchema,
    listResultSchema,
    memberListSchema,
  } from '@stampp/shared';
  import * as v from 'valibot';
  import WorkspaceEmptyState from '~/components/workspace/WorkspaceEmptyState.vue';
  import WorkspaceLoadingState from '~/components/workspace/WorkspaceLoadingState.vue';
  import { formatMinutes } from '~/utils/week';

  definePageMeta({ layout: 'workspace' });

  type MemberOption = {
    userId: string;
    label: string;
  };

  const attendanceListSchema = listResultSchema(attendanceDtoSchema);

  const { apiFetch, apiSend } = useApi();
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const current = shallowRef<CurrentAttendance | null>(null);
  const records = shallowRef<AttendanceDto[]>([]);
  const members = shallowRef<MemberOption[]>([]);
  const loading = shallowRef(true);
  const busy = shallowRef(false);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);
  const filterUserId = shallowRef<string | undefined>(undefined);
  const createOpen = shallowRef(false);
  const createLoading = shallowRef(false);
  const createError = shallowRef<string | null>(null);
  const manualUserId = shallowRef<string | undefined>(undefined);
  const manualClockIn = shallowRef('');
  const manualClockOut = shallowRef('');
  const manualNote = shallowRef('');
  const now = shallowRef(Date.now());

  const memberOptions = computed(() => [
    { label: 'All members', value: undefined },
    ...members.value.map((member) => ({ label: member.label, value: member.userId })),
  ]);

  const clockedIn = computed(() => current.value?.clockedIn ?? false);
  const openRecord = computed(() => current.value?.record ?? null);

  const elapsedLabel = computed(() => {
    if (!clockedIn.value || !openRecord.value) return '';
    const openMinutes = Math.max(
      0,
      Math.floor((now.value - new Date(openRecord.value.clockInAt).getTime()) / 60_000),
    );
    return formatMinutes(openMinutes);
  });

  const timeFormatter = computed(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
  );

  function formatInstant(value: string | null): string {
    if (!value) return '—';
    return timeFormatter.value.format(new Date(value));
  }

  function formatDuration(minutes: number | null, state: AttendanceDto['state']): string {
    if (state === 'open') return elapsedLabel.value || '0:00';
    if (minutes === null) return '—';
    return formatMinutes(minutes);
  }

  async function loadCurrent() {
    current.value = await apiFetch(
      currentAttendanceSchema,
      `/workspaces/${workspaceId.value}/attendance/current`,
    );
  }

  async function loadRecords() {
    const params = new URLSearchParams({ limit: '100' });
    if (filterUserId.value) params.set('userId', filterUserId.value);
    const result = await apiFetch(
      attendanceListSchema,
      `/workspaces/${workspaceId.value}/attendance?${params.toString()}`,
    );
    records.value = result.items.toSorted((left, right) =>
      right.clockInAt.localeCompare(left.clockInAt),
    );
  }

  async function loadMembers() {
    const result = await client.organization.listMembers({
      query: { organizationId: workspaceId.value },
    });
    if (result.error) {
      members.value = [];
      return;
    }
    const parsed = v.safeParse(memberListSchema, result.data);
    if (!parsed.success) {
      members.value = [];
      return;
    }
    const options: MemberOption[] = [];
    for (const entry of parsed.output.members) {
      const displayName = entry.user.name?.trim();
      options.push({
        userId: entry.userId,
        label: displayName && displayName.length > 0 ? displayName : entry.user.email,
      });
    }
    members.value = options;
  }

  async function refresh() {
    errorMessage.value = null;
    try {
      await Promise.all([loadCurrent(), loadRecords()]);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load attendance';
      current.value = null;
      records.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function clockAction(action: 'in' | 'out') {
    busy.value = true;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      if (action === 'in') {
        await apiFetch(
          attendanceDtoSchema,
          `/workspaces/${workspaceId.value}/attendance/clock-in`,
          {
            method: 'POST',
            body: JSON.stringify({ timezone }),
          },
        );
        successMessage.value = 'Clocked in.';
      } else {
        await apiFetch(
          attendanceDtoSchema,
          `/workspaces/${workspaceId.value}/attendance/clock-out`,
          {
            method: 'POST',
            body: JSON.stringify({}),
          },
        );
        successMessage.value = 'Clocked out.';
      }
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Attendance action failed';
    } finally {
      busy.value = false;
    }
  }

  async function createManual() {
    createLoading.value = true;
    createError.value = null;
    try {
      const body = {
        clockInAt: new Date(manualClockIn.value).toISOString(),
        clockOutAt: manualClockOut.value ? new Date(manualClockOut.value).toISOString() : null,
        timezone,
        note: manualNote.value.trim() || undefined,
        userId: manualUserId.value,
      } satisfies CreateAttendanceInput;
      await apiFetch(attendanceDtoSchema, `/workspaces/${workspaceId.value}/attendance`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      createOpen.value = false;
      manualClockIn.value = '';
      manualClockOut.value = '';
      manualNote.value = '';
      await refresh();
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not create attendance';
    } finally {
      createLoading.value = false;
    }
  }

  async function removeRecord(record: AttendanceDto) {
    busy.value = true;
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/attendance/${record.id}`, {
        method: 'DELETE',
      });
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete record';
    } finally {
      busy.value = false;
    }
  }

  async function onFilterChange() {
    loading.value = true;
    await refresh();
  }

  onMounted(async () => {
    await Promise.all([loadMembers(), refresh()]);
    const timer = setInterval(() => {
      now.value = Date.now();
    }, 30_000);
    onBeforeUnmount(() => clearInterval(timer));
  });
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Attendance</h1>
        <p class="text-sm text-muted">
          Clock in and out for presence. This stays separate from project time tracking.
        </p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        @click="createOpen = !createOpen"
      >
        {{ createOpen ? 'Close form' : 'Manual entry' }}
      </UButton>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />
    <UAlert
      v-else-if="successMessage"
      color="success"
      variant="subtle"
      :title="successMessage"
    />

    <UCard>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="space-y-1">
          <p class="text-sm text-muted">Current status</p>
          <div class="flex items-center gap-2">
            <UBadge
              :color="clockedIn ? 'success' : 'neutral'"
              variant="subtle"
            >
              {{ clockedIn ? 'Clocked in' : 'Clocked out' }}
            </UBadge>
            <span
              v-if="clockedIn && openRecord"
              class="text-sm text-muted"
            >
              Since {{ formatInstant(openRecord.clockInAt) }}
            </span>
          </div>
          <p
            v-if="clockedIn"
            class="text-2xl font-semibold text-highlighted tabular-nums"
          >
            {{ elapsedLabel }}
          </p>
        </div>
        <div class="flex gap-2">
          <UButton
            v-if="!clockedIn"
            :loading="busy"
            @click="clockAction('in')"
          >
            Clock in
          </UButton>
          <UButton
            v-else
            color="error"
            variant="soft"
            :loading="busy"
            @click="clockAction('out')"
          >
            Clock out
          </UButton>
        </div>
      </div>
    </UCard>

    <UCard v-if="createOpen">
      <form
        class="space-y-4"
        @submit.prevent="createManual"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Member"
            help="Leave as your account to add your own missed punch."
          >
            <USelect
              v-model="manualUserId"
              :items="memberOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Clock in"
            required
          >
            <UInput
              v-model="manualClockIn"
              type="datetime-local"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField label="Clock out">
            <UInput
              v-model="manualClockOut"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Note">
            <UInput
              v-model="manualNote"
              maxlength="500"
              class="w-full"
            />
          </UFormField>
        </div>
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
            Save attendance
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

    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 class="text-lg font-medium text-highlighted">Recent punches</h2>
      <UFormField label="Member">
        <USelect
          v-model="filterUserId"
          :items="memberOptions"
          value-key="value"
          class="w-48"
          @update:model-value="onFilterChange"
        />
      </UFormField>
    </div>

    <WorkspaceLoadingState
      v-if="loading"
      label="Loading attendance"
    />

    <WorkspaceEmptyState
      v-else-if="records.length === 0 && !errorMessage"
      title="No attendance records"
      description="Clock in to start your first attendance record."
      icon="i-lucide-calendar-check"
    />

    <ul
      v-else
      class="divide-y divide-default rounded-lg border border-default"
    >
      <li
        v-for="record in records"
        :key="record.id"
        class="flex flex-wrap items-start justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium text-highlighted tabular-nums">
              {{ formatInstant(record.clockInAt) }} → {{ formatInstant(record.clockOutAt) }}
            </p>
            <UBadge
              :color="record.state === 'open' ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              {{
                record.state === 'open'
                  ? 'Open'
                  : formatDuration(record.durationMinutes, record.state)
              }}
            </UBadge>
            <UBadge
              color="info"
              variant="subtle"
              size="sm"
            >
              {{ record.source === 'manual' ? 'Manual' : 'Clock' }}
            </UBadge>
          </div>
          <p class="text-sm text-muted">
            {{ record.workDate }} · {{ record.timezone }}
            <template v-if="record.note"> · {{ record.note }} </template>
          </p>
        </div>
        <UButton
          color="error"
          variant="ghost"
          size="sm"
          :loading="busy"
          @click="removeRecord(record)"
        >
          Delete
        </UButton>
      </li>
    </ul>
  </div>
</template>
