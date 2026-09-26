<script setup lang="ts">
  defineProps<{ title: string; description: string; icon: string }>();
</script>

<template>
  <div class="flex items-start gap-4 py-8">
    <div class="grid size-10 shrink-0 place-items-center rounded-xl bg-elevated text-muted">
      <UIcon
        :name="icon"
        class="size-5"
        aria-hidden="true"
      />
    </div>

    <div class="space-y-1">
      <h2 class="text-base font-semibold text-highlighted">{{ title }}</h2>
      <p class="max-w-xl text-sm leading-6 text-muted">{{ description }}</p>
      <slot />
    </div>
  </div>
</template>
