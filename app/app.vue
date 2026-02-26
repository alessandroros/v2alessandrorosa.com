<script setup lang="ts">
const baseTitle = 'Alessandro Rosà | Software Engineer';
const baseDescription =
  'Software engineer Team Lead from Italy. Lover of all things programming - but  always learning new stuff.';
const baseOgImage = '/og-image.png';
const ogType = 'website';
const author = 'Alessandro Rosà';
const ogSiteName = 'Alessandro Rosà';
const twitterCard = 'summary_large_image';
const twitterCreator = 'alessandroburns';
const twitterSite = '@alessandroburns';

function titleTemplate(title?: string) {
  if (title?.length && title !== baseTitle) {
    return `${title} | Alessandro Rosà`;
  }
  return baseTitle;
}

useHead({
  title: baseTitle,
  titleTemplate,
});

useServerHead({
  title: baseTitle,
  titleTemplate,
});

useSeoMeta({
  author,
  description: baseDescription,
  ogDescription: baseDescription,
  ogImage: baseOgImage,
  ogSiteName,
  ogTitle: baseTitle,
  ogType,
  title: baseTitle,
  titleTemplate,
  twitterCard,
  twitterCreator,
  twitterSite,
});

useServerSeoMeta({
  author,
  description: baseDescription,
  ogDescription: baseDescription,
  ogImage: baseOgImage,
  ogSiteName,
  ogTitle: baseTitle,
  ogType,
  title: baseTitle,
  titleTemplate,
  twitterCard,
  twitterCreator,
  twitterSite,
});
</script>

<template>
  <div class="container mx-auto flex h-full min-h-screen flex-col px-4 sm:px-8 py-4">
    <Navigation />

    <NuxtPage />
  </div>
</template>
