<script setup lang="ts">
  import type { SummaryReport } from '@stampp/shared';
  import { formatMinutes } from '~/utils/week';

  defineProps<{ report: SummaryReport }>();
</script>

<template>
  <div class="space-y-4">
    <div class="grid gap-3 sm:grid-cols-3">
      <UCard>
        <p class="text-sm text-muted">Total</p>
        <p class="mt-1 text-2xl font-semibold text-highlighted">
          {{ formatMinutes(report.totals.totalMinutes) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Billable</p>
        <p class="mt-1 text-2xl font-semibold text-primary">
          {{ formatMinutes(report.totals.billableMinutes) }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">Non-billable</p>
        <p class="mt-1 text-2xl font-semibold text-highlighted">
          {{ formatMinutes(report.totals.nonBillableMinutes) }}
        </p>
      </UCard>
    </div>

    <div class="overflow-hidden rounded-lg border border-default">
      <table class="w-full text-left text-sm">
        <thead class="bg-elevated text-muted">
          <tr>
            <th class="px-4 py-3 font-medium capitalize">{{ report.groupBy }}</th>
            <th class="px-4 py-3 text-right font-medium">Total</th>
            <th class="px-4 py-3 text-right font-medium">Billable</th>
            <th class="px-4 py-3 text-right font-medium">Non-billable</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr
            v-for="group in report.groups"
            :key="group.id ?? `unassigned-${report.groupBy}`"
          >
            <td class="px-4 py-3 font-medium text-highlighted">{{ group.name }}</td>
            <td class="px-4 py-3 text-right">{{ formatMinutes(group.totalMinutes) }}</td>
            <td class="px-4 py-3 text-right">{{ formatMinutes(group.billableMinutes) }}</td>
            <td class="px-4 py-3 text-right">
              {{ formatMinutes(group.nonBillableMinutes) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
