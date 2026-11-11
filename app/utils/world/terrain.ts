import * as THREE from 'three';

/*
  Real terrain of the Brenta Dolomites, baked by scripts/bake-terrain.py into
  public/terrain. World units are metres: x grows east, z grows south, y is
  the altitude (vertically exaggerated a little, so the walls read as walls
  from 7 km away, which is what the eye remembers).
*/

// True scale: around the Tuckett the LiDAR shows the walls as they are.
export const EXAGGERATION = 1;
const BASE = 800;

export interface TerrainMeta {
  width: number;
  height: number;
  bounds: { north: number; south: number; west: number; east: number };
  sizeMeters: { x: number; z: number };
  minHeight: number;
  maxHeight: number;
}

export interface LidarMeta {
  width: number;
  height: number;
  bounds: { north: number; south: number; west: number; east: number };
  sizeMeters: { x: number; z: number };
  cellMeters: number;
  heightScale: number;
}

/** High-resolution LiDAR patch (scripts/bake-lidar.py), in world space. */
export interface LidarPatch {
  meta: LidarMeta;
  /** Heights in metres, row-major, north first; 0 where there is no data. */
  data: Float32Array;
  /** World x, z of the north-west corner and of the south-east corner. */
  min: THREE.Vector2;
  max: THREE.Vector2;
}

export interface Heightmap {
  meta: TerrainMeta;
  /** Heights in metres, row-major, north first. */
  data: Float32Array;
  patch: LidarPatch | null;
}

/** Width of the band where the LiDAR patch fades into the base terrain. */
const PATCH_BLEND = 150;

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
  const data = sharpenWalls(meta, new Uint16Array(buffer.buffer));
  return { meta, data, patch: await loadLidar(meta) };
}

/** Separable box blur of a W x H grid, clamped at the edges. */
function boxBlur(
  src: Float32Array,
  W: number,
  H: number,
  r: number,
): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let sum = 0;
      for (let k = -r; k <= r; k++)
        sum += src[j * W + clamp(i + k, 0, W - 1)] ?? 0;
      tmp[j * W + i] = sum / n;
    }
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let sum = 0;
      for (let k = -r; k <= r; k++)
        sum += tmp[clamp(j + k, 0, H - 1) * W + i] ?? 0;
      out[j * W + i] = sum / n;
    }
  }
  return out;
}

/*
  The LiDAR records every boulder and rut of the summer ground. In winter the
  snow pack fills them: on gentle slopes (where snow and scree lie) the
  heights are softened over a few metres, while steep walls keep their ledges.
  Done on the data, so skis, track and trees sit on the surface you see.
*/
function blanketOfSnow(data: Float32Array, W: number, H: number, cell: number) {
  const soft = boxBlur(boxBlur(data, W, H, 1), W, H, 1);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const h = data[k] ?? 0;
      if (!h) continue;
      const dx =
        (data[j * W + clamp(i + 1, 0, W - 1)] ?? h) -
        (data[j * W + clamp(i - 1, 0, W - 1)] ?? h);
      const dz =
        (data[clamp(j + 1, 0, H - 1) * W + i] ?? h) -
        (data[clamp(j - 1, 0, H - 1) * W + i] ?? h);
      const gradient = Math.hypot(dx, dz) / (2 * cell); // tan of the slope
      const gentle = smoothstep(0.95, 0.35, gradient);
      data[k] = h + ((soft[k] ?? h) - h) * gentle * 0.7;
    }
  }
}

async function loadLidar(base: TerrainMeta): Promise<LidarPatch | null> {
  try {
    const meta = await $fetch<LidarMeta>('/terrain/lidar.json');
    const res = await fetch('/terrain/lidar.u16');
    if (!res.ok) return null;
    const raw = new Uint16Array(await res.arrayBuffer());
    const data = new Float32Array(raw.length);
    for (let k = 0; k < raw.length; k++)
      data[k] = (raw[k] ?? 0) * meta.heightScale;
    blanketOfSnow(data, meta.width, meta.height, meta.cellMeters);
    const b = meta.bounds;
    return {
      meta,
      data,
      min: geoToWorld(base, b.north, b.west),
      max: geoToWorld(base, b.south, b.east),
    };
  } catch {
    return null;
  }
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

interface OrthoMeta {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
}

/**
 * Stitches the orthophoto tiles (scripts/bake-ortho.py) into one texture.
 * Resolves to null when the tiles are missing, so the painted terrain is
 * used instead.
 */
export async function loadOrtho(
  maxSize: number,
  anisotropy: number,
): Promise<THREE.Texture | null> {
  try {
    const meta = await $fetch<OrthoMeta>('/terrain/ortho.json');
    const fullW = meta.cols * meta.tileWidth;
    const fullH = meta.rows * meta.tileHeight;
    const scale = Math.min(1, maxSize / Math.max(fullW, fullH));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(fullW * scale);
    canvas.height = Math.round(fullH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const jobs: Promise<void>[] = [];
    for (let r = 0; r < meta.rows; r++) {
      for (let c = 0; c < meta.cols; c++) {
        jobs.push(
          fetch(`/terrain/ortho/r${r}c${c}.jpg`)
            .then((res) => {
              if (!res.ok)
                throw new Error(`ortho tile ${r},${c}: ${res.status}`);
              return res.blob();
            })
            .then((blob) => createImageBitmap(blob))
            .then((img) => {
              ctx.drawImage(
                img,
                Math.round(c * meta.tileWidth * scale),
                Math.round(r * meta.tileHeight * scale),
                Math.ceil(meta.tileWidth * scale),
                Math.ceil(meta.tileHeight * scale),
              );
              img.close();
            }),
        );
      }
    }
    await Promise.all(jobs);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    return texture;
  } catch {
    return null;
  }
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

/**
 * Height in world units at world (x, z): the LiDAR patch where there is
 * one, faded into the base terrain near its edges.
 */
export function heightAt(map: Heightmap, x: number, z: number): number {
  const base = baseHeightAt(map, x, z);
  const p = map.patch;
  if (!p || x <= p.min.x || x >= p.max.x || z <= p.min.y || z >= p.max.y)
    return base;
  const edge = Math.min(x - p.min.x, p.max.x - x, z - p.min.y, p.max.y - z);
  const w = smoothstep(0, PATCH_BLEND, edge);
  const { width: W, height: H } = p.meta;
  const fx = ((x - p.min.x) / (p.max.x - p.min.x)) * (W - 1);
  const fz = ((z - p.min.y) / (p.max.y - p.min.y)) * (H - 1);
  const i = Math.min(W - 2, Math.floor(fx));
  const j = Math.min(H - 2, Math.floor(fz));
  const dx = fx - i;
  const dz = fz - j;
  const v00 = p.data[j * W + i] ?? 0;
  const v10 = p.data[j * W + i + 1] ?? 0;
  const v01 = p.data[(j + 1) * W + i] ?? 0;
  const v11 = p.data[(j + 1) * W + i + 1] ?? 0;
  if (!v00 || !v10 || !v01 || !v11) return base;
  const h =
    (v00 * (1 - dx) + v10 * dx) * (1 - dz) + (v01 * (1 - dx) + v11 * dx) * dz;
  return base + (scaleHeight(h) - base) * w;
}

/** Inside the LiDAR patch, away from its blend band. */
function insidePatch(
  map: Heightmap,
  x: number,
  z: number,
  margin = PATCH_BLEND,
) {
  const p = map.patch;
  return (
    !!p &&
    x > p.min.x + margin &&
    x < p.max.x - margin &&
    z > p.min.y + margin &&
    z < p.max.y - margin
  );
}

/** Bilinear height of the base (25 m) terrain in world units at world (x, z). */
function baseHeightAt(map: Heightmap, x: number, z: number): number {
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
  const snowCover = new Float32Array(pos.count);
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
    snowCover[k] = snow;

    colors.set([c.r, c.g, c.b], k * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('snow', new THREE.BufferAttribute(snowCover, 1));
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
      '#include <common>\nattribute float snow;\nattribute float sky;\nvarying float vSky;\nvarying float vSnow;\nvarying vec3 vWPos;\nvarying vec3 vWNor;',
    )
    .replace(
      '#include <worldpos_vertex>',
      '#include <worldpos_vertex>\nvSky = sky;\nvSnow = snow;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
// Skylight and light bounced off snow and pale rock, stopped by the walls around.
reflectedLight.indirectDiffuse *= mix(0.35, 1.35, vSky);`,
    )
    .replace(
      '#include <common>',
      `#include <common>
varying float vSky;
varying float vSnow;
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
      `#ifdef USE_ORTHO
{
  // The orthophoto, with its baked shadows lifted a little. Walls get few
  // texels from above, so they lean on the painted rock colour instead;
  // the 2015 flight was in summer, so the current snow is painted on top.
  vec3 ortho = pow(diffuseColor.rgb, vec3(0.88)) * 1.06;
  float steep = smoothstep(0.55, 0.85, 1.0 - normalize(vWNor).y) * 0.55;
  diffuseColor.rgb = mix(mix(ortho, vColor, steep), vec3(0.95, 0.96, 0.98), vSnow);
}
#else
#include <color_fragment>
#endif
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
#ifdef USE_ORTHO
  diffuseColor.rgb *= mix(1.0, 0.85 + 0.25 * crowns, green);
#else
  diffuseColor.rgb *= mix(1.0, 0.7 + 0.55 * crowns, green);
#endif
}`,
    );
}

/**
 * How much of the sky each vertex sees, from 0 (bottom of a gully) to 1 (a
 * summit). Shadowed faces are lit by the sky and the snow around them, and
 * that light is stopped by the surrounding walls: this is what keeps pale
 * dolomite pale in the shade, and dark in the gullies. Horizon angles in 8
 * directions, computed on every second vertex and shared with neighbours.
 */
function skyVisibility(
  map: Heightmap,
  geometry: THREE.BufferGeometry,
  cols: number,
  near: boolean,
): Float32Array {
  const pos = geometry.getAttribute('position');
  const rows = pos.count / cols;
  const dirs = Array.from(
    { length: 8 },
    (_, d) =>
      [Math.cos((d * Math.PI) / 4), Math.sin((d * Math.PI) / 4)] as const,
  );
  const steps = near
    ? [6, 12, 25, 40, 70, 110, 170, 260, 400, 600, 900, 1300, 1800]
    : [40, 80, 130, 200, 300, 450, 650, 900, 1300, 1800];
  const out = new Float32Array(pos.count);
  for (let vj = 0; vj < rows; vj += 2) {
    for (let vi = 0; vi < cols; vi += 2) {
      const k0 = vj * cols + vi;
      const x = pos.getX(k0);
      const z = pos.getZ(k0);
      const h0 = pos.getY(k0);
      let open = 0;
      for (const [dx, dz] of dirs) {
        let horizon = 0;
        for (const d of steps) {
          const t = (heightAt(map, x + dx * d, z + dz * d) - h0) / d;
          if (t > horizon) horizon = t;
        }
        open += 1 - Math.sin(Math.atan(horizon));
      }
      const v = open / dirs.length;
      for (let b = 0; b < 2 && vj + b < rows; b++) {
        for (let a = 0; a < 2 && vi + a < cols; a++)
          out[(vj + b) * cols + vi + a] = v;
      }
    }
  }
  return out;
}

function terrainMaterial(ortho: THREE.Texture | null) {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: ortho,
  });
  if (ortho) material.defines = { USE_ORTHO: '' };
  material.onBeforeCompile = addDetail;
  return material;
}

export function buildTerrain(
  map: Heightmap,
  stride: number,
  snowLine: number,
  ortho: THREE.Texture | null = null,
): THREE.Mesh {
  const { width: W, height: H, sizeMeters: s } = map.meta;
  const cols = Math.floor((W - 1) / stride) + 1;
  const rows = Math.floor((H - 1) / stride) + 1;
  const geometry = new THREE.PlaneGeometry(s.x, s.z, cols - 1, rows - 1);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.getAttribute('position');
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      const x = pos.getX(k);
      const z = pos.getZ(k);
      // Under the LiDAR patch the base terrain steps aside; in the blend band
      // it follows the faded heights, so the two meshes meet without a seam.
      const y = insidePatch(map, x, z)
        ? heightAt(map, x, z) - 40
        : insidePatch(map, x, z, -20)
          ? heightAt(map, x, z) - 0.5
          : scaleHeight(map.data[j * stride * W + i * stride] ?? BASE);
      pos.setY(k, y);
    }
  }
  geometry.computeVertexNormals();
  geometry.userData.cols = cols;
  paintTerrain(geometry, snowLine);
  geometry.setAttribute(
    'sky',
    new THREE.BufferAttribute(skyVisibility(map, geometry, cols, false), 1),
  );

  const mesh = new THREE.Mesh(geometry, terrainMaterial(ortho));
  mesh.name = 'terrain';
  return mesh;
}

/**
 * The LiDAR patch around the Tuckett as its own mesh, with the same
 * materials as the base terrain and orthophoto UVs in the base frame.
 */
export function buildPatch(
  map: Heightmap,
  stride: number,
  snowLine: number,
  ortho: THREE.Texture | null,
): THREE.Mesh | null {
  const p = map.patch;
  if (!p) return null;
  const s = map.meta.sizeMeters;
  const cols = Math.floor((p.meta.width - 1) / stride) + 1;
  const rows = Math.floor((p.meta.height - 1) / stride) + 1;
  const w = p.max.x - p.min.x;
  const d = p.max.y - p.min.y;
  const geometry = new THREE.PlaneGeometry(w, d, cols - 1, rows - 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(p.min.x + w / 2, 0, p.min.y + d / 2);
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const z = pos.getZ(k);
    pos.setY(k, heightAt(map, x, z));
    uv.setXY(k, x / s.x + 0.5, 0.5 - z / s.z);
  }
  // Light the terrain as if it were a little smoother than it is: normals
  // from a softened copy hide the 3 m triangles, the silhouette stays true.
  const heights = new Float32Array(pos.count);
  for (let k = 0; k < pos.count; k++) heights[k] = pos.getY(k);
  const softened = boxBlur(boxBlur(heights, cols, rows, 1), cols, rows, 1);
  for (let k = 0; k < pos.count; k++)
    pos.setY(k, softened[k] ?? heights[k] ?? 0);
  geometry.computeVertexNormals();
  for (let k = 0; k < pos.count; k++) pos.setY(k, heights[k] ?? 0);
  pos.needsUpdate = true;
  geometry.userData.cols = cols;
  paintTerrain(geometry, snowLine);
  geometry.setAttribute(
    'sky',
    new THREE.BufferAttribute(skyVisibility(map, geometry, cols, true), 1),
  );
  const mesh = new THREE.Mesh(geometry, terrainMaterial(ortho));
  mesh.name = 'terrain-lidar';
  // Skis, poles and the signpost cast their shadows on the snow here.
  mesh.receiveShadow = true;
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
