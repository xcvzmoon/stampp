<script setup lang="ts">
  import type { TagDto, TimeEntryDto } from '@stampp/shared';
  import { listResultSchema, tagDtoSchema, timeEntryDtoSchema } from '@stampp/shared';
  import { useNow } from '@vueuse/core';
  import * as v from 'valibot';

  const props = defineProps<{ workspaceId: string }>();

  const runningTimerSchema = v.nullable(timeEntryDtoSchema);
  const tagsListSchema = listResultSchema(tagDtoSchema);
  const { apiFetch } = useApi();
  const now = useNow({ interval: 1000 });
  const timer = ref<TimeEntryDto | null>(null);
  const description = ref<string>('');
  const availableTags = ref<TagDto[]>([]);
  const selectedTagIds = ref<string[]>([]);
  const loading = ref<boolean>(false);
  const errorMessage = ref<string | null>(null);

  const tagItems = computed(() =>
    availableTags.value.map((tag) => ({ label: tag.name, id: tag.id })),
  );

  const elapsed = computed<string>(() => {
    if (!timer.value?.startAt) return '00:00:00';
    const seconds = Math.max(
      0,
      Math.floor((now.value.getTime() - Date.parse(timer.value.startAt)) / 1000),
    );
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return [hours, minutes, remainder].map((part) => String(part).padStart(2, '0')).join(':');
  });

  async function loadTags() {
    try {
      const result = await apiFetch(
        tagsListSchema,
        `/workspaces/${props.workspaceId}/tags?limit=100`,
      );
      availableTags.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load tags';
    }
  }

  async function loadTimer() {
    try {
      timer.value = await apiFetch(runningTimerSchema, `/workspaces/${props.workspaceId}/timer`);
      description.value = timer.value?.description ?? '';
      selectedTagIds.value = timer.value?.tags.map((tag) => tag.id) ?? [];
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load timer';
    }
  }

  async function start() {
    loading.value = true;
    errorMessage.value = null;
    try {
      timer.value = await apiFetch(
        timeEntryDtoSchema,
        `/workspaces/${props.workspaceId}/timer/start`,
        {
          method: 'POST',
          body: JSON.stringify({
            description: description.value,
            tagIds: selectedTagIds.value,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        },
      );
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not start timer';
    } finally {
      loading.value = false;
    }
  }

  async function stop() {
    if (!timer.value) return;
    loading.value = true;
    errorMessage.value = null;
    try {
      await apiFetch(
        timeEntryDtoSchema,
        `/workspaces/${props.workspaceId}/timer/${timer.value.id}/stop`,
        { method: 'POST' },
      );
      timer.value = null;
      description.value = '';
      selectedTagIds.value = [];
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not stop timer';
    } finally {
      loading.value = false;
    }
  }

  onMounted(async () => {
    await Promise.all([loadTimer(), loadTags()]);
  });
</script>

<template>
  <div class="border-b border-default bg-elevated/40">
    <div class="flex w-full flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-end lg:gap-4">
      <div class="flex items-center justify-between gap-4 lg:mr-2 lg:pb-2">
        <span class="text-sm font-semibold text-highlighted">Timer</span>
        <span
          class="font-mono text-sm font-semibold text-highlighted tabular-nums lg:hidden"
          role="timer"
        >
          {{ elapsed }}
        </span>
      </div>
      <div class="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)]">
        <label class="grid min-w-0 gap-1 text-xs font-medium text-muted">
          What are you working on?
          <UInput
            v-model="description"
            class="w-full"
            :disabled="Boolean(timer)"
            placeholder="Add a description"
          />
        </label>
        <label class="grid min-w-0 gap-1 text-xs font-medium text-muted">
          Tags
          <USelectMenu
            v-model="selectedTagIds"
            class="w-full"
            :items="tagItems"
            value-key="id"
            multiple
            :disabled="Boolean(timer) || availableTags.length === 0"
            placeholder="Optional"
          />
        </label>
      </div>
      <span
        class="hidden min-w-20 pb-2 text-right font-mono text-sm font-semibold text-highlighted tabular-nums lg:block"
        role="timer"
      >
        {{ elapsed }}
      </span>
      <UButton
        v-if="timer"
        color="error"
        :loading="loading"
        class="justify-center"
        @click="stop"
      >
        Stop timer
      </UButton>
      <UButton
        v-else
        :loading="loading"
        class="justify-center"
        @click="start"
      >
        Start timer
      </UButton>
      <div
        v-if="timer?.tags.length"
        class="flex flex-wrap items-center gap-1 lg:hidden"
      >
        <UBadge
          v-for="tag in timer.tags"
          :key="tag.id"
          color="neutral"
          variant="subtle"
          size="sm"
        >
          {{ tag.name }}
        </UBadge>
      </div>
      <p
        v-if="errorMessage"
        role="alert"
        class="w-full text-sm text-error"
      >
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>
