<script setup lang="ts">
  import type { ProjectBudgetUsage, ProjectDto, TaskDto } from '@stampp/shared';
  import {
    listResultSchema,
    projectBudgetUsageSchema,
    projectDtoSchema,
    taskDtoSchema,
  } from '@stampp/shared';
  import { formatRateAmount } from '~/utils/rates';
  import { formatMinutes } from '~/utils/week';

  definePageMeta({ layout: 'workspace' });

  const tasksListSchema = listResultSchema(taskDtoSchema);

  const { apiFetch, apiSend } = useApi();

  const workspaceId = useRouteParam('workspaceId');
  const projectId = useRouteParam('projectId');

  const project = ref<ProjectDto | null>(null);
  const tasks = ref<TaskDto[]>([]);
  const budgetUsage = ref<ProjectBudgetUsage | null>(null);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const taskName = ref('');
  const taskEstimate = ref<string>('');
  const taskLoading = ref(false);
  const taskError = ref<string | null>(null);
  const budgetOpen = ref(false);
  const budgetLoading = ref(false);
  const budgetError = ref<string | null>(null);
  const budgetMinutes = ref<string>('');
  const budgetAmount = ref<string>('');
  const budgetCurrency = ref('USD');
  const budgetAlertPercent = ref(80);

  function levelColor(level: 'none' | 'warning' | 'exceeded') {
    if (level === 'exceeded') return 'error' as const;
    if (level === 'warning') return 'warning' as const;
    return 'success' as const;
  }

  function levelLabel(level: 'none' | 'warning' | 'exceeded') {
    if (level === 'exceeded') return 'Over budget';
    if (level === 'warning') return 'Near budget';
    return 'Within budget';
  }

  function syncBudgetForm(): void {
    if (!project.value) return;
    budgetMinutes.value =
      project.value.budgetMinutes === null ? '' : String(project.value.budgetMinutes);
    if (project.value.budgetAmountMinor === null || project.value.budgetCurrency === null) {
      budgetAmount.value = '';
      budgetCurrency.value = 'USD';
    } else {
      const digits = project.value.budgetCurrency === 'JPY' ? 0 : 2;
      budgetAmount.value = (project.value.budgetAmountMinor / 10 ** digits).toFixed(digits);
      budgetCurrency.value = project.value.budgetCurrency;
    }
    budgetAlertPercent.value = project.value.budgetAlertAtPercent;
  }

  function toMinorFromMajor(value: string, currency: string): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    const digits = currency === 'JPY' ? 0 : 2;
    return Math.round(parsed * 10 ** digits);
  }

  async function loadBudget(): Promise<void> {
    budgetUsage.value = await apiFetch(
      projectBudgetUsageSchema,
      `/workspaces/${workspaceId.value}/projects/${projectId.value}/budget`,
    );
  }

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
      syncBudgetForm();
      await loadBudget();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load project';
    } finally {
      loading.value = false;
    }
  }

  async function saveBudget() {
    if (!project.value) return;
    budgetLoading.value = true;
    budgetError.value = null;
    try {
      const minutesText = budgetMinutes.value.trim();
      const amountText = budgetAmount.value.trim();
      const amountMinor = amountText ? toMinorFromMajor(amountText, budgetCurrency.value) : null;
      if (amountText && amountMinor === null) {
        budgetError.value = 'Budget amount must be a non-negative number.';
        return;
      }
      if (amountMinor !== null && !budgetCurrency.value) {
        budgetError.value = 'Currency is required when a money budget is set.';
        return;
      }

      const minutes = minutesText ? Number(minutesText) : null;
      if (minutesText && (!Number.isInteger(minutes) || (minutes ?? 0) < 1)) {
        budgetError.value = 'Hours budget must be a positive number of minutes.';
        return;
      }

      project.value = await apiFetch(
        projectDtoSchema,
        `/workspaces/${workspaceId.value}/projects/${projectId.value}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            budgetMinutes: minutes,
            budgetAmountMinor: amountMinor,
            budgetCurrency: amountMinor === null ? null : budgetCurrency.value,
            budgetAlertAtPercent: budgetAlertPercent.value,
          }),
        },
      );
      budgetOpen.value = false;
      await loadBudget();
    } catch (error) {
      budgetError.value = error instanceof Error ? error.message : 'Could not save budget';
    } finally {
      budgetLoading.value = false;
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
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-medium text-highlighted">Budget</h2>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            @click="
              budgetOpen = !budgetOpen;
              if (budgetOpen) syncBudgetForm();
            "
          >
            {{ budgetOpen ? 'Close' : 'Edit budget' }}
          </UButton>
        </div>

        <UCard v-if="budgetOpen">
          <form
            class="grid gap-3 sm:grid-cols-2"
            @submit.prevent="saveBudget"
          >
            <UFormField
              label="Hours budget (minutes)"
              help="Leave empty for no hours budget."
            >
              <UInput
                v-model="budgetMinutes"
                type="number"
                min="1"
                step="1"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Alert at %"
              help="Warn when usage reaches this percent."
            >
              <UInput
                v-model.number="budgetAlertPercent"
                type="number"
                min="1"
                max="100"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Money budget"
              help="Leave empty for no money budget. Uses billable project/org rates."
            >
              <UInput
                v-model="budgetAmount"
                type="number"
                min="0"
                step="0.01"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Currency">
              <UInput
                v-model="budgetCurrency"
                maxlength="3"
                class="w-full"
              />
            </UFormField>
            <UAlert
              v-if="budgetError"
              class="sm:col-span-2"
              color="error"
              variant="subtle"
              :title="budgetError"
            />
            <div class="sm:col-span-2">
              <UButton
                type="submit"
                :loading="budgetLoading"
              >
                Save budget
              </UButton>
            </div>
          </form>
        </UCard>

        <div
          v-if="budgetUsage"
          class="grid gap-3 sm:grid-cols-2"
        >
          <UCard>
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-medium tracking-wide text-muted uppercase">Hours used</p>
                <p class="mt-1 font-mono text-2xl font-semibold text-highlighted">
                  {{ formatMinutes(budgetUsage.usedMinutes) }}
                  <span class="text-sm font-normal text-muted">
                    /
                    {{
                      budgetUsage.budgetMinutes === null
                        ? '—'
                        : formatMinutes(budgetUsage.budgetMinutes)
                    }}
                  </span>
                </p>
              </div>
              <UBadge
                :color="levelColor(budgetUsage.hoursLevel)"
                variant="subtle"
                size="sm"
              >
                {{ levelLabel(budgetUsage.hoursLevel) }}
              </UBadge>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-medium tracking-wide text-muted uppercase">Billable used</p>
                <p class="mt-1 font-mono text-2xl font-semibold text-highlighted">
                  {{
                    budgetUsage.budgetAmountMinor === null || !budgetUsage.currency
                      ? formatMinutes(0)
                      : formatRateAmount(budgetUsage.usedAmountMinor, budgetUsage.currency)
                  }}
                  <span class="text-sm font-normal text-muted">
                    /
                    {{
                      budgetUsage.budgetAmountMinor === null || !budgetUsage.currency
                        ? '—'
                        : formatRateAmount(budgetUsage.budgetAmountMinor, budgetUsage.currency)
                    }}
                  </span>
                </p>
              </div>
              <UBadge
                v-if="budgetUsage.budgetAmountMinor !== null"
                :color="levelColor(budgetUsage.moneyLevel)"
                variant="subtle"
                size="sm"
              >
                {{ levelLabel(budgetUsage.moneyLevel) }}
              </UBadge>
            </div>
          </UCard>
        </div>
      </section>

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
