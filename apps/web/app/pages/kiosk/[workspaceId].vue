<script setup lang="ts">
  import type { KioskPunchResult } from '@stampp/shared';
  import { kioskPunchResultSchema } from '@stampp/shared';
  import * as v from 'valibot';

  definePageMeta({ layout: false });

  const route = useRoute();
  const workspaceId = useRouteParam('workspaceId');
  const { apiFetch } = useApi();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const deviceKey = shallowRef('');
  const method = shallowRef<'pin' | 'qr'>('pin');
  const pin = shallowRef('');
  const qrToken = shallowRef('');
  const busy = shallowRef(false);
  const errorMessage = shallowRef<string | null>(null);
  const successMessage = shallowRef<string | null>(null);
  const lastResult = shallowRef<KioskPunchResult | null>(null);

  onMounted(() => {
    const fromQuery = route.query.deviceKey;
    const parsed = v.safeParse(v.union([v.string(), v.array(v.string())]), fromQuery ?? '');
    if (parsed.success) {
      deviceKey.value = Array.isArray(parsed.output) ? (parsed.output[0] ?? '') : parsed.output;
    }
  });

  async function punch() {
    busy.value = true;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      const body =
        method.value === 'pin'
          ? { method: 'pin' as const, pin: pin.value, timezone }
          : { method: 'qr' as const, qrToken: qrToken.value, timezone };
      const result = await apiFetch(
        kioskPunchResultSchema,
        `/workspaces/${workspaceId.value}/kiosk/punch`,
        {
          method: 'POST',
          headers: { 'x-kiosk-device-key': deviceKey.value.trim() },
          body: JSON.stringify(body),
        },
      );
      lastResult.value = result;
      successMessage.value = result.action === 'clock_in' ? 'Clocked in.' : 'Clocked out.';
      pin.value = '';
      qrToken.value = '';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Punch failed';
      lastResult.value = null;
    } finally {
      busy.value = false;
    }
  }
</script>

<template>
  <div class="min-h-svh bg-default">
    <main
      class="auth-page mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-7 px-4 py-12 sm:px-6"
    >
      <div class="flex items-center justify-center gap-2.5 text-highlighted">
        <span
          class="brand-mark"
          aria-hidden="true"
          >S</span
        >
        <span class="text-base font-semibold tracking-tight">Stampp</span>
      </div>
      <header class="space-y-1 text-center">
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Clock in or out</h1>
        <p class="text-sm text-muted">
          Enter the device key once, then clock in or out with your PIN or QR token.
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

      <form
        class="space-y-4 rounded-xl border border-default bg-elevated p-6 shadow-sm"
        @submit.prevent="punch"
      >
        <UFormField
          label="Device key"
          required
        >
          <UInput
            v-model="deviceKey"
            class="w-full"
            required
            autocomplete="off"
          />
        </UFormField>

        <UFormField label="Method">
          <div class="flex gap-2">
            <UButton
              type="button"
              size="sm"
              :color="method === 'pin' ? 'primary' : 'neutral'"
              :variant="method === 'pin' ? 'soft' : 'ghost'"
              @click="method = 'pin'"
            >
              PIN
            </UButton>
            <UButton
              type="button"
              size="sm"
              :color="method === 'qr' ? 'primary' : 'neutral'"
              :variant="method === 'qr' ? 'soft' : 'ghost'"
              @click="method = 'qr'"
            >
              QR
            </UButton>
          </div>
        </UFormField>

        <UFormField
          v-if="method === 'pin'"
          label="PIN"
          required
        >
          <UInput
            v-model="pin"
            type="password"
            inputmode="numeric"
            maxlength="8"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          v-else
          label="QR token"
          required
        >
          <UInput
            v-model="qrToken"
            class="w-full"
            required
            autocomplete="off"
          />
        </UFormField>

        <UButton
          type="submit"
          block
          size="lg"
          :loading="busy"
        >
          Punch
        </UButton>
      </form>

      <p
        v-if="lastResult"
        class="text-center text-sm text-muted tabular-nums"
      >
        {{ lastResult.action === 'clock_in' ? 'In' : 'Out' }}
        {{ new Date(lastResult.clockInAt).toLocaleString() }}
        <template v-if="lastResult.clockOutAt">
          → {{ new Date(lastResult.clockOutAt).toLocaleString() }}
        </template>
      </p>
    </main>
  </div>
</template>
