<script setup lang="ts">
  import type { TimesheetDto } from '@stampp/shared';
  import { timesheetDtoSchema, timesheetListResultSchema, memberListSchema } from '@stampp/shared';
  import * as v from 'valibot';

  definePageMeta({ layout: 'workspace' });

  const { apiFetch, apiSend } = useApi();
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');

  const pending = shallowRef<TimesheetDto[]>([]);
  const memberLabelByUserId = shallowRef(new Map<string, string>());
  const loading = shallowRef(true);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);
  const actingId = shallowRef<string | null>(null);
  const rejectNote = shallowRef<Record<string, string>>({});

  function weekLabel(weekStart: string): string {
    const start = new Date(`${weekStart}T12:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const formatter = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${formatter.format(start)} – ${formatter.format(end)}`;
  }

  function memberLabel(userId: string): string {
    return memberLabelByUserId.value.get(userId) ?? userId;
  }

  async function loadMembers(): Promise<void> {
    const result = await client.organization.listMembers({
      query: { organizationId: workspaceId.value },
    });
    if (result.error || !result.data) return;
    const parsed = v.safeParse(memberListSchema, result.data);
    if (!parsed.success) return;
    const map = new Map<string, string>();
    for (const entry of parsed.output.members) {
      const name = entry.user.name?.trim();
      map.set(entry.userId, name && name.length > 0 ? name : entry.user.email);
    }
    memberLabelByUserId.value = map;
  }

  async function loadPending(): Promise<void> {
    loading.value = true;
    errorMessage.value = null;
    try {
      const [list] = await Promise.all([
        apiFetch(
          timesheetListResultSchema,
          `/workspaces/${workspaceId.value}/timesheets/pending?limit=100`,
        ),
        loadMembers(),
      ]);
      pending.value = list.items;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load approvals';
      errorMessage.value =
        message.includes('permission') || message.includes('Missing')
          ? 'You need manager access to review timesheet approvals.'
          : message;
      pending.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function approve(timesheet: TimesheetDto): Promise<void> {
    actingId.value = timesheet.id;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      await apiFetch(
        timesheetDtoSchema,
        `/workspaces/${workspaceId.value}/timesheets/${timesheet.id}/approve`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      successMessage.value = 'Timesheet approved and week locked.';
      await loadPending();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not approve timesheet';
    } finally {
      actingId.value = null;
    }
  }

  async function reject(timesheet: TimesheetDto): Promise<void> {
    const note = (rejectNote.value[timesheet.id] ?? '').trim();
    if (!note) {
      errorMessage.value = 'A rejection note is required.';
      return;
    }
    actingId.value = timesheet.id;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      await apiFetch(
        timesheetDtoSchema,
        `/workspaces/${workspaceId.value}/timesheets/${timesheet.id}/reject`,
        { method: 'POST', body: JSON.stringify({ note }) },
      );
      successMessage.value = 'Timesheet rejected. The member can edit the week again.';
      rejectNote.value = { ...rejectNote.value, [timesheet.id]: '' };
      await loadPending();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not reject timesheet';
    } finally {
      actingId.value = null;
    }
  }

  onMounted(loadPending);
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-highlighted">Approvals</h1>
      <p class="text-sm text-muted">
        Review submitted timesheets. Approve locks the week; reject returns it to the member with a
        note.
      </p>
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

    <p
      v-if="loading"
      class="text-sm text-muted"
    >
      Loading approvals…
    </p>

    <p
      v-else-if="pending.length === 0 && !errorMessage"
      class="text-sm text-muted"
    >
      No timesheets waiting for approval.
    </p>

    <ul
      v-else
      class="space-y-4"
    >
      <li
        v-for="timesheet in pending"
        :key="timesheet.id"
        class="rounded-lg border border-default"
      >
        <div
          class="flex flex-wrap items-start justify-between gap-4 border-b border-default px-4 py-3"
        >
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-highlighted">
                {{ memberLabel(timesheet.userId) }}
              </p>
              <UBadge
                color="info"
                variant="subtle"
                size="sm"
              >
                {{ weekLabel(timesheet.weekStart) }}
              </UBadge>
            </div>
            <p
              v-if="timesheet.submitNote"
              class="text-sm text-muted"
            >
              {{ timesheet.submitNote }}
            </p>
            <p
              v-if="timesheet.submittedAt"
              class="text-xs text-muted"
            >
              Submitted {{ new Date(timesheet.submittedAt).toLocaleString() }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              size="sm"
              :loading="actingId === timesheet.id"
              @click="approve(timesheet)"
            >
              Approve
            </UButton>
          </div>
        </div>
        <form
          class="space-y-3 px-4 py-3"
          @submit.prevent="reject(timesheet)"
        >
          <UFormField label="Rejection note">
            <UTextarea
              v-model="rejectNote[timesheet.id]"
              class="w-full"
              :rows="2"
              required
              maxlength="2000"
              placeholder="Explain what needs to change"
            />
          </UFormField>
          <UButton
            type="submit"
            size="sm"
            color="error"
            variant="soft"
            :loading="actingId === timesheet.id"
          >
            Reject
          </UButton>
        </form>
      </li>
    </ul>
  </div>
</template>
