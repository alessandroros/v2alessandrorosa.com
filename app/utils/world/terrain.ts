import * as THREE from 'three';

/*
  Real terrain of the Brenta Dolomites, baked by scripts/bake-terrain.py into
  public/terrain. World units are metres: x grows east, z grows south, y is
  the altitude (vertically exaggerated a little, so the walls read as walls
  from 7 km away, which is what the eye remembers).
*/

export const EXAGGERATION = 1.3;
const BASE = 800;

export interface TerrainMeta {
  width: number;
  height: number;
  bounds: { north: number; south: number; west: number; east: number };
  sizeMeters: { x: number; z: number };
  minHeight: number;
  maxHeight: number;
}

export interface Heightmap {
  meta: TerrainMeta;
  /** Heights in metres, row-major, north first. */
  data: Float32Array;
}

export async function loadHeightmap(
  onProgress?: (ratio: number) => void,
): Promise<Heightmap> {
  const meta = await $fetch<TerrainMeta>('/terrain/brenta.json');
  const res = await fetch('/terrain/brenta.u16');
  if (!res.ok || !res.body)
    throw new Error(`Terrain download failed: ${res.status}`);
  const total = meta.width * meta.height * 2;
  const reader = res.body.getReader();
  const buffer = new Uint8Array(total);
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer.set(value.subarray(0, Math.max(0, total - received)), received);
    received += value.length;
    onProgress?.(Math.min(1, received / total));
  }
  return { meta, data: sharpenWalls(meta, new Uint16Array(buffer.buffer)) };
}

/*
  A 25 m DEM rounds dolomite walls into domes. Unsharp masking above the
  tree line brings back the steps between ledges and towers, which is how
  the group looks in photos taken from Campiglio.
*/
function sharpenWalls(meta: TerrainMeta, raw: Uint16Array): Float32Array {
  const { width: W, height: H } = meta;
  const src = Float32Array.from(raw);
  const blur = (input: Float32Array, r: number) => {
    const tmp = new Float32Array(input.length);
    const out = new Float32Array(input.length);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let sum = 0;
        for (let k = -r; k <= r; k++)
          sum += input[j * W + Math.min(W - 1, Math.max(0, i + k))] ?? 0;
        tmp[j * W + i] = sum / (2 * r + 1);
      }
    }
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        let sum = 0;
        for (let k = -r; k <= r; k++)
          sum += tmp[Math.min(H - 1, Math.max(0, j + k)) * W + i] ?? 0;
        out[j * W + i] = sum / (2 * r + 1);
      }
    }
    return out;
  };
  const soft = blur(blur(src, 3), 3);
  const out = new Float32Array(src.length);
  for (let k = 0; k < src.length; k++) {
    const h = src[k] ?? 0;
    const detail = h - (soft[k] ?? h);
    out[k] = h + detail * 1.4 * smoothstep(1900, 2500, h);
  }
  return out;
}

export const scaleHeight = (h: number) => BASE + (h - BASE) * EXAGGERATION;

/** Inverse of scaleHeight: the real altitude in metres of a world y. */
export const realAltitude = (y: number) => BASE + (y - BASE) / EXAGGERATION;

export function geoToWorld(meta: TerrainMeta, lat: number, lon: number) {
  const { bounds: b, sizeMeters: s } = meta;
  return new THREE.Vector2(
    ((lon - b.west) / (b.east - b.west) - 0.5) * s.x,
    ((b.north - lat) / (b.north - b.south) - 0.5) * s.z,
  );
}

/** Bilinear height in world units at world (x, z). */
export function heightAt(map: Heightmap, x: number, z: number): number {
  const { width: W, height: H, sizeMeters: s } = map.meta;
  const fx = clamp((x / s.x + 0.5) * (W - 1), 0, W - 1.001);
  const fz = clamp((z / s.z + 0.5) * (H - 1), 0, H - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const dx = fx - i;
  const dz = fz - j;
  const at = (a: number, b: number) => map.data[b * W + a] ?? BASE;
  const top = at(i, j) * (1 - dx) + at(i + 1, j) * dx;
  const bottom = at(i, j + 1) * (1 - dx) + at(i + 1, j + 1) * dx;
  return scaleHeight(top * (1 - dz) + bottom * dz);
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Cheap hash noise, stable per vertex. */
function noise(i: number, j: number) {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const C = {
  forest: new THREE.Color('#1f3320'),
  forestDark: new THREE.Color('#152417'),
  meadow: new THREE.Color('#5c7a3a'),
  pasture: new THREE.Color('#7f9150'),
  mugo: new THREE.Color('#3f5530'),
  scree: new THREE.Color('#bdbdb8'),
  rock: new THREE.Color('#d3d5d6'),
  rockWarm: new THREE.Color('#e4e1da'),
  rockDark: new THREE.Color('#7c8088'),
  snow: new THREE.Color('#f4f6fa'),
  water: new THREE.Color('#2f5f73'),
};

/**
 * Paints the terrain by altitude and slope, the way the Brenta looks:
 * spruce forest in the valleys, pastures, dwarf pine, pale scree under pale
 * dolomite walls, snow on every ledge flat enough to hold it.
 */
export function paintTerrain(geometry: THREE.BufferGeometry, snowLine: number) {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Color();
  const cols = geometry.userData.cols as number;
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k);
    const h = BASE + (y - BASE) / EXAGGERATION; // real altitude
    const slope = 1 - nor.getY(k); // 0 flat, ~1 vertical
    const i = k % cols;
    const j = Math.floor(k / cols);
    const n = noise(i, j);
    const n2 = noise(j + 7, i + 3);

    // Lakes (Molveno, Tovel) are perfectly flat in the DEM.
    if (slope < 0.0005 && h < 1300) {
      colors.set([C.water.r, C.water.g, C.water.b], k * 3);
      continue;
    }

    // Vegetation below the tree line.
    const treeLine = 1950 + n * 120;
    c.copy(n2 > 0.55 ? C.forestDark : C.forest);
    const pasture = smoothstep(0.12, 0.02, slope) * (n > 0.35 ? 1 : 0.4);
    c.lerp(C.pasture, pasture * 0.85);
    const aboveTrees = smoothstep(treeLine - 80, treeLine + 120, h);
    tmp.copy(C.mugo).lerp(C.meadow, smoothstep(0.25, 0.05, slope));
    c.lerp(tmp, aboveTrees);

    // Scree and rock take over with altitude and steepness.
    const rocky = Math.max(
      smoothstep(2100, 2500, h + n * 150),
      smoothstep(0.45, 0.7, slope),
    );
    tmp
      .copy(C.scree)
      .lerp(n > 0.5 ? C.rockWarm : C.rock, smoothstep(0.25, 0.5, slope));
    tmp.lerp(C.rockDark, smoothstep(0.75, 0.95, slope) * 0.6 + n2 * 0.12);
    c.lerp(tmp, rocky);

    // Snow holds on gentle slopes above the snow line.
    const snow =
      smoothstep(snowLine - 150, snowLine + 150, h + n * 200) *
      smoothstep(0.3, 0.12, slope);
    c.lerp(C.snow, snow);

    colors.set([c.r, c.g, c.b], k * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/*
  The DEM is ~25 m per sample, too coarse for dolomite. The fragment shader
  adds what the eye expects at this distance: horizontal strata and dark
  water streaks on the walls, crowns of trees in the forest.
*/
function addDetail(shader: { vertexShader: string; fragmentShader: string }) {
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNor;',
    )
    .replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec3 vWPos;
varying vec3 vWNor;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}`,
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
{
  float slope = 1.0 - normalize(vWNor).y;
  float wall = smoothstep(0.3, 0.6, slope) * smoothstep(1700.0, 2100.0, vWPos.y);
  float strata = vnoise(vec2(vWPos.y * 0.055, (vWPos.x + vWPos.z) * 0.0015));
  float streak = vnoise(vec2((vWPos.x - vWPos.z) * 0.07, vWPos.y * 0.003));
  float grain = vnoise(vWPos.xz * 0.25);
  vec3 rockTint = vec3(0.78 + 0.3 * strata) * mix(1.0, 0.62, smoothstep(0.62, 0.85, streak)) * (0.92 + 0.12 * grain);
  diffuseColor.rgb *= mix(vec3(1.0), rockTint, wall);
  float green = smoothstep(0.0, 0.06, diffuseColor.g - diffuseColor.r);
  float crowns = vnoise(vWPos.xz * 0.12) * 0.6 + vnoise(vWPos.xz * 0.5) * 0.4;
  diffuseColor.rgb *= mix(1.0, 0.7 + 0.55 * crowns, green);
}`,
    );
}

export function buildTerrain(
  map: Heightmap,
  stride: number,
  snowLine: number,
): THREE.Mesh {
  const { width: W, height: H, sizeMeters: s } = map.meta;
  const cols = Math.floor((W - 1) / stride) + 1;
  const rows = Math.floor((H - 1) / stride) + 1;
  const geometry = new THREE.PlaneGeometry(s.x, s.z, cols - 1, rows - 1);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const h = map.data[j * stride * W + i * stride] ?? BASE;
      pos.setY(j * cols + i, scaleHeight(h));
    }
  }
  geometry.computeVertexNormals();
  geometry.userData.cols = cols;
  paintTerrain(geometry, snowLine);

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.onBeforeCompile = addDetail;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  return mesh;
}

/** A wide skirt of dim hills around the DEM, so the horizon never ends in a void. */
export function buildSkirt(map: Heightmap): THREE.Mesh {
  const { sizeMeters: s } = map.meta;
  const geometry = new THREE.RingGeometry(
    Math.max(s.x, s.z) * 0.55,
    90000,
    96,
    6,
  );
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const z = pos.getZ(k);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const ridge =
      1600 +
      700 * Math.sin(a * 7) * Math.cos(a * 3) +
      500 * Math.sin(a * 17 + 1);
    pos.setY(k, scaleHeight(ridge) * Math.min(1, 26000 / r) + 600);
  }
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: '#3d4a3c' }),
  );
}
