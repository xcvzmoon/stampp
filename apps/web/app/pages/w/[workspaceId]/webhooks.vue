<script setup lang="ts">
  import type { WebhookDeliveryDto, WebhookSubscriptionDto } from '@stampp/shared';
  import {
    WEBHOOK_EVENT_TYPES,
    webhookDeliveryListResultSchema,
    webhookSubscriptionCreatedSchema,
    webhookSubscriptionListResultSchema,
    webhookSubscriptionDtoSchema,
  } from '@stampp/shared';

  const route = useRoute();
  const workspaceId = computed(() => String(route.params.workspaceId));
  const { apiFetch, apiSend } = useApi();

  const subscriptions = shallowRef<WebhookSubscriptionDto[]>([]);
  const deliveries = shallowRef<WebhookDeliveryDto[]>([]);
  const selected = shallowRef<WebhookSubscriptionDto | null>(null);
  const errorMessage = shallowRef('');
  const createdSecret = shallowRef('');

  const form = reactive({
    url: '',
    description: '',
    events: ['time_entry.created'],
  });

  async function load() {
    errorMessage.value = '';
    try {
      const result = await apiFetch(
        webhookSubscriptionListResultSchema,
        `/workspaces/${workspaceId.value}/webhooks?limit=100`,
      );
      subscriptions.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load webhooks';
    }
  }

  async function loadDeliveries(webhook: WebhookSubscriptionDto) {
    selected.value = webhook;
    try {
      const result = await apiFetch(
        webhookDeliveryListResultSchema,
        `/workspaces/${workspaceId.value}/webhooks/${webhook.id}/deliveries?limit=50`,
      );
      deliveries.value = result.items;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not load deliveries';
    }
  }

  async function createWebhook() {
    errorMessage.value = '';
    try {
      const result = await apiFetch(
        webhookSubscriptionCreatedSchema,
        `/workspaces/${workspaceId.value}/webhooks`,
        {
          method: 'POST',
          body: JSON.stringify({
            url: form.url,
            description: form.description || undefined,
            events: form.events,
          }),
        },
      );
      createdSecret.value = result.secret;
      form.url = '';
      form.description = '';
      await load();
      await loadDeliveries(result.subscription);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not create webhook';
    }
  }

  async function toggleStatus(webhook: WebhookSubscriptionDto) {
    try {
      await apiFetch(
        webhookSubscriptionDtoSchema,
        `/workspaces/${workspaceId.value}/webhooks/${webhook.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: webhook.status === 'active' ? 'disabled' : 'active',
          }),
        },
      );
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not update webhook';
    }
  }

  async function removeWebhook(webhook: WebhookSubscriptionDto) {
    try {
      await apiSend(`/workspaces/${workspaceId.value}/webhooks/${webhook.id}`, {
        method: 'DELETE',
      });
      if (selected.value?.id === webhook.id) {
        selected.value = null;
        deliveries.value = [];
      }
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not delete webhook';
    }
  }

  async function rotateSecret(webhook: WebhookSubscriptionDto) {
    try {
      const result = await apiFetch(
        webhookSubscriptionCreatedSchema,
        `/workspaces/${workspaceId.value}/webhooks/${webhook.id}/rotate-secret`,
        { method: 'POST' },
      );
      createdSecret.value = result.secret;
      await load();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not rotate secret';
    }
  }

  async function sendTest(webhook: WebhookSubscriptionDto) {
    try {
      await apiSend(`/workspaces/${workspaceId.value}/webhooks/${webhook.id}/test`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await loadDeliveries(webhook);
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Could not queue test';
    }
  }

  function toggleEvent(name: string) {
    const index = form.events.indexOf(name);
    if (index >= 0) {
      form.events.splice(index, 1);
    } else {
      form.events.push(name);
    }
  }

  onMounted(load);
</script>

<template>
  <UContainer class="space-y-6 py-8">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-highlighted">Webhooks</h1>
      <p class="text-sm text-muted">
        Deliver signed product events to your HTTPS endpoints. The signing secret is shown once.
      </p>
    </header>

    <UAlert
      v-if="errorMessage"
      color="error"
      :title="errorMessage"
    />

    <UAlert
      v-if="createdSecret"
      color="warning"
      title="Copy this signing secret now"
      :description="createdSecret"
    />

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Add subscription</h2>
      </template>
      <form
        class="space-y-4"
        @submit.prevent="createWebhook"
      >
        <UFormField label="Endpoint URL">
          <UInput
            v-model="form.url"
            class="w-full"
            placeholder="https://example.com/stampp/webhooks"
            required
          />
        </UFormField>
        <UFormField label="Description">
          <UInput
            v-model="form.description"
            class="w-full"
            placeholder="Billing automation"
          />
        </UFormField>
        <UFormField label="Events">
          <div class="flex flex-wrap gap-2">
            <UCheckbox
              v-for="name in WEBHOOK_EVENT_TYPES"
              :key="name"
              :label="name"
              :model-value="form.events.includes(name)"
              @update:model-value="toggleEvent(name)"
            />
          </div>
        </UFormField>
        <UButton
          type="submit"
          color="primary"
        >
          Create webhook
        </UButton>
      </form>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Subscriptions</h2>
      </template>
      <p
        v-if="!subscriptions.length"
        class="text-sm text-muted"
      >
        No webhooks yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="webhook in subscriptions"
          :key="webhook.id"
          class="flex flex-wrap items-center justify-between gap-3 py-3"
        >
          <div>
            <p class="font-medium text-highlighted">{{ webhook.url }}</p>
            <p class="text-xs text-muted">
              {{ webhook.status }} · {{ webhook.events.length }} events ·
              {{ webhook.secretPrefix }}…
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              color="neutral"
              variant="soft"
              @click="loadDeliveries(webhook)"
            >
              Deliveries
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              @click="sendTest(webhook)"
            >
              Test
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              @click="rotateSecret(webhook)"
            >
              Rotate
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              @click="toggleStatus(webhook)"
            >
              {{ webhook.status === 'active' ? 'Disable' : 'Enable' }}
            </UButton>
            <UButton
              color="error"
              variant="soft"
              @click="removeWebhook(webhook)"
            >
              Delete
            </UButton>
          </div>
        </li>
      </ul>
    </UCard>

    <UCard v-if="selected">
      <template #header>
        <h2 class="text-lg font-medium text-highlighted">Deliveries · {{ selected.url }}</h2>
      </template>
      <p
        v-if="!deliveries.length"
        class="text-sm text-muted"
      >
        No deliveries yet.
      </p>
      <ul
        v-else
        class="divide-y divide-default"
      >
        <li
          v-for="delivery in deliveries"
          :key="delivery.id"
          class="grid gap-1 py-3 text-sm"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-highlighted">{{ delivery.event }}</span>
            <UBadge :color="delivery.status === 'success' ? 'success' : 'warning'">
              {{ delivery.status }}
            </UBadge>
            <span class="text-muted">attempt {{ delivery.attemptCount }}</span>
            <span
              v-if="delivery.lastStatusCode"
              class="text-muted"
            >
              HTTP {{ delivery.lastStatusCode }}
            </span>
          </div>
          <p class="text-xs text-muted">{{ delivery.createdAt }}</p>
          <p
            v-if="delivery.lastError"
            class="text-xs text-error"
          >
            {{ delivery.lastError }}
          </p>
        </li>
      </ul>
    </UCard>
  </UContainer>
</template>
