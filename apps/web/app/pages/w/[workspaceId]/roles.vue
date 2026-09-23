<script setup lang="ts">
  import type { CustomRoleDto, WorkspaceMemberDto } from '@stampp/shared';
  import {
    ALL_PERMISSIONS,
    customRoleListResultSchema,
    customRoleDtoSchema,
    workspaceMemberDtoSchema,
    workspaceMemberListResultSchema,
  } from '@stampp/shared';

  const route = useRoute();
  const workspaceId = computed(() => String(route.params.workspaceId));
  const { apiFetch, apiSend } = useApi();

  const roles = shallowRef<CustomRoleDto[]>([]);
  const members = shallowRef<WorkspaceMemberDto[]>([]);
  const errorMessage = shallowRef('');
  const form = reactive<{
    name: string;
    description: string;
    permissions: string[];
  }>({
    name: '',
    description: '',
    permissions: [],
  });

  async function load() {
    errorMessage.value = '';
    try {
      const [roleResult, memberResult] = await Promise.all([
        apiFetch(customRoleListResultSchema, `/workspaces/${workspaceId.value}/roles`),
        apiFetch(workspaceMemberListResultSchema, `/workspaces/${workspaceId.value}/members`),
      ]);
      roles.value = roleResult.items;
      members.value = memberResult.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load roles';
    }
  }

  async function createRole() {
    try {
      await apiFetch(customRoleDtoSchema, `/workspaces/${workspaceId.value}/roles`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          permissions: form.permissions,
        }),
      });
      form.name = '';
      form.description = '';
      form.permissions = [];
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not create role';
    }
  }

  async function removeRole(role: CustomRoleDto) {
    try {
      await apiSend(`/workspaces/${workspaceId.value}/roles/${role.id}`, { method: 'DELETE' });
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete role';
    }
  }

  async function assignCustom(member: WorkspaceMemberDto, customRoleId: string | null) {
    try {
      await apiFetch(
        workspaceMemberDtoSchema,
        `/workspaces/${workspaceId.value}/members/${member.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ customRoleId }),
        },
      );
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not assign role';
    }
  }

  function togglePermission(name: string) {
    const index = form.permissions.indexOf(name);
    if (index >= 0) {
      form.permissions.splice(index, 1);
    } else {
      form.permissions.push(name);
    }
  }

  onMounted(load);
</script>

<template>
  <UContainer class="space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-highlighted">Custom roles</h1>
      <p class="text-sm text-muted">
        Workspace role definitions reuse the same permission strings as built-in roles. Assigning a
        custom role replaces the built-in permissions for that member.
      </p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Create role</h2>
      </template>
      <form
        class="space-y-4"
        @submit.prevent="createRole"
      >
        <UFormField label="Name">
          <UInput
            v-model="form.name"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField label="Description">
          <UInput
            v-model="form.description"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Permissions">
          <div class="grid gap-1 sm:grid-cols-2">
            <UCheckbox
              v-for="name in ALL_PERMISSIONS"
              :key="name"
              :label="name"
              :model-value="form.permissions.includes(name)"
              @update:model-value="togglePermission(name)"
            />
          </div>
        </UFormField>
        <UButton
          type="submit"
          color="primary"
        >
          Create role
        </UButton>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Roles</h2>
      </template>
      <p
        v-if="!roles.length"
        class="text-sm text-muted"
      >
        No custom roles yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="role in roles"
          :key="role.id"
          class="flex items-center justify-between gap-3 py-3"
        >
          <div>
            <p class="font-medium text-highlighted">{{ role.name }}</p>
            <p class="text-xs text-muted">{{ role.permissions.length }} permissions</p>
          </div>
          <UButton
            color="error"
            variant="soft"
            @click="removeRole(role)"
          >
            Delete
          </UButton>
        </li>
      </ul>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Member assignment</h2>
      </template>
      <ul class="divide-y divide-default">
        <li
          v-for="member in members"
          :key="member.id"
          class="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div>
            <p class="font-medium text-highlighted">{{ member.email }}</p>
            <p class="text-xs text-muted">
              built-in {{ member.role }}
              <template v-if="member.customRoleName">
                · custom {{ member.customRoleName }}</template
              >
            </p>
          </div>
          <USelect
            :model-value="member.customRoleId ?? ''"
            :items="[
              { label: 'Built-in role', value: '' },
              ...roles.map((role) => ({ label: role.name, value: role.id })),
            ]"
            @update:model-value="(value) => assignCustom(member, value ? String(value) : null)"
          />
        </li>
      </ul>
    </UCard>
  </UContainer>
</template>
