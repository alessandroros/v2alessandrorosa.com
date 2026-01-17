<script setup lang="ts">
const title = '';

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

const { data: repositories } = useFetch('/api/github/repositories');

const { data: metrics } = useFetch('/api/wakatime');

const { data: sports } = useFetch('/api/strava/activities');
</script>

<template>
  <div class="flex w-full flex-col gap-12 pb-8">
    <Hero :languages="metrics?.languages" />

    <Projects :projects="repositories || []" />

    <StravaStats v-if="sports && sports.length > 0" :sports="sports" />

    <BlogPosts />

    <Contact />
  </div>
</template>
