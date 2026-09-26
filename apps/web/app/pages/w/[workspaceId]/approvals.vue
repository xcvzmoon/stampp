<script setup lang="ts">
  import type {
    ApprovalChainDto,
    ApprovalRunDto,
    CreateApprovalChainInput,
    DecideApprovalInput,
  } from '@stampp/shared';
  import {
    approvalChainDtoSchema,
    approvalChainListResultSchema,
    approvalRunDtoSchema,
    approvalRunListResultSchema,
    createApprovalChainInputSchema,
    decideApprovalInputSchema,
    memberListSchema,
  } from '@stampp/shared';
  import * as v from 'valibot';
  import WorkspaceLoadingState from '~/components/workspace/WorkspaceLoadingState.vue';

  definePageMeta({ layout: 'workspace' });

  type MemberOption = { userId: string; label: string };

  const { apiFetch } = useApi();
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');

  const chains = shallowRef<ApprovalChainDto[]>([]);
  const pending = shallowRef<ApprovalRunDto[]>([]);
  const members = shallowRef<MemberOption[]>([]);
  const loading = shallowRef(true);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);
  const busy = shallowRef(false);

  const createOpen = shallowRef(false);
  const chainName = shallowRef('');
  const entityType = shallowRef<'timesheet' | 'time_off_request'>('timesheet');
  const stepCount = shallowRef(2);
  const stepApprovers = shallowRef<(string | undefined)[]>([undefined, undefined]);
  const createError = shallowRef<string | null>(null);
  const rejectNotes = shallowRef<Record<string, string>>({});

  const entityTypeOptions = [
    { label: 'Timesheet', value: 'timesheet' },
    { label: 'Time off', value: 'time_off_request' },
  ];

  const memberOptions = computed(() => [
    { label: 'Any eligible approver', value: undefined },
    ...members.value.map((member) => ({ label: member.label, value: member.userId })),
  ]);

  const memberByUserId = computed(() => {
    const map = new Map<string, string>();
    for (const member of members.value) map.set(member.userId, member.label);
    return map;
  });

  function memberLabel(userId: string): string {
    return memberByUserId.value.get(userId) ?? userId;
  }

  function entityTypeLabel(type: string): string {
    return type === 'timesheet' ? 'Timesheet' : 'Time off';
  }

  const statusColor = computed<Record<string, 'warning' | 'success' | 'error' | 'neutral'>>(() => ({
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    canceled: 'neutral',
  }));

  function ensureStepSlots(count: number) {
    const next = [...stepApprovers.value];
    while (next.length < count) next.push(undefined);
    next.length = count;
    stepApprovers.value = next;
  }

  async function loadMembers(): Promise<void> {
    const result = await client.organization.listMembers({
      query: { organizationId: workspaceId.value },
    });
    if (result.error || !result.data) return;
    const parsed = v.safeParse(memberListSchema, result.data);
    if (!parsed.success) return;
    members.value = parsed.output.members.map((entry) => {
      const name = entry.user.name?.trim();
      return {
        userId: entry.userId,
        label: name && name.length > 0 ? name : entry.user.email,
      };
    });
  }

  async function refresh(): Promise<void> {
    errorMessage.value = null;
    try {
      const [chainResult, runResult] = await Promise.all([
        apiFetch(
          approvalChainListResultSchema,
          `/workspaces/${workspaceId.value}/approvals/chains?limit=100`,
        ),
        apiFetch(
          approvalRunListResultSchema,
          `/workspaces/${workspaceId.value}/approvals/runs?status=pending&limit=100`,
        ),
        loadMembers(),
      ]);
      chains.value = chainResult.items;
      pending.value = runResult.items;
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : 'Could not load approval chains';
      chains.value = [];
      pending.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function createChain(): Promise<void> {
    createError.value = null;
    busy.value = true;
    try {
      ensureStepSlots(stepCount.value);
      const payload = {
        name: chainName.value.trim(),
        entityType: entityType.value,
        active: true,
        steps: stepApprovers.value.slice(0, stepCount.value).map((userId) => ({
          approverUserId: userId ?? null,
        })),
      } satisfies CreateApprovalChainInput;
      v.parse(createApprovalChainInputSchema, payload);
      await apiFetch(approvalChainDtoSchema, `/workspaces/${workspaceId.value}/approvals/chains`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      createOpen.value = false;
      chainName.value = '';
      successMessage.value = 'Approval chain created.';
      await refresh();
    } catch (error) {
      createError.value = error instanceof Error ? error.message : 'Could not create chain';
    } finally {
      busy.value = false;
    }
  }

  async function decide(run: ApprovalRunDto, action: 'approve' | 'reject'): Promise<void> {
    const note = (rejectNotes.value[run.id] ?? '').trim();
    if (action === 'reject' && !note) {
      errorMessage.value = 'A rejection note is required.';
      return;
    }
    busy.value = true;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      const payload = { action, note: note || undefined } satisfies DecideApprovalInput;
      v.parse(decideApprovalInputSchema, payload);
      await apiFetch(
        approvalRunDtoSchema,
        `/workspaces/${workspaceId.value}/approvals/runs/${run.id}/decide`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      successMessage.value =
        action === 'approve' ? 'Approval step recorded.' : 'Approval rejected.';
      rejectNotes.value[run.id] = '';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not decide run';
    } finally {
      busy.value = false;
    }
  }

  onMounted(async () => {
    await refresh();
  });
</script>

<template>
  <div class="workspace-page space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Approvals</h1>
        <p class="text-sm text-muted">
          Review timesheets and time off requests, and set the order for team approvals.
        </p>
      </div>
      <UButton @click="createOpen = !createOpen">
        {{ createOpen ? 'Close form' : 'New chain' }}
      </UButton>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :title="errorMessage"
    />
    <UAlert
      v-else-if="successMessage"
      color="success"
      variant="subtle"
      :title="successMessage"
    />

    <UCard v-if="createOpen">
      <form
        class="space-y-4"
        @submit.prevent="createChain"
      >
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="chainName"
              class="w-full"
              required
              maxlength="80"
            />
          </UFormField>
          <UFormField
            label="Entity"
            required
          >
            <USelect
              v-model="entityType"
              :items="entityTypeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Stages"
            required
          >
            <UInput
              v-model.number="stepCount"
              type="number"
              min="1"
              max="5"
              class="w-full"
              required
              @update:model-value="ensureStepSlots(Number(stepCount) || 1)"
            />
          </UFormField>
          <UFormField
            v-for="(_slot, index) in stepApprovers.slice(0, stepCount)"
            :key="index"
            :label="`Stage ${index + 1} approver`"
          >
            <USelect
              v-model="stepApprovers[index]"
              :items="memberOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
        <UAlert
          v-if="createError"
          color="error"
          variant="subtle"
          :title="createError"
        />
        <div class="flex gap-2">
          <UButton
            type="submit"
            :loading="busy"
          >
            Create chain
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

    <section class="space-y-3">
      <h2 class="text-lg font-medium text-highlighted">Configured chains</h2>
      <WorkspaceLoadingState
        v-if="loading"
        label="Loading approval chains"
      />
      <p
        v-else-if="!chains.length"
        class="text-sm text-muted"
      >
        No approval chains yet. Create one to require multiple stages before a request completes.
      </p>
      <ul
        v-else
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="chain in chains"
          :key="chain.id"
          class="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-highlighted">{{ chain.name }}</p>
              <UBadge
                color="info"
                variant="subtle"
                size="sm"
              >
                {{ entityTypeLabel(chain.entityType) }}
              </UBadge>
              <UBadge
                :color="chain.active ? 'success' : 'neutral'"
                variant="subtle"
                size="sm"
              >
                {{ chain.active ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
            <ol class="mt-1 flex flex-wrap gap-2 text-sm text-muted">
              <li
                v-for="step in chain.steps"
                :key="step.order"
              >
                {{ step.order }}.
                {{
                  step.approverUserId ? memberLabel(step.approverUserId) : 'Any eligible approver'
                }}
              </li>
            </ol>
          </div>
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-medium text-highlighted">Pending decisions</h2>
      <p
        v-if="!pending.length"
        class="text-sm text-muted"
      >
        Nothing waiting on approval steps.
      </p>
      <ul
        v-else
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="run in pending"
          :key="run.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-medium text-highlighted">
                  {{ entityTypeLabel(run.entityType) }} · step {{ run.currentStep }} of
                  {{ run.stepCount }}
                </p>
                <UBadge
                  :color="statusColor[run.status] ?? 'neutral'"
                  variant="subtle"
                  size="sm"
                >
                  {{ run.status }}
                </UBadge>
              </div>
              <p class="text-sm text-muted">
                Submitted by {{ memberLabel(run.submittedBy) }} ·
                {{
                  new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(run.submittedAt))
                }}
              </p>
              <ol class="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                <li
                  v-for="step in run.steps"
                  :key="step.order"
                >
                  {{ step.order }}.
                  {{ step.approverUserId ? memberLabel(step.approverUserId) : 'Any eligible' }}
                  <template v-if="step.action"> · {{ step.action }} </template>
                  <template v-else-if="step.order === run.currentStep"> · current </template>
                </li>
              </ol>
            </div>
            <div
              v-if="run.canAct"
              class="flex flex-wrap gap-2"
            >
              <UButton
                size="sm"
                :loading="busy"
                @click="decide(run, 'approve')"
              >
                Approve step
              </UButton>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                :loading="busy"
                @click="decide(run, 'reject')"
              >
                Reject
              </UButton>
            </div>
          </div>
          <UInput
            v-if="run.canAct"
            v-model="rejectNotes[run.id]"
            placeholder="Rejection note (required to reject)"
            size="sm"
          />
        </li>
      </ul>
    </section>
  </div>
</template>
