<script setup lang="ts">
  const client = useAuthClient();

  onMounted(async () => {
    try {
      const { data: session } = await client.getSession();
      if (session) await navigateTo('/workspaces');
    } catch {
      return;
    }
  });
</script>

<template>
  <div class="landing-page min-h-dvh bg-default">
    <header class="border-b border-default">
      <div
        class="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <ULink
          to="/"
          class="flex items-center gap-2.5 text-highlighted"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
            >S</span
          >
          <span class="text-base font-semibold tracking-tight">Stampp</span>
        </ULink>
        <nav
          class="flex items-center gap-2"
          aria-label="Main navigation"
        >
          <UButton
            to="/sign-in"
            color="neutral"
            variant="ghost"
            size="sm"
            >Sign in</UButton
          >
          <UButton
            to="/sign-up"
            size="sm"
            >Create account</UButton
          >
        </nav>
      </div>
    </header>

    <main>
      <section
        class="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 md:min-h-[min(750px,calc(100dvh-64px))] md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12 md:py-14"
      >
        <div class="max-w-xl">
          <h1
            class="text-4xl leading-[1.08] font-semibold tracking-[-0.035em] text-balance text-highlighted sm:text-5xl lg:text-6xl"
          >
            Work time, clearly accounted for.
          </h1>
          <p class="mt-6 max-w-md text-base leading-7 text-muted sm:text-lg">
            Track work as it happens, review your week, and keep your team in sync. No seat pricing
            or feature gates.
          </p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <UButton
              to="/sign-up"
              size="lg"
              >Create account</UButton
            >
            <UButton
              to="/sign-in"
              size="lg"
              color="neutral"
              variant="outline"
              >Sign in</UButton
            >
          </div>
        </div>
        <figure class="landing-hero-image overflow-hidden rounded-2xl">
          <img
            src="/workspace-desk.webp"
            alt="A desk with a laptop, notebook, and clock ready for a workday"
            width="1456"
            height="1092"
            class="h-full w-full object-cover"
            fetchpriority="high"
          />
        </figure>
      </section>

      <section
        id="how-it-works"
        class="border-t border-default bg-elevated/40"
      >
        <div
          class="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:gap-16 md:py-24"
        >
          <div>
            <h2
              class="max-w-sm text-3xl leading-tight font-semibold tracking-tight text-highlighted sm:text-4xl"
            >
              One place for the working week.
            </h2>
            <p class="mt-4 max-w-sm leading-7 text-muted">
              Go from the first minute of work to a reviewed timesheet without losing the context
              behind it.
            </p>
          </div>
          <div class="grid gap-8 sm:grid-cols-2">
            <div class="landing-feature">
              <UIcon
                name="i-lucide-timer"
                class="size-6 text-primary"
                aria-hidden="true"
              />
              <h3>Capture time</h3>
              <p>Start a timer or fill in your week when it suits your work.</p>
            </div>
            <div class="landing-feature">
              <UIcon
                name="i-lucide-folders"
                class="size-6 text-primary"
                aria-hidden="true"
              />
              <h3>Keep the context</h3>
              <p>Organize time around projects, clients, and tags.</p>
            </div>
            <div class="landing-feature">
              <UIcon
                name="i-lucide-check-check"
                class="size-6 text-primary"
                aria-hidden="true"
              />
              <h3>Review together</h3>
              <p>Submit timesheets and handle approvals in the same workspace.</p>
            </div>
            <div class="landing-feature">
              <UIcon
                name="i-lucide-chart-no-axes-combined"
                class="size-6 text-primary"
                aria-hidden="true"
              />
              <h3>See the whole picture</h3>
              <p>Use reports to understand how time is spent across the team.</p>
            </div>
          </div>
        </div>
      </section>

      <section
        class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-end md:justify-between md:py-24"
      >
        <div>
          <h2 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
            Run it your way.
          </h2>
          <p class="mt-3 max-w-xl leading-7 text-muted">
            Stampp is open source and fully self-hostable. Your workspace can grow without seat
            pricing or feature gates.
          </p>
        </div>
        <UButton
          to="/sign-up"
          size="lg"
          class="shrink-0 self-start md:self-auto"
          >Create account</UButton
        >
      </section>
    </main>

    <footer class="border-t border-default">
      <div
        class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6 text-sm text-muted sm:px-6"
      >
        <span class="font-medium text-highlighted">Stampp</span>
        <span>Open-source work time.</span>
      </div>
    </footer>
  </div>
</template>
