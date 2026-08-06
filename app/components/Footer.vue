<script setup lang="ts">
const links = useSiteLinks();

const year = new Date().getFullYear();
</script>

<template>
  <footer
    class="mt-24 grid grid-cols-1 gap-8 border-t border-surface-border pt-8 text-sm sm:grid-cols-3"
  >
    <nav class="flex flex-col gap-2" aria-label="Footer">
      <p
        class="text-xs font-semibold tracking-[0.09em] text-black-primary/60 uppercase dark:text-white-primary/50"
      >
        Sections
      </p>

      <NuxtLink
        v-for="link of links"
        :key="link.to"
        class="w-fit text-[color:var(--accent-link)] transition-colors hover:underline hover:underline-offset-4"
        :to="link.to"
        >{{ link.label }}</NuxtLink
      >
    </nav>

    <div class="flex flex-col gap-2">
      <p
        class="text-xs font-semibold tracking-[0.09em] text-black-primary/60 uppercase dark:text-white-primary/50"
      >
        Elsewhere
      </p>

      <a
        class="w-fit text-[color:var(--accent-link)] transition-colors hover:underline hover:underline-offset-4"
        href="https://github.com/alessandroros"
        rel="noreferrer noopener"
        target="_blank"
        >GitHub</a
      >

      <a
        class="w-fit text-[color:var(--accent-link)] transition-colors hover:underline hover:underline-offset-4"
        href="https://www.linkedin.com/in/alessandrorosa/"
        rel="noreferrer noopener"
        target="_blank"
        >LinkedIn</a
      >

      <a
        class="w-fit text-[color:var(--accent-link)] transition-colors hover:underline hover:underline-offset-4"
        href="mailto:info@alessandrorosa.com"
        >info@alessandrorosa.com</a
      >
    </div>

    <div class="flex flex-col gap-2 text-black-primary/70 dark:text-white-primary/60">
      <p
        class="text-xs font-semibold tracking-[0.09em] text-black-primary/60 uppercase dark:text-white-primary/50"
      >
        Colophon
      </p>

      <!-- Each typeface is set in itself, which is also the joke: nerazzurro
           palette, and the two families a Milan fan would pick anyway. -->
      <p>
        Set in <span class="font-sans font-medium">Inter</span>,
        <span class="font-serif font-semibold">Source Serif 4</span> and
        <span class="font-mono font-medium">JetBrains Mono</span>.
      </p>

      <p>
        <span class="font-sans font-medium text-[color:var(--accent-link)]">Inter</span>
        +
        <span class="font-mono font-medium text-[color:var(--accent-link)]">JetBrains</span>,
        always top.
      </p>

      <p>Nuxt 4 · Tailwind 4 · Cloudflare Pages</p>

      <p class="tabular-nums">© {{ year }} Alessandro Rosà</p>
    </div>
  </footer>
</template>
