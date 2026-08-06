<script setup lang="ts">
import { secondsToHoursMinutes } from '~~/strava';

const title = 'Weekly Activity Stats';

useHead({
  title,
});

useServerHead({
  title,
});

useSeoMeta({
  title,
});

useServerSeoMeta({
  title,
});

const { data: sports } = useFetch('/api/strava/activities');

const totalMinutes = computed(() => {
  let m = 0;

  for (const sport of Object.values(sports.value ?? {})) {
    m += sport?.this_week_elapsed_time || 0;
  }

  return m / 60;
});

const hasData = computed(() => sports.value && Object.keys(sports.value).length > 0);
</script>

<template>
  <div class="flex w-full flex-col gap-24 pb-16">
    <SectionTitle v-if="hasData">
      Have I been lazy this week? {{ totalMinutes < 60 * 7 ? 'Yes!' : 'No!' }}
    </SectionTitle>

    <SectionTitle v-else>
      Weekly Activity Stats
    </SectionTitle>

    <p v-if="!hasData" class="max-w-[62ch] text-lg leading-relaxed text-black-primary dark:text-white-primary">
      Strava integration is not configured. To enable activity tracking, set up your Strava API credentials.
    </p>

    <section
      v-for="(sport, sportIndex) of sports"
      :key="sportIndex"
      class="flex flex-col gap-6"
    >
      <SectionTitle class="capitalize">{{ sport.name }}</SectionTitle>

      <KPIGrid>
        <KPI
          label="Total time"
          :value="secondsToHoursMinutes(sport.total_elapsed_time)"
        />

        <KPI
          label="Time this year"
          :value="secondsToHoursMinutes(sport.this_year_elapsed_time)"
        />

        <KPI
          label="Time this month"
          :value="secondsToHoursMinutes(sport.this_month_elapsed_time)"
        />

        <KPI
          label="Time this week"
          :value="secondsToHoursMinutes(sport.this_week_elapsed_time)"
        />

        <KPI
          v-if="sport?.total_distance"
          label="Total distance"
          :value="`${
            sport?.total_distance ? Math.floor(sport?.total_distance / 1000) : 0
          }km`"
        />

        <KPI
          v-if="sport?.total_distance"
          label="Distance this year"
          :value="`${
            sport?.this_year_distance
              ? Math.floor(sport?.this_year_distance / 1000)
              : 0
          }km`"
        />

        <KPI
          v-if="sport?.total_distance"
          label="Distance this month"
          :value="`${
            sport?.this_month_distance
              ? Math.floor(sport?.this_month_distance / 1000)
              : 0
          }km`"
        />

        <KPI
          v-if="sport?.total_distance"
          label="Distance this week"
          :value="`${
            sport?.this_week_distance
              ? Math.floor(sport?.this_week_distance / 1000)
              : 0
          }km`"
        />
      </KPIGrid>
    </section>
  </div>
</template>
