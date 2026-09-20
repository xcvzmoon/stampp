<script setup lang="ts">
  import type { PersonalAccessTokenDto } from '@stampp/shared';
  import { personalAccessTokenListSchema } from '@stampp/shared';
  import * as v from 'valibot';

  definePageMeta({ layout: 'workspace' });

  const client = useAuthClient();
  const workspaceId = useRouteParam('workspaceId');
  const { apiFetch, apiSend } = useApi();

  const twoFactorEnabled = ref(false);
  const twoFactorPending = ref(false);
  const twoFactorPassword = ref('');
  const totpUri = ref('');
  const totpCode = ref('');
  const backupCodes = ref<string[]>([]);
  const errorMessage = ref<string | null>(null);
  const successMessage = ref<string | null>(null);

  const tokens = shallowRef<PersonalAccessTokenDto[]>([]);
  const tokenName = ref('');
  const tokenPlaintext = ref('');
  const tokenLoading = ref(false);
  const revokingId = shallowRef<string | null>(null);

  const sessionUserSchema = v.object({
    twoFactorEnabled: v.optional(v.boolean()),
  });

  const enablePayloadSchema = v.object({
    totpURI: v.optional(v.string()),
    backupCodes: v.optional(v.array(v.string())),
  });

  const tokenPayloadSchema = v.object({
    token: v.optional(v.string()),
    message: v.optional(v.string()),
  });

  async function loadSession() {
    const { data } = await client.useSession(useFetch);
    const parsed = v.safeParse(sessionUserSchema, data.value?.user ?? {});
    twoFactorEnabled.value = parsed.success ? Boolean(parsed.output.twoFactorEnabled) : false;
  }

  async function loadTokens() {
    errorMessage.value = null;
    try {
      const result = await apiFetch(
        personalAccessTokenListSchema,
        `/workspaces/${workspaceId.value}/tokens`,
      );
      tokens.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load tokens';
    }
  }

  async function enableTwoFactor() {
    twoFactorPending.value = true;
    errorMessage.value = null;
    successMessage.value = null;
    try {
      const result = await client.twoFactor.enable({ password: twoFactorPassword.value });
      if (result.error) {
        throw new Error(result.error.message ?? 'Could not enable two-factor');
      }
      const parsed = v.safeParse(enablePayloadSchema, result.data ?? {});
      totpUri.value = parsed.success ? (parsed.output.totpURI ?? '') : '';
      backupCodes.value = parsed.success ? (parsed.output.backupCodes ?? []) : [];
      twoFactorPassword.value = '';
      successMessage.value = 'Scan the authenticator URI, then verify a code to finish setup.';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not enable two-factor';
    } finally {
      twoFactorPending.value = false;
    }
  }

  async function verifyTwoFactor() {
    twoFactorPending.value = true;
    errorMessage.value = null;
    try {
      const result = await client.twoFactor.verifyTotp({ code: totpCode.value });
      if (result.error) {
        throw new Error(result.error.message ?? 'Verification failed');
      }
      twoFactorEnabled.value = true;
      totpUri.value = '';
      totpCode.value = '';
      successMessage.value = 'Two-factor authentication is enabled.';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Verification failed';
    } finally {
      twoFactorPending.value = false;
    }
  }

  async function disableTwoFactor() {
    twoFactorPending.value = true;
    errorMessage.value = null;
    try {
      const result = await client.twoFactor.disable({ password: twoFactorPassword.value });
      if (result.error) {
        throw new Error(result.error.message ?? 'Could not disable two-factor');
      }
      twoFactorEnabled.value = false;
      backupCodes.value = [];
      twoFactorPassword.value = '';
      successMessage.value = 'Two-factor authentication is disabled.';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not disable two-factor';
    } finally {
      twoFactorPending.value = false;
    }
  }

  async function createToken() {
    if (!tokenName.value.trim()) {
      errorMessage.value = 'Token name is required';
      return;
    }
    tokenLoading.value = true;
    errorMessage.value = null;
    tokenPlaintext.value = '';
    try {
      const response = await fetch(
        `${useRuntimeConfig().public.apiBaseURL}/workspaces/${workspaceId.value}/tokens`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: tokenName.value.trim() }),
        },
      );
      const parsed = v.safeParse(tokenPayloadSchema, await response.json().catch(() => ({})));
      if (!response.ok || !parsed.success || !parsed.output.token) {
        const message =
          parsed.success && parsed.output.message
            ? parsed.output.message
            : 'Could not create token';
        throw new Error(message);
      }
      tokenPlaintext.value = parsed.output.token;
      tokenName.value = '';
      await loadTokens();
      successMessage.value = 'Token created. Copy it now — it will not be shown again.';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not create token';
    } finally {
      tokenLoading.value = false;
    }
  }

  async function revokeToken(token: PersonalAccessTokenDto) {
    revokingId.value = token.id;
    errorMessage.value = null;
    try {
      await apiSend(`/workspaces/${workspaceId.value}/tokens/${token.id}`, {
        method: 'DELETE',
      });
      await loadTokens();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not revoke token';
    } finally {
      revokingId.value = null;
    }
  }

  onMounted(async () => {
    await loadSession();
    await loadTokens();
  });
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold text-highlighted">Security</h1>
      <p class="text-sm text-muted">
        Manage two-factor authentication and personal access tokens for this workspace.
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

    <UCard>
      <div class="space-y-3">
        <h2 class="text-lg font-medium text-highlighted">Two-factor authentication</h2>
        <p class="text-sm text-muted">
          Status:
          <span :class="twoFactorEnabled ? 'text-success' : 'text-muted'">
            {{ twoFactorEnabled ? 'Enabled' : 'Disabled' }}
          </span>
        </p>
        <div class="flex flex-wrap items-end gap-2">
          <UFormField
            v-if="!twoFactorEnabled || totpUri"
            label="Password"
          >
            <UInput
              v-model="twoFactorPassword"
              type="password"
              autocomplete="current-password"
              class="min-w-48"
            />
          </UFormField>
          <UButton
            v-if="!twoFactorEnabled && !totpUri"
            :loading="twoFactorPending"
            @click="enableTwoFactor"
          >
            Enable 2FA
          </UButton>
          <UButton
            v-if="twoFactorEnabled"
            color="error"
            variant="soft"
            :loading="twoFactorPending"
            @click="disableTwoFactor"
          >
            Disable 2FA
          </UButton>
        </div>
        <div
          v-if="totpUri"
          class="space-y-2 rounded-lg border border-default p-3"
        >
          <p class="text-xs font-medium text-muted">Authenticator URI</p>
          <p class="font-mono text-xs break-all">{{ totpUri }}</p>
          <div
            v-if="backupCodes.length"
            class="space-y-1"
          >
            <p class="text-xs font-medium text-muted">Backup codes</p>
            <ul class="grid grid-cols-2 gap-1 font-mono text-xs">
              <li
                v-for="code in backupCodes"
                :key="code"
              >
                {{ code }}
              </li>
            </ul>
          </div>
          <form
            class="flex flex-wrap items-end gap-2"
            @submit.prevent="verifyTwoFactor"
          >
            <UFormField label="Verify code">
              <UInput
                v-model="totpCode"
                inputmode="numeric"
                maxlength="8"
              />
            </UFormField>
            <UButton
              type="submit"
              :loading="twoFactorPending"
            >
              Verify
            </UButton>
          </form>
        </div>
      </div>
    </UCard>

    <UCard>
      <div class="space-y-4">
        <div>
          <h2 class="text-lg font-medium text-highlighted">Personal access tokens</h2>
          <p class="text-sm text-muted">
            Use <code>Authorization: Bearer stpp_…</code> for workspace API calls.
          </p>
        </div>
        <form
          class="flex flex-wrap items-end gap-2"
          @submit.prevent="createToken"
        >
          <UFormField
            label="Name"
            required
          >
            <UInput
              v-model="tokenName"
              class="min-w-56"
              maxlength="100"
            />
          </UFormField>
          <UButton
            type="submit"
            :loading="tokenLoading"
          >
            Create token
          </UButton>
        </form>
        <UAlert
          v-if="tokenPlaintext"
          color="warning"
          variant="subtle"
          title="Copy this token now"
          :description="tokenPlaintext"
        />
        <ul
          v-if="tokens.length"
          class="divide-y divide-default rounded-lg border border-default"
        >
          <li
            v-for="token in tokens"
            :key="token.id"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div>
              <p class="font-medium text-highlighted">{{ token.name }}</p>
              <p class="text-xs text-muted">
                Created {{ new Date(token.createdAt).toLocaleString() }}
                <template v-if="token.lastUsedAt">
                  · last used {{ new Date(token.lastUsedAt).toLocaleString() }}
                </template>
                <template v-if="token.revokedAt"> · revoked </template>
              </p>
            </div>
            <UButton
              v-if="!token.revokedAt"
              size="sm"
              color="error"
              variant="soft"
              :loading="revokingId === token.id"
              @click="revokeToken(token)"
            >
              Revoke
            </UButton>
          </li>
        </ul>
        <p
          v-else
          class="text-sm text-muted"
        >
          No personal access tokens yet.
        </p>
      </div>
    </UCard>
  </div>
</template>
