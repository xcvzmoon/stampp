<script setup lang="ts">
  withDefaults(defineProps<{ label: string; rows?: number }>(), { rows: 3 });
</script>

<template>
  <div
    role="status"
    :aria-label="label"
    class="space-y-3 py-2"
  >
    <div
      v-for="row in rows"
      :key="row"
      class="flex items-center gap-4"
    >
      <USkeleton class="h-11 min-w-0 flex-1 rounded-lg" />
      <USkeleton class="h-8 w-20 shrink-0 rounded-lg" />
    </div>
  </div>
</template>
