<script setup lang="ts">
  const client = useAuthClient();
  const { data: session } = await client.useSession(useFetch);

  if (session.value) {
    await navigateTo('/workspaces');
  }
</script>

<template>
  <main class="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-8 px-4 py-16">
    <header class="space-y-3 text-center">
      <p class="text-sm font-medium tracking-wide text-primary uppercase">Stampp</p>
      <h1 class="text-4xl font-semibold tracking-tight text-highlighted">Open-source work time</h1>
      <p class="text-base text-muted">No seat pricing. No feature gates. Fully self-hostable.</p>
    </header>

    <div class="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <UButton
        to="/sign-up"
        size="lg"
      >
        Create account
      </UButton>
      <UButton
        to="/sign-in"
        size="lg"
        color="neutral"
        variant="soft"
      >
        Sign in
      </UButton>
    </div>
  </main>
</template>
