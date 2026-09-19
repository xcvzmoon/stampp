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
    <div class="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
      <UInput
        v-model="description"
        class="min-w-56 flex-1"
        :disabled="Boolean(timer)"
        placeholder="What are you working on?"
        aria-label="Timer description"
      />
      <USelectMenu
        v-model="selectedTagIds"
        class="min-w-40"
        :items="tagItems"
        value-key="id"
        multiple
        :disabled="Boolean(timer) || availableTags.length === 0"
        placeholder="Tags"
        aria-label="Timer tags"
      />
      <span class="min-w-20 text-right font-mono text-sm font-semibold text-highlighted">
        {{ elapsed }}
      </span>
      <UButton
        v-if="timer"
        color="error"
        :loading="loading"
        @click="stop"
      >
        Stop
      </UButton>
      <UButton
        v-else
        :loading="loading"
        @click="start"
      >
        Start timer
      </UButton>
      <div
        v-if="timer?.tags.length"
        class="flex flex-wrap items-center gap-1"
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
        class="w-full text-sm text-error"
      >
        {{ errorMessage }}
      </p>
    </div>
  </div>
</template>
