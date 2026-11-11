import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { buildProps, type PropId } from './props';
import { buildForest } from './trees';
import {
  buildPatch,
  buildSkirt,
  buildTerrain,
  geoToWorld,
  heightAt,
  loadHeightmap,
  loadOrtho,
  paintTerrain,
  type Heightmap,
} from './terrain';
import type { ScreenInfo } from './textures';

/*
  The home page world: the refuge table at Rifugio Tuckett, the real Brenta
  group across the valley, a physically based sky driven by the real sun.
*/

// Rifugio Tuckett e Sella, 2272 m, inside the group: looking up at the Bocca
// di Tuckett, with Cima Brenta on the right.
export const VIEWPOINT = { lat: 46.19196, lon: 10.88228 };
// Between the pass (az 116°) and Cima Brenta (az 135°), seen from the hut.
const LOOK_AT = { lat: 46.1842, lon: 10.8982 };
/** The walls are close and high: a wider lens, looking slightly up. */
const LENS = { fov: 60, portraitFov: 74, pitchDeg: 5 };

export const PEAKS = [
  {
    id: 'tosa',
    name: 'Cima Tosa',
    altitude: 3173,
    lat: 46.1554,
    lon: 10.8712,
    label: true,
  },
  // Hidden behind other walls from the Tuckett: on the map only.
  {
    id: 'crozzon',
    name: 'Crozzon di Brenta',
    altitude: 3135,
    lat: 46.1626,
    lon: 10.8685,
    label: false,
  },
  {
    id: 'brenta',
    name: 'Cima Brenta',
    altitude: 3150,
    lat: 46.1795,
    lon: 10.89989,
    label: true,
  },
  {
    id: 'bocca',
    name: 'Bocca di Tuckett',
    altitude: 2648,
    lat: 46.18556,
    lon: 10.90102,
    label: true,
  },
] as const;

export interface Label {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface Lighting {
  /** Sun altitude and azimuth in degrees (azimuth clockwise from north). */
  altitude: number;
  azimuth: number;
  /** 0..1 cloud cover. */
  cloud: number;
  fog: boolean;
  precipitation: 'snow' | 'rain' | null;
  snowLine: number;
  /** Forces the lantern on, even in daylight. */
  lantern: boolean;
}

export interface WorldOptions {
  canvas: HTMLCanvasElement;
  onProgress?: (ratio: number) => void;
  onHover?: (id: PropId | null, x: number, y: number) => void;
  onPick?: (id: PropId) => void;
  onLabels?: (labels: Label[]) => void;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function sunVector(altitude: number, azimuth: number) {
  const alt = THREE.MathUtils.degToRad(altitude);
  const az = THREE.MathUtils.degToRad(azimuth);
  return new THREE.Vector3(
    Math.sin(az) * Math.cos(alt),
    Math.sin(alt),
    -Math.cos(az) * Math.cos(alt),
  );
}

export async function createWorld(opts: WorldOptions) {
  const mobile = window.matchMedia('(max-width: 800px)').matches;
  const renderer = new THREE.WebGLRenderer({
    canvas: opts.canvas,
    antialias: true,
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, mobile ? 1.5 : 1.75),
  );
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120000);

  /* -------------------------------------------------------- terrain */
  const map: Heightmap = await loadHeightmap(opts.onProgress);
  let snowLine = 2200;
  const ortho = await loadOrtho(
    Math.min(renderer.capabilities.maxTextureSize, mobile ? 2048 : 4096),
    renderer.capabilities.getMaxAnisotropy(),
  );
  const terrain = buildTerrain(map, mobile ? 2 : 1, snowLine, ortho);
  const lidar = buildPatch(map, mobile ? 2 : 1, snowLine, ortho);
  if (lidar) scene.add(lidar);
  scene.add(terrain, buildSkirt(map));
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(300000, 300000),
    new THREE.MeshLambertMaterial({ color: '#2c3a2c' }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = 650;
  scene.add(base);

  /* ---------------------------------------------------- the terrace */
  const view = geoToWorld(map.meta, VIEWPOINT.lat, VIEWPOINT.lon);
  const look = geoToWorld(map.meta, LOOK_AT.lat, LOOK_AT.lon);
  let groundY = 0;
  for (let dx = -6; dx <= 6; dx += 1.5) {
    for (let dz = -6; dz <= 6; dz += 1.5)
      groundY = Math.max(groundY, heightAt(map, view.x + dx, view.y + dz));
  }
  const yaw = Math.atan2(-(look.x - view.x), -(look.y - view.y));
  const forest = buildForest(map, {
    view,
    forward: new THREE.Vector2(look.x - view.x, look.y - view.y).normalize(),
    mobile,
  });
  scene.add(forest.group);

  const { bounds } = map.meta;
  const toUv = (lat: number, lon: number) => ({
    u: (lon - bounds.west) / (bounds.east - bounds.west),
    v: (bounds.north - lat) / (bounds.north - bounds.south),
  });
  const MAP_NAMES: Record<string, string> = {
    tosa: 'C. Tosa',
    crozzon: 'Crozzon',
    brenta: 'C. Brenta',
    bocca: 'Bocca di Tuckett',
  };
  const marks = [
    { label: 'Rif. Tuckett 2272', ...toUv(VIEWPOINT.lat, VIEWPOINT.lon) },
    ...PEAKS.map((p) => ({
      label: `${MAP_NAMES[p.id]} ${p.altitude}`,
      ...toUv(p.lat, p.lon),
    })),
  ];

  const props = buildProps(map, marks);
  const terrace = new THREE.Group();
  terrace.position.set(view.x, groundY + 0.05, view.y);
  terrace.rotation.y = yaw;
  terrace.add(props.group);
  scene.add(terrace);

  // Camera rig, in terrace space: sitting at the table, looking across the valley.
  const home = {
    pos: new THREE.Vector3(0, 1.32, 1.3),
    // Pitch the view up: the pass and Cima Brenta tower over the hut.
    target: new THREE.Vector3(
      0,
      1.32 + Math.tan(THREE.MathUtils.degToRad(LENS.pitchDeg)) * 7.3,
      -6,
    ),
  };
  const camPos = home.pos.clone();
  const camTarget = home.target.clone();
  const goalPos = home.pos.clone();
  const goalTarget = home.target.clone();
  const pointer = new THREE.Vector2(0, 0);
  const pointerNdc = new THREE.Vector2(-2, -2);

  /* --------------------------------------------------------- sky */
  const sky = new Sky();
  sky.scale.setScalar(100000);
  scene.add(sky);

  // Image-based lighting from the same sky: props get the colour of the real
  // sky on every face, not only the side the sun reaches.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.material = sky.material;
  envSky.scale.setScalar(1000);
  envScene.add(envSky);
  let envTarget: THREE.WebGLRenderTarget | null = null;
  function refreshEnvironment() {
    envTarget?.dispose();
    envTarget = pmrem.fromScene(envScene, 0, 1, 3000);
    scene.environment = envTarget.texture;
  }
  const skyU = sky.material.uniforms as Record<string, THREE.IUniform>;

  const starGeo = new THREE.BufferGeometry();
  const starPos: number[] = [];
  for (let i = 0; i < 2500; i++) {
    const v = new THREE.Vector3().randomDirection();
    if (v.y < -0.05) v.y = -v.y;
    starPos.push(v.x * 90000, v.y * 90000, v.z * 90000);
  }
  starGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(starPos, 3),
  );
  const starMat = new THREE.PointsMaterial({
    color: '#ffffff',
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  /* ------------------------------------------------------- lights */
  const sun = new THREE.DirectionalLight('#ffffff', 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -2;
  sun.shadow.camera.right = 2;
  sun.shadow.camera.top = 2;
  sun.shadow.camera.bottom = -2;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  sun.target.position.copy(terrace.position);
  const moon = new THREE.DirectionalLight('#9fb4ff', 0);
  moon.position.set(-1, 0.6, 0.4).multiplyScalar(1000);
  scene.add(moon);
  const hemi = new THREE.HemisphereLight('#bcd4ff', '#3a4a30', 0.6);
  scene.add(hemi);
  // Soft fill from behind the viewer, like a reflector in a photo: it only
  // reaches the table, never the mountains.
  const fill = new THREE.PointLight('#fff4e6', 2.5, 5, 2);
  fill.position.set(0.3, 2.1, 1.9);
  terrace.add(fill);
  scene.fog = new THREE.FogExp2('#a9c1d9', 0.00003);

  /* ------------------------------------------------ precipitation */
  const flakes = 2500;
  const flakePos = new Float32Array(flakes * 3);
  for (let i = 0; i < flakes; i++) {
    flakePos[i * 3] = (Math.random() - 0.5) * 30;
    flakePos[i * 3 + 1] = Math.random() * 14;
    flakePos[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));
  const flakeMat = new THREE.PointsMaterial({
    color: '#ffffff',
    size: 0.05,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const precip = new THREE.Points(flakeGeo, flakeMat);
  precip.visible = false;
  terrace.add(precip);

  /* ------------------------------------------------------ lighting */
  let lighting: Lighting | null = null;
  let precipitation: Lighting['precipitation'] = null;
  const tmp = new THREE.Color();

  function setLighting(l: Lighting) {
    lighting = l;
    const dir = sunVector(l.altitude, l.azimuth);
    const day = smooth(-6, 6, l.altitude);
    const golden = 1 - smooth(2, 18, l.altitude);
    const overcast = l.cloud;

    skyU.sunPosition?.value.copy(dir);
    if (skyU.turbidity) skyU.turbidity.value = 2 + overcast * 10;
    if (skyU.rayleigh)
      skyU.rayleigh.value = 1.2 + golden * 1.4 - overcast * 0.6;
    if (skyU.mieCoefficient)
      skyU.mieCoefficient.value = 0.004 + overcast * 0.01;
    if (skyU.mieDirectionalG) skyU.mieDirectionalG.value = 0.8;

    sun.position.copy(terrace.position).addScaledVector(dir, 30);
    sun.color.set('#fff1e0').lerp(tmp.set('#ff8a4a'), golden * day);
    sun.intensity =
      3.2 * day * (1 - overcast * 0.75) * smooth(-1, 3, l.altitude);
    moon.intensity = 0.35 * (1 - day) * (1 - overcast * 0.7);
    // Pale dolomite in the shade still gets the whole sky: keep the skylight strong.
    hemi.intensity = 0.12 + 1.35 * day;
    fill.intensity = 0.6 + 2.4 * day;
    refreshEnvironment();
    scene.environmentIntensity = 0.25 + 0.75 * day;
    hemi.color.set('#9fb7e0').lerp(tmp.set('#d9b8a8'), golden * day * 0.6);
    // The "ground" half of the skylight is what snow and pale scree bounce back.
    hemi.groundColor.set(l.snowLine < 2300 ? '#a7adb6' : '#6f7566');

    const fogDay = tmp
      .set('#a7bfd6')
      .lerp(new THREE.Color('#e3b08f'), golden * 0.7);
    const fogColor = new THREE.Color('#0b1222')
      .lerp(fogDay, day)
      .lerp(new THREE.Color('#9aa3ab'), overcast * 0.5 * day);
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(fogColor);
    // Aerial perspective: about a fifth of the colour of the Brenta at 7 km is
    // haze, the far ridges fade into the sky.
    fog.density = 0.00006 + overcast * 0.00004 + (l.fog ? 0.00025 : 0);
    renderer.toneMappingExposure = 0.55 + (1 - day) * 0.35;
    renderer.setClearColor(fogColor);

    starMat.opacity = (1 - smooth(-12, -3, l.altitude)) * (1 - overcast);

    const lanternOn = l.lantern || day < 0.5;
    props.lanternLight.intensity = lanternOn ? 1.6 : 0;
    props.lanternGlass.emissiveIntensity = lanternOn ? 2.2 : 0;
    props.laptopScreen.color.setScalar(0.55 + (1 - day) * 0.2);

    precipitation = l.precipitation;
    precip.visible = !!precipitation;
    flakeMat.size = precipitation === 'rain' ? 0.025 : 0.05;
    flakeMat.color.set(precipitation === 'rain' ? '#b9c7d6' : '#ffffff');

    forest.setSnow(l.snowLine < 1700 ? 0.25 : 0);
    if (Math.abs(l.snowLine - snowLine) > 50) {
      snowLine = l.snowLine;
      paintTerrain(terrain.geometry, snowLine);
      if (lidar) paintTerrain(lidar.geometry, snowLine);
    }
  }

  /* ------------------------------------------------------ picking */
  const raycaster = new THREE.Raycaster();
  let hovered: PropId | null = null;
  const highlight = new THREE.Color('#3a2a10');
  const black = new THREE.Color('#000000');

  function setHighlight(id: PropId | null) {
    for (const item of props.clickable) {
      const on = item.userData.id === id;
      item.traverse((c) => {
        const m = (c as THREE.Mesh).material as
          | THREE.MeshStandardMaterial
          | THREE.MeshStandardMaterial[]
          | undefined;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
          if (mat.emissive && mat !== props.lanternGlass)
            mat.emissive.copy(on ? highlight : black);
        }
      });
    }
  }

  function pick(): PropId | null {
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(props.clickable, true)[0];
    let o: THREE.Object3D | null = hit?.object ?? null;
    while (o && !o.userData.id) o = o.parent;
    return (o?.userData.id as PropId | undefined) ?? null;
  }

  function setPointer(e: MouseEvent) {
    const rect = opts.canvas.getBoundingClientRect();
    pointerNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  function onPointerMove(e: PointerEvent) {
    setPointer(e);
    if (e.pointerType === 'mouse') pointer.copy(pointerNdc);
    const id = pick();
    if (id !== hovered) {
      hovered = id;
      setHighlight(id);
      opts.canvas.style.cursor = id ? 'pointer' : '';
    }
    opts.onHover?.(id, e.clientX, e.clientY);
  }

  // Taps and clicks carry their own position: touch screens never hover.
  // A press that moves more than a few pixels is a drag, not a pick.
  const press = { x: 0, y: 0 };
  function onPointerDown(e: PointerEvent) {
    press.x = e.clientX;
    press.y = e.clientY;
  }
  function onPointerUp(e: PointerEvent) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) return;
    setPointer(e);
    const id = pick();
    if (id) opts.onPick?.(id);
  }

  opts.canvas.addEventListener('pointermove', onPointerMove);
  opts.canvas.addEventListener('pointerdown', onPointerDown);
  opts.canvas.addEventListener('pointerup', onPointerUp);

  /** Moves the camera close to a prop, or back to the seat with `null`. */
  function focus(id: PropId | null) {
    if (!id || id === 'lantern') {
      goalPos.copy(home.pos);
      goalTarget.copy(home.target);
      return;
    }
    // The panel covers the right side: aim past the object so it sits on the left.
    const a = props.anchors[id];
    const wide = opts.canvas.clientWidth > 900;
    goalTarget.copy(a).add(new THREE.Vector3(wide ? 0.16 : 0, 0, 0));
    goalPos.copy(a).add(new THREE.Vector3(wide ? 0.2 : 0.05, 0.42, 0.52));
  }

  /* ------------------------------------------------------- resize */
  function resize() {
    const w = opts.canvas.clientWidth;
    const h = opts.canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the table and the summits in frame on portrait screens.
    camera.fov = camera.aspect < 1 ? LENS.portraitFov : LENS.fov;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(opts.canvas);
  resize();

  /* --------------------------------------------------------- loop */
  // Labels only for summits the eye can see from the table: walk the line of
  // sight over the heightmap once, at start.
  const eye = terrace.localToWorld(home.pos.clone());
  const peaks = PEAKS.filter((p) => p.label)
    .map((p) => {
      const g = geoToWorld(map.meta, p.lat, p.lon);
      return {
        id: p.id,
        pos: new THREE.Vector3(g.x, heightAt(map, g.x, g.y) + 40, g.y),
      };
    })
    .filter(({ pos }) => {
      const p = new THREE.Vector3();
      for (let t = 0.03; t < 0.97; t += 0.01) {
        p.lerpVectors(eye, pos, t);
        if (heightAt(map, p.x, p.z) > p.y + 8) return false;
      }
      return true;
    });
  const v = new THREE.Vector3();
  const clock = new THREE.Clock();
  let frame = 0;
  let running = true;

  function tick() {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // Ease towards the goal pose, plus a little breathing and pointer parallax.
    const k = 1 - Math.exp(-dt * 3);
    camPos.lerp(goalPos, k);
    camTarget.lerp(goalTarget, k);
    const sway = new THREE.Vector3(
      pointer.x * 0.06 + Math.sin(t * 0.3) * 0.01,
      pointer.y * 0.03 + Math.sin(t * 0.5) * 0.006,
      0,
    );
    camera.position.copy(terrace.localToWorld(v.copy(camPos).add(sway)));
    camera.lookAt(terrace.localToWorld(v.copy(camTarget)));

    if (precipitation) {
      const arr = flakeGeo.getAttribute('position') as THREE.BufferAttribute;
      const speed = precipitation === 'rain' ? 9 : 0.9;
      for (let i = 0; i < flakes; i++) {
        let y = arr.getY(i) - speed * dt;
        if (y < 0) y += 14;
        arr.setY(i, y);
        if (precipitation === 'snow')
          arr.setX(i, arr.getX(i) + Math.sin(t + i) * 0.003);
      }
      arr.needsUpdate = true;
    }

    renderer.render(scene, camera);

    if (opts.onLabels) {
      const w = opts.canvas.clientWidth;
      const h = opts.canvas.clientHeight;
      opts.onLabels(
        peaks.map((p) => {
          v.copy(p.pos).project(camera);
          return {
            id: p.id,
            x: (v.x * 0.5 + 0.5) * w,
            y: (-v.y * 0.5 + 0.5) * h,
            visible: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1,
          };
        }),
      );
    }
  }
  tick();

  return {
    setLighting,
    focus,
    updateScreens: (info: ScreenInfo) => props.updateScreens(info),
    get lighting() {
      return lighting;
    },
    dispose() {
      running = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
      opts.canvas.removeEventListener('pointermove', onPointerMove);
      opts.canvas.removeEventListener('pointerdown', onPointerDown);
      opts.canvas.removeEventListener('pointerup', onPointerUp);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const m = mesh.material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.dispose();
      });
      envTarget?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}

export type World = Awaited<ReturnType<typeof createWorld>>;
