<script setup lang="ts">
  const route = useRoute();
  const config = useRuntimeConfig();
  const client = useAuthClient();

  const email = ref('');
  const password = ref('');
  const totpCode = ref('');
  const needsTwoFactor = ref(false);
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  const oauthProviders = computed(() => {
    const providers: { id: string; label: string }[] = [];
    if (config.public.authProviders?.google) {
      providers.push({ id: 'google', label: 'Continue with Google' });
    }
    if (config.public.authProviders?.github) {
      providers.push({ id: 'github', label: 'Continue with GitHub' });
    }
    return providers;
  });

  function resolveNextPath(candidate: string | null | undefined): string {
    if (candidate?.startsWith('/')) {
      return candidate;
    }
    return '/workspaces';
  }

  function nextPath(): string {
    const rawNext = route.query.next;
    const nextCandidate = Array.isArray(rawNext) ? rawNext[0] : rawNext;
    return resolveNextPath(nextCandidate);
  }

  async function signIn() {
    loading.value = true;
    errorMessage.value = null;
    if (needsTwoFactor.value) {
      const { error } = await client.twoFactor.verifyTotp({
        code: totpCode.value,
      });
      loading.value = false;
      if (error) {
        errorMessage.value = error.message ?? 'Two-factor verification failed';
        return;
      }
      await navigateTo(nextPath());
      return;
    }

    const { error, data } = await client.signIn.email({
      email: email.value,
      password: password.value,
    });
    loading.value = false;
    if (error) {
      if (
        error.status === 403 &&
        (error.code === 'TOTP_REQUIRED' || error.message?.toLowerCase().includes('two-factor'))
      ) {
        needsTwoFactor.value = true;
        errorMessage.value = null;
        return;
      }
      errorMessage.value = error.message ?? 'Sign in failed';
      return;
    }
    if (data) {
      await navigateTo(nextPath());
    }
  }

  async function signInOAuth(provider: string) {
    errorMessage.value = null;
    await client.signIn.social({
      provider,
      callbackURL: nextPath(),
    });
  }
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
    <header class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold text-highlighted">Sign in to Stampp</h1>
      <p class="text-sm text-muted">Track time without seat pricing or feature gates.</p>
    </header>

    <UCard>
      <form
        class="space-y-4"
        @submit.prevent="signIn"
      >
        <UFormField
          v-if="!needsTwoFactor"
          label="Email"
          required
        >
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField
          v-if="!needsTwoFactor"
          label="Password"
          required
        >
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="w-full"
            required
          />
        </UFormField>

        <UFormField
          v-else
          label="Two-factor code"
          required
        >
          <UInput
            v-model="totpCode"
            inputmode="numeric"
            autocomplete="one-time-code"
            class="w-full"
            required
            maxlength="8"
          />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          type="submit"
          class="w-full"
          :loading="loading"
        >
          {{ needsTwoFactor ? 'Verify code' : 'Sign in' }}
        </UButton>
      </form>

      <div
        v-if="oauthProviders.length && !needsTwoFactor"
        class="mt-4 space-y-2 border-t border-default pt-4"
      >
        <UButton
          v-for="provider in oauthProviders"
          :key="provider.id"
          color="neutral"
          variant="soft"
          class="w-full"
          @click="signInOAuth(provider.id)"
        >
          {{ provider.label }}
        </UButton>
      </div>
    </UCard>
  </main>
</template>
