import * as THREE from 'three';
import { heightAt, type Heightmap } from './terrain';

/*
  First person, skinning up from Rifugio Tuckett towards the Bocca di
  Tuckett: yellow freeride touring skis, poles, the skin track ahead and a
  SAT-style signpost whose plates lead to the sections of the site.
  Everything here lives in "rig" space: origin on the snow under the skier,
  -z forward along the track, metres.
*/

export type PropId =
  | 'about'
  | 'route'
  | 'logbook'
  | 'projects'
  | 'stack'
  | 'contact';

const PLATES: { id: PropId; title: string; note: string; time: string }[] = [
  {
    id: 'route',
    title: 'The route',
    note: 'career, pitch by pitch',
    time: '12 yrs',
  },
  { id: 'logbook', title: 'Libro di vetta', note: 'blog', time: '5 min' },
  { id: 'projects', title: 'Projects', note: 'side projects', time: '30 min' },
  { id: 'stack', title: 'Stack', note: 'the gear I carry', time: '10 min' },
  { id: 'about', title: 'About', note: "who's skinning up", time: '2 min' },
  { id: 'contact', title: 'Contact', note: 'radio the hut', time: '1 min' },
];

function canvasTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/* ------------------------------------------------------------- skis */

/** Yellow freeride topsheet, tip at the top of the canvas. */
function topsheet() {
  return canvasTexture(128, 2048, (ctx) => {
    ctx.fillStyle = '#ecfa6b';
    ctx.fillRect(0, 0, 128, 2048);
    // Black tip and tail caps.
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, 128, 150);
    ctx.fillRect(0, 1930, 128, 118);
    // A dark geometric band below the tip.
    ctx.strokeStyle = '#121212';
    ctx.lineWidth = 6;
    for (let y = 190; y < 560; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y + 30);
      ctx.lineTo(64, y);
      ctx.lineTo(128, y + 30);
      ctx.stroke();
    }
    // Thin edge lines and a centre stripe towards the tail.
    ctx.fillRect(4, 150, 3, 1780);
    ctx.fillRect(121, 150, 3, 1780);
    ctx.fillRect(60, 1250, 8, 680);
    // Snow dust thrown on the shovel by the last steps.
    let seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 900; i++) {
      const y = 150 + Math.pow(r(), 2.2) * 620;
      const a = 0.35 + r() * 0.6;
      ctx.fillStyle = `rgba(250,252,255,${a.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(r() * 128, y, 1 + r() * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function skiGeometry() {
  const length = 1.84;
  const geometry = new THREE.BoxGeometry(0.12, 0.018, length, 1, 1, 90);
  const pos = geometry.getAttribute('position');
  for (let k = 0; k < pos.count; k++) {
    const z = pos.getZ(k);
    const u = (z + length / 2) / length; // 0 tip, 1 tail
    // Sidecut: wide shovel, narrower waist, slightly narrower tail.
    let half =
      0.054 +
      0.016 * Math.pow(Math.abs(u - 0.5) * 2, 2) -
      (u > 0.5 ? 0.004 : 0);
    // Rounded tip and tail.
    half *= Math.sqrt(Math.min(1, u / 0.035, (1 - u) / 0.03));
    pos.setX(k, Math.sign(pos.getX(k)) * half);
    // Rocker in the shovel, a lower twin tail.
    let lift = 0;
    if (u < 0.2) lift = 0.075 * Math.pow((0.2 - u) / 0.2, 2);
    if (u > 0.9) lift = 0.03 * Math.pow((u - 0.9) / 0.1, 2);
    pos.setY(k, pos.getY(k) + lift);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildSki(top: THREE.Texture) {
  const g = new THREE.Group();
  const side = new THREE.MeshStandardMaterial({
    color: '#141414',
    roughness: 0.5,
  });
  // A touch of self-illumination keeps the #ECFA6B topsheet vivid under any
  // sky; lit only by an overcast sky and tone mapping it turns olive.
  // Glossy, clear-coated topsheet that mirrors the sky like a real ski.
  const sheet = new THREE.MeshPhysicalMaterial({
    map: top,
    roughness: 0.45,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: top,
    emissiveIntensity: 0.2,
  });
  const base = new THREE.MeshStandardMaterial({
    color: '#2a2a2a',
    roughness: 0.9,
  });
  const ski = new THREE.Mesh(skiGeometry(), [
    side,
    side,
    sheet,
    base,
    side,
    side,
  ]);
  ski.position.set(0, 0.05, -0.32);
  g.add(ski);
  // Skin tip clip.
  const clip = new THREE.Mesh(
    new THREE.TorusGeometry(0.035, 0.004, 6, 16, Math.PI),
    new THREE.MeshStandardMaterial({
      color: '#b9bdc2',
      metalness: 0.8,
      roughness: 0.3,
    }),
  );
  clip.position.set(0, 0.095, -1.22);
  clip.rotation.x = -0.3;
  g.add(clip);
  // Touring boot toe and binding, mostly out of frame.
  const boot = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.13, 0.32),
    new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.6 }),
  );
  boot.position.set(0, 0.09, 0.1);
  g.add(boot);
  return g;
}

function buildPole() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.009, 1, 8),
    new THREE.MeshStandardMaterial({
      color: '#1b1b1d',
      metalness: 0.3,
      roughness: 0.4,
    }),
  );
  shaft.position.y = -0.5;
  const basket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.008, 16),
    new THREE.MeshStandardMaterial({ color: '#d23a2a', roughness: 0.6 }),
  );
  basket.position.y = -0.93;
  g.add(shaft, basket);
  return g;
}

const DOWN = new THREE.Vector3(0, -1, 0);

/** Points a pole from the hand to where its tip is planted. */
function placePole(pole: THREE.Group, hand: THREE.Vector3, tip: THREE.Vector3) {
  const dir = new THREE.Vector3().subVectors(tip, hand);
  pole.position.copy(hand);
  pole.scale.set(1, dir.length(), 1);
  pole.quaternion.setFromUnitVectors(DOWN, dir.normalize());
}

/* --------------------------------------------------------- signpost */

function plateShape(width: number, height: number, tip: number, left: boolean) {
  const s = new THREE.Shape();
  const x0 = left ? tip : 0;
  const x1 = left ? width + tip : width;
  s.moveTo(x0, 0);
  s.lineTo(x1, 0);
  if (!left) s.lineTo(x1 + tip, height / 2);
  s.lineTo(x1, height);
  s.lineTo(x0, height);
  if (left) s.lineTo(0, height / 2);
  s.closePath();
  return s;
}

function plateTexture(
  title: string,
  note: string,
  time: string,
  left: boolean,
) {
  return canvasTexture(1024, 200, (ctx) => {
    ctx.fillStyle = '#f7f6f1';
    ctx.fillRect(0, 0, 1024, 200);
    // SAT colours on the arrow end: red, white, red.
    const band = left ? 0 : 1024 - 170;
    ctx.fillStyle = '#c8241b';
    ctx.fillRect(band, 0, 170, 200);
    ctx.fillStyle = '#f7f6f1';
    ctx.fillRect(band + 57, 0, 56, 200);
    ctx.fillStyle = '#1a1a1a';
    const x = left ? 200 : 40;
    ctx.font = '700 78px "Inter", Helvetica, Arial, sans-serif';
    ctx.fillText(title.toUpperCase(), x, 92);
    ctx.font = '42px "Inter", Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#4a4a4a';
    ctx.fillText(note, x, 158);
    ctx.font = '700 46px "JetBrains Mono", Menlo, monospace';
    ctx.fillStyle = '#1a1a1a';
    const tw = ctx.measureText(time).width;
    ctx.fillText(time, left ? 1024 - 40 - tw : 1024 - 200 - tw, 158);
  });
}

function headerTexture() {
  return canvasTexture(1024, 240, (ctx) => {
    ctx.fillStyle = '#f7f6f1';
    ctx.fillRect(0, 0, 1024, 240);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, 996, 212);
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.font = '700 84px "Inter", Helvetica, Arial, sans-serif';
    ctx.fillText('RIFUGIO TUCKETT', 512, 118);
    ctx.font = '48px "JetBrains Mono", Menlo, monospace';
    ctx.fillText('2272 m · SAT', 512, 190);
  });
}

function shapeUvs(geometry: THREE.ShapeGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox ?? new THREE.Box3();
  const pos = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let k = 0; k < pos.count; k++) {
    uv.setXY(
      k,
      (pos.getX(k) - box.min.x) / (box.max.x - box.min.x),
      (pos.getY(k) - box.min.y) / (box.max.y - box.min.y),
    );
  }
}

function buildSignpost() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({
    color: '#8d9399',
    metalness: 0.7,
    roughness: 0.45,
  });
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 2.9, 12),
    metal,
  );
  post.position.y = 1.45;
  g.add(post);

  const header = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.21),
    new THREE.MeshStandardMaterial({
      map: headerTexture(),
      roughness: 0.6,
      side: THREE.DoubleSide,
    }),
  );
  header.position.set(0, 2.68, 0.035);
  g.add(header);

  const plates: THREE.Object3D[] = [];
  const width = 0.86;
  const height = 0.18;
  const tip = 0.12;
  PLATES.forEach((p, i) => {
    const left = i % 2 === 1;
    const geometry = new THREE.ShapeGeometry(
      plateShape(width, height, tip, left),
    );
    shapeUvs(geometry);
    const mat = new THREE.MeshStandardMaterial({
      map: plateTexture(p.title, p.note, p.time, left),
      roughness: 0.55,
      side: THREE.DoubleSide,
      emissive: new THREE.Color('#000000'),
    });
    const plate = new THREE.Mesh(geometry, mat);
    const group = new THREE.Group();
    group.userData.id = p.id;
    group.add(plate);
    // Plates hang off the post, pointing alternately right and left.
    group.position.set(
      left ? -(width + tip) + 0.02 : -0.02,
      2.33 - i * 0.24,
      0.04,
    );
    g.add(group);
    plates.push(group);
  });
  return { group: g, plates };
}

/* -------------------------------------------------------- skin track */

/**
 * Two grooves in the snow, zig-zagging up towards the pass with kick turns,
 * from the skier's feet. Built in world space.
 */
export function buildSkinTrack(
  map: Heightmap,
  from: THREE.Vector2,
  to: THREE.Vector2,
) {
  const dir = new THREE.Vector2().subVectors(to, from);
  const length = Math.min(dir.length(), 1400);
  dir.normalize();
  const side = new THREE.Vector2(-dir.y, dir.x);
  const centre: THREE.Vector2[] = [];
  for (let d = 0; d <= length; d += 2) {
    // Switchbacks grow as the slope steepens towards the pass.
    const amp = 6 + (d / length) * 30;
    const lateral = Math.sin((d / 70) * Math.PI) * amp * Math.min(1, d / 40);
    centre.push(
      from.clone().addScaledVector(dir, d).addScaledVector(side, lateral),
    );
  }
  const positions: number[] = [];
  const indices: number[] = [];
  const grooves = [-0.12, 0.12];
  const half = 0.045;
  for (const g of grooves) {
    const start = positions.length / 3;
    centre.forEach((c, i) => {
      const next = centre[Math.min(centre.length - 1, i + 1)] ?? c;
      const prev = centre[Math.max(0, i - 1)] ?? c;
      const t = new THREE.Vector2().subVectors(next, prev).normalize();
      const n = new THREE.Vector2(-t.y, t.x);
      // Just above the snow under the skis, a little higher further away
      // so the 3 m terrain triangles never swallow it.
      const lift = 0.02 + Math.min(0.18, i * 2 * 0.012);
      for (const o of [g - half, g + half]) {
        const p = c.clone().addScaledVector(n, o);
        positions.push(p.x, heightAt(map, p.x, p.y) + lift, p.y);
      }
    });
    for (let i = 0; i < centre.length - 1; i++) {
      const a = start + i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshLambertMaterial({
      color: '#8f9cb0',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    }),
  );
  mesh.name = 'skin-track';
  return mesh;
}

/* --------------------------------------------------------------- rig */

export function buildGear() {
  const group = new THREE.Group();
  const top = topsheet();
  const left = buildSki(top);
  const right = buildSki(top);
  left.position.x = -0.13;
  right.position.x = 0.13;
  const skis = new THREE.Group();
  skis.add(left, right);
  // A little artistic licence: the skis sit further ahead than under a real
  // skier's eyes, so the tips stay in frame while looking up the valley.
  skis.position.z = -1.3;
  group.add(skis);

  const poleL = buildPole();
  const poleR = buildPole();
  // Hands just outside the frame, tips planted ahead, beside the skis.
  const handL = new THREE.Vector3(-0.42, 1.05, -0.25);
  const handR = new THREE.Vector3(0.42, 1.05, -0.25);
  // Standing still in the track: one ski a little ahead, poles planted.
  left.position.z = -0.08;
  right.position.z = 0.06;
  placePole(poleL, handL, new THREE.Vector3(-0.55, 0.02, -2.25));
  placePole(poleR, handR, new THREE.Vector3(0.56, 0.02, -2.4));
  group.add(poleL, poleR);

  const sign = buildSignpost();
  sign.group.position.set(1.15, 0, -2.7);
  group.add(sign.group);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const anchors = Object.fromEntries(
    sign.plates.map((p) => [p.userData.id as PropId, new THREE.Vector3()]),
  ) as Record<PropId, THREE.Vector3>;

  return {
    group,
    clickable: sign.plates,
    signpost: sign.group,
    /** World-independent anchor of a plate, in rig space. */
    anchor(id: PropId) {
      const plate = sign.plates.find((p) => p.userData.id === id);
      const out = anchors[id];
      if (!plate) return out;
      plate.updateWorldMatrix(true, false);
      group.updateWorldMatrix(true, false);
      out.set(0.45, 0.09, 0).applyMatrix4(plate.matrixWorld);
      return group.worldToLocal(out);
    },
    /** Tilts the skis to the slope under them (radians, positive uphill). */
    setSlope(angle: number) {
      skis.rotation.x = angle;
    },
    /** Moves the signpost towards the centre on narrow screens. */
    setNarrow(narrow: boolean) {
      const x = narrow ? 0.75 : 1.7;
      const z = narrow ? -3.6 : -3.8;
      sign.group.position.set(x, 0, z);
      // Plates face the skier.
      sign.group.rotation.set(0, Math.atan2(-x, 0.6 - z), 0);
    },
    /** Turns the skis to follow the skin track (radians, rig space). */
    setHeading(angle: number) {
      skis.rotation.y = angle;
    },
  };
}

export type Gear = ReturnType<typeof buildGear>;
