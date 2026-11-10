<script setup lang="ts">
import {
  BRENTA,
  RAIN_CODES,
  SNOW_CODES,
  WEATHER_LABELS,
  WEATHER_PRESETS,
  fetchSummitWeather,
  sunPosition,
  type Weather,
  type WeatherPreset,
} from '~/utils/brenta';
import type { PropId } from '~/utils/world/props';
import { PEAKS, type Label, type World } from '~/utils/world/world';

const props = defineProps<{ open: PropId | null }>();
const emit = defineEmits<{
  pick: [id: Exclude<PropId, 'lantern'>];
  lofi: [];
}>();

const TITLES: Record<PropId, string> = {
  about: 'Enamel mug · about me',
  route: 'Hiking map · the route',
  logbook: 'Summit logbook · blog',
  projects: 'Laptop · projects',
  stack: 'Rope · my stack',
  contact: 'Radio · get in touch',
  lantern: 'Lantern · change the time of day',
};

const MENU: { id: Exclude<PropId, 'lantern'>; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'route', label: 'Route' },
  { id: 'logbook', label: 'Logbook' },
  { id: 'projects', label: 'Projects' },
  { id: 'stack', label: 'Stack' },
  { id: 'contact', label: 'Contact' },
];

const canvas = ref<HTMLCanvasElement | null>(null);
const progress = ref(0);
const loaded = ref(false);
const failed = ref(false);
const labels = ref<Label[]>([]);
const hover = ref<{ id: PropId; x: number; y: number } | null>(null);
let world: World | null = null;

/* ------------------------------------------------------ time & weather */

const romeTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Rome',
  hour: '2-digit',
  minute: '2-digit',
});
const romeHour = (d: Date) => {
  const [h = 0, m = 0] = romeTime.format(d).split(':').map(Number);
  return h + m / 60;
};

const now = ref(new Date());
// The lantern cycles: live → midday → sunset (enrosadira) → night → live.
const SCENES = [null, 'day', 'sunset', 'night'] as const;
const sceneIndex = ref(0);
const simWeather = ref<WeatherPreset>('live');
const live = ref<Weather>({
  code: null,
  cloud: 20,
  temperature: null,
  wind: null,
});

const date = computed(() => {
  const mode = SCENES[sceneIndex.value];
  if (!mode) return now.value;
  if (mode === 'day') {
    return new Date(
      now.value.getTime() + (12.5 - romeHour(now.value)) * 3600e3,
    );
  }
  // Search today for the sun height we want, at the Brenta.
  const target = mode === 'sunset' ? 2.5 : -20;
  let best = now.value;
  let bestErr = Infinity;
  for (let h = 12; h <= 23.9; h += 0.1) {
    const d = new Date(
      now.value.getTime() + (h - romeHour(now.value)) * 3600e3,
    );
    const err = Math.abs(
      sunPosition(d, BRENTA.lat, BRENTA.lon).altitude - target,
    );
    if (err < bestErr) {
      bestErr = err;
      best = d;
    }
  }
  return best;
});

const weather = computed<Weather>(() =>
  simWeather.value === 'live'
    ? live.value
    : { ...live.value, ...WEATHER_PRESETS[simWeather.value] },
);

const SNOW = SNOW_CODES;
const RAIN = RAIN_CODES;

const skyText = computed(() =>
  weather.value.code === null
    ? '…'
    : (WEATHER_LABELS[weather.value.code] ?? '—'),
);
const tempText = computed(() =>
  live.value.temperature === null
    ? '—'
    : `${live.value.temperature.toFixed(1)}°C`,
);

function applyLighting() {
  if (!world) return;
  const { altitude, azimuth } = sunPosition(date.value, BRENTA.lat, BRENTA.lon);
  const code = weather.value.code ?? 0;
  const month = date.value.getMonth();
  const seasonal = [11, 0, 1, 2].includes(month)
    ? 1500
    : [3, 10].includes(month)
      ? 1900
      : [4, 9].includes(month)
        ? 2400
        : 2900;
  world.setLighting({
    altitude,
    azimuth,
    cloud: Math.min(1, weather.value.cloud / 100),
    fog: code === 45 || code === 48,
    precipitation: SNOW.has(code) ? 'snow' : RAIN.has(code) ? 'rain' : null,
    snowLine: SNOW.has(code) ? Math.min(seasonal, 1400) : seasonal,
    lantern: sceneIndex.value !== 0,
  });
  world.updateScreens({
    temperature: tempText.value,
    sky: skyText.value,
    time: romeTime.format(date.value),
  });
}

watch([date, weather], applyLighting);

async function refreshWeather() {
  try {
    live.value = await fetchSummitWeather();
  } catch {
    // Keep the last known weather; the sky still follows the sun.
  }
}

/* ---------------------------------------------------------- picking */

function pick(id: PropId) {
  if (id === 'lantern') {
    sceneIndex.value = (sceneIndex.value + 1) % SCENES.length;
    return;
  }
  emit('pick', id);
}

watch(
  () => props.open,
  (id) => world?.focus(id),
);

/* -------------------------------------------------------- lifecycle */

let clock: ReturnType<typeof setInterval> | undefined;
let weatherClock: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  if (!canvas.value) return;
  try {
    const { createWorld } = await import('~/utils/world/world');
    world = await createWorld({
      canvas: canvas.value,
      onProgress: (r) => (progress.value = r),
      onHover: (id, x, y) => (hover.value = id ? { id, x, y } : null),
      onPick: pick,
      onLabels: (l) => (labels.value = l),
    });
    applyLighting();
    world.focus(props.open);
    loaded.value = true;
  } catch (error) {
    console.error(error);
    failed.value = true;
  }
  void refreshWeather();
  clock = setInterval(() => (now.value = new Date()), 60_000);
  weatherClock = setInterval(refreshWeather, 15 * 60_000);
});

onBeforeUnmount(() => {
  clearInterval(clock);
  clearInterval(weatherClock);
  world?.dispose();
  world = null;
});

const peakName = (id: string) => PEAKS.find((p) => p.id === id);
const sceneLabel = computed(() => SCENES[sceneIndex.value] ?? 'live');
</script>

<template>
  <div
    class="world fixed inset-0 z-0 overflow-hidden bg-[#0b1222] text-white select-none"
  >
    <canvas
      ref="canvas"
      class="absolute inset-0 h-full w-full"
      :class="{ 'opacity-0': !loaded }"
    />

    <!-- Loading: the walk up to the refuge. -->
    <Transition name="fade">
      <div
        v-if="!loaded"
        class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-[#0b1222] font-mono text-xs tracking-[0.16em] uppercase"
      >
        <template v-if="!failed">
          <p class="opacity-80">Walking up to Monte Spinale · 2104 m</p>
          <div class="h-px w-56 bg-white/15">
            <div
              class="h-px bg-white transition-[width]"
              :style="{ width: `${Math.round(progress * 100)}%` }"
            />
          </div>
        </template>
        <template v-else>
          <p class="opacity-80">This device cannot draw the mountains.</p>
          <button
            type="button"
            class="rounded-full border border-white/40 px-4 py-2 hover:bg-white hover:text-black"
            @click="emit('lofi')"
          >
            Open the lo-fi site
          </button>
        </template>
      </div>
    </Transition>

    <!-- Summit labels, projected from the 3D scene. -->
    <template v-if="loaded && !open">
      <div
        v-for="l in labels"
        v-show="l.visible"
        :key="l.id"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full text-center font-mono text-[10.5px] leading-tight tracking-[0.08em] uppercase"
        :style="{ left: `${l.x}px`, top: `${l.y}px` }"
      >
        {{ peakName(l.id)?.name }}<br /><span class="opacity-70"
          >{{ peakName(l.id)?.altitude }} m</span
        >
        <div class="mx-auto mt-1 h-5 w-px bg-white/50" />
      </div>
    </template>

    <!-- Hover tooltip -->
    <div
      v-if="hover && !open"
      class="glass pointer-events-none absolute z-20 rounded-md px-2.5 py-1.5 font-mono text-[11px] tracking-[0.06em]"
      :style="{ left: `${hover.x + 14}px`, top: `${hover.y + 14}px` }"
    >
      {{ TITLES[hover.id] }}
    </div>

    <!-- Top bar -->
    <div
      class="absolute inset-x-0 top-0 z-10 flex items-center gap-6 px-4 py-5 sm:px-8 lg:px-12"
    >
      <span
        class="font-mono text-[13px] font-medium tracking-[0.18em] uppercase"
        >Alessandro Rosà</span
      >
      <nav class="ml-auto hidden md:block" aria-label="Main">
        <ul class="flex gap-6 font-mono text-xs tracking-[0.14em] uppercase">
          <li v-for="m in MENU" :key="m.id">
            <button
              type="button"
              class="uppercase opacity-80 hover:underline hover:underline-offset-4 hover:opacity-100"
              :class="{
                'underline underline-offset-4 opacity-100': open === m.id,
              }"
              @click="emit('pick', m.id)"
            >
              {{ m.label }}
            </button>
          </li>
        </ul>
      </nav>
    </div>

    <!-- Data credits: required by the licences of the sources. -->
    <p
      class="pointer-events-auto absolute right-4 bottom-1 z-10 font-mono text-[9.5px] tracking-[0.04em] opacity-55 sm:right-8 lg:right-12"
    >
      Terrain:
      <a
        class="underline"
        href="https://registry.opendata.aws/terrain-tiles/"
        target="_blank"
        rel="noreferrer"
        >AWS Terrain Tiles</a
      >
      · Orthophoto 2015 ©
      <a
        class="underline"
        href="https://www.provincia.tn.it/News/Approfondimenti/Ortofoto-digitale-2015"
        target="_blank"
        rel="noreferrer"
        >Provincia autonoma di Trento</a
      >
      · Weather:
      <a
        class="underline"
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
        >Open-Meteo</a
      >
    </p>

    <!-- Bottom bar: live summit station and modes -->
    <div
      class="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-end gap-3 px-4 pb-5 font-mono text-[11px] sm:px-8 lg:px-12"
    >
      <div class="glass rounded-lg px-3 py-2">
        <span
          class="dot"
          :class="{ sim: sceneIndex !== 0 || simWeather !== 'live' }"
        />
        Cima Tosa · {{ tempText }} · {{ skyText }} · {{ romeTime.format(date) }}
        <span v-if="sceneIndex !== 0" class="opacity-70"
          >({{ sceneLabel }})</span
        >
      </div>
      <p class="hidden opacity-70 lg:block">Click the things on the table.</p>
      <div class="ml-auto flex gap-2">
        <select
          v-model="simWeather"
          class="glass rounded-full px-3 py-1.5 uppercase"
          aria-label="Simulate the weather"
        >
          <option
            v-for="w in ['live', 'clear', 'cloudy', 'snow', 'rain', 'fog']"
            :key="w"
            :value="w"
            class="text-black"
          >
            {{ w === 'live' ? 'live weather' : w }}
          </option>
        </select>
        <button
          type="button"
          class="glass rounded-full px-3 py-1.5 tracking-[0.12em] uppercase"
          @click="sceneIndex = (sceneIndex + 1) % SCENES.length"
        >
          {{ sceneLabel === 'live' ? 'Time: now' : `Time: ${sceneLabel}` }}
        </button>
        <button
          type="button"
          class="glass rounded-full px-3 py-1.5 tracking-[0.12em] uppercase"
          @click="emit('lofi')"
        >
          Lo-fi
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass {
  background: rgb(10 14 24 / 0.38);
  border: 1px solid rgb(255 255 255 / 0.2);
  backdrop-filter: blur(8px);
}

.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  vertical-align: middle;
  border-radius: 50%;
  background: #7be08a;
  box-shadow: 0 0 8px #7be08a;
}

.dot.sim {
  background: #ffb547;
  box-shadow: 0 0 8px #ffb547;
}

canvas {
  transition: opacity 1.2s;
}

.fade-leave-active {
  transition: opacity 1s;
}

.fade-leave-to {
  opacity: 0;
}
</style>
