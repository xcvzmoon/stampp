<script setup lang="ts">
  type NavigationGroup = {
    label: string;
    items: { label: string; icon: string; to: string }[];
  };

  const route = useRoute();
  const client = useAuthClient();
  const { data: session } = await client.useSession(useFetch);
  const workspaceId = useRouteParam('workspaceId');

  const navigation = computed<NavigationGroup[]>(() => {
    const base = `/w/${workspaceId.value}`;
    return [
      {
        label: 'Work',
        items: [
          { label: 'Time', icon: 'i-lucide-clock-3', to: `${base}/time` },
          { label: 'Attendance', icon: 'i-lucide-calendar-check', to: `${base}/attendance` },
          { label: 'Time off', icon: 'i-lucide-calendar-days', to: `${base}/time-off` },
          { label: 'Schedule', icon: 'i-lucide-calendar-range', to: `${base}/schedule` },
          { label: 'Approvals', icon: 'i-lucide-check-check', to: `${base}/approvals` },
        ],
      },
      {
        label: 'Projects',
        items: [
          { label: 'Projects', icon: 'i-lucide-folders', to: `${base}/projects` },
          { label: 'Clients', icon: 'i-lucide-building-2', to: `${base}/clients` },
          { label: 'Tags', icon: 'i-lucide-tags', to: `${base}/tags` },
          { label: 'Rates', icon: 'i-lucide-badge-dollar-sign', to: `${base}/rates` },
          { label: 'Expenses', icon: 'i-lucide-receipt', to: `${base}/expenses` },
          { label: 'Invoices', icon: 'i-lucide-file-text', to: `${base}/invoices` },
        ],
      },
      {
        label: 'Workspace',
        items: [
          { label: 'Team', icon: 'i-lucide-users', to: `${base}/team` },
          { label: 'Kiosk', icon: 'i-lucide-monitor', to: `${base}/kiosk` },
          { label: 'Reports', icon: 'i-lucide-chart-no-axes-combined', to: `${base}/reports` },
          { label: 'Roles', icon: 'i-lucide-shield-user', to: `${base}/roles` },
          { label: 'Import', icon: 'i-lucide-upload', to: `${base}/import` },
          { label: 'Audit', icon: 'i-lucide-scroll-text', to: `${base}/audit` },
        ],
      },
      {
        label: 'Settings',
        items: [
          { label: 'Security', icon: 'i-lucide-shield-check', to: `${base}/security` },
          { label: 'Webhooks', icon: 'i-lucide-webhook', to: `${base}/webhooks` },
          { label: 'SSO', icon: 'i-lucide-key-round', to: `${base}/sso` },
          { label: 'SAML', icon: 'i-lucide-lock-keyhole', to: `${base}/saml` },
          { label: 'SCIM', icon: 'i-lucide-user-cog', to: `${base}/scim` },
        ],
      },
    ];
  });

  const currentPage = computed<string>(() => {
    for (const group of navigation.value) {
      for (const item of group.items) {
        if (route.path === item.to || route.path.startsWith(`${item.to}/`)) return item.label;
      }
    }
    return 'Workspace';
  });

  function isActive(path: string): boolean {
    return route.path === path || route.path.startsWith(`${path}/`);
  }

  async function signOut(): Promise<void> {
    await client.signOut();
    await navigateTo('/sign-in');
  }
</script>

<template>
  <div class="workspace-shell min-h-dvh bg-default">
    <a
      href="#workspace-content"
      class="workspace-skip-link"
      >Skip to content</a
    >

    <header class="workspace-header border-b border-default bg-default">
      <div class="flex min-h-16 items-center gap-4 px-4 sm:px-6">
        <ULink
          to="/workspaces"
          class="flex shrink-0 items-center gap-2.5 text-highlighted"
        >
          <span
            class="brand-mark"
            aria-hidden="true"
            >S</span
          >
          <span class="text-base font-semibold tracking-tight">Stampp</span>
        </ULink>
        <span
          class="hidden h-5 w-px bg-default sm:block"
          aria-hidden="true"
        />
        <ULink
          to="/workspaces"
          class="hidden items-center gap-1 text-sm text-muted transition-colors hover:text-highlighted sm:inline-flex"
        >
          Workspaces
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5"
            aria-hidden="true"
          />
        </ULink>
        <span class="min-w-0 truncate text-sm font-medium text-highlighted">{{ currentPage }}</span>
        <div class="ml-auto flex items-center gap-2 sm:gap-4">
          <span class="hidden max-w-48 truncate text-xs text-muted md:block">{{
            session?.user?.email
          }}</span>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            @click="signOut"
            >Sign out</UButton
          >
        </div>
      </div>
    </header>

    <GlobalTimer :workspace-id="workspaceId" />

    <div class="workspace-body">
      <aside
        class="workspace-sidebar hidden border-r border-default lg:block"
        aria-label="Workspace navigation"
      >
        <nav class="space-y-6 px-3 py-6">
          <div
            v-for="group in navigation"
            :key="group.label"
          >
            <p class="px-3 pb-2 text-xs font-medium text-muted">{{ group.label }}</p>
            <div class="space-y-0.5">
              <ULink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="workspace-nav-link"
                :class="{ 'workspace-nav-link-active': isActive(item.to) }"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                <UIcon
                  :name="item.icon"
                  class="size-4 shrink-0"
                  aria-hidden="true"
                />
                {{ item.label }}
              </ULink>
            </div>
          </div>
        </nav>
      </aside>

      <div class="min-w-0">
        <nav
          class="flex gap-1 overflow-x-auto border-b border-default px-4 py-2 sm:px-6 lg:hidden"
          aria-label="Quick links"
        >
          <ULink
            :to="`/w/${workspaceId}/time`"
            class="workspace-nav-link shrink-0"
            :class="{ 'workspace-nav-link-active': isActive(`/w/${workspaceId}/time`) }"
            >Time</ULink
          >
          <ULink
            :to="`/w/${workspaceId}/projects`"
            class="workspace-nav-link shrink-0"
            :class="{ 'workspace-nav-link-active': isActive(`/w/${workspaceId}/projects`) }"
            >Projects</ULink
          >
          <ULink
            :to="`/w/${workspaceId}/approvals`"
            class="workspace-nav-link shrink-0"
            :class="{ 'workspace-nav-link-active': isActive(`/w/${workspaceId}/approvals`) }"
            >Approvals</ULink
          >
          <ULink
            :to="`/w/${workspaceId}/reports`"
            class="workspace-nav-link shrink-0"
            :class="{ 'workspace-nav-link-active': isActive(`/w/${workspaceId}/reports`) }"
            >Reports</ULink
          >
        </nav>
        <details class="workspace-mobile-nav border-b border-default lg:hidden">
          <summary
            class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-highlighted sm:px-6"
          >
            Browse workspace
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4"
              aria-hidden="true"
            />
          </summary>
          <nav
            class="grid gap-5 px-4 pb-5 sm:grid-cols-2 sm:px-6"
            aria-label="Workspace navigation"
          >
            <div
              v-for="group in navigation"
              :key="group.label"
            >
              <p class="px-3 pb-1 text-xs font-medium text-muted">{{ group.label }}</p>
              <ULink
                v-for="item in group.items"
                :key="item.to"
                :to="item.to"
                class="workspace-nav-link"
                :class="{ 'workspace-nav-link-active': isActive(item.to) }"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                <UIcon
                  :name="item.icon"
                  class="size-4 shrink-0"
                  aria-hidden="true"
                />
                {{ item.label }}
              </ULink>
            </div>
          </nav>
        </details>

        <main
          id="workspace-content"
          class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 xl:px-10"
        >
          <NuxtPage />
        </main>
      </div>
    </div>
  </div>
</template>
