<script setup lang="ts">
// Icons are self-hosted in public/icons (devicon originals) so the section
// does not depend on third-party CDNs and does not shift layout while loading.
const tools = [
  { icon: 'linux', name: 'Linux', href: 'https://www.linux.org/' },
  {
    icon: 'csharp',
    name: 'C#',
    href: 'https://learn.microsoft.com/en-us/dotnet/csharp/',
  },
  { icon: 'dotnetcore', name: '.NET', href: 'https://dotnet.microsoft.com/' },
  { icon: 'angular', name: 'Angular', href: 'https://angular.dev' },
  {
    icon: 'javascript',
    name: 'JavaScript',
    href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
  },
  {
    icon: 'typescript',
    name: 'TypeScript',
    href: 'https://www.typescriptlang.org/',
  },
  { icon: 'postgresql', name: 'PostgreSQL', href: 'https://www.postgresql.org' },
  { icon: 'redis', name: 'Redis', href: 'https://redis.io' },
  { icon: 'docker', name: 'Docker', href: 'https://www.docker.com/' },
  { icon: 'kubernetes', name: 'Kubernetes', href: 'https://kubernetes.io' },
  { icon: 'git', name: 'Git', href: 'https://git-scm.com/' },
  { icon: 'postman', name: 'Postman', href: 'https://postman.com' },
  {
    icon: 'apachekafka',
    name: 'Apache Kafka',
    href: 'https://kafka.apache.org/',
    invertOnDark: true,
  },
  { icon: 'chartjs', name: 'Chart.js', href: 'https://www.chartjs.org' },
  {
    icon: 'css3',
    name: 'CSS',
    href: 'https://developer.mozilla.org/en-US/docs/Web/CSS',
  },
  { icon: 'd3js', name: 'D3.js', href: 'https://d3js.org/' },
  {
    icon: 'elasticsearch',
    name: 'Elasticsearch',
    href: 'https://www.elastic.co',
  },
  { icon: 'gatsby', name: 'Gatsby', href: 'https://www.gatsbyjs.com/' },
  { icon: 'grafana', name: 'Grafana', href: 'https://grafana.com' },
  {
    icon: 'html5',
    name: 'HTML',
    href: 'https://developer.mozilla.org/en-US/docs/Web/HTML',
  },
  { icon: 'argocd', name: 'Argo CD', href: 'https://argo-cd.readthedocs.io' },
  { icon: 'nginx', name: 'Nginx', href: 'https://www.nginx.com' },
  { icon: 'mongodb', name: 'MongoDB', href: 'https://www.mongodb.com/' },
  { icon: 'oracle', name: 'Oracle', href: 'https://www.oracle.com/' },
];
</script>

<template>
  <section id="tech-stack" class="flex flex-col gap-6">
    <SectionTitle> Languages and Tools </SectionTitle>

    <ul class="flex flex-wrap gap-3">
      <li v-for="tool of tools" :key="tool.name">
        <a
          class="flex size-12 items-center justify-center rounded-sm transition-transform hover:scale-110"
          :href="tool.href"
          :title="tool.name"
          target="_blank"
          rel="noreferrer"
        >
          <img
            class="size-10 object-contain"
            :class="tool.invertOnDark ? 'dark:invert' : ''"
            :src="`/icons/${tool.icon}.svg`"
            :alt="tool.name"
            width="40"
            height="40"
            loading="lazy"
            decoding="async"
          />
        </a>
      </li>
    </ul>
  </section>
</template>
