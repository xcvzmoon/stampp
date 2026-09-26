<script setup lang="ts">
  import type { ExpenseDto, ProjectDto } from '@stampp/shared';
  import {
    expenseDtoSchema,
    expenseListResultSchema,
    listResultSchema,
    projectDtoSchema,
  } from '@stampp/shared';
  import * as v from 'valibot';
  import WorkspaceEmptyState from '~/components/workspace/WorkspaceEmptyState.vue';
  import WorkspaceLoadingState from '~/components/workspace/WorkspaceLoadingState.vue';
  import { formatRateAmount } from '~/utils/rates';

  definePageMeta({ layout: 'workspace' });

  const projectsListSchema = listResultSchema(projectDtoSchema);
  const { apiFetch, apiSend } = useApi();
  const workspaceId = useRouteParam('workspaceId');

  const expenses = ref<ExpenseDto[]>([]);
  const projects = ref<ProjectDto[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const createOpen = ref(false);
  const createLoading = ref(false);
  const createError = ref<string | null>(null);
  const savingId = ref<string | null>(null);

  const expenseDate = ref(new Date().toISOString().slice(0, 10));
  const amountMajor = ref(25);
  const currency = ref('USD');
  const category = ref('meals');
  const description = ref('');
  const notes = ref('');
  const projectId = ref<string | undefined>();
  const billable = ref(false);

  const categoryOptions = [
    { label: 'Travel', value: 'travel' },
    { label: 'Meals', value: 'meals' },
    { label: 'Lodging', value: 'lodging' },
    { label: 'Software', value: 'software' },
    { label: 'Equipment', value: 'equipment' },
    { label: 'Other', value: 'other' },
  ];

  const currencyOptions = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'PHP'].map((code) => ({
    label: code,
    value: code,
  }));

  const projectOptions = computed(() => [
    { label: 'No project', value: undefined },
    ...projects.value.map((project) => ({ label: project.name, value: project.id })),
  ]);

  const projectNameById = computed(() => {
    const map = new Map<string, string>();
    for (const project of projects.value) map.set(project.id, project.name);
    return map;
  });

  function majorToMinor(major: number, code: string): number {
    const digits = code === 'JPY' ? 0 : 2;
    return Math.round(major * 10 ** digits);
  }

  async function loadExpenses() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [expenseResult, projectResult] = await Promise.all([
        apiFetch(expenseListResultSchema, `/workspaces/${workspaceId.value}/expenses?limit=100`),
        apiFetch(
          projectsListSchema,
          `/workspaces/${workspaceId.value}/projects?limit=100&status=active`,
        ),
      ]);
      expenses.value = expenseResult.items;
      projects.value = projectResult.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load expenses';
    } finally {
      loading.value = false;
    }
  }

  function resetForm() {
    expenseDate.value = new Date().toISOString().slice(0, 10);
    amountMajor.value = 25;
    currency.value = 'USD';
    category.value = 'meals';
    description.value = '';
    notes.value = '';
    projectId.value = undefined;
    billable.value = false;
  }

  async function createExpense() {
    createLoading.value = true;
    createError.value = null;
    try {
      await apiFetch(expenseDtoSchema, `/workspaces/${workspaceId.value}/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          expenseDate: expenseDate.value,
          amountMinor: majorToMinor(Number(amountMajor.value), currency.value),
          currency: currency.value,
          category: category.value,
          description: description.value,
          notes: notes.value || undefined,
          projectId: projectId.value ?? null,
          billable: billable.value,
        }),
      });
      createOpen.value = false;
      resetForm();
      await loadExpenses();
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not create expense';
    } finally {
      createLoading.value = false;
    }
  }

  async function setStatus(expense: ExpenseDto, status: 'open' | 'approved' | 'rejected') {
    savingId.value = expense.id;
    errorMessage.value = null;
    try {
      await apiFetch(expenseDtoSchema, `/workspaces/${workspaceId.value}/expenses/${expense.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadExpenses();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not update expense';
    } finally {
      savingId.value = null;
    }
  }

  async function removeExpense(expense: ExpenseDto) {
    savingId.value = expense.id;
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/expenses/${expense.id}`, {
        method: 'DELETE',
      });
      await loadExpenses();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete expense';
    } finally {
      savingId.value = null;
    }
  }

  async function uploadReceipt(expense: ExpenseDto, file: File) {
    savingId.value = expense.id;
    errorMessage.value = null;
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(
        `${useRuntimeConfig().public.apiBaseURL}/workspaces/${workspaceId.value}/expenses/${expense.id}/receipt`,
        {
          method: 'POST',
          credentials: 'include',
          body: form,
        },
      );
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const parsed = v.safeParse(v.object({ message: v.optional(v.string()) }), payload);
        throw new Error(
          parsed.success
            ? (parsed.output.message ?? 'Could not upload receipt')
            : 'Could not upload receipt',
        );
      }
      await loadExpenses();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not upload receipt';
    } finally {
      savingId.value = null;
    }
  }

  function onReceiptChange(expense: ExpenseDto, event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    const file = target.files?.[0];
    if (!file) return;
    void uploadReceipt(expense, file);
    target.value = '';
  }

  onMounted(async () => {
    resetForm();
    await loadExpenses();
  });
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Expenses</h1>
        <p class="text-sm text-muted">Record project expenses and keep receipts with each claim.</p>
      </div>
      <UButton
        @click="
          createOpen = true;
          resetForm();
        "
      >
        New expense
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
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="createExpense"
      >
        <UFormField
          label="Date"
          required
        >
          <UInput
            v-model="expenseDate"
            type="date"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="Amount"
          required
        >
          <UInput
            v-model.number="amountMajor"
            type="number"
            min="0.01"
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
          label="Category"
          required
        >
          <USelect
            v-model="category"
            :items="categoryOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Project"
          class="sm:col-span-2"
        >
          <USelect
            v-model="projectId"
            :items="projectOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Description"
          required
          class="sm:col-span-2"
        >
          <UInput
            v-model="description"
            class="w-full"
            required
            maxlength="500"
          />
        </UFormField>
        <UFormField
          label="Notes"
          class="sm:col-span-2"
        >
          <UTextarea
            v-model="notes"
            class="w-full"
            :rows="2"
          />
        </UFormField>
        <div class="sm:col-span-2">
          <UCheckbox
            v-model="billable"
            label="Billable"
          />
        </div>
        <UAlert
          v-if="createError"
          class="sm:col-span-2"
          color="error"
          variant="subtle"
          :title="createError"
        />
        <div class="flex gap-2 sm:col-span-2">
          <UButton
            type="submit"
            :loading="createLoading"
          >
            Create expense
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

    <WorkspaceLoadingState
      v-if="loading"
      label="Loading expenses"
    />

    <WorkspaceEmptyState
      v-else-if="expenses.length === 0 && !errorMessage && !createOpen"
      title="No expenses yet"
      description="Add an expense to track project costs and receipts."
      icon="i-lucide-receipt"
    />

    <ul
      v-else
      class="divide-y divide-default rounded-lg border border-default"
    >
      <li
        v-for="expense in expenses"
        :key="expense.id"
        class="flex flex-wrap items-start justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium text-highlighted">
              {{ formatRateAmount(expense.amountMinor, expense.currency) }}
            </p>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ expense.category }}
            </UBadge>
            <UBadge
              color="info"
              variant="subtle"
              size="sm"
            >
              {{ expense.status }}
            </UBadge>
            <UBadge
              v-if="expense.billable"
              color="success"
              variant="subtle"
              size="sm"
            >
              Billable
            </UBadge>
          </div>
          <p class="truncate text-sm text-highlighted">{{ expense.description }}</p>
          <p class="text-xs text-muted">
            {{ expense.expenseDate }}
            <template v-if="expense.projectId">
              · {{ projectNameById.get(expense.projectId) ?? expense.projectId }}
            </template>
            <template v-if="expense.hasReceipt"> · receipt attached </template>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            :disabled="savingId === expense.id"
            @click="setStatus(expense, 'approved')"
          >
            Approve
          </UButton>
          <UButton
            size="sm"
            color="error"
            variant="soft"
            :disabled="savingId === expense.id"
            @click="setStatus(expense, 'rejected')"
          >
            Reject
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            :disabled="savingId === expense.id"
            @click="removeExpense(expense)"
          >
            Delete
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            as="label"
          >
            Receipt
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              class="hidden"
              @change="onReceiptChange(expense, $event)"
            />
          </UButton>
        </div>
      </li>
    </ul>
  </div>
</template>
