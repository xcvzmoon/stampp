<script setup lang="ts">
  import type { ClientDto, InvoiceDto } from '@stampp/shared';
  import {
    clientDtoSchema,
    invoiceDtoSchema,
    invoiceListResultSchema,
    listResultSchema,
  } from '@stampp/shared';
  import { formatRateAmount } from '~/utils/rates';

  definePageMeta({ layout: 'workspace' });

  const clientsListSchema = listResultSchema(clientDtoSchema);
  const { apiFetch, apiSend } = useApi();
  const workspaceId = useRouteParam('workspaceId');

  const invoices = ref<InvoiceDto[]>([]);
  const clients = ref<ClientDto[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const successMessage = ref<string | null>(null);
  const createOpen = ref(false);
  const createLoading = ref(false);
  const createError = ref<string | null>(null);
  const actingId = ref<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const generateFrom = ref(monthAgo);
  const generateTo = ref(today);
  const generateIssueDate = ref(today);
  const generateDueDate = ref('');
  const generateCurrency = ref('USD');
  const generateClientId = ref<string | undefined>();
  const generateProjectId = ref<string | undefined>();
  const generateIncludeExpenses = ref(true);

  const statusColor = {
    draft: 'neutral',
    sent: 'info',
    paid: 'success',
    void: 'error',
  } as const;

  const clientNameById = computed(() => {
    const map = new Map<string, string>();
    for (const client of clients.value) map.set(client.id, client.name);
    return map;
  });

  async function loadInvoices() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [invoiceResult, clientResult] = await Promise.all([
        apiFetch(invoiceListResultSchema, `/workspaces/${workspaceId.value}/invoices?limit=100`),
        apiFetch(clientsListSchema, `/workspaces/${workspaceId.value}/clients?limit=100`),
      ]);
      invoices.value = invoiceResult.items;
      clients.value = clientResult.items;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load invoices';
      errorMessage.value =
        message.includes('permission') || message.includes('Missing')
          ? 'You need manager access to manage invoices.'
          : message;
      invoices.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function generateInvoice() {
    createLoading.value = true;
    createError.value = null;
    try {
      await apiFetch(invoiceDtoSchema, `/workspaces/${workspaceId.value}/invoices/generate`, {
        method: 'POST',
        body: JSON.stringify({
          from: generateFrom.value,
          to: generateTo.value,
          issueDate: generateIssueDate.value,
          dueDate: generateDueDate.value || null,
          currency: generateCurrency.value,
          clientId: generateClientId.value ?? null,
          projectId: generateProjectId.value ?? null,
          includeExpenses: generateIncludeExpenses.value,
        }),
      });
      createOpen.value = false;
      successMessage.value = 'Draft invoice generated.';
      await loadInvoices();
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not generate invoice';
    } finally {
      createLoading.value = false;
    }
  }

  async function transition(invoice: InvoiceDto, action: 'send' | 'pay' | 'void') {
    actingId.value = invoice.id;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      await apiFetch(
        invoiceDtoSchema,
        `/workspaces/${workspaceId.value}/invoices/${invoice.id}/status`,
        {
          method: 'POST',
          body: JSON.stringify({ action }),
        },
      );
      successMessage.value = `Invoice ${action === 'send' ? 'sent' : action === 'pay' ? 'paid' : 'voided'}.`;
      await loadInvoices();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not update invoice';
    } finally {
      actingId.value = null;
    }
  }

  async function downloadPdf(invoice: InvoiceDto) {
    errorMessage.value = null;
    try {
      const response = await fetch(
        `${useRuntimeConfig().public.apiBaseURL}/workspaces/${workspaceId.value}/invoices/${invoice.id}/pdf`,
        { credentials: 'include' },
      );
      if (!response.ok) {
        throw new Error('Could not download PDF');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoice.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not download PDF';
    }
  }

  onMounted(loadInvoices);
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">Invoices</h1>
        <p class="text-sm text-muted">
          Bill clients from approved expenses and billable time using project rates.
        </p>
      </div>
      <UButton @click="createOpen = true">Generate invoice</UButton>
    </header>

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

    <UCard v-if="createOpen">
      <form
        class="grid gap-3 sm:grid-cols-2"
        @submit.prevent="generateInvoice"
      >
        <UFormField
          label="From"
          required
        >
          <UInput
            v-model="generateFrom"
            type="date"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="To"
          required
        >
          <UInput
            v-model="generateTo"
            type="date"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="Issue date"
          required
        >
          <UInput
            v-model="generateIssueDate"
            type="date"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField label="Due date">
          <UInput
            v-model="generateDueDate"
            type="date"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Currency">
          <UInput
            v-model="generateCurrency"
            maxlength="3"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Client">
          <USelect
            v-model="generateClientId"
            :items="[
              { label: 'All clients', value: undefined },
              ...clients.map((client) => ({ label: client.name, value: client.id })),
            ]"
            value-key="value"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Project ID"
          help="Optional project filter"
          class="sm:col-span-2"
        >
          <UInput
            v-model="generateProjectId"
            class="w-full"
          />
        </UFormField>
        <div class="sm:col-span-2">
          <UCheckbox
            v-model="generateIncludeExpenses"
            label="Include approved billable expenses"
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
            Generate
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
      Loading invoices…
    </p>

    <p
      v-else-if="invoices.length === 0 && !errorMessage && !createOpen"
      class="text-sm text-muted"
    >
      No invoices yet. Generate one from a billable date range.
    </p>

    <ul
      v-else
      class="divide-y divide-default rounded-lg border border-default"
    >
      <li
        v-for="invoice in invoices"
        :key="invoice.id"
        class="flex flex-wrap items-start justify-between gap-4 px-4 py-3"
      >
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-medium text-highlighted">{{ invoice.number }}</p>
            <UBadge
              :color="statusColor[invoice.status]"
              variant="subtle"
              size="sm"
            >
              {{ invoice.status }}
            </UBadge>
          </div>
          <p class="text-sm text-muted">
            {{ formatRateAmount(invoice.totalMinor, invoice.currency) }}
            · paid {{ formatRateAmount(invoice.paidMinor, invoice.currency) }} · balance
            {{ formatRateAmount(invoice.balanceMinor, invoice.currency) }}
          </p>
          <p class="text-xs text-muted">
            Issued {{ invoice.issueDate }}
            <template v-if="invoice.clientId">
              · {{ clientNameById.get(invoice.clientId) ?? invoice.clientId }}
            </template>
            · {{ invoice.lines.length }} lines
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-if="invoice.status === 'draft'"
            size="sm"
            :disabled="actingId === invoice.id"
            @click="transition(invoice, 'send')"
          >
            Send
          </UButton>
          <UButton
            v-if="invoice.status === 'sent' || invoice.status === 'draft'"
            size="sm"
            color="success"
            variant="soft"
            :disabled="actingId === invoice.id"
            @click="transition(invoice, 'pay')"
          >
            Mark paid
          </UButton>
          <UButton
            v-if="invoice.status !== 'void'"
            size="sm"
            color="error"
            variant="soft"
            :disabled="actingId === invoice.id"
            @click="transition(invoice, 'void')"
          >
            Void
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            @click="downloadPdf(invoice)"
          >
            PDF
          </UButton>
        </div>
      </li>
    </ul>
  </div>
</template>
