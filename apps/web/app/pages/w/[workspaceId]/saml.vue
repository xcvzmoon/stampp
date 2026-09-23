<script setup lang="ts">
  import type { SamlProviderDto } from '@stampp/shared';
  import { samlProviderDtoSchema, samlProviderListResultSchema } from '@stampp/shared';

  const route = useRoute();
  const workspaceId = computed(() => String(route.params.workspaceId));
  const { apiFetch, apiSend } = useApi();

  const providers = shallowRef<SamlProviderDto[]>([]);
  const errorMessage = shallowRef('');
  const form = reactive({
    name: '',
    entityId: '',
    entryPoint: '',
    certificate: '',
    emailAttribute: 'email',
    allowedEmailDomains: '',
  });

  async function load() {
    errorMessage.value = '';
    try {
      const result = await apiFetch(
        samlProviderListResultSchema,
        `/workspaces/${workspaceId.value}/saml/providers`,
      );
      providers.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load SAML providers';
    }
  }

  async function createProvider() {
    try {
      await apiFetch(samlProviderDtoSchema, `/workspaces/${workspaceId.value}/saml/providers`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          entityId: form.entityId,
          entryPoint: form.entryPoint,
          certificate: form.certificate,
          emailAttribute: form.emailAttribute,
          allowedEmailDomains: form.allowedEmailDomains,
        }),
      });
      form.name = '';
      form.entityId = '';
      form.entryPoint = '';
      form.certificate = '';
      form.allowedEmailDomains = '';
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not create provider';
    }
  }

  async function removeProvider(provider: SamlProviderDto) {
    try {
      await apiSend(`/workspaces/${workspaceId.value}/saml/providers/${provider.id}`, {
        method: 'DELETE',
      });
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete provider';
    }
  }

  onMounted(load);
</script>

<template>
  <UContainer class="space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-highlighted">SAML</h1>
      <p class="text-sm text-muted">
        Service-provider SAML for workspace single sign-on. Register the metadata URL at your IdP,
        then start login from <code>/api/auth/saml/{id}/login</code>.
      </p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Add SAML provider</h2>
      </template>
      <form
        class="grid gap-4 sm:grid-cols-2"
        @submit.prevent="createProvider"
      >
        <UFormField label="Name">
          <UInput
            v-model="form.name"
            required
          />
        </UFormField>
        <UFormField label="Email attribute">
          <UInput
            v-model="form.emailAttribute"
            required
          />
        </UFormField>
        <UFormField
          label="IdP entity id"
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.entityId"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="SSO URL"
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.entryPoint"
            class="w-full"
            required
          />
        </UFormField>
        <UFormField
          label="IdP signing certificate (PEM)"
          class="sm:col-span-2"
        >
          <UTextarea
            v-model="form.certificate"
            class="w-full"
            :rows="6"
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
            placeholder="acme.com"
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
        No SAML providers yet.
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
          <div class="min-w-0">
            <p class="font-medium text-highlighted">{{ provider.name }}</p>
            <p class="truncate text-xs text-muted">{{ provider.metadataUrl }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              :to="provider.metadataUrl"
              target="_blank"
              color="neutral"
              variant="soft"
            >
              Metadata
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
