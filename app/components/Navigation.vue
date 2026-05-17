<script setup lang="ts">
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
  <nav class="mb-8 overflow-hidden">
    <NuxtLink
      class="block truncate text-3xl lowercase text-black-primary dark:text-white-primary"
      to="/"
      >Alessandro Rosà</NuxtLink
    >
  </nav>

  <!-- fixed top-right theme toggle -->
  <button
    class="fixed top-4 right-4 z-50 rounded-full border border-black-primary dark:border-white-primary p-2 text-black-primary dark:text-white-primary transition-colors hover:bg-black-primary hover:text-white-primary dark:hover:bg-white-primary dark:hover:text-black-primary"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    @click="toggleTheme"
  >
    <!-- bulb on = light mode available; bulb off = dark mode available -->
    <svg v-if="isDark" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
      <path d="M9 18h6"/><path d="M10 22h4"/>
    </svg>
    <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
      <path d="M9 18h6"/><path d="M10 22h4"/>
    </svg>
  </button>
</template>
