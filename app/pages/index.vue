<script setup lang="ts">
import type { ContributionCalendar, Project } from '~~/github';
import type { WakatimeStatResponse } from '~~/wakatime';

const title = 'Alessandro Rosà — Software Developer';

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

//const { data: repositories } = useFetch<Project[]>('/api/github/repositories');

const { data: metrics } = useFetch<WakatimeStatResponse['data']>('/api/wakatime');

const { data: contributions } = useFetch<ContributionCalendar>(
  '/api/github/contributions',
);

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
  <div class="flex w-full flex-col gap-24 pb-16">
    <Hero :languages="metrics?.languages" />

    <TechStack />

    <section
      v-if="contributions?.weeks?.length"
      id="contributions"
      class="flex flex-col gap-6"
    >
      <SectionTitle eyebrow="GitHub">Commits</SectionTitle>

      <ContributionGraph :calendar="contributions" />
    </section>

    <ProgrammingMetrics v-if="metrics" :metrics="metrics" />

    <Projects :projects="featuredProjects" title="My Projects" />

    <Projects
      :projects="starred ?? []"
      title="Starred Projects"
      section-id="starred-projects"
    />

    <StravaStats v-if="sports && sports.length > 0" :sports="sports" />

    <BlogPosts />

    <Contact />
  </div>
</template>
