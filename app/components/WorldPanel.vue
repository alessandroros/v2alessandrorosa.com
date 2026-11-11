<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close');
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Transition name="slide">
    <aside
      v-if="open"
      class="fixed inset-y-0 right-0 z-30 flex w-full max-w-[640px] flex-col border-l border-surface-border bg-white-primary/95 text-black-primary shadow-2xl backdrop-blur dark:bg-black-primary/92 dark:text-white-primary"
      role="dialog"
      aria-modal="false"
      :aria-label="title"
    >
      <div
        class="flex items-center justify-between border-b border-surface-border px-6 py-4"
      >
        <p class="font-mono text-xs tracking-[0.14em] uppercase opacity-70">
          {{ title }}
        </p>
        <button
          type="button"
          class="rounded-full border border-surface-border px-3 py-1 font-mono text-xs tracking-[0.1em] uppercase hover:border-[color:var(--accent-link)]"
          @click="emit('close')"
        >
          Back to the track
        </button>
      </div>
      <div class="flex-1 overflow-y-auto px-6 py-8">
        <slot />
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition:
    transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.3s;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(40px);
  opacity: 0;
}
</style>
