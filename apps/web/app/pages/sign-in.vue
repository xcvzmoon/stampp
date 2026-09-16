<script setup lang="ts">
  const route = useRoute();
  const client = useAuthClient();

  const email = ref('');
  const password = ref('');
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);

  function resolveNextPath(candidate: string | null | undefined): string {
    if (candidate?.startsWith('/')) {
      return candidate;
    }
    return '/workspaces';
  }

  async function signIn() {
    loading.value = true;
    errorMessage.value = null;
    const { error } = await client.signIn.email({
      email: email.value,
      password: password.value,
    });
    loading.value = false;
    if (error) {
      errorMessage.value = error.message ?? 'Sign in failed';
      return;
    }
    const rawNext = route.query.next;
    const nextCandidate = Array.isArray(rawNext) ? rawNext[0] : rawNext;
    await navigateTo(resolveNextPath(nextCandidate));
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

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
        />

        <UButton
          type="submit"
          block
          :loading="loading"
        >
          Sign in
        </UButton>
      </form>
    </UCard>

    <p class="text-center text-sm text-muted">
      No account yet?
      <ULink
        to="/sign-up"
        class="font-medium text-primary"
      >
        Create one
      </ULink>
    </p>
  </main>
</template>
