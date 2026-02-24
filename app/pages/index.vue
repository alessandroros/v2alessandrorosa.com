<script setup lang="ts">
import type { Project } from '~~/github';

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

const { data: repositories } = useFetch<Project[]>('/api/github/starred');

const { data: metrics } = useFetch('/api/wakatime');

const { data: sports } = useFetch('/api/strava/activities');
</script>

<template>
  <div class="flex w-full flex-col gap-12 pb-8">
    <Hero :languages="metrics?.languages" />

    <TechStack />

    <Projects :projects="repositories ?? []" title="Starred Projects" />

    <StravaStats v-if="sports && sports.length > 0" :sports="sports" />

    <BlogPosts />

    <Contact />
  </div>
</template>
