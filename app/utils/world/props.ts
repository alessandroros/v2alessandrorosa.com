import * as THREE from 'three';
import type { Heightmap } from './terrain';
import {
  bookCoverTexture,
  drawRadio,
  drawTerminal,
  planksTexture,
  ropeTexture,
  screenTexture,
  topoMapTexture,
  type ScreenInfo,
} from './textures';

/*
  The refuge table on Monte Spinale. Each object is a door into a part of
  the site: its group carries `userData.id`, which the world raycasts for.
*/

export type PropId =
  | 'about'
  | 'route'
  | 'logbook'
  | 'projects'
  | 'stack'
  | 'contact'
  | 'lantern';

export interface Props {
  group: THREE.Group;
  clickable: THREE.Object3D[];
  lanternLight: THREE.PointLight;
  lanternGlass: THREE.MeshStandardMaterial;
  laptopScreen: THREE.MeshBasicMaterial;
  updateScreens: (info: ScreenInfo) => void;
  anchors: Record<PropId, THREE.Vector3>;
}

const TABLE_HEIGHT = 0.75;

const wood = (map: THREE.Texture, color = '#ffffff') =>
  new THREE.MeshStandardMaterial({ map, color, roughness: 0.85 });

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

function prop(
  id: PropId,
  x: number,
  z: number,
  yaw: number,
  ...children: THREE.Object3D[]
) {
  const g = new THREE.Group();
  g.userData.id = id;
  g.position.set(x, TABLE_HEIGHT, z);
  g.rotation.y = yaw;
  g.add(...children);
  return shadowed(g);
}

export function buildProps(
  map: Heightmap,
  marks: { label: string; u: number; v: number }[],
): Props {
  const group = new THREE.Group();
  const planks = planksTexture(1);

  // Deck and table.
  const deckTex = planksTexture(2);
  deckTex.rotation = Math.PI / 2;
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.08, 3.6),
    wood(deckTex, '#d6c2a6'),
  );
  deck.position.y = -0.04;
  deck.receiveShadow = true;
  group.add(deck);

  const table = new THREE.Group();
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.06, 0.95),
    wood(planks, '#fbe9cf'),
  );
  top.position.y = TABLE_HEIGHT - 0.03;
  table.add(top);
  const legMat = wood(planks, '#c9ab86');
  for (const [x, z] of [
    [-0.75, -0.38],
    [0.75, -0.38],
    [-0.75, 0.38],
    [0.75, 0.38],
  ] as const) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, TABLE_HEIGHT - 0.06, 0.07),
      legMat,
    );
    leg.position.set(x, (TABLE_HEIGHT - 0.06) / 2, z);
    table.add(leg);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.3), legMat);
  bench.position.set(0, 0.45, -0.85);
  table.add(bench);
  group.add(shadowed(table));

  // Map: the career route. Slightly curled sheet.
  const mapTex = topoMapTexture(map, marks);
  const aspect = map.meta.height / map.meta.width;
  const mapGeo = new THREE.PlaneGeometry(0.42, 0.42 * aspect, 24, 24);
  const mp = mapGeo.getAttribute('position');
  for (let k = 0; k < mp.count; k++) {
    const x = mp.getX(k);
    mp.setZ(k, 0.012 * Math.cos((x / 0.21) * Math.PI) + 0.004);
  }
  mapGeo.computeVertexNormals();
  const sheet = new THREE.Mesh(
    mapGeo,
    new THREE.MeshStandardMaterial({
      map: mapTex,
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
  );
  sheet.rotation.x = -Math.PI / 2;
  const route = prop('route', -0.28, 0.04, 0.18, sheet);

  // Logbook: the blog.
  const cover = new THREE.MeshStandardMaterial({
    map: bookCoverTexture(),
    roughness: 0.7,
  });
  const leather = new THREE.MeshStandardMaterial({
    color: '#5a1c15',
    roughness: 0.7,
  });
  const pages = new THREE.MeshStandardMaterial({
    color: '#efe6d0',
    roughness: 0.9,
  });
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.035, 0.28), [
    pages,
    leather,
    cover,
    leather,
    pages,
    pages,
  ]);
  book.position.y = 0.0175;
  const logbook = prop('logbook', 0.34, 0.06, -0.32, book);

  // Laptop: projects. The terminal shows the live summit weather.
  const terminal = screenTexture(drawTerminal, 400);
  const laptopScreen = new THREE.MeshBasicMaterial({
    map: terminal.texture,
    toneMapped: false,
  });
  const alu = new THREE.MeshStandardMaterial({
    color: '#9aa0a6',
    metalness: 0.6,
    roughness: 0.35,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.014, 0.22), alu);
  base.position.y = 0.007;
  const keys = new THREE.Mesh(
    new THREE.PlaneGeometry(0.27, 0.1),
    new THREE.MeshStandardMaterial({ color: '#2a2c2e', roughness: 0.8 }),
  );
  keys.rotation.x = -Math.PI / 2;
  keys.position.set(0, 0.0145, 0.02);
  const lid = new THREE.Group();
  const lidBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.21, 0.008), alu);
  lidBox.position.y = 0.105;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.29, 0.18),
    laptopScreen,
  );
  screen.position.set(0, 0.107, 0.0045);
  lid.add(lidBox, screen);
  lid.position.set(0, 0.014, -0.106);
  lid.rotation.x = -0.32;
  const laptop = prop('projects', 0.02, -0.2, 0.08, base, keys, lid);

  // Enamel mug: about me.
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.042, 0),
    new THREE.Vector2(0.045, 0.004),
    new THREE.Vector2(0.045, 0.095),
    new THREE.Vector2(0.043, 0.095),
    new THREE.Vector2(0.041, 0.006),
    new THREE.Vector2(0, 0.006),
  ];
  const enamel = new THREE.MeshStandardMaterial({
    color: '#f3f1ea',
    roughness: 0.25,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#1f3b73',
    roughness: 0.3,
  });
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 32), enamel);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.044, 0.003, 8, 32),
    rimMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.095;
  const handle = new THREE.Mesh(
    new THREE.TorusGeometry(0.028, 0.006, 8, 16, Math.PI),
    enamel,
  );
  handle.position.set(0.045, 0.05, 0);
  handle.rotation.z = -Math.PI / 2;
  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(0.041, 24),
    new THREE.MeshStandardMaterial({ color: '#2b160a', roughness: 0.15 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.08;
  const mug = prop('about', 0.64, -0.05, 0.6, cup, rim, handle, coffee);

  // Radio: contact.
  const radioFace = screenTexture(drawRadio, 384);
  const body = new THREE.MeshStandardMaterial({
    color: '#3b4a3a',
    roughness: 0.6,
  });
  const face = new THREE.MeshStandardMaterial({
    map: radioFace.texture,
    roughness: 0.5,
  });
  const radioBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.075), [
    body,
    body,
    body,
    body,
    face,
    body,
  ]);
  radioBox.position.y = 0.065;
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.002, 0.003, 0.32),
    alu,
  );
  antenna.position.set(-0.08, 0.27, -0.02);
  antenna.rotation.z = 0.35;
  const radio = prop('contact', 0.46, -0.3, -0.25, radioBox, antenna);

  // Coiled rope: the stack.
  const coil: THREE.Vector3[] = [];
  for (let t = 0; t <= 1; t += 0.004) {
    const a = t * Math.PI * 2 * 5;
    const r = 0.1 + 0.012 * Math.sin(a * 0.5) + t * 0.02;
    coil.push(
      new THREE.Vector3(
        Math.cos(a) * r,
        0.009 + Math.floor(t * 5) * 0.0 + t * 0.03,
        Math.sin(a) * r * 0.92,
      ),
    );
  }
  const ropeMesh = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 600, 0.0085, 8),
    new THREE.MeshStandardMaterial({ map: ropeTexture(), roughness: 0.8 }),
  );
  const rope = prop('stack', -0.6, 0.2, 0, ropeMesh);

  // Lantern: day and night.
  const metal = new THREE.MeshStandardMaterial({
    color: '#25352a',
    metalness: 0.5,
    roughness: 0.5,
  });
  const lanternGlass = new THREE.MeshStandardMaterial({
    color: '#fff3d6',
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
    emissive: new THREE.Color('#ffb05a'),
    emissiveIntensity: 0,
  });
  const lb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.065, 0.03, 24),
    metal,
  );
  lb.position.y = 0.015;
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.13, 24, 1, true),
    lanternGlass,
  );
  glass.position.y = 0.095;
  glass.castShadow = false;
  const capTop = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.05, 24), metal);
  capTop.position.y = 0.185;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.03, 0.004, 8, 24),
    metal,
  );
  ring.position.y = 0.235;
  const lanternLight = new THREE.PointLight('#ffb35c', 0, 6, 2);
  lanternLight.position.y = 0.1;
  lanternLight.castShadow = true;
  lanternLight.shadow.mapSize.set(512, 512);
  lanternLight.shadow.bias = -0.002;
  const lantern = prop('lantern', -0.66, -0.22, 0, lb, glass, capTop, ring);
  lantern.add(lanternLight);
  glass.castShadow = false;

  const items = [route, logbook, laptop, mug, radio, rope, lantern];
  group.add(...items);

  const anchors = Object.fromEntries(
    items.map((o) => [
      o.userData.id as PropId,
      o.position.clone().add(new THREE.Vector3(0, 0.06, 0)),
    ]),
  ) as Record<PropId, THREE.Vector3>;

  return {
    group,
    clickable: items,
    lanternLight,
    lanternGlass,
    laptopScreen,
    anchors,
    updateScreens(info) {
      terminal.update(info);
      radioFace.update(info);
    },
  };
}
