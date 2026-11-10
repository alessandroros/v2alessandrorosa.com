import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from '~/utils/brenta';
import { heightAt, realAltitude, type Heightmap } from './terrain';

/*
  Spruce forest of Val Brenta and Vallesinella, as in the photos taken from
  Campiglio: individual dark conifers, tall and narrow, up to the tree line.
  Two instanced meshes: detailed trees near the viewer, simple cones far away.
*/

function spruce(segments: number, tiers: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(
    0.03,
    0.045,
    0.25,
    Math.max(4, segments - 2),
  );
  trunk.translate(0, 0.125, 0);
  parts.push(trunk);
  for (let t = 0; t < tiers; t++) {
    const k = t / tiers;
    const radius = 0.24 * (1 - k * 0.72);
    const height = 0.42 - k * 0.12;
    const cone = new THREE.ConeGeometry(radius, height, segments, 1, false);
    cone.translate(0, 0.18 + k * 0.72 + height / 2, 0);
    parts.push(cone);
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  // Darker at the bottom, a lighter tip: reads as volume without shadows.
  const pos = merged.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const trunkColor = new THREE.Color('#3b2a1e');
  const low = new THREE.Color('#18301c');
  const high = new THREE.Color('#3d5e37');
  const c = new THREE.Color();
  for (let k = 0; k < pos.count; k++) {
    const y = pos.getY(k);
    if (y < 0.19 && Math.hypot(pos.getX(k), pos.getZ(k)) < 0.05)
      c.copy(trunkColor);
    else c.copy(low).lerp(high, Math.min(1, y / 1.2));
    colors.set([c.r, c.g, c.b], k * 3);
  }
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.computeVertexNormals();
  return merged;
}

export interface ForestOptions {
  view: THREE.Vector2;
  forward: THREE.Vector2;
  mobile: boolean;
}

export function buildForest(
  map: Heightmap,
  { view, forward, mobile }: ForestOptions,
) {
  const r = rng(2024);
  const near: THREE.Matrix4[] = [];
  const far: THREE.Matrix4[] = [];
  const tints: number[] = [];
  const farTints: number[] = [];
  const attempts = mobile ? 40000 : 140000;
  const maxNear = mobile ? 1500 : 5000;
  const maxFar = mobile ? 9000 : 32000;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const s = map.meta.sizeMeters;

  for (let a = 0; a < attempts; a++) {
    // Mostly in front of the viewer, denser near, sparse up to 6 km.
    const dist = 25 + Math.pow(r(), 1.7) * 6000;
    const spread = dist < 300 ? 1.5 : 0.75;
    const angle = Math.atan2(forward.y, forward.x) + (r() - 0.5) * 2 * spread;
    const x = view.x + Math.cos(angle) * dist;
    const z = view.y + Math.sin(angle) * dist;
    if (Math.abs(x) > s.x / 2 - 50 || Math.abs(z) > s.z / 2 - 50) continue;

    const y = heightAt(map, x, z);
    const h = realAltitude(y);
    const dx = heightAt(map, x + 15, z) - heightAt(map, x - 15, z);
    const dz = heightAt(map, x, z + 15) - heightAt(map, x, z - 15);
    const slope = Math.hypot(dx, dz) / 30;
    const treeLine = 1900 + r() * 160;
    if (h > treeLine || slope > 1.1) continue;
    if (h < 1300 && slope < 0.01) continue; // lakes
    // Clearings: pastures on gentle ground.
    if (slope < 0.18 && r() < 0.55) continue;
    // Keep the view open right in front of the table.
    const off = Math.abs(
      Math.atan2(
        Math.sin(angle - Math.atan2(forward.y, forward.x)),
        Math.cos(angle - Math.atan2(forward.y, forward.x)),
      ),
    );
    if (dist < 250 && off < 0.45) continue;

    // Trees thin out and shrink towards the tree line.
    const nearLine = Math.min(1, (treeLine - h) / 250);
    if (r() > 0.35 + nearLine * 0.65) continue;
    const height = (14 + r() * 22) * (0.45 + nearLine * 0.55);
    const width = height * (0.36 + r() * 0.14);
    q.setFromAxisAngle(up, r() * Math.PI * 2);
    m.compose(
      new THREE.Vector3(x, y - 0.6, z),
      q,
      new THREE.Vector3(width, height, width),
    );
    const tint = 0.75 + r() * 0.45;
    if (dist < 900 && near.length < maxNear) {
      near.push(m.clone());
      tints.push(tint);
    } else if (far.length < maxFar) {
      far.push(m.clone());
      farTints.push(tint);
    }
  }

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const group = new THREE.Group();
  group.name = 'forest';
  const make = (
    geometry: THREE.BufferGeometry,
    list: THREE.Matrix4[],
    tint: number[],
  ) => {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    const color = new THREE.Color();
    list.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      const t = tint[i] ?? 1;
      mesh.setColorAt(i, color.setRGB(t, t, t * 0.95));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  make(spruce(mobile ? 6 : 9, 5), near, tints);
  make(spruce(5, 3), far, farTints);

  /** Light snow on the branches when the snow line drops below the forest. */
  function setSnow(amount: number) {
    material.color.setRGB(1 + amount * 0.6, 1 + amount * 0.6, 1 + amount * 0.7);
  }

  return { group, setSnow, count: near.length + far.length };
}
