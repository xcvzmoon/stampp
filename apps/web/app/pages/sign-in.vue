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
  <main
    class="auth-page mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-7 px-4 py-12 sm:px-6"
  >
    <ULink
      to="/"
      class="flex w-fit items-center gap-2.5 text-highlighted"
    >
      <span
        class="brand-mark"
        aria-hidden="true"
        >S</span
      >
      <span class="text-base font-semibold tracking-tight">Stampp</span>
    </ULink>
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Welcome back</h1>
      <p class="text-sm text-muted">Sign in to open your workspace.</p>
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
    <p class="text-sm text-muted">
      New to Stampp?
      <ULink
        to="/sign-up"
        class="font-medium text-primary hover:underline"
        >Create account</ULink
      >
    </p>
  </main>
</template>
