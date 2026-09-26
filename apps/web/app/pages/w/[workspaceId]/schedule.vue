<script setup lang="ts">
  import type {
    AssignmentDto,
    CapacityDto,
    CreateAssignmentInput,
    ProjectDto,
    UpsertCapacityInput,
    WorkloadResult,
  } from '@stampp/shared';
  import {
    assignmentDtoSchema,
    capacityDtoSchema,
    createAssignmentInputSchema,
    listResultSchema,
    memberListSchema,
    projectDtoSchema,
    upsertCapacityInputSchema,
    workloadResultSchema,
  } from '@stampp/shared';
  import * as v from 'valibot';
  import WorkspaceLoadingState from '~/components/workspace/WorkspaceLoadingState.vue';

  definePageMeta({ layout: 'workspace' });

  type MemberOption = { userId: string; label: string };

  const assignmentsListSchema = listResultSchema(assignmentDtoSchema);
  const projectsListSchema = listResultSchema(projectDtoSchema);

  const { apiFetch, apiSend } = useApi();
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');

  const today = new Date();
  const from = shallowRef(addDays(today, -7));
  const to = shallowRef(addDays(today, 21));

  const capacities = shallowRef<CapacityDto[]>([]);
  const assignments = shallowRef<AssignmentDto[]>([]);
  const projects = shallowRef<ProjectDto[]>([]);
  const workload = shallowRef<WorkloadResult | null>(null);
  const members = shallowRef<MemberOption[]>([]);
  const loading = shallowRef(true);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);
  const busy = shallowRef(false);

  const capacityHours = shallowRef(40);
  const capacityUserId = shallowRef<string | undefined>(undefined);

  const assignOpen = shallowRef(false);
  const assignLoading = shallowRef(false);
  const assignError = shallowRef<string | null>(null);
  const assignUserId = shallowRef<string | undefined>(undefined);
  const assignProjectId = shallowRef<string | undefined>(undefined);
  const assignStart = shallowRef('');
  const assignEnd = shallowRef('');
  const assignHours = shallowRef(20);

  function addDays(base: Date, days: number): string {
    const value = new Date(base);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  const memberOptions = computed(() =>
    members.value.map((member) => ({ label: member.label, value: member.userId })),
  );
  const projectOptions = computed(() =>
    projects.value
      .filter((project) => project.status === 'active')
      .map((project) => ({ label: project.name, value: project.id })),
  );

  const memberByUserId = computed(() => {
    const map = new Map<string, string>();
    for (const member of members.value) map.set(member.userId, member.label);
    return map;
  });

  const statusColor = computed<Record<string, 'error' | 'success' | 'warning' | 'neutral'>>(() => ({
    overbooked: 'error',
    on_track: 'success',
    underutilized: 'warning',
    unscheduled: 'neutral',
  }));

  function memberLabel(userId: string): string {
    return memberByUserId.value.get(userId) ?? userId;
  }

  function hours(value: number): string {
    return `${value % 1 === 0 ? value : value.toFixed(1)} h`;
  }

  async function loadMembers(): Promise<void> {
    const result = await client.organization.listMembers({
      query: { organizationId: workspaceId.value },
    });
    if (result.error || !result.data) return;
    const parsed = v.safeParse(memberListSchema, result.data);
    if (!parsed.success) return;
    members.value = parsed.output.members.map((entry) => {
      const name = entry.user.name?.trim();
      return {
        userId: entry.userId,
        label: name && name.length > 0 ? name : entry.user.email,
      };
    });
  }

  async function refresh(): Promise<void> {
    errorMessage.value = null;
    try {
      const [capacityResult, assignmentResult, projectResult, workloadResult] = await Promise.all([
        apiFetch(
          listResultSchema(capacityDtoSchema),
          `/workspaces/${workspaceId.value}/schedules/capacities?limit=100`,
        ),
        apiFetch(
          assignmentsListSchema,
          `/workspaces/${workspaceId.value}/schedules/assignments?limit=200&active=true`,
        ),
        apiFetch(
          projectsListSchema,
          `/workspaces/${workspaceId.value}/projects?limit=100&status=active`,
        ),
        apiFetch(
          workloadResultSchema,
          `/workspaces/${workspaceId.value}/schedules/workload?from=${from.value}&to=${to.value}`,
        ),
        loadMembers(),
      ]);
      capacities.value = capacityResult.items;
      assignments.value = assignmentResult.items;
      projects.value = projectResult.items;
      workload.value = workloadResult;
      if (!capacityUserId.value && members.value[0]) {
        capacityUserId.value = members.value[0].userId;
        const own = capacities.value.find((row) => row.userId === capacityUserId.value);
        if (own) capacityHours.value = own.weeklyHours;
      }
      if (!assignUserId.value && members.value[0]) {
        assignUserId.value = members.value[0].userId;
      }
      if (!assignProjectId.value && projectOptions.value[0]) {
        assignProjectId.value = projectOptions.value[0].value;
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load schedule';
      workload.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function saveCapacity(): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      const payload = {
        userId: capacityUserId.value,
        weeklyHours: capacityHours.value,
      } satisfies UpsertCapacityInput;
      v.parse(upsertCapacityInputSchema, payload);
      await apiFetch(capacityDtoSchema, `/workspaces/${workspaceId.value}/schedules/capacity`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      successMessage.value = 'Capacity saved.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not save capacity';
    } finally {
      busy.value = false;
    }
  }

  async function createAssignment(): Promise<void> {
    assignLoading.value = true;
    assignError.value = null;
    try {
      const payload = {
        userId: assignUserId.value ?? '',
        projectId: assignProjectId.value ?? '',
        startDate: assignStart.value,
        endDate: assignEnd.value,
        hoursPerWeek: assignHours.value,
      } satisfies CreateAssignmentInput;
      v.parse(createAssignmentInputSchema, payload);
      await apiFetch(
        assignmentDtoSchema,
        `/workspaces/${workspaceId.value}/schedules/assignments`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      assignOpen.value = false;
      assignStart.value = '';
      assignEnd.value = '';
      successMessage.value = 'Assignment created.';
      await refresh();
    } catch (error) {
      assignError.value = error instanceof Error ? error.message : 'Could not create assignment';
    } finally {
      assignLoading.value = false;
    }
  }

  async function removeAssignment(assignment: AssignmentDto): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/schedules/assignments/${assignment.id}`, {
        method: 'DELETE',
      });
      successMessage.value = 'Assignment deleted.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete assignment';
    } finally {
      busy.value = false;
    }
  }

  onMounted(async () => {
    await refresh();
  });
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Schedule</h1>
        <p class="text-sm text-muted">
          Weekly capacity, project assignments, and scheduled vs tracked workload for the selected
          range.
        </p>
      </div>
      <UButton @click="assignOpen = !assignOpen">
        {{ assignOpen ? 'Close form' : 'New assignment' }}
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

    <UCard v-if="assignOpen">
      <form
        class="space-y-4"
        @submit.prevent="createAssignment"
      >
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField
            label="Member"
            required
          >
            <USelect
              v-model="assignUserId"
              :items="memberOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Project"
            required
          >
            <USelect
              v-model="assignProjectId"
              :items="projectOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Hours / week"
            required
          >
            <UInput
              v-model.number="assignHours"
              type="number"
              min="0.5"
              max="168"
              step="0.5"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            label="Start"
            required
          >
            <UInput
              v-model="assignStart"
              type="date"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            label="End"
            required
          >
            <UInput
              v-model="assignEnd"
              type="date"
              class="w-full"
              required
            />
          </UFormField>
        </div>
        <UAlert
          v-if="assignError"
          color="error"
          variant="subtle"
          :title="assignError"
        />
        <div class="flex gap-2">
          <UButton
            type="submit"
            :loading="assignLoading"
          >
            Create assignment
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            @click="assignOpen = false"
          >
            Cancel
          </UButton>
        </div>
      </form>
    </UCard>

    <section class="grid gap-4 lg:grid-cols-2">
      <UCard>
        <template #header>
          <p class="font-medium text-highlighted">Weekly capacity</p>
        </template>
        <form
          class="flex flex-wrap items-end gap-3"
          @submit.prevent="saveCapacity"
        >
          <UFormField label="Member">
            <USelect
              v-model="capacityUserId"
              :items="memberOptions"
              value-key="value"
              class="w-56"
            />
          </UFormField>
          <UFormField label="Hours / week">
            <UInput
              v-model.number="capacityHours"
              type="number"
              min="0.5"
              max="168"
              step="0.5"
              class="w-32"
              required
            />
          </UFormField>
          <UButton
            type="submit"
            size="sm"
            :loading="busy"
          >
            Save capacity
          </UButton>
        </form>
        <ul
          v-if="capacities.length"
          class="mt-4 divide-y divide-default border-t border-default text-sm"
        >
          <li
            v-for="row in capacities"
            :key="row.id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <span>{{ memberLabel(row.userId) }}</span>
            <span class="tabular-nums">{{ hours(row.weeklyHours) }}</span>
          </li>
        </ul>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="font-medium text-highlighted">Workload range</p>
            <div class="flex items-end gap-2">
              <UFormField label="From">
                <UInput
                  v-model="from"
                  type="date"
                  size="sm"
                />
              </UFormField>
              <UFormField label="To">
                <UInput
                  v-model="to"
                  type="date"
                  size="sm"
                />
              </UFormField>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                :loading="busy"
                @click="
                  busy = true;
                  refresh().finally(() => (busy = false));
                "
              >
                Reload
              </UButton>
            </div>
          </div>
        </template>
        <WorkspaceLoadingState
          v-if="loading"
          label="Loading workload"
        />
        <ul
          v-else-if="workload?.members.length"
          class="space-y-3"
        >
          <li
            v-for="row in workload.members"
            :key="row.userId"
            class="rounded-lg border border-default p-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="font-medium text-highlighted">{{ memberLabel(row.userId) }}</p>
              <UBadge
                :color="statusColor[row.status] ?? 'neutral'"
                variant="subtle"
                size="sm"
              >
                {{ row.status.replace('_', ' ') }}
              </UBadge>
            </div>
            <p class="mt-1 text-sm text-muted tabular-nums">
              Capacity {{ hours(row.capacityHours) }} · Scheduled {{ hours(row.scheduledHours) }} ·
              Tracked {{ hours(row.trackedHours) }}
            </p>
            <ul
              v-if="row.assignments.length"
              class="mt-2 flex flex-wrap gap-2 text-xs text-muted"
            >
              <li
                v-for="assignment in row.assignments"
                :key="assignment.assignmentId"
                class="rounded border border-default px-2 py-1"
              >
                {{ assignment.projectName ?? assignment.projectId }} ·
                {{ hours(assignment.hoursPerWeek) }}/wk
              </li>
            </ul>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          No workload data for this range.
        </p>
      </UCard>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-medium text-highlighted">Assignments</h2>
      <p
        v-if="!assignments.length"
        class="text-sm text-muted"
      >
        No active assignments yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="assignment in assignments"
          :key="assignment.id"
          class="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
        >
          <div>
            <p class="font-medium text-highlighted">
              {{ memberLabel(assignment.userId) }} ·
              {{
                projects.find((project) => project.id === assignment.projectId)?.name ??
                assignment.projectId
              }}
            </p>
            <p class="text-sm text-muted">
              {{ assignment.startDate }} → {{ assignment.endDate }} ·
              {{ hours(assignment.hoursPerWeek) }}/week
              <template v-if="assignment.note"> · {{ assignment.note }} </template>
            </p>
          </div>
          <UButton
            size="sm"
            color="error"
            variant="ghost"
            :loading="busy"
            @click="removeAssignment(assignment)"
          >
            Delete
          </UButton>
        </li>
      </ul>
    </section>
  </div>
</template>
