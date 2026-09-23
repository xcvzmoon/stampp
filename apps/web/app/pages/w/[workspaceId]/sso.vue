<script setup lang="ts">
  import type { SsoProviderDto } from '@stampp/shared';
  import { ssoProviderDtoSchema, ssoProviderListResultSchema } from '@stampp/shared';

  const route = useRoute();
  const workspaceId = computed(() => String(route.params.workspaceId));
  const { apiFetch, apiSend } = useApi();
  const client = useAuthClient();

  const providers = shallowRef<SsoProviderDto[]>([]);
  const errorMessage = shallowRef('');
  const form = reactive({
    providerId: '',
    name: '',
    issuer: '',
    clientId: '',
    clientSecret: '',
    allowedEmailDomains: '',
  });

  async function load() {
    errorMessage.value = '';
    try {
      const result = await apiFetch(
        ssoProviderListResultSchema,
        `/workspaces/${workspaceId.value}/sso/providers`,
      );
      providers.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load SSO providers';
    }
  }

  async function createProvider() {
    try {
      await apiFetch(ssoProviderDtoSchema, `/workspaces/${workspaceId.value}/sso/providers`, {
        method: 'POST',
        body: JSON.stringify({
          providerId: form.providerId,
          name: form.name,
          issuer: form.issuer,
          clientId: form.clientId,
          clientSecret: form.clientSecret,
          allowedEmailDomains: form.allowedEmailDomains,
        }),
      });
      form.providerId = '';
      form.name = '';
      form.issuer = '';
      form.clientId = '';
      form.clientSecret = '';
      form.allowedEmailDomains = '';
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not create provider';
    }
  }

  async function toggleProvider(provider: SsoProviderDto) {
    try {
      await apiFetch(
        ssoProviderDtoSchema,
        `/workspaces/${workspaceId.value}/sso/providers/${provider.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: provider.status === 'enabled' ? 'disabled' : 'enabled',
          }),
        },
      );
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not update provider';
    }
  }

  async function removeProvider(provider: SsoProviderDto) {
    try {
      await apiSend(`/workspaces/${workspaceId.value}/sso/providers/${provider.id}`, {
        method: 'DELETE',
      });
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete provider';
    }
  }

  async function signInWith(provider: SsoProviderDto) {
    await client.signIn.social({
      provider: `wsp_${provider.id}`,
      callbackURL: `/w/${workspaceId.value}`,
    });
  }

  onMounted(load);
</script>

<template>
  <UContainer class="space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-highlighted">Single sign-on</h1>
      <p class="text-sm text-muted">
        Workspace OIDC providers. Clients use discovery from the issuer; secrets are stored
        server-side and never returned after create. SAML and SCIM come next on this slice track.
      </p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Add OIDC provider</h2>
      </template>
      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="createProvider"
      >
        <UFormField label="Provider id">
          <UInput
            v-model="form.providerId"
            placeholder="okta-acme"
            required
          />
        </UFormField>
        <UFormField label="Display name">
          <UInput
            v-model="form.name"
            placeholder="Okta"
            required
          />
        </UFormField>
        <UFormField
          label="Issuer"
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.issuer"
            class="w-full"
            placeholder="https://dev-123.okta.com"
            required
          />
        </UFormField>
        <UFormField label="Client id">
          <UInput
            v-model="form.clientId"
            required
          />
        </UFormField>
        <UFormField label="Client secret">
          <UInput
            v-model="form.clientSecret"
            type="password"
            required
          />
        </UFormField>
        <UFormField
          label="Allowed email domains"
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.allowedEmailDomains"
            class="w-full"
            placeholder="acme.com, acme.io"
          />
        </UFormField>
        <div class="sm:col-span-2">
          <UButton
            type="submit"
            color="primary"
          >
            Create provider
          </UButton>
        </div>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Providers</h2>
      </template>
      <p
        v-if="!providers.length"
        class="text-sm text-muted"
      >
        No OIDC providers yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="provider in providers"
          :key="provider.id"
          class="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div>
            <p class="font-medium text-highlighted">{{ provider.name }}</p>
            <p class="text-xs text-muted">
              {{ provider.issuer }} · {{ provider.status }}
              <template v-if="provider.allowedEmailDomains.length">
                · {{ provider.allowedEmailDomains.join(', ') }}
              </template>
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              color="primary"
              variant="soft"
              @click="signInWith(provider)"
            >
              Sign in
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              @click="toggleProvider(provider)"
            >
              {{ provider.status === 'enabled' ? 'Disable' : 'Enable' }}
            </UButton>
            <UButton
              color="error"
              variant="soft"
              @click="removeProvider(provider)"
            >
              Delete
            </UButton>
          </div>
        </li>
      </ul>
    </UCard>
  </UContainer>
</template>
