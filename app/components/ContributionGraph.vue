<script setup lang="ts">
import type { ContributionCalendar, ContributionDay } from '~~/github';

const props = defineProps<{
  calendar: ContributionCalendar;
}>();

type Cell = ContributionDay & { level: number };

/**
 * Thresholds scale with the busiest day rather than using GitHub's fixed
 * breakpoints: on a calendar where the peak is three commits, fixed
 * breakpoints would render every day at the palest step.
 */
function levelFor(count: number, max: number) {
  if (count <= 0) {
    return 0;
  }

  if (max <= 0) {
    return 1;
  }

  const ratio = count / max;

  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;

  return 4;
}

/**
 * Flattened column-major grid. The first week is padded so that every row of
 * the rendered grid is the same weekday, which is what makes the columns line
 * up with the month labels.
 */
const cells = computed<Array<Cell | null>>(() => {
  const weeks = props.calendar?.weeks ?? [];
  const max = props.calendar?.max ?? 0;

  const out: Array<Cell | null> = [];

  weeks.forEach((week, weekIndex) => {
    const days = week ?? [];

    if (weekIndex === 0) {
      const leading = days[0]?.weekday ?? 0;

      for (let i = 0; i < leading; i += 1) {
        out.push(null);
      }
    }

    for (const day of days) {
      out.push({ ...day, level: levelFor(day.count, max) });
    }
  });

  return out;
});

const monthLabels = computed(() => {
  const weeks = props.calendar?.weeks ?? [];

  let previousMonth = -1;

  return weeks.map((week) => {
    const first = week?.[0];

    if (!first) {
      return '';
    }

    const month = new Date(`${first.date}T00:00:00Z`).getUTCMonth();

    // Label a column only when its month differs from the column before it,
    // and skip the first column so a stub week does not get a label.
    if (month === previousMonth) {
      return '';
    }

    previousMonth = month;

    return new Date(`${first.date}T00:00:00Z`).toLocaleString('en', {
      month: 'short',
      timeZone: 'UTC',
    });
  });
});

const weekCount = computed(() => props.calendar?.weeks?.length ?? 0);

function labelFor(cell: Cell) {
  const date = new Date(`${cell.date}T00:00:00Z`).toLocaleDateString('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const count = cell.count === 0 ? 'No' : String(cell.count);
  const noun = cell.count === 1 ? 'contribution' : 'contributions';

  return `${count} ${noun} on ${date}`;
}

const wrapper = useTemplateRef<HTMLElement>('wrapper');

const tip = ref<{ text: string; x: number; y: number } | null>(null);

/**
 * One shared tooltip driven by delegation rather than a listener per cell:
 * the grid holds ~370 of them.
 */
function showTip(event: MouseEvent) {
  const target = (event.target as HTMLElement)?.closest<HTMLElement>(
    '[data-cell]',
  );

  if (!target || !wrapper.value) {
    tip.value = null;

    return;
  }

  const index = Number(target.dataset.cell);
  const cell = cells.value[index];

  if (!cell) {
    tip.value = null;

    return;
  }

  const host = wrapper.value.getBoundingClientRect();
  const box = target.getBoundingClientRect();

  tip.value = {
    text: labelFor(cell),
    x: box.left - host.left + box.width / 2,
    y: box.top - host.top,
  };
}

function hideTip() {
  tip.value = null;
}
</script>

<template>
  <figure v-if="weekCount" ref="wrapper" class="relative m-0 flex flex-col gap-3">
    <!-- The tooltip lives outside the scroll container on purpose: inside it,
         `overflow-x-auto` clips anything sitting above the top row. -->
    <div
      v-if="tip"
      class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-surface-border bg-surface px-2 py-1 text-xs whitespace-nowrap text-black-primary shadow-sm dark:text-white-primary"
      :style="{ left: `${tip.x}px`, top: `${tip.y - 6}px` }"
      role="tooltip"
    >
      {{ tip.text }}
    </div>

    <div class="overflow-x-auto pb-1">
      <div class="flex w-fit gap-2" @mouseover="showTip" @mouseleave="hideTip">

        <!-- Weekday rail. Only alternate days are labelled, as on GitHub. -->
        <div
          class="grid shrink-0 grid-rows-7 gap-[3px] pt-[18px] text-[10px] text-black-primary/55 dark:text-white-primary/50"
          aria-hidden="true"
        >
          <span class="h-[11px] leading-[11px]"></span>
          <span class="h-[11px] leading-[11px]">Mon</span>
          <span class="h-[11px] leading-[11px]"></span>
          <span class="h-[11px] leading-[11px]">Wed</span>
          <span class="h-[11px] leading-[11px]"></span>
          <span class="h-[11px] leading-[11px]">Fri</span>
          <span class="h-[11px] leading-[11px]"></span>
        </div>

        <div class="flex flex-col gap-[3px]">
          <div
            class="grid grid-flow-col gap-[3px] text-[10px] text-black-primary/55 dark:text-white-primary/50"
            :style="{ gridTemplateColumns: `repeat(${weekCount}, 11px)` }"
            aria-hidden="true"
          >
            <span
              v-for="(label, index) of monthLabels"
              :key="index"
              class="h-[15px] whitespace-nowrap"
              >{{ label }}</span
            >
          </div>

          <div
            class="grid grid-flow-col grid-rows-7 gap-[3px]"
            role="img"
            :aria-label="`Contribution heatmap: ${calendar.total} contributions in the last year`"
          >
            <span
              v-for="(cell, index) of cells"
              :key="index"
              class="size-[11px] rounded-[2px]"
              :class="cell ? 'border border-black-primary/5 dark:border-white-primary/5' : ''"
              :style="cell ? { backgroundColor: `var(--heat-${cell.level})` } : undefined"
              :data-cell="cell ? index : undefined"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <figcaption
      class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-black-primary/70 dark:text-white-primary/60"
    >
      <span>
        <span
          class="font-mono font-medium tabular-nums text-[color:var(--accent-link)]"
          >{{ calendar.total }}</span
        >
        contributions in the last year
      </span>

      <span class="ml-auto flex items-center gap-[3px]">
        <span class="mr-1 text-xs">Less</span>
        <span
          v-for="level of [0, 1, 2, 3, 4]"
          :key="level"
          class="size-[11px] rounded-[2px] border border-black-primary/5 dark:border-white-primary/5"
          :style="{ backgroundColor: `var(--heat-${level})` }"
        ></span>
        <span class="ml-1 text-xs">More</span>
      </span>
    </figcaption>
  </figure>
</template>
