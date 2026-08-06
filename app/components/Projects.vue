<script setup lang="ts">
import type { Project } from '~~/github';

withDefaults(
  defineProps<{
    title?: string;
    projects: Project[];
    sectionId?: string;
  }>(),
  { title: undefined, sectionId: 'projects' },
);
</script>

<template>
  <section v-if="projects?.length" :id="sectionId" class="flex flex-col gap-6">
    <SectionTitle>{{ title || 'Projects' }}</SectionTitle>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Project
        v-for="project of projects"
        :key="project.name"
        :project="project"
      />
    </div>
  </section>
</template>
