<script setup lang="ts">
defineProps<{
  eyebrow?: string;
}>();
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="eyebrow"
      class="text-xs font-semibold tracking-[0.09em] text-[color:var(--accent-link)] uppercase"
    >
      {{ eyebrow }}
    </p>

    <h2
      class="font-serif text-3xl font-semibold tracking-[-0.015em] text-balance text-black-primary dark:text-white-primary"
    >
      <slot></slot>
    </h2>
  </div>
</template>
