<script setup lang="ts">
  import type {
    CreateRateInput,
    ProjectDto,
    RateDto,
    RateKind,
    RateScope,
    TaskDto,
  } from '@stampp/shared';
  import {
    listResultSchema,
    projectDtoSchema,
    rateDtoSchema,
    taskDtoSchema,
    memberListSchema,
  } from '@stampp/shared';
  import * as v from 'valibot';
  import { formatRateAmount, majorToMinor } from '~/utils/rates';

  definePageMeta({ layout: 'workspace' });

  type MemberOption = {
    userId: string;
    label: string;
  };

  const ratesListSchema = listResultSchema(rateDtoSchema);
  const projectsListSchema = listResultSchema(projectDtoSchema);
  const tasksListSchema = listResultSchema(taskDtoSchema);

  const { apiFetch, apiSend } = useApi();
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');

  const rates = ref<RateDto[]>([]);
  const projects = ref<ProjectDto[]>([]);
  const tasks = ref<TaskDto[]>([]);
  const members = ref<MemberOption[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const createOpen = ref(false);
  const createLoading = ref(false);
  const createError = ref<string | null>(null);
  const revokingId = ref<string | null>(null);

  const kind = ref<RateKind>('billable');
  const scope = ref<RateScope>('org');
  const amountMajor = ref<number>(100);
  const currency = ref('USD');
  const effectiveFrom = ref('');
  const userId = ref<string | undefined>();
  const projectId = ref<string | undefined>();
  const taskId = ref<string | undefined>();

  const kindOptions = [
    { label: 'Billable', value: 'billable' },
    { label: 'Cost', value: 'cost' },
  ];

  const scopeOptions = [
    { label: 'Workspace default', value: 'org' },
    { label: 'Member', value: 'user' },
    { label: 'Project', value: 'project' },
    { label: 'Member + project', value: 'user_project' },
    { label: 'Task', value: 'task' },
  ];

  const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'PHP'].map((code) => ({
    label: code,
    value: code,
  }));

  const projectOptions = computed(() => [
    { label: 'Select a project', value: undefined },
    ...projects.value.map((project) => ({ label: project.name, value: project.id })),
  ]);

  const taskOptions = computed(() => [
    { label: 'Select a task', value: undefined },
    ...tasks.value.map((task) => ({ label: task.name, value: task.id })),
  ]);

  const memberOptions = computed(() => [
    { label: 'Select a member', value: undefined },
    ...members.value.map((member) => ({ label: member.label, value: member.userId })),
  ]);

  const needsUser = computed(() => scope.value === 'user' || scope.value === 'user_project');
  const needsProject = computed(
    () => scope.value === 'project' || scope.value === 'user_project' || scope.value === 'task',
  );
  const needsTask = computed(() => scope.value === 'task');

  const projectById = computed(() => {
    const map = new Map<string, string>();
    for (const project of projects.value) {
      map.set(project.id, project.name);
    }
    return map;
  });

  const taskById = computed(() => {
    const map = new Map<string, string>();
    for (const task of tasks.value) {
      map.set(task.id, task.name);
    }
    return map;
  });

  const memberByUserId = computed(() => {
    const map = new Map<string, string>();
    for (const member of members.value) {
      map.set(member.userId, member.label);
    }
    return map;
  });

  const scopeLabel: Record<RateScope, string> = {
    org: 'Workspace',
    user: 'Member',
    project: 'Project',
    user_project: 'Member + project',
    task: 'Task',
  };

  function targetLabel(rate: RateDto): string {
    const parts: string[] = [];
    if (rate.userId) {
      parts.push(memberByUserId.value.get(rate.userId) ?? rate.userId);
    }
    if (rate.projectId) {
      parts.push(projectById.value.get(rate.projectId) ?? rate.projectId);
    }
    if (rate.taskId) {
      parts.push(taskById.value.get(rate.taskId) ?? rate.taskId);
    }
    return parts.length > 0 ? parts.join(' · ') : 'All work';
  }

  function resetForm() {
    kind.value = 'billable';
    scope.value = 'org';
    amountMajor.value = 100;
    currency.value = 'USD';
    effectiveFrom.value = new Date().toISOString().slice(0, 16);
    userId.value = undefined;
    projectId.value = undefined;
    taskId.value = undefined;
  }

  function toIsoInput(value: string): string {
    if (value.endsWith('Z') || value.includes('+')) {
      return new Date(value).toISOString();
    }
    return new Date(`${value}:00.000Z`).toISOString();
  }

  async function loadTasks(project: string | undefined) {
    tasks.value = [];
    taskId.value = undefined;
    if (!project) {
      return;
    }
    const result = await apiFetch(
      tasksListSchema,
      `/workspaces/${workspaceId.value}/projects/${project}/tasks?limit=100&status=active`,
    );
    tasks.value = result.items;
  }

  async function loadMembers() {
    const result = await client.organization.listMembers({
      query: { organizationId: workspaceId.value },
    });
    if (result.error || !result.data) {
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

  async function loadRates() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [rateResult, projectResult] = await Promise.all([
        apiFetch(ratesListSchema, `/workspaces/${workspaceId.value}/rates?limit=100`),
        apiFetch(
          projectsListSchema,
          `/workspaces/${workspaceId.value}/projects?limit=100&status=active`,
        ),
      ]);
      rates.value = rateResult.items;
      projects.value = projectResult.items;
      await loadMembers();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load rates';
      errorMessage.value =
        message.includes('permission') || message.includes('Permission')
          ? 'You need admin settings access to manage workspace rates.'
          : message;
      rates.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function createRate() {
    createLoading.value = true;
    createError.value = null;
    try {
      const payload: CreateRateInput = {
        kind: kind.value,
        scope: scope.value,
        amountMinor: majorToMinor(Number(amountMajor.value), currency.value),
        currency: currency.value,
        effectiveFrom: toIsoInput(effectiveFrom.value),
        userId: needsUser.value ? (userId.value ?? null) : null,
        projectId: needsProject.value ? (projectId.value ?? null) : null,
        taskId: needsTask.value ? (taskId.value ?? null) : null,
      };

      await apiFetch(rateDtoSchema, `/workspaces/${workspaceId.value}/rates`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      createOpen.value = false;
      resetForm();
      await loadRates();
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not create rate';
    } finally {
      createLoading.value = false;
    }
  }

  async function revokeRate(rate: RateDto) {
    revokingId.value = rate.id;
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/rates/${rate.id}`, {
        method: 'DELETE',
      });
      await loadRates();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not revoke rate';
    } finally {
      revokingId.value = null;
    }
  }

  watch(projectId, async (next) => {
    if (needsTask.value) {
      await loadTasks(next);
    } else {
      tasks.value = [];
      taskId.value = undefined;
    }
  });

  watch(scope, async (next) => {
    if (next === 'task' && projectId.value) {
      await loadTasks(projectId.value);
      return;
    }
    if (next !== 'task') {
      taskId.value = undefined;
      tasks.value = [];
    }
  });

  onMounted(async () => {
    resetForm();
    await loadRates();
  });
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">Rates</h1>
        <p class="text-sm text-muted">
          Billable and labor cost rates with historical versions. New versions never rewrite past
          money.
        </p>
      </div>
      <UButton
        @click="
          createOpen = true;
          resetForm();
        "
      >
        New rate
      </UButton>
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
        @submit.prevent="createRate"
      >
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="Kind"
            required
          >
            <USelect
              v-model="kind"
              :items="kindOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Applies to"
            required
          >
            <USelect
              v-model="scope"
              :items="scopeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="needsUser"
            label="Member"
            required
          >
            <USelect
              v-model="userId"
              :items="memberOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="needsProject"
            label="Project"
            required
          >
            <USelect
              v-model="projectId"
              :items="projectOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="needsTask"
            label="Task"
            required
          >
            <USelect
              v-model="taskId"
              :items="taskOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Amount per hour"
            required
            help="Stored as integer minor units. Historical time keeps the rate that was active then."
          >
            <UInput
              v-model.number="amountMajor"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            label="Currency"
            required
          >
            <USelect
              v-model="currency"
              :items="currencyOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Effective from"
            required
          >
            <UInput
              v-model="effectiveFrom"
              type="datetime-local"
              class="w-full"
              required
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
            Create rate
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

    <p
      v-if="loading"
      class="text-sm text-muted"
    >
      Loading rates…
    </p>

    <p
      v-else-if="rates.length === 0 && !errorMessage && !createOpen"
      class="text-sm text-muted"
    >
      No rates yet. Set workspace, member, project, or task rates for billable and cost reporting.
    </p>

    <ul
      v-else
      class="divide-y divide-default rounded-lg border border-default"
    >
      <li
        v-for="rate in rates"
        :key="rate.id"
        class="flex flex-wrap items-start justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium text-highlighted">
              {{ formatRateAmount(rate.amountMinor, rate.currency) }} / hour
            </p>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ rate.kind === 'billable' ? 'Billable' : 'Cost' }}
            </UBadge>
            <UBadge
              color="info"
              variant="subtle"
              size="sm"
            >
              {{ scopeLabel[rate.scope] }}
            </UBadge>
            <UBadge
              :color="rate.effectiveTo ? 'neutral' : 'success'"
              variant="subtle"
              size="sm"
            >
              {{ rate.effectiveTo ? 'Closed' : 'Open' }}
            </UBadge>
          </div>
          <p class="truncate text-sm text-muted">{{ targetLabel(rate) }}</p>
          <p class="text-xs text-muted">
            From {{ new Date(rate.effectiveFrom).toLocaleString() }}
            <template v-if="rate.effectiveTo">
              · to {{ new Date(rate.effectiveTo).toLocaleString() }}
            </template>
          </p>
        </div>
        <UButton
          v-if="!rate.effectiveTo"
          size="sm"
          color="error"
          variant="soft"
          :loading="revokingId === rate.id"
          @click="revokeRate(rate)"
        >
          Revoke
        </UButton>
      </li>
    </ul>
  </div>
</template>
