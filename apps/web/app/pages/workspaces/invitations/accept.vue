<script setup lang="ts">
  import type { InvitationDetail } from '@stampp/shared';
  import { acceptInvitationResultSchema, invitationDetailSchema } from '@stampp/shared';
  import * as v from 'valibot';

  const route = useRoute();
  const client = useAuthClient();
  const { data: session } = await client.useSession(useFetch);

  const invitationId = computed(() => {
    const raw = route.query.id;
    return (Array.isArray(raw) ? raw[0] : raw) ?? '';
  });

  const invitation = shallowRef<InvitationDetail | null>(null);
  const loading = shallowRef(true);
  const submitting = shallowRef(false);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);

  const acceptPath = computed(() => `/workspaces/invitations/accept?id=${invitationId.value}`);

  async function loadInvitation(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;
    invitation.value = null;

    if (!invitationId.value) {
      errorMessage.value = 'This invitation link is missing an invitation id.';
      loading.value = false;
      return;
    }

    if (!session.value?.user) {
      loading.value = false;
      return;
    }

    const { data, error } = await client.organization.getInvitation({
      query: { id: invitationId.value },
    });

    loading.value = false;

    if (error || !data) {
      errorMessage.value = error?.message ?? 'This invitation could not be loaded.';
      return;
    }

    const parsed = v.safeParse(invitationDetailSchema, data);
    if (!parsed.success) {
      errorMessage.value = 'This invitation payload did not match the expected shape.';
      return;
    }

    invitation.value = parsed.output;
  }

  async function acceptInvitation(): Promise<void> {
    if (!invitation.value) return;
    submitting.value = true;
    errorMessage.value = null;
    successMessage.value = null;

    const { data, error } = await client.organization.acceptInvitation({
      invitationId: invitation.value.id,
    });

    submitting.value = false;

    if (error) {
      errorMessage.value = error.message ?? 'Could not accept this invitation.';
      return;
    }

    const parsed = v.safeParse(acceptInvitationResultSchema, data ?? {});
    const organizationId = parsed.success
      ? (parsed.output.organizationId ?? invitation.value.organizationId)
      : invitation.value.organizationId;

    if (organizationId) {
      await client.organization.setActive({ organizationId });
      successMessage.value = 'You joined the workspace.';
      await navigateTo(`/w/${organizationId}/time`);
      return;
    }

    successMessage.value = 'You joined the workspace.';
    await navigateTo('/workspaces');
  }

  async function rejectInvitation(): Promise<void> {
    if (!invitation.value) return;
    submitting.value = true;
    errorMessage.value = null;

    const { error } = await client.organization.rejectInvitation({
      invitationId: invitation.value.id,
    });

    submitting.value = false;

    if (error) {
      errorMessage.value = error.message ?? 'Could not reject this invitation.';
      return;
    }

    invitation.value = null;
    successMessage.value = 'Invitation rejected.';
    await navigateTo('/workspaces');
  }

  onMounted(() => {
    void loadInvitation();
  });
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
    <header class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold text-highlighted">Workspace invitation</h1>
      <p class="text-sm text-muted">Accept or reject the invite for this workspace.</p>
    </header>

    <UCard>
      <div
        v-if="loading"
        class="space-y-3"
      >
        <USkeleton class="h-4 w-2/3" />
        <USkeleton class="h-4 w-1/2" />
      </div>

      <div
        v-else-if="!session?.user"
        class="space-y-4"
      >
        <p class="text-sm text-muted">
          Sign in with the invited email address to review this invitation.
        </p>
        <div class="flex flex-col gap-2">
          <UButton
            :to="{ path: '/sign-in', query: { next: acceptPath } }"
            block
          >
            Sign in
          </UButton>
          <UButton
            :to="{ path: '/sign-up', query: { next: acceptPath } }"
            block
            color="neutral"
            variant="soft"
          >
            Create account
          </UButton>
        </div>
      </div>

      <div
        v-else-if="invitation"
        class="space-y-4"
      >
        <div class="space-y-1">
          <p class="text-sm text-muted">Workspace</p>
          <p class="font-medium text-highlighted">
            {{ invitation.organizationName || invitation.organizationId }}
          </p>
        </div>
        <div class="space-y-1">
          <p class="text-sm text-muted">Invited email</p>
          <p class="font-medium text-highlighted">{{ invitation.email }}</p>
        </div>
        <div class="space-y-1">
          <p class="text-sm text-muted">Role</p>
          <p class="font-medium text-highlighted">{{ invitation.role }}</p>
        </div>
        <div
          v-if="invitation.inviterEmail"
          class="space-y-1"
        >
          <p class="text-sm text-muted">Invited by</p>
          <p class="font-medium text-highlighted">{{ invitation.inviterEmail }}</p>
        </div>

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

        <div class="flex gap-2">
          <UButton
            class="flex-1"
            :loading="submitting"
            @click="acceptInvitation"
          >
            Accept
          </UButton>
          <UButton
            class="flex-1"
            color="neutral"
            variant="soft"
            :loading="submitting"
            @click="rejectInvitation"
          >
            Reject
          </UButton>
        </div>
      </div>

      <div
        v-else
        class="space-y-4"
      >
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />
        <UAlert
          v-else
          color="warning"
          variant="subtle"
          title="Invitation unavailable"
          description="This invitation is missing, already used, or not visible to your account."
        />
        <UButton
          to="/workspaces"
          block
          color="neutral"
          variant="soft"
        >
          Back to workspaces
        </UButton>
      </div>
    </UCard>
  </main>
</template>
