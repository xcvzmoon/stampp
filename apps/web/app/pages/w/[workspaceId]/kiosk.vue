<script setup lang="ts">
  import type {
    KioskCredentialDto,
    KioskDeviceCreated,
    KioskDeviceDto,
    SetKioskPinInput,
  } from '@stampp/shared';
  import {
    memberListSchema,
    setKioskPinInputSchema,
    kioskCredentialListResultSchema,
    kioskDeviceListResultSchema,
  } from '@stampp/shared';
  import * as v from 'valibot';
  import WorkspaceLoadingState from '~/components/workspace/WorkspaceLoadingState.vue';

  definePageMeta({ layout: 'workspace' });

  type MemberOption = { userId: string; label: string };

  const devicesListSchema = kioskDeviceListResultSchema;
  const credentialsListSchema = kioskCredentialListResultSchema;
  const deviceCreatedSchema = v.object({
    device: v.object({
      id: v.string(),
      workspaceId: v.string(),
      name: v.string(),
      keyPrefix: v.string(),
      status: v.picklist(['active', 'revoked']),
      lastUsedAt: v.nullable(v.string()),
      createdAt: v.string(),
      updatedAt: v.string(),
    }),
    deviceKey: v.string(),
  });

  const { apiFetch, apiSend } = useApi();
  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');

  const devices = shallowRef<KioskDeviceDto[]>([]);
  const credentials = shallowRef<KioskCredentialDto[]>([]);
  const members = shallowRef<MemberOption[]>([]);
  const loading = shallowRef(true);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);
  const busy = shallowRef(false);

  const deviceName = shallowRef('');
  const lastDeviceKey = shallowRef<string | null>(null);

  const pinUserId = shallowRef<string | undefined>(undefined);
  const pinValue = shallowRef('');

  const qrUserId = shallowRef<string | undefined>(undefined);
  const lastQrToken = shallowRef<string | null>(null);

  const memberOptions = computed(() =>
    members.value.map((member) => ({ label: member.label, value: member.userId })),
  );

  const memberByUserId = computed(() => {
    const map = new Map<string, string>();
    for (const member of members.value) map.set(member.userId, member.label);
    return map;
  });

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
    if (!pinUserId.value && members.value[0]) {
      pinUserId.value = members.value[0].userId;
      qrUserId.value = members.value[0].userId;
    }
  }

  async function refresh(): Promise<void> {
    errorMessage.value = null;
    try {
      const [deviceResult, credentialResult] = await Promise.all([
        apiFetch(devicesListSchema, `/workspaces/${workspaceId.value}/kiosk/devices?limit=100`),
        apiFetch(
          credentialsListSchema,
          `/workspaces/${workspaceId.value}/kiosk/credentials?limit=100`,
        ),
        loadMembers(),
      ]);
      devices.value = deviceResult.items;
      credentials.value = credentialResult.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load kiosk';
      devices.value = [];
      credentials.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function createDevice(): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      const result = await apiFetch(
        deviceCreatedSchema,
        `/workspaces/${workspaceId.value}/kiosk/devices`,
        {
          method: 'POST',
          body: JSON.stringify({ name: deviceName.value.trim() }),
        },
      );
      lastDeviceKey.value = result.deviceKey;
      deviceName.value = '';
      successMessage.value = 'Device registered. Copy the key now; it will not be shown again.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not register device';
    } finally {
      busy.value = false;
    }
  }

  async function revokeDevice(device: KioskDeviceDto): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/kiosk/devices/${device.id}`, {
        method: 'DELETE',
      });
      successMessage.value = 'Device revoked.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not revoke device';
    } finally {
      busy.value = false;
    }
  }

  async function rotateKey(device: KioskDeviceDto): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      const result = await apiFetch(
        deviceCreatedSchema,
        `/workspaces/${workspaceId.value}/kiosk/devices/${device.id}/rotate-key`,
        { method: 'POST' },
      );
      lastDeviceKey.value = result.deviceKey;
      successMessage.value = 'Device key rotated. Copy the new key now.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not rotate key';
    } finally {
      busy.value = false;
    }
  }

  async function savePin(): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      const payload = {
        userId: pinUserId.value,
        pin: pinValue.value,
      } satisfies SetKioskPinInput;
      v.parse(setKioskPinInputSchema, payload);
      await apiFetch(v.object({ id: v.string() }), `/workspaces/${workspaceId.value}/kiosk/pin`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      pinValue.value = '';
      successMessage.value = 'PIN saved.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not save PIN';
    } finally {
      busy.value = false;
    }
  }

  async function rotateQr(): Promise<void> {
    busy.value = true;
    errorMessage.value = null;
    try {
      const result = await apiFetch(
        v.object({
          credential: v.object({ id: v.string() }),
          qrToken: v.string(),
        }),
        `/workspaces/${workspaceId.value}/kiosk/qr.rotate`,
        {
          method: 'POST',
          body: JSON.stringify({ userId: qrUserId.value }),
        },
      );
      lastQrToken.value = result.qrToken;
      successMessage.value = 'QR token rotated. Copy it now; it will not be shown again.';
      await refresh();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not rotate QR token';
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
    <header class="space-y-1">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Kiosk</h1>
      <p class="text-sm text-muted">
        Set up a shared device for team clock-ins with a PIN or QR token.
      </p>
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

    <UAlert
      v-if="lastDeviceKey"
      color="warning"
      variant="subtle"
      title="Device key (copy now)"
    >
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <code class="rounded bg-elevated px-2 py-1 text-xs break-all">{{ lastDeviceKey }}</code>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          @click="lastDeviceKey = null"
        >
          Dismiss
        </UButton>
      </div>
    </UAlert>

    <UAlert
      v-if="lastQrToken"
      color="warning"
      variant="subtle"
      title="QR token (copy now)"
    >
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <code class="rounded bg-elevated px-2 py-1 text-xs break-all">{{ lastQrToken }}</code>
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          @click="lastQrToken = null"
        >
          Dismiss
        </UButton>
      </div>
    </UAlert>

    <section class="grid gap-4 lg:grid-cols-2">
      <UCard>
        <template #header>
          <p class="font-medium text-highlighted">Register device</p>
        </template>
        <form
          class="flex flex-wrap items-end gap-3"
          @submit.prevent="createDevice"
        >
          <UFormField
            label="Device name"
            required
            class="min-w-48 flex-1"
          >
            <UInput
              v-model="deviceName"
              class="w-full"
              required
              maxlength="80"
            />
          </UFormField>
          <UButton
            type="submit"
            size="sm"
            :loading="busy"
          >
            Register
          </UButton>
        </form>
      </UCard>

      <UCard>
        <template #header>
          <p class="font-medium text-highlighted">Member PIN / QR</p>
        </template>
        <div class="space-y-3">
          <div class="flex flex-wrap items-end gap-3">
            <UFormField
              label="Member"
              class="min-w-40 flex-1"
            >
              <USelect
                v-model="pinUserId"
                :items="memberOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="PIN (4-8 digits)"
              required
            >
              <UInput
                v-model="pinValue"
                inputmode="numeric"
                maxlength="8"
                class="w-32"
                required
              />
            </UFormField>
            <UButton
              size="sm"
              :loading="busy"
              @click="savePin"
            >
              Save PIN
            </UButton>
          </div>
          <div class="flex flex-wrap items-end gap-3">
            <UFormField
              label="Member"
              class="min-w-40 flex-1"
            >
              <USelect
                v-model="qrUserId"
                :items="memberOptions"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              :loading="busy"
              @click="rotateQr"
            >
              Rotate QR token
            </UButton>
          </div>
        </div>
      </UCard>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-medium text-highlighted">Devices</h2>
      <WorkspaceLoadingState
        v-if="loading"
        label="Loading devices"
      />
      <p
        v-else-if="!devices.length"
        class="text-sm text-muted"
      >
        No kiosk devices yet. Register one and open the kiosk screen with its key.
      </p>
      <ul
        v-else
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="device in devices"
          :key="device.id"
          class="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-highlighted">{{ device.name }}</p>
              <UBadge
                :color="device.status === 'active' ? 'success' : 'error'"
                variant="subtle"
                size="sm"
              >
                {{ device.status }}
              </UBadge>
              <span class="text-sm text-muted">key {{ device.keyPrefix }}…</span>
            </div>
            <p class="text-sm text-muted">
              Last used
              {{
                device.lastUsedAt
                  ? new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(device.lastUsedAt))
                  : 'never'
              }}
            </p>
          </div>
          <div class="flex gap-2">
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              :loading="busy"
              @click="rotateKey(device)"
            >
              Rotate key
            </UButton>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              :loading="busy"
              :disabled="device.status === 'revoked'"
              @click="revokeDevice(device)"
            >
              Revoke
            </UButton>
          </div>
        </li>
      </ul>
    </section>

    <section class="space-y-3">
      <h2 class="text-lg font-medium text-highlighted">Member credentials</h2>
      <p
        v-if="!credentials.length"
        class="text-sm text-muted"
      >
        No PINs or QR tokens configured yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default rounded-lg border border-default"
      >
        <li
          v-for="credential in credentials"
          :key="credential.id"
          class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
        >
          <span class="font-medium text-highlighted">{{ memberLabel(credential.userId) }}</span>
          <span class="flex gap-2">
            <UBadge
              :color="credential.hasPin ? 'success' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              PIN
            </UBadge>
            <UBadge
              :color="credential.hasQrToken ? 'info' : 'neutral'"
              variant="subtle"
              size="sm"
            >
              QR
            </UBadge>
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
