<script setup lang="ts">
  type FilterOption = { label: string; value: string };

  defineProps<{
    projectOptions: FilterOption[];
    clientOptions: FilterOption[];
    loading: boolean;
  }>();

  const emit = defineEmits<{
    apply: [];
    downloadCsv: [];
  }>();

  const from = defineModel<string>('from', { required: true });
  const to = defineModel<string>('to', { required: true });
  const projectId = defineModel<string>('projectId', { required: true });
  const clientId = defineModel<string>('clientId', { required: true });
  const userId = defineModel<string>('userId', { required: true });
  const billable = defineModel<string>('billable', { required: true });
  const groupBy = defineModel<string>('groupBy', { required: true });

  const selectedProjectId = computed<string>({
    get: () => projectId.value || 'all',
    set: (value) => (projectId.value = value === 'all' ? '' : value),
  });
  const selectedClientId = computed<string>({
    get: () => clientId.value || 'all',
    set: (value) => (clientId.value = value === 'all' ? '' : value),
  });
  const selectedBillable = computed<string>({
    get: () => billable.value || 'all',
    set: (value) => (billable.value = value === 'all' ? '' : value),
  });

  const billableOptions = [
    { label: 'All time', value: 'all' },
    { label: 'Billable only', value: 'true' },
    { label: 'Non-billable only', value: 'false' },
  ];
  const groupOptions = [
    { label: 'Project', value: 'project' },
    { label: 'Client', value: 'client' },
    { label: 'User', value: 'user' },
  ];
</script>

<template>
  <UCard>
    <form
      class="space-y-4"
      @submit.prevent="emit('apply')"
    >
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UFormField label="From">
          <UInput
            v-model="from"
            type="date"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField label="To">
          <UInput
            v-model="to"
            type="date"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField label="Project">
          <USelect
            v-model="selectedProjectId"
            :items="projectOptions"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Client">
          <USelect
            v-model="selectedClientId"
            :items="clientOptions"
            class="w-full"
          />
        </UFormField>
        <UFormField label="User ID">
          <UInput
            v-model="userId"
            class="w-full"
            placeholder="All permitted users"
          />
        </UFormField>
        <UFormField label="Billing">
          <USelect
            v-model="selectedBillable"
            :items="billableOptions"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Group by">
          <USelect
            v-model="groupBy"
            :items="groupOptions"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          type="submit"
          :loading="loading"
        >
          Apply filters
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-lucide-download"
          :disabled="loading"
          @click="emit('downloadCsv')"
        >
          Download CSV
        </UButton>
      </div>
    </form>
  </UCard>
</template>
