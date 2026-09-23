<script setup lang="ts">
  import type {
    CreateTimeOffRequestInput,
    HolidayDto,
    TimeOffBalanceListResult,
    TimeOffCalendarResult,
    TimeOffRequestDto,
    TimeOffTypeDto,
  } from '@stampp/shared';
  import {
    holidayDtoSchema,
    listResultSchema,
    memberListSchema,
    timeOffBalanceListResultSchema,
    timeOffCalendarResultSchema,
    timeOffRequestDtoSchema,
    timeOffTypeDtoSchema,
    createTimeOffRequestInputSchema,
    createHolidayInputSchema,
    createTimeOffTypeInputSchema,
  } from '@stampp/shared';
  import * as v from 'valibot';

  definePageMeta({ layout: 'workspace' });

  type MemberOption = { userId: string; label: string };

  const typesListSchema = listResultSchema(timeOffTypeDtoSchema);
  const holidaysListSchema = listResultSchema(holidayDtoSchema);
  const requestsListSchema = listResultSchema(timeOffRequestDtoSchema);

  const { apiFetch, apiSend } = useApi();
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');

  const year = new Date().getFullYear();
  const today = new Date();
  const from = shallowRef(addDays(today, -7));
  const to = shallowRef(addDays(today, 21));

  const types = shallowRef<TimeOffTypeDto[]>([]);
  const holidays = shallowRef<HolidayDto[]>([]);
  const requests = shallowRef<TimeOffRequestDto[]>([]);
  const pending = shallowRef<TimeOffRequestDto[]>([]);
  const balances = shallowRef<TimeOffBalanceListResult | null>(null);
  const calendar = shallowRef<TimeOffCalendarResult | null>(null);
  const members = shallowRef<MemberOption[]>([]);
  const loading = shallowRef(true);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);
  const busy = shallowRef(false);

  const requestOpen = shallowRef(false);
  const requestLoading = shallowRef(false);
  const requestError = shallowRef<string | null>(null);
  const requestTypeId = shallowRef<string | undefined>(undefined);
  const requestStart = shallowRef('');
  const requestEnd = shallowRef('');
  const requestNote = shallowRef('');

  const typeOpen = shallowRef(false);
  const typeName = shallowRef('');
  const typeAllowance = shallowRef<number | null>(15);
  const typePaid = shallowRef(true);
  const holidayOpen = shallowRef(false);
  const holidayName = shallowRef('');
  const holidayDate = shallowRef('');

  const rejectNotes = shallowRef<Record<string, string>>({});

  function addDays(base: Date, days: number): string {
    const value = new Date(base);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
  }

  const typeOptions = computed(() =>
    types.value.filter((type) => type.active).map((type) => ({ label: type.name, value: type.id })),
  );

  const memberByUserId = computed(() => {
    const map = new Map<string, string>();
    for (const member of members.value) {
      map.set(member.userId, member.label);
    }
    return map;
  });

  const statusColor = computed<Record<string, 'warning' | 'success' | 'error' | 'neutral'>>(() => ({
    pending: 'warning',
    approved: 'success',
    rejected: 'error',
    canceled: 'neutral',
  }));

  function formatDays(days: number): string {
    return `${days % 1 === 0 ? days : days.toFixed(2)} d`;
  }

  function memberLabel(userId: string): string {
    return memberByUserId.value.get(userId) ?? userId;
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
      const [typeResult, holidayResult, requestResult, balanceResult, calendarResult] =
        await Promise.all([
          apiFetch(typesListSchema, `/workspaces/${workspaceId.value}/time-off/types?limit=100`),
          apiFetch(
            holidaysListSchema,
            `/workspaces/${workspaceId.value}/time-off/holidays?limit=200`,
          ),
          apiFetch(
            requestsListSchema,
            `/workspaces/${workspaceId.value}/time-off/requests?limit=100`,
          ),
          apiFetch(
            timeOffBalanceListResultSchema,
            `/workspaces/${workspaceId.value}/time-off/balances?year=${year}`,
          ),
          apiFetch(
            timeOffCalendarResultSchema,
            `/workspaces/${workspaceId.value}/time-off/calendar?from=${from.value}&to=${to.value}`,
          ),
          loadPending(),
          loadMembers(),
        ]);
      types.value = typeResult.items;
      holidays.value = holidayResult.items;
      requests.value = requestResult.items.toSorted((left, right) =>
        right.startDate.localeCompare(left.startDate),
      );
      balances.value = balanceResult;
      calendar.value = calendarResult;
      if (!requestTypeId.value && typeOptions.value[0]) {
        requestTypeId.value = typeOptions.value[0].value;
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load time off';
      balances.value = null;
      calendar.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function loadPending(): Promise<void> {
    try {
      const result = await apiFetch(
        requestsListSchema,
        `/workspaces/${workspaceId.value}/time-off/requests/pending?limit=100`,
      );
      pending.value = result.items;
    } catch {
      pending.value = [];
    }
  }

  async function createRequest(): Promise<void> {
    requestLoading.value = true;
    requestError.value = null;
    try {
      const payload = {
        timeOffTypeId: requestTypeId.value ?? '',
        startDate: requestStart.value,
        endDate: requestEnd.value,
        note: requestNote.value.trim() || undefined,
      } satisfies CreateTimeOffRequestInput;
      v.parse(createTimeOffRequestInputSchema, payload);
      await apiFetch(
        timeOffRequestDtoSchema,
        `/workspaces/${workspaceId.value}/time-off/requests`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      requestOpen.value = false;
      requestStart.value = '';
      requestEnd.value = '';
      requestNote.value = '';
      successMessage.value = 'Time-off request submitted.';
      await refresh();
    } catch (error) {
      requestError.value = error instanceof Error ? error.message : 'Could not submit request';
    } finally {
      requestLoading.value = false;
    }
  }

  async function withdraw(request: TimeOffRequestDto): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      await apiFetch(
        timeOffRequestDtoSchema,
        `/workspaces/${workspaceId.value}/time-off/requests/${request.id}/withdraw`,
        { method: 'POST' },
      );
      successMessage.value = 'Request withdrawn.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not withdraw request';
    } finally {
      busy.value = false;
    }
  }

  async function approve(request: TimeOffRequestDto): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      await apiFetch(
        timeOffRequestDtoSchema,
        `/workspaces/${workspaceId.value}/time-off/requests/${request.id}/approve`,
        { method: 'POST', body: JSON.stringify({}) },
      );
      successMessage.value = 'Request approved.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not approve request';
    } finally {
      busy.value = false;
    }
  }

  async function reject(request: TimeOffRequestDto): Promise<void> {
    const note = (rejectNotes.value[request.id] ?? '').trim();
    if (!note) {
      errorMessage.value = 'A rejection note is required.';
      return;
    }
    busy.value = true;
    errorMessage.value = null;
    try {
      await apiFetch(
        timeOffRequestDtoSchema,
        `/workspaces/${workspaceId.value}/time-off/requests/${request.id}/reject`,
        { method: 'POST', body: JSON.stringify({ note }) },
      );
      successMessage.value = 'Request rejected.';
      rejectNotes.value[request.id] = '';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not reject request';
    } finally {
      busy.value = false;
    }
  }

  async function createType(): Promise<void> {
    busy.value = true;
    requestError.value = null;
    try {
      const payload = {
        name: typeName.value.trim(),
        paid: typePaid.value,
        annualAllowanceDays: typeAllowance.value,
      } satisfies v.InferInput<typeof createTimeOffTypeInputSchema>;
      v.parse(createTimeOffTypeInputSchema, payload);
      await apiFetch(timeOffTypeDtoSchema, `/workspaces/${workspaceId.value}/time-off/types`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      typeOpen.value = false;
      typeName.value = '';
      successMessage.value = 'Time-off type created.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not create type';
    } finally {
      busy.value = false;
    }
  }

  async function createHoliday(): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      const payload = {
        name: holidayName.value.trim(),
        date: holidayDate.value,
      } satisfies v.InferInput<typeof createHolidayInputSchema>;
      v.parse(createHolidayInputSchema, payload);
      await apiFetch(holidayDtoSchema, `/workspaces/${workspaceId.value}/time-off/holidays`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      holidayOpen.value = false;
      holidayName.value = '';
      holidayDate.value = '';
      successMessage.value = 'Holiday added.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not add holiday';
    } finally {
      busy.value = false;
    }
  }

  async function removeHoliday(holiday: HolidayDto): Promise<void> {
    busy.value = true;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/time-off/holidays/${holiday.id}`, {
        method: 'DELETE',
      });
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete holiday';
    } finally {
      busy.value = false;
    }
  }

  onMounted(async () => {
    await refresh();
  });
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold text-highlighted">Time off</h1>
        <p class="text-sm text-muted">
          Leave types, balances, holidays, requests, and a team calendar. Weekdays only count
          against allowance; holidays are excluded.
        </p>
      </div>
      <UButton @click="requestOpen = !requestOpen">
        {{ requestOpen ? 'Close form' : 'Request time off' }}
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

    <UCard v-if="requestOpen">
      <form
        class="space-y-4"
        @submit.prevent="createRequest"
      >
        <div class="grid gap-4 sm:grid-cols-3">
          <UFormField
            label="Type"
            required
          >
            <USelect
              v-model="requestTypeId"
              :items="typeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Start"
            required
          >
            <UInput
              v-model="requestStart"
              type="date"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            label="End"
            required
          >
            <UInput
              v-model="requestEnd"
              type="date"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField label="Note">
            <UInput
              v-model="requestNote"
              maxlength="2000"
              class="w-full"
            />
          </UFormField>
        </div>
        <UAlert
          v-if="requestError"
          color="error"
          variant="subtle"
          :title="requestError"
        />
        <div class="flex gap-2">
          <UButton
            type="submit"
            :loading="requestLoading"
          >
            Submit request
          </UButton>
          <UButton
            color="neutral"
            variant="soft"
            @click="requestOpen = false"
          >
            Cancel
          </UButton>
        </div>
      </form>
    </UCard>

    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-medium text-highlighted">Balances · {{ year }}</h2>
        <div class="flex gap-2">
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            @click="typeOpen = !typeOpen"
          >
            Manage types
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            @click="holidayOpen = !holidayOpen"
          >
            Manage holidays
          </UButton>
        </div>
      </div>

      <UCard v-if="typeOpen">
        <form
          class="grid gap-4 sm:grid-cols-3"
          @submit.prevent="createType"
        >
          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="typeName"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField label="Annual allowance days">
            <UInput
              v-model.number="typeAllowance"
              type="number"
              min="0"
              step="0.5"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Paid">
            <UCheckbox
              v-model="typePaid"
              label="Counts as paid leave"
            />
          </UFormField>
          <div class="sm:col-span-3">
            <UButton
              type="submit"
              size="sm"
              :loading="busy"
            >
              Create type
            </UButton>
          </div>
        </form>
      </UCard>

      <UCard v-if="holidayOpen">
        <form
          class="grid gap-4 sm:grid-cols-3"
          @submit.prevent="createHoliday"
        >
          <UFormField
            label="Holiday name"
            required
          >
            <UInput
              v-model="holidayName"
              class="w-full"
              required
            />
          </UFormField>
          <UFormField
            label="Date"
            required
          >
            <UInput
              v-model="holidayDate"
              type="date"
              class="w-full"
              required
            />
          </UFormField>
          <div class="flex items-end">
            <UButton
              type="submit"
              size="sm"
              :loading="busy"
            >
              Add holiday
            </UButton>
          </div>
        </form>
        <ul
          v-if="holidays.length"
          class="mt-4 divide-y divide-default border-t border-default"
        >
          <li
            v-for="holiday in holidays"
            :key="holiday.id"
            class="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span>{{ holiday.date }} · {{ holiday.name }}</span>
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              :loading="busy"
              @click="removeHoliday(holiday)"
            >
              Delete
            </UButton>
          </li>
        </ul>
      </UCard>

      <p
        v-if="loading"
        class="text-sm text-muted"
      >
        Loading balances…
      </p>
      <ul
        v-else-if="balances?.items.length"
        class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        <li
          v-for="item in balances.items"
          :key="item.timeOffTypeId"
          class="rounded-lg border border-default p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="font-medium text-highlighted">{{ item.name }}</p>
            <UBadge
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ item.paid ? 'Paid' : 'Unpaid' }}
            </UBadge>
          </div>
          <p class="mt-2 text-2xl font-semibold text-highlighted tabular-nums">
            {{ item.remainingDays === null ? '∞' : formatDays(item.remainingDays) }}
            <span class="text-sm font-normal text-muted">remaining</span>
          </p>
          <p class="mt-1 text-sm text-muted">
            Allowance {{ item.allowanceDays === null ? '—' : formatDays(item.allowanceDays) }} ·
            Used {{ formatDays(item.usedDays) }}
          </p>
        </li>
      </ul>
      <p
        v-else
        class="text-sm text-muted"
      >
        No active time-off types yet. Create a type to start tracking balances.
      </p>
    </section>

    <section
      v-if="pending.length"
      class="space-y-3"
    >
      <h2 class="text-lg font-medium text-highlighted">Pending approvals</h2>
      <ul class="divide-y divide-default rounded-lg border border-default">
        <li
          v-for="request in pending"
          :key="request.id"
          class="space-y-2 px-4 py-3"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-medium text-highlighted">
                {{ memberLabel(request.userId) }} · {{ request.startDate }} →
                {{ request.endDate }} · {{ formatDays(request.days) }}
              </p>
              <p class="text-sm text-muted">
                {{
                  types.find((type) => type.id === request.timeOffTypeId)?.name ??
                  request.timeOffTypeId
                }}
                <template v-if="request.note"> · {{ request.note }} </template>
              </p>
            </div>
            <div class="flex gap-2">
              <UButton
                size="sm"
                :loading="busy"
                @click="approve(request)"
              >
                Approve
              </UButton>
              <UButton
                size="sm"
                color="neutral"
                variant="soft"
                :loading="busy"
                @click="reject(request)"
              >
                Reject
              </UButton>
            </div>
          </div>
          <UInput
            v-model="rejectNotes[request.id]"
            placeholder="Rejection note (required to reject)"
            size="sm"
          />
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-medium text-highlighted">My requests</h2>
      <p
        v-if="!requests.length"
        class="text-sm text-muted"
      >
        No time-off requests yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="request in requests"
          :key="request.id"
          class="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-highlighted">
                {{ request.startDate }} → {{ request.endDate }}
              </p>
              <UBadge
                :color="statusColor[request.status] ?? 'neutral'"
                variant="subtle"
                size="sm"
              >
                {{ request.status }}
              </UBadge>
              <span class="text-sm text-muted tabular-nums">
                {{ formatDays(request.days) }}
              </span>
            </div>
            <p class="text-sm text-muted">
              {{
                types.find((type) => type.id === request.timeOffTypeId)?.name ??
                request.timeOffTypeId
              }}
              <template v-if="request.note"> · {{ request.note }} </template>
            </p>
          </div>
          <UButton
            v-if="request.status === 'pending'"
            size="sm"
            color="neutral"
            variant="soft"
            :loading="busy"
            @click="withdraw(request)"
          >
            Withdraw
          </UButton>
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-lg font-medium text-highlighted">Team calendar</h2>
        <div class="flex items-end gap-2">
          <UFormField label="From">
            <UInput
              v-model="from"
              type="date"
              size="sm"
            />
          </UFormField>
          <UFormField label="To">
            <UInput
              v-model="to"
              type="date"
              size="sm"
            />
          </UFormField>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            :loading="busy"
            @click="
              busy = true;
              refresh().finally(() => (busy = false));
            "
          >
            Reload
          </UButton>
        </div>
      </div>

      <p
        v-if="!calendar"
        class="text-sm text-muted"
      >
        Calendar unavailable.
      </p>
      <div
        v-else
        class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        <article
          v-for="day in calendar.days"
          :key="day.date"
          class="rounded-lg border border-default p-3"
          :class="day.holiday ? 'bg-elevated/50' : ''"
        >
          <p class="text-sm font-medium text-highlighted">{{ day.date }}</p>
          <p
            v-if="day.holiday"
            class="mt-1 text-xs text-muted"
          >
            Holiday · {{ day.holiday.name }}
          </p>
          <ul
            v-if="day.requests.length"
            class="mt-2 space-y-1"
          >
            <li
              v-for="entry in day.requests"
              :key="entry.id"
              class="text-xs text-muted"
            >
              {{ memberLabel(entry.userId) }} · {{ entry.typeName }}
              <UBadge
                :color="statusColor[entry.status] ?? 'neutral'"
                variant="subtle"
                size="sm"
              >
                {{ entry.status }}
              </UBadge>
            </li>
          </ul>
        </article>
      </div>
    </section>
  </div>
</template>
