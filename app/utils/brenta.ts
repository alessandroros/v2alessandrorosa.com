/*
  Sun position and live summit weather for the Brenta Dolomites, shared by
  the 3D home page and the career topo.
*/

/** Cima Tosa, the highest summit of the group. */
export const BRENTA = { lat: 46.157, lon: 10.875, elevation: 3173 } as const;

/** Small deterministic PRNG (mulberry32), so generated shapes look the same on every visit. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sun altitude and azimuth (degrees, azimuth clockwise from north). */
export function sunPosition(date: Date, lat: number, lon: number) {
  const rad = Math.PI / 180;
  const d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const H = (gmst * 15 + lon) * rad - ra;
  const la = lat * rad;
  const alt = Math.asin(
    Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H),
  );
  const az = Math.atan2(
    -Math.sin(H),
    Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(H),
  );
  return { altitude: alt / rad, azimuth: (az / rad + 360) % 360 };
}

export interface Weather {
  code: number | null;
  cloud: number;
  temperature: number | null;
  wind: number | null;
}

export type WeatherPreset =
  | 'live'
  | 'clear'
  | 'cloudy'
  | 'snow'
  | 'rain'
  | 'fog';

export const WEATHER_PRESETS: Record<
  Exclude<WeatherPreset, 'live'>,
  Pick<Weather, 'code' | 'cloud'>
> = {
  clear: { code: 0, cloud: 0 },
  cloudy: { code: 3, cloud: 85 },
  snow: { code: 73, cloud: 95 },
  rain: { code: 63, cloud: 95 },
  fog: { code: 45, cloud: 70 },
};

/** WMO weather codes, as returned by Open-Meteo. */
export const WEATHER_LABELS: Record<number, string> = {
  0: 'clear',
  1: 'mostly clear',
  2: 'partly cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'freezing fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  61: 'light rain',
  63: 'rain',
  65: 'heavy rain',
  66: 'freezing rain',
  67: 'freezing rain',
  71: 'light snow',
  73: 'snow',
  75: 'heavy snow',
  77: 'snow grains',
  80: 'showers',
  81: 'showers',
  82: 'heavy showers',
  85: 'snow showers',
  86: 'snow showers',
  95: 'thunderstorm',
  96: 'thunderstorm',
  99: 'thunderstorm',
};

export const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
export const RAIN_CODES = new Set([
  51, 53, 55, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99,
]);

export async function fetchSummitWeather(): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${BRENTA.lat}&longitude=${BRENTA.lon}` +
    `&elevation=${BRENTA.elevation}&current=temperature_2m,weather_code,cloud_cover,wind_speed_10m&timezone=Europe%2FRome`;
  const res = await $fetch<{
    current: {
      temperature_2m: number;
      weather_code: number;
      cloud_cover: number;
      wind_speed_10m: number;
    };
  }>(url);
  return {
    code: res.current.weather_code,
    cloud: res.current.cloud_cover,
    temperature: res.current.temperature_2m,
    wind: res.current.wind_speed_10m,
  };
}
