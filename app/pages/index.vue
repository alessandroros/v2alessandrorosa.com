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

const { data: starred } = useFetch<Project[]>('/api/github/starred');

const { data: repositories } = useFetch<Project[]>('/api/github/repositories');

const { data: metrics } = useFetch('/api/wakatime');

const { data: sports } = useFetch('/api/strava/activities');

const featuredProjects: Project[] = [
  {
    name: 'capitalquest.fun',
    description:
      'A platform to learn about capital markets through a fun and engaging experience.',
    homepageUrl: 'https://capitalquest.fun',
    url: 'https://capitalquest.fun',
    stargazerCount: 0,
    languages: [
      { name: 'TypeScript', color: '#007ACC' },
      { name: 'Angular', color: '#DD0230' },
      { name: 'Mapbox GL JS', color: '#FFFFFF' },
    ],
  },
];
</script>

<template>
  <div class="flex w-full flex-col gap-12 pb-8">
    <Hero :languages="metrics?.languages" />

    <TechStack />

    <Projects :projects="featuredProjects" title="My Projects" />

    <Projects :projects="starred ?? []" title="Starred Projects" />

    <StravaStats v-if="sports && sports.length > 0" :sports="sports" />

    <BlogPosts />

    <Contact />
  </div>
</template>
