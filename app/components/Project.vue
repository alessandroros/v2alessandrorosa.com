<script setup lang="ts">
import type { Project } from '~~/github';

defineProps<{
  project: Project;
}>();
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-md border border-surface-border bg-surface p-4"
  >
    <a
      class="text-lg font-semibold text-[color:var(--accent-link)]"
      :href="project?.url ?? project?.homepageUrl ?? '#'"
      rel="noreferrer noopener"
      target="_blank"
      >{{ project.name }}</a
    >

    <p
      class="text-black-primary dark:text-white-primary"
      :class="{ 'mb-5': project?.languages?.length }"
    >
      {{ project.description }}
    </p>

    <div v-if="project?.languages?.length" class="mt-auto flex gap-2">
      <ProjectLanguage
        v-for="(language, languageIndex) of project?.languages ?? []"
        :key="languageIndex"
        :language="language"
      />
    </div>
  </div>
</template>
