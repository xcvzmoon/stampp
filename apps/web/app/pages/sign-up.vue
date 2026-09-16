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
  <main class="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
    <header class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold text-highlighted">Create your Stampp account</h1>
      <p class="text-sm text-muted">Open-source work time, fully self-hostable.</p>
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
