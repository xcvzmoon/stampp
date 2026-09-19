<script setup lang="ts">
  import type { TagDto } from '@stampp/shared';
  import { listResultSchema, tagDtoSchema } from '@stampp/shared';

  definePageMeta({ layout: 'workspace' });

  const tagsListSchema = listResultSchema(tagDtoSchema);

  const { apiFetch, apiSend } = useApi();
  const workspaceId = useRouteParam('workspaceId');

  const tagList = ref<TagDto[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  const createOpen = ref(false);
  const createLoading = ref(false);
  const createError = ref<string | null>(null);
  const name = ref('');
  const editingId = ref<string | null>(null);
  const editName = ref('');
  const savingEdit = ref(false);
  const editError = ref<string | null>(null);

  async function loadTags() {
    loading.value = true;
    errorMessage.value = null;
    try {
      const result = await apiFetch(
        tagsListSchema,
        `/workspaces/${workspaceId.value}/tags?limit=100`,
      );
      tagList.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load tags';
    } finally {
      loading.value = false;
    }
  }

  async function createTag() {
    createLoading.value = true;
    createError.value = null;
    try {
      await apiFetch(tagDtoSchema, `/workspaces/${workspaceId.value}/tags`, {
        method: 'POST',
        body: JSON.stringify({ name: name.value }),
      });
      createOpen.value = false;
      name.value = '';
      await loadTags();
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not create tag';
    } finally {
      createLoading.value = false;
    }
  }

  function startEdit(tag: TagDto) {
    editingId.value = tag.id;
    editName.value = tag.name;
    editError.value = null;
  }

  async function saveEdit(tag: TagDto) {
    savingEdit.value = true;
    editError.value = null;
    try {
      await apiFetch(tagDtoSchema, `/workspaces/${workspaceId.value}/tags/${tag.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.value }),
      });
      editingId.value = null;
      await loadTags();
    } catch (error) {
      editError.value = error instanceof Error ? error.message : 'Could not rename tag';
    } finally {
      savingEdit.value = false;
    }
  }

  async function archiveTag(tag: TagDto) {
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/tags/${tag.id}`, {
        method: 'DELETE',
      });
      await loadTags();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not archive tag';
    }
  }

  onMounted(loadTags);
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">Tags</h1>
        <p class="text-sm text-muted">
          Shared labels you can attach to time entries in this workspace.
        </p>
      </div>
      <UButton @click="createOpen = true">New tag</UButton>
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
        @submit.prevent="createTag"
      >
        <UFormField
          label="Name"
          required
        >
          <UInput
            v-model="name"
            class="w-full"
            required
            maxlength="50"
          />
        </UFormField>
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
            Create
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

    <UCard v-if="loading">
      <p class="text-sm text-muted">Loading tags…</p>
    </UCard>

    <UCard v-else-if="tagList.length === 0 && !createOpen">
      <p class="text-sm text-muted">No tags yet. Create one to label time entries.</p>
    </UCard>

    <div
      v-else
      class="divide-y divide-default"
    >
      <div
        v-for="tag in tagList"
        :key="tag.id"
        class="flex flex-wrap items-center justify-between gap-3 py-3"
      >
        <div
          v-if="editingId !== tag.id"
          class="min-w-0 flex-1"
        >
          <p class="truncate font-medium text-highlighted">{{ tag.name }}</p>
        </div>
        <form
          v-else
          class="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          @submit.prevent="saveEdit(tag)"
        >
          <UInput
            v-model="editName"
            class="min-w-40 flex-1"
            required
            maxlength="50"
          />
          <UButton
            type="submit"
            size="sm"
            :loading="savingEdit"
          >
            Save
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            @click="editingId = null"
          >
            Cancel
          </UButton>
          <p
            v-if="editError"
            class="w-full text-sm text-error"
          >
            {{ editError }}
          </p>
        </form>
        <div
          v-if="editingId !== tag.id"
          class="flex items-center gap-2"
        >
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            @click="startEdit(tag)"
          >
            Rename
          </UButton>
          <UButton
            size="sm"
            color="error"
            variant="soft"
            @click="archiveTag(tag)"
          >
            Archive
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
