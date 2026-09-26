<script setup lang="ts">
  const client = useAuthClient();

  const name = ref('');
  const email = ref('');
  const password = ref('');
  const loading = ref(false);
  const errorMessage = ref<string | null>(null);
  const verificationSent = ref(false);

  async function signUp() {
    loading.value = true;
    errorMessage.value = null;

    const { error } = await client.signUp.email({
      email: email.value,
      password: password.value,
      name: name.value,
    });

    if (error) {
      loading.value = false;
      errorMessage.value = error.message ?? 'Sign up failed';
      return;
    }

    verificationSent.value = true;
    loading.value = false;
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
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted">Create your account</h1>
      <p class="text-sm text-muted">Start a workspace for your work and your team.</p>
    </header>

    <UCard v-if="verificationSent">
      <div class="space-y-3">
        <h2 class="text-lg font-medium text-highlighted">Check your email</h2>
        <p class="text-sm text-muted">
          We sent a verification link to
          <span class="font-medium text-highlighted">{{ email }}</span
          >. Confirm it, then sign in and create your workspace.
        </p>
        <UButton
          to="/sign-in"
          block
        >
          Go to sign in
        </UButton>
      </div>
    </UCard>

    <UCard v-else>
      <form
        class="space-y-4"
        @submit.prevent="signUp"
      >
        <UFormField
          label="Name"
          required
        >
          <UInput
            v-model="name"
            autocomplete="name"
            class="w-full"
            required
          />
        </UFormField>

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
          help="At least 8 characters."
        >
          <UInput
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="w-full"
            minlength="8"
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
          Create account
        </UButton>
      </form>
    </UCard>

    <p class="text-center text-sm text-muted">
      Already have an account?
      <ULink
        to="/sign-in"
        class="font-medium text-primary"
      >
        Sign in
      </ULink>
    </p>
  </main>
</template>
