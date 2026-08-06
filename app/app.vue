<script setup lang="ts">
const baseTitle = 'Alessandro Rosà | Software Engineer';
const baseDescription =
  'Software engineer from Italy, leading cloud development at SDF. I design architectures that stay reliable as they scale.';
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
  script: [
    {
      innerHTML: `(function(){var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t?t==='dark':true);})();`,
      tagPosition: 'head',
    },
  ],
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
  <div class="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-8">
    <Navigation />

    <main class="flex w-full flex-1 flex-col">
      <NuxtPage />
    </main>

    <Footer />
  </div>
</template>
