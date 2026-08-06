<script setup lang="ts">
import { secondsToHoursMinutes, type Sport } from '~~/strava';

const props = defineProps<{
  sports: Sport[];
}>();

const totalWeeklyMinutes = computed(() => {
  let m = 0;
  for (const sport of props.sports ?? []) {
    m += sport?.this_week_elapsed_time || 0;
  }
  return m / 60;
});

</script>

<template>
  <section v-if="sports?.length" id="strava-stats" class="flex flex-col gap-6">
    <SectionTitle eyebrow="Strava"> Weekly Activity Stats 🏃‍♂️ </SectionTitle>

    <p class="text-lg text-black-primary dark:text-white-primary">
      This week:
      <span class="font-mono font-medium tabular-nums text-[color:var(--accent-link)]"
        >{{ Math.floor(totalWeeklyMinutes) }} minutes</span
      >
      <span v-if="totalWeeklyMinutes >= 60 * 7" class="ml-2">💪 Goal achieved!</span>
      <span v-else class="ml-2">📊 {{ Math.floor((60 * 7) - totalWeeklyMinutes) }} min to weekly goal</span>
    </p>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="(sport, sportIndex) of sports"
        :key="sportIndex"
        class="flex flex-col gap-4 rounded-md border border-surface-border bg-surface p-6"
      >
        <h3 class="text-lg font-semibold capitalize text-black-primary dark:text-white-primary">
          {{ sport.name }}
        </h3>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col">
            <span class="text-sm text-black-primary/70 dark:text-white-primary/60">This Week</span>
            <span class="font-mono text-lg font-medium tabular-nums text-black-primary dark:text-white-primary">
              {{ secondsToHoursMinutes(sport.this_week_elapsed_time) }}
            </span>
          </div>

          <div class="flex flex-col">
            <span class="text-sm text-black-primary/70 dark:text-white-primary/60">This Month</span>
            <span class="font-mono text-lg font-medium tabular-nums text-black-primary dark:text-white-primary">
              {{ secondsToHoursMinutes(sport.this_month_elapsed_time) }}
            </span>
          </div>

          <div v-if="sport?.this_week_distance" class="flex flex-col">
            <span class="text-sm text-black-primary/70 dark:text-white-primary/60">Distance (Week)</span>
            <span class="font-mono text-lg font-medium tabular-nums text-black-primary dark:text-white-primary">
              {{ Math.floor(sport.this_week_distance / 1000) }}km
            </span>
          </div>

          <div v-if="sport?.this_month_distance" class="flex flex-col">
            <span class="text-sm text-black-primary/70 dark:text-white-primary/60">Distance (Month)</span>
            <span class="font-mono text-lg font-medium tabular-nums text-black-primary dark:text-white-primary">
              {{ Math.floor(sport.this_month_distance / 1000) }}km
            </span>
          </div>
        </div>

        <div class="mt-2 font-mono text-sm tabular-nums text-black-primary/70 dark:text-white-primary/60">
          Total: {{ secondsToHoursMinutes(sport.total_elapsed_time) }}
          <span v-if="sport?.total_distance">
            · {{ Math.floor(sport.total_distance / 1000) }}km
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
