<script setup lang="ts">
  import type { AuditEventDto, AuditRetentionDto } from '@stampp/shared';
  import { auditEventListResultSchema, auditRetentionDtoSchema } from '@stampp/shared';

  definePageMeta({ layout: 'workspace' });

  const route = useRoute();
  const workspaceId = computed(() => String(route.params.workspaceId));
  const { apiFetch, apiSend } = useApi();

  const events = shallowRef<AuditEventDto[]>([]);
  const retention = shallowRef<AuditRetentionDto | null>(null);
  const errorMessage = shallowRef('');
  const filters = reactive({
    action: '',
    entityType: '',
    entityId: '',
  });
  const retentionDays = shallowRef(365);

  async function load() {
    errorMessage.value = '';
    try {
      const query = new URLSearchParams({ limit: '100' });
      if (filters.action) query.set('action', filters.action);
      if (filters.entityType) query.set('entityType', filters.entityType);
      if (filters.entityId) query.set('entityId', filters.entityId);
      const [eventResult, retentionResult] = await Promise.all([
        apiFetch(
          auditEventListResultSchema,
          `/workspaces/${workspaceId.value}/audit?${query.toString()}`,
        ),
        apiFetch(auditRetentionDtoSchema, `/workspaces/${workspaceId.value}/audit/retention`),
      ]);
      events.value = eventResult.items;
      retention.value = retentionResult;
      retentionDays.value = retentionResult.retentionDays;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load audit log';
    }
  }

  async function saveRetention() {
    try {
      const days = Number(retentionDays.value);
      if (!Number.isInteger(days) || days < 7 || days > 3650) {
        errorMessage.value = 'Retention must be 7-3650 days';
        return;
      }
      retention.value = await apiFetch(
        auditRetentionDtoSchema,
        `/workspaces/${workspaceId.value}/audit/retention`,
        {
          method: 'PUT',
          body: JSON.stringify({ retentionDays: days }),
        },
      );
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not save retention';
    }
  }

  async function exportCsv() {
    await apiSend(`/workspaces/${workspaceId.value}/audit/export`, { method: 'GET' });
  }

  onMounted(load);
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Audit log</h1>
      <p class="text-sm text-muted">
        Browse workspace audit events, export CSV, and set how long events are kept.
      </p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Filters</h2>
      </template>
      <form
        class="grid gap-3 sm:grid-cols-4"
        @submit.prevent="load"
      >
        <UFormField label="Action">
          <UInput
            v-model="filters.action"
            placeholder="time_entry.created"
          />
        </UFormField>
        <UFormField label="Entity type">
          <UInput
            v-model="filters.entityType"
            placeholder="time_entry"
          />
        </UFormField>
        <UFormField label="Entity id">
          <UInput
            v-model="filters.entityId"
            placeholder="tent_…"
          />
        </UFormField>
        <div class="flex items-end gap-2">
          <UButton
            type="submit"
            color="primary"
          >
            Apply
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            @click="exportCsv"
          >
            Export CSV
          </UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Retention</h2>
      </template>
      <form
        class="flex flex-wrap items-end gap-3"
        @submit.prevent="saveRetention"
      >
        <UFormField
          label="Days"
          class="min-w-40"
        >
          <UInput
            v-model.number="retentionDays"
            type="number"
            min="7"
            max="3650"
          />
        </UFormField>
        <UButton
          type="submit"
          color="primary"
        >
          Save and purge expired
        </UButton>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Events</h2>
      </template>
      <p
        v-if="!events.length"
        class="text-sm text-muted"
      >
        No audit events.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="item in events"
          :key="item.id"
          class="py-3 text-sm"
        >
          <p class="font-medium text-highlighted">{{ item.action }}</p>
          <p class="text-xs text-muted">
            {{ item.entityType }} · {{ item.entityId }} · {{ item.createdAt }}
          </p>
        </li>
      </ul>
    </UCard>
  </div>
</template>
