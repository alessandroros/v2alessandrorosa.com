<script setup lang="ts">
import { switchHighlightColor } from '~/colors';
import type { WakatimeStatResponse } from '~~/wakatime';

defineProps<{
  languages?: WakatimeStatResponse['data']['languages'];
}>();

// Markup, config and data formats are what an editor logs, not what you would
// answer if someone asked what you have been writing.
const hiddenLanguages = new Set([
  'bash',
  'csv',
  'css',
  'gitignore',
  'html',
  'ini',
  'json',
  'markdown',
  'netrw',
  'other',
  'scss',
  'text',
  'toml',
  'xml',
  'yaml',
]);

const defaultLanguages = ['C#', 'TypeScript', 'SQL'];

const listFormatter = new Intl.ListFormat('en-GB', {
  style: 'long',
  type: 'conjunction',
});

function formatLanguageText(inputLanguages?: string[]) {
  const source = Array.isArray(inputLanguages) && inputLanguages.length
    ? inputLanguages
    : defaultLanguages;

  const picked = source
    .filter(
      (language) => language?.length && !hiddenLanguages.has(language.toLowerCase()),
    )
    .slice(0, 3);

  const formatted = listFormatter.format(
    picked.length ? picked : defaultLanguages,
  );

  return `Lately I have been writing a lot of ${formatted}.`;
}

const rotation = ref(0);

const favicon = computed(() => {
  if (rotation.value === 0) {
    return [{ rel: 'icon', href: '/ar.png', type: 'image/png' }];
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  const img = new Image();
  img.src = '/ar.png';
  ctx.translate(32, 32);
  ctx.rotate((rotation.value * Math.PI) / 180);
  ctx.drawImage(img, -32, -32, 64, 64);
  return [{ rel: 'icon', href: canvas.toDataURL('image/png'), type: 'image/png' }];
});

useHead({
  link: favicon,
});

const rotateInterval = ref<ReturnType<typeof setInterval>>();

function rotateFavicon() {
  rotation.value += 15;
}

function startRotation() {
  if (rotateInterval.value) {
    return;
  }

  rotateFavicon();

  rotateInterval.value = setInterval(rotateFavicon, 100);
}

function stopRotation() {
  clearInterval(rotateInterval.value);

  rotateInterval.value = undefined;
}

function easterEgg() {
  switchHighlightColor();

  startRotation();
}
</script>

<template>
  <section
    id="about"
    class="grid grid-cols-1 items-center gap-8 lg:grid-cols-2"
  >
    <div class="flex flex-col gap-6">
      <h1
        class="font-serif text-5xl leading-[1.04] font-bold tracking-[-0.008em] break-words text-black-primary lg:text-6xl dark:text-white-primary"
      >
        <span
          class="text-[color:var(--highlight)] duration-300"
          @focus="easterEgg"
          @focusout="stopRotation"
          @mouseenter="easterEgg"
          @mouseleave="stopRotation"
          >Hi,</span
        >
        I'm Alessandro
      </h1>

      <p
        class="max-w-[62ch] text-lg leading-relaxed text-black-primary dark:text-white-primary"
      >
        I am a software engineer from Italy. I enjoy designing architectures
        that stay reliable as they scale, and I keep trying whatever is new to
        see if it earns a place.
      </p>

      <p
        class="max-w-[62ch] text-lg leading-relaxed text-black-primary dark:text-white-primary"
      >
        I work @
        <a
          class="text-[color:var(--accent-link)] underline"
          href="https://www.sdfgroup.com"
          target="_blank"
          rel="noreferrer"
          >SDF (SAME Deutz-Fahr SpA)</a
        >
        where I lead cloud development.
      </p>

      <p class="max-w-[62ch] text-lg leading-relaxed text-black-primary/70 dark:text-white-primary/60">
        {{ formatLanguageText(languages?.map((l) => l.name)) }}
      </p>

      <div class="mt-3 flex gap-4">
        <GithubLink />

        <LinkedInLink />
      </div>
    </div>

    <NuxtPicture
      alt="Image of Alessandro Rosà"
      class="order-first mx-auto w-8/12 lg:order-1 lg:mr-0 lg:w-fit lg:text-right max-w-sm xl:max-w-md"
      :img-attrs="{ class: 'mr-auto lg:mr-0 ml-auto lg:text-right rounded-full aspect-square object-cover shadow-lg' }"
      src="/alessandro_rosa.png"
    />
  </section>
</template>
