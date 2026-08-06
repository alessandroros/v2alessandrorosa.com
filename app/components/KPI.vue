<script setup lang="ts">
defineProps<{
  label: string;
  value: number | string;
}>();
</script>

<template>
  <Tile>
    <p
      class="mb-auto font-mono text-4xl font-medium tabular-nums text-[color:var(--accent-link)] transition-all duration-200"
    >
      {{ value }}
    </p>

    <p class="mt-4 text-black-primary dark:text-white-primary">
      {{ label }}
    </p>
  </Tile>
</template>
