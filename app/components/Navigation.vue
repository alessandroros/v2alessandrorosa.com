<script setup lang="ts">
const route = useRoute();

const links = useSiteLinks();

const menuOpen = ref(false);

// Hash links point at sections of the home page, so they never mark a page as current.
function isCurrent(to: string) {
  return !to.includes('#') && route.path === to;
}

watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);

const isDark = useState('theme-dark', () => true);

function toggleTheme() {
  isDark.value = !isDark.value;
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', isDark.value);
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
  }
}

if (import.meta.client) {
  const saved = localStorage.getItem('theme');
  isDark.value = saved ? saved === 'dark' : true;
  document.documentElement.classList.toggle('dark', isDark.value);
}
</script>

<template>
  <header
    class="mb-16 flex flex-wrap items-baseline gap-x-6 gap-y-3 border-b border-surface-border pb-4"
  >
    <NuxtLink
      class="order-1 font-serif text-2xl font-semibold tracking-[-0.015em] text-black-primary dark:text-white-primary"
      to="/"
      >Alessandro Rosà</NuxtLink
    >

    <button
      class="order-2 ml-auto self-center rounded-sm p-1 text-black-primary transition-colors hover:text-[color:var(--accent-link)] lg:hidden dark:text-white-primary"
      type="button"
      aria-controls="site-nav"
      :aria-expanded="menuOpen"
      :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
      @click="menuOpen = !menuOpen"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <template v-if="menuOpen">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </template>
        <template v-else>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </template>
      </svg>
    </button>

    <button
      class="order-3 self-center rounded-sm p-1 text-black-primary/55 transition-colors hover:text-[color:var(--accent-link)] dark:text-white-primary/50"
      type="button"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggleTheme"
    >
      <!-- bulb outline = light mode available; filled bulb = dark mode available -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        :fill="isDark ? 'none' : 'currentColor'"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"
        />
        <path d="M9 18h6" />
        <path d="M10 22h4" />
      </svg>
    </button>

    <nav
      id="site-nav"
      class="order-4 w-full basis-full lg:order-2 lg:ml-auto lg:block lg:w-auto lg:basis-auto"
      :class="menuOpen ? 'block' : 'hidden'"
      aria-label="Main"
    >
      <ul
        class="flex flex-col gap-y-1 py-3 lg:flex-row lg:items-baseline lg:gap-x-5 lg:py-0"
      >
        <li v-for="link of links" :key="link.to">
          <NuxtLink
            class="block py-1 text-[13px] tracking-[0.08em] uppercase transition-colors hover:text-[color:var(--accent-link)]"
            :class="
              isCurrent(link.to)
                ? 'font-semibold text-[color:var(--accent-link)]'
                : 'text-black-primary/65 dark:text-white-primary/60'
            "
            :aria-current="isCurrent(link.to) ? 'page' : undefined"
            :to="link.to"
            >{{ link.label }}</NuxtLink
          >
        </li>
      </ul>
    </nav>
  </header>
</template>
