<script setup lang="ts">
  import type { InviteRole, WorkspaceInvitation, WorkspaceMember } from '@stampp/shared';
  import { invitationListSchema, memberListSchema } from '@stampp/shared';
  import * as v from 'valibot';

  type MemberRow = {
    id: string;
    userId: string;
    role: string;
    name: string;
    email: string;
  };

  definePageMeta({ layout: 'workspace' });

  const client = useAuthClient();
  const { data: session } = await client.useSession(useFetch);
  const workspaceId = useRouteParam('workspaceId');

  const members = shallowRef<MemberRow[]>([]);
  const invitations = shallowRef<WorkspaceInvitation[]>([]);
  const loading = shallowRef(true);
  const inviteLoading = shallowRef(false);
  const cancelLoadingId = shallowRef<string | null>(null);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);

  const inviteEmail = ref('');
  const inviteRole = ref<InviteRole>('member');
  const roleOptions = [
    { label: 'Member', value: 'member' },
    { label: 'Admin', value: 'admin' },
  ];

  const canManage = computed(() => {
    const userId = session.value?.user?.id;
    if (!userId) return false;
    const current = members.value.find((entry) => entry.userId === userId);
    return current?.role === 'owner' || current?.role === 'admin';
  });

  function toMemberRow(entry: WorkspaceMember): MemberRow {
    const displayName = entry.user.name?.trim();
    return {
      id: entry.id,
      userId: entry.userId,
      role: entry.role,
      name: displayName && displayName.length > 0 ? displayName : entry.user.email,
      email: entry.user.email,
    };
  }

  async function loadTeam(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;

    const [membersResult, invitationsResult] = await Promise.all([
      client.organization.listMembers({
        query: { organizationId: workspaceId.value },
      }),
      client.organization.listInvitations({
        query: { organizationId: workspaceId.value },
      }),
    ]);

    loading.value = false;

    if (membersResult.error) {
      errorMessage.value = membersResult.error.message ?? 'Could not load workspace members.';
      return;
    }

    const parsedMembers = v.safeParse(memberListSchema, membersResult.data);
    if (!parsedMembers.success) {
      errorMessage.value = 'Workspace members payload did not match the expected shape.';
      return;
    }

    const memberRows: MemberRow[] = [];
    for (const entry of parsedMembers.output.members) {
      memberRows.push(toMemberRow(entry));
    }
    members.value = memberRows;

    if (invitationsResult.error) {
      invitations.value = [];
      return;
    }

    const parsedInvitations = v.safeParse(invitationListSchema, invitationsResult.data);
    if (!parsedInvitations.success) {
      invitations.value = [];
      return;
    }

    const pendingInvitations: WorkspaceInvitation[] = [];
    for (const entry of parsedInvitations.output) {
      if (entry.status !== 'pending') continue;
      pendingInvitations.push(entry);
    }
    invitations.value = pendingInvitations;
  }

  async function inviteMember(): Promise<void> {
    inviteLoading.value = true;
    errorMessage.value = null;
    successMessage.value = null;

    const { error } = await client.organization.inviteMember({
      email: inviteEmail.value.trim(),
      role: inviteRole.value,
      organizationId: workspaceId.value,
    });

    inviteLoading.value = false;

    if (error) {
      errorMessage.value = error.message ?? 'Could not send the invitation.';
      return;
    }

    inviteEmail.value = '';
    inviteRole.value = 'member';
    successMessage.value = 'Invitation sent.';
    await loadTeam();
  }

  async function cancelInvitation(invitationId: string): Promise<void> {
    cancelLoadingId.value = invitationId;
    errorMessage.value = null;
    successMessage.value = null;

    const { error } = await client.organization.cancelInvitation({ invitationId });

    cancelLoadingId.value = null;

    if (error) {
      errorMessage.value = error.message ?? 'Could not cancel the invitation.';
      return;
    }

    successMessage.value = 'Invitation cancelled.';
    await loadTeam();
  }

  onMounted(() => {
    void loadTeam();
  });
</script>

<template>
  <div class="workspace-page space-y-8">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Team</h1>
      <p class="text-sm text-muted">Workspace members and pending invitations.</p>
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

    <UCard v-if="canManage">
      <div class="space-y-4">
        <div>
          <h2 class="text-lg font-medium text-highlighted">Invite member</h2>
          <p class="text-sm text-muted">Send an email invitation to join this workspace.</p>
        </div>
        <form
          class="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          @submit.prevent="inviteMember"
        >
          <UFormField
            label="Email"
            required
          >
            <UInput
              v-model="inviteEmail"
              type="email"
              class="w-full"
              autocomplete="email"
              required
            />
          </UFormField>
          <UFormField
            label="Role"
            required
          >
            <USelect
              v-model="inviteRole"
              :items="roleOptions"
              value-key="value"
              class="w-full sm:w-40"
            />
          </UFormField>
          <UButton
            type="submit"
            :loading="inviteLoading"
          >
            Send invite
          </UButton>
        </form>
      </div>
    </UCard>

    <section class="space-y-3">
      <h2 class="text-lg font-medium text-highlighted">Members</h2>
      <div
        v-if="loading"
        class="space-y-2"
      >
        <USkeleton class="h-12 w-full" />
        <USkeleton class="h-12 w-full" />
      </div>
      <ul
        v-else
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="member in members"
          :key="member.id"
          class="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium text-highlighted">{{ member.name }}</p>
            <p class="truncate text-sm text-muted">{{ member.email }}</p>
          </div>
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ member.role }}
          </UBadge>
        </li>
        <li
          v-if="members.length === 0"
          class="px-4 py-3 text-sm text-muted"
        >
          No members loaded.
        </li>
      </ul>
    </section>

    <section
      v-if="canManage"
      class="space-y-3"
    >
      <h2 class="text-lg font-medium text-highlighted">Pending invitations</h2>
      <ul
        v-if="invitations.length > 0"
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="invitation in invitations"
          :key="invitation.id"
          class="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="truncate font-medium text-highlighted">{{ invitation.email }}</p>
            <p class="text-sm text-muted">{{ invitation.role }} · {{ invitation.status }}</p>
          </div>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            :loading="cancelLoadingId === invitation.id"
            @click="cancelInvitation(invitation.id)"
          >
            Cancel
          </UButton>
        </li>
      </ul>
      <p
        v-else
        class="text-sm text-muted"
      >
        No pending invitations.
      </p>
    </section>
  </div>
</template>
