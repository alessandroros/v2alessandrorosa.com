<script setup lang="ts">
import { secondsToHHMMSS } from '~~/strava';
import type { Sport } from '~~/strava';

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
  <section v-if="sports?.length" id="strava-stats" class="flex flex-col gap-8">
    <SectionTitle>
      Weekly Activity Stats 🏃‍♂️
    </SectionTitle>

    <div class="mb-4">
      <p class="text-dark-primary dark:text-white-primary text-lg">
        This week: <span class="font-semibold">{{ Math.floor(totalWeeklyMinutes) }} minutes</span>
        <span v-if="totalWeeklyMinutes >= 60 * 7" class="ml-2">💪 Goal achieved!</span>
        <span v-else class="ml-2">📊 {{ Math.floor((60 * 7) - totalWeeklyMinutes) }} min to weekly goal</span>
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="(sport, sportIndex) of sports"
        :key="sportIndex"
        class="flex flex-col gap-4 rounded-lg border border-gray-200 p-6 dark:border-gray-700"
      >
        <h3 class="text-xl font-semibold capitalize text-dark-primary dark:text-white-primary">
          {{ sport.name }}
        </h3>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col">
            <span class="text-sm text-gray-600 dark:text-gray-400">This Week</span>
            <span class="text-lg font-semibold text-dark-primary dark:text-white-primary">
              {{ secondsToHHMMSS(sport.this_week_elapsed_time) }}
            </span>
          </div>

          <div class="flex flex-col">
            <span class="text-sm text-gray-600 dark:text-gray-400">This Month</span>
            <span class="text-lg font-semibold text-dark-primary dark:text-white-primary">
              {{ secondsToHHMMSS(sport.this_month_elapsed_time) }}
            </span>
          </div>

          <div v-if="sport?.this_week_distance" class="flex flex-col">
            <span class="text-sm text-gray-600 dark:text-gray-400">Distance (Week)</span>
            <span class="text-lg font-semibold text-dark-primary dark:text-white-primary">
              {{ Math.floor(sport.this_week_distance / 1000) }}km
            </span>
          </div>

          <div v-if="sport?.this_month_distance" class="flex flex-col">
            <span class="text-sm text-gray-600 dark:text-gray-400">Distance (Month)</span>
            <span class="text-lg font-semibold text-dark-primary dark:text-white-primary">
              {{ Math.floor(sport.this_month_distance / 1000) }}km
            </span>
          </div>
        </div>

        <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Total: {{ secondsToHHMMSS(sport.total_elapsed_time) }}
          <span v-if="sport?.total_distance">
            · {{ Math.floor(sport.total_distance / 1000) }}km
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
