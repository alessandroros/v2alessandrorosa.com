<script setup lang="ts">
const { data: list } = await useAsyncData('blog-posts', () =>
  queryCollectionNavigation('content', ['path', 'title', 'date_created'])
    .order('date_created', 'DESC')
    .then((docs) => docs?.find((d) => d.path === '/blog')?.children ?? []),
);
</script>

<template>
  <section v-if="list?.length" id="blog" class="flex flex-col gap-6">
    <SectionTitle eyebrow="Blog"> Thoughts </SectionTitle>

    <ul class="flex flex-col gap-3">
      <li v-for="link in list" :key="link.path">
        <NuxtLink
          class="text-lg text-[color:var(--accent-link)] underline underline-offset-4 transition duration-300"
          :to="link.path"
          >{{ link.title }}</NuxtLink
        >
      </li>
    </ul>
  </section>
</template>
