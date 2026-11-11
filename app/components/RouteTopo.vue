<script setup lang="ts">
import { pitches, routeStart } from '~/data/route';
import { rng } from '~/utils/brenta';

const N = pitches.length;
const TOP = 70;
const BOTTOM = 850;
const STEP = (BOTTOM - TOP) / N;

/** Belays zig-zag up the wall; belay 0 is the start of the route. */
function belay(i: number) {
  return { x: i % 2 ? 230 : i === 0 ? 170 : 150, y: BOTTOM - i * STEP };
}

const segments = pitches.map((pitch, i) => {
  const a = belay(i);
  const b = belay(i + 1);
  const cx = (a.x + b.x) / 2 + (i % 2 ? -30 : 30);
  const cy = (a.y + b.y) / 2;
  const at = (t: number) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * cx + t ** 2 * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * cy + t ** 2 * b.y,
  });
  const bolts = [0.25, 0.5, 0.75].map((t) => {
    const { x, y } = at(t);
    return `M${x - 4},${y - 4}L${x + 4},${y + 4}M${x + 4},${y - 4}L${x - 4},${y + 4}`;
  });
  return {
    i,
    grade: pitch.grade,
    d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`,
    bolts: bolts.join(''),
    labelX: i % 2 ? 340 : 14,
    labelY: cy,
    anchor: i % 2 ? 'end' : 'start',
  };
});

const belays = Array.from({ length: N }, (_, k) => {
  const i = k + 1;
  return { i, ...belay(i), top: i === N, label: i === N ? 'today' : `S${i}` };
});
const start = belay(0);

const r = rng(23);
const cracks = Array.from({ length: 16 }, () => {
  const x = r() * 200 + 90;
  const y = r() * 760 + 80;
  return `M${x},${y} q${(r() - 0.5) * 20},${r() * 30 + 20} ${(r() - 0.5) * 14},${r() * 60 + 30}`;
});

// The most recent pitch first, like reading the topo from the top.
const cards = pitches.map((pitch, i) => ({ ...pitch, i })).reverse();

const active = ref(N - 1);
</script>

<template>
  <section id="route" class="@container relative flex flex-col gap-6">
    <SectionTitle eyebrow="Topo">The route, pitch by pitch</SectionTitle>

    <p
      class="max-w-[62ch] text-lg leading-relaxed text-black-primary/70 dark:text-white-primary/60"
    >
      Every company has been a pitch: a different grade, different protection,
      and a belay to look down and see what I had learned. The last one I had to
      equip from scratch. Read it bottom to top, like every topo.
    </p>

    <div
      class="mt-6 grid grid-cols-1 items-start gap-10 @3xl:grid-cols-[minmax(240px,340px)_1fr] @3xl:gap-14"
    >
      <svg
        class="topo mx-auto w-full max-w-[320px] text-black-primary @3xl:sticky @3xl:top-6 dark:text-white-primary"
        viewBox="0 0 380 900"
        role="img"
        aria-label="Topo of the route, one pitch per company"
      >
        <path
          class="wall"
          d="M60,890 L74,760 L58,640 L86,520 L70,400 L96,300 L84,190 L112,110 L150,48 L230,40 L282,96 L300,200 L290,320 L318,430 L304,560 L326,680 L312,800 L330,890 Z"
        />
        <path v-for="(d, k) in cracks" :key="k" class="crack" :d="d" />

        <g
          v-for="seg in segments"
          :key="seg.i"
          :class="{ active: active === seg.i }"
          @pointerenter="active = seg.i"
        >
          <path class="seg" :d="seg.d" />
          <path class="bolt" :d="seg.bolts" />
          <text :x="seg.labelX" :y="seg.labelY - 4" :text-anchor="seg.anchor">
            L{{ seg.i + 1 }}
          </text>
          <text
            class="grade"
            :x="seg.labelX"
            :y="seg.labelY + 12"
            :text-anchor="seg.anchor"
          >
            {{ seg.grade }}
          </text>
        </g>

        <text class="muted" :x="start.x" :y="start.y + 30" text-anchor="middle">
          start · {{ routeStart }}
        </text>
        <g v-for="b in belays" :key="b.i">
          <circle
            class="belay"
            :class="{ top: b.top }"
            :cx="b.x"
            :cy="b.y"
            :r="b.top ? 8 : 6.5"
          />
          <text
            class="muted"
            :x="b.x + (b.i % 2 ? -14 : 14)"
            :y="b.y + 4"
            :text-anchor="b.i % 2 ? 'end' : 'start'"
          >
            {{ b.label }}
          </text>
        </g>
      </svg>

      <ol class="flex flex-col gap-4">
        <li
          v-for="card in cards"
          :key="card.company"
          class="pitch rounded-xl border bg-surface p-5 transition"
          :class="
            active === card.i
              ? 'border-[color:var(--accent-link)] @3xl:translate-x-1'
              : 'border-surface-border'
          "
          @pointerenter="active = card.i"
        >
          <div
            class="flex flex-wrap items-baseline justify-between gap-3 font-mono text-xs"
          >
            <span
              class="tracking-[0.08em] text-black-primary/60 dark:text-white-primary/55"
              >L{{ card.i + 1 }} · {{ card.years }}</span
            >
            <span
              class="rounded-full border border-current px-2.5 text-[color:var(--accent-link)]"
              >{{ card.grade }}</span
            >
          </div>
          <h3
            class="mt-1.5 font-serif text-2xl font-semibold tracking-[-0.01em] text-black-primary dark:text-white-primary"
          >
            {{ card.company }}
          </h3>
          <p class="mb-3 text-black-primary/65 dark:text-white-primary/55">
            {{ card.role }}
          </p>
          <p
            class="mb-4 leading-relaxed text-black-primary dark:text-white-primary"
          >
            {{ card.note }}
          </p>
          <ul class="flex flex-wrap gap-1.5" aria-label="Gear">
            <li
              v-for="g in card.gear"
              :key="g"
              class="rounded-md bg-black-primary/5 px-2 py-0.5 font-mono text-[11px] text-black-primary/70 dark:bg-white-primary/8 dark:text-white-primary/65"
            >
              {{ g }}
            </li>
          </ul>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.topo .wall {
  fill: var(--surface);
  stroke: currentColor;
  stroke-width: 1.4;
}

.topo .crack {
  fill: none;
  stroke: currentColor;
  stroke-width: 0.8;
  opacity: 0.3;
}

.topo .seg {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  transition:
    stroke 0.2s,
    stroke-width 0.2s;
}

.topo .bolt {
  stroke: currentColor;
  stroke-width: 1.4;
}

.topo .active .seg {
  stroke: var(--accent-link);
  stroke-width: 4;
}

.topo .belay {
  fill: var(--surface);
  stroke: currentColor;
  stroke-width: 1.6;
}

.topo .belay.top {
  fill: var(--accent-link);
  stroke: var(--accent-link);
}

.topo text {
  font-family: var(--font-mono);
  font-size: 12px;
  fill: currentColor;
}

.topo .grade {
  fill: var(--accent-link);
  font-weight: 500;
}

.topo .muted {
  font-size: 10.5px;
  opacity: 0.6;
}
</style>
