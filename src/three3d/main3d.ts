import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { initTelegram, hapticHurt } from '../telegram';

// ===========================================================================
// Config: car styles and city themes
// ===========================================================================

type CarKind = 'sedan' | 'sport' | 'van' | 'classic';
interface CarStyle {
  id: string;
  name: string;
  color: number;
  kind: CarKind;
  taxi?: boolean;
  police?: boolean;
}

const CAR_STYLES: CarStyle[] = [
  { id: 'taxi', name: 'Таксі', color: 0xffd400, kind: 'sedan', taxi: true },
  { id: 'sport', name: 'Спорт', color: 0xff3b30, kind: 'sport' },
  { id: 'police', name: 'Поліція', color: 0x1e3a8a, kind: 'sedan', police: true },
  { id: 'classic', name: 'Класика', color: 0x9a2f2f, kind: 'classic' },
  { id: 'van', name: 'Фургон', color: 0x2f9e6a, kind: 'van' },
];

interface CityTheme {
  id: string;
  name: string;
  bg: number;
  fog: number;
  building: number;
  ambient: number;
  neon: number[];
}

const CITIES: CityTheme[] = [
  {
    id: 'nyc',
    name: 'Нью-Йорк',
    bg: 0x05070f,
    fog: 0x070b1c,
    building: 0x0c1020,
    ambient: 0x2a3550,
    neon: [0xff2d95, 0x00e5ff, 0xffb300, 0x7cff5a, 0xa05cff],
  },
  {
    id: 'miami',
    name: 'Маямі',
    bg: 0x1a0b2e,
    fog: 0x2a1240,
    building: 0x1a1030,
    ambient: 0x3a2050,
    neon: [0xff2d95, 0x00e5ff, 0xff6ec7, 0xa05cff, 0xffd166],
  },
  {
    id: 'tokyo',
    name: 'Токіо',
    bg: 0x0a0510,
    fog: 0x150818,
    building: 0x140a16,
    ambient: 0x301525,
    neon: [0xff2233, 0xffffff, 0xff66aa, 0x33ddff, 0xffd400],
  },
  {
    id: 'vegas',
    name: 'Вегас',
    bg: 0x0d0a04,
    fog: 0x1a1408,
    building: 0x14110a,
    ambient: 0x352a10,
    neon: [0xffd400, 0xffae42, 0xff5e5e, 0x00e5ff, 0xff2d95],
  },
];

const LANES = [-2.4, -0.8, 0.8, 2.4];

// ===========================================================================
// Renderer / scene / camera
// ===========================================================================

const canvas = document.getElementById('app') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x070b1c, 28, 105);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4.2, 8);

initTelegram('#05070f');

const ambient = new THREE.AmbientLight(0x2a3550, 0.55);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.45);
moon.position.set(-20, 40, 10);
scene.add(moon);

const neonLights: THREE.PointLight[] = [];
for (let i = 0; i < 3; i++) {
  const light = new THREE.PointLight(0xffffff, 55, 38, 2);
  light.position.set(i % 2 === 0 ? -7 : 7, 5 + Math.random() * 7, -i * 26);
  scene.add(light);
  neonLights.push(light);
}

// ---- Wet street + reflections ----------------------------------------------

const reflector = new Reflector(new THREE.PlaneGeometry(60, 400), {
  textureWidth: 512,
  textureHeight: 512,
  color: 0x0a0d14,
});
reflector.rotateX(-Math.PI / 2);
scene.add(reflector);

const street = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 400),
  new THREE.MeshStandardMaterial({
    color: 0x0c1018,
    roughness: 0.3,
    metalness: 0.75,
    transparent: true,
    opacity: 0.5,
  }),
);
street.rotateX(-Math.PI / 2);
street.position.y = 0.01;
scene.add(street);

for (const side of [-1, 1]) {
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.3, 400),
    new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.95 }),
  );
  walk.position.set(side * 7, 0.15, 0);
  scene.add(walk);
}

const laneMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const laneMarks: THREE.Mesh[] = [];
for (let i = 0; i < 24; i++) {
  const lane = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 2.4), laneMat);
  lane.position.set(0, 0.32, -i * 8);
  scene.add(lane);
  laneMarks.push(lane);
}

// ---- Street lamps ----------------------------------------------------------

const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffdca0 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.7, metalness: 0.5 });
const lamps: THREE.Group[] = [];
for (let i = 0; i < 6; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), poleMat);
  pole.position.y = 3;
  g.add(pole);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lampHeadMat);
  head.position.set(-side * 1.3, 5.7, 0);
  g.add(head);
  const light = new THREE.PointLight(0xffd28a, 20, 16, 2);
  light.position.set(-side * 1.3, 5.6, 0);
  g.add(light);
  g.position.set(side * 5.4, 0, -i * 16);
  scene.add(g);
  lamps.push(g);
}

// ---- Buildings -------------------------------------------------------------

function makeWindowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let y = 6; y < c.height - 4; y += 10) {
    for (let x = 6; x < c.width - 4; x += 12) {
      if (Math.random() < 0.5) {
        ctx.fillStyle = Math.random() < 0.8 ? '#ffd98c' : '#9fd0ff';
        ctx.fillRect(x, y, 7, 6);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const CORRIDOR = 18 * 9;
const buildings: THREE.Mesh[] = [];
const buildingGeo = new THREE.BoxGeometry(1, 1, 1);

function styleBuilding(b: THREE.Mesh): void {
  const h = 8 + Math.random() * 30;
  const w = 4 + Math.random() * 4;
  const d = 5 + Math.random() * 4;
  b.scale.set(w, h, d);
  b.position.y = h / 2;
  const mat = b.material as THREE.MeshStandardMaterial;
  const tex = makeWindowTexture();
  tex.repeat.set(Math.round(w / 2), Math.round(h / 3));
  mat.map = tex;
  mat.emissiveMap = tex;
  mat.emissive = new THREE.Color(0xffffff);
  mat.emissiveIntensity = 0.45;
  mat.needsUpdate = true;
}

for (let i = 0; i < 18; i++) {
  for (const side of [-1, 1]) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c1020, roughness: 0.9 });
    const b = new THREE.Mesh(buildingGeo, mat);
    styleBuilding(b);
    b.position.x = side * (9 + Math.random() * 3);
    b.position.z = -i * 9 - Math.random() * 3;
    scene.add(b);
    buildings.push(b);
  }
}

const billboards: THREE.Mesh[] = [];
for (let i = 0; i < 10; i++) {
  const bb = new THREE.Mesh(
    new THREE.PlaneGeometry(3 + Math.random() * 2, 1.2 + Math.random()),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  const side = i % 2 === 0 ? -1 : 1;
  bb.position.set(side * 6.4, 4 + Math.random() * 10, -i * 16);
  bb.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(bb);
  billboards.push(bb);
}

// ===========================================================================
// Car builder
// ===========================================================================

interface Car {
  group: THREE.Group;
  policeLights?: THREE.Mesh[];
}

interface Dims {
  bl: number; bw: number; bh: number; by: number;
  cw: number; ch: number; cl: number; cy: number; cz: number;
}
const CAR_DIMS: Record<CarKind, Dims> = {
  sedan: { bl: 4.3, bw: 1.9, bh: 0.45, by: 0.6, cw: 1.7, ch: 0.55, cl: 2.0, cy: 1.05, cz: -0.05 },
  sport: { bl: 4.8, bw: 1.96, bh: 0.38, by: 0.5, cw: 1.62, ch: 0.4, cl: 1.5, cy: 0.9, cz: 0.15 },
  van: { bl: 3.9, bw: 1.96, bh: 0.5, by: 0.62, cw: 1.86, ch: 1.0, cl: 2.7, cy: 1.3, cz: 0.1 },
  classic: { bl: 4.4, bw: 1.8, bh: 0.55, by: 0.66, cw: 1.64, ch: 0.62, cl: 1.7, cy: 1.22, cz: 0.0 },
};

function buildCar(style: CarStyle, isPlayer: boolean): Car {
  const d = CAR_DIMS[style.kind];
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: style.color,
    roughness: 0.35,
    metalness: 0.45,
    // Cars glow in their own colour so they read on the dark road
    // (player a touch; traffic glows strongly so it is impossible to miss).
    emissive: new THREE.Color(style.color),
    emissiveIntensity: isPlayer ? 0.12 : 0.85,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f18,
    roughness: 0.1,
    metalness: 0.9,
  });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(d.bw, d.bh, d.bl), paint);
  lower.position.y = d.by;
  group.add(lower);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(d.cw, d.ch, d.cl), paint);
  cabin.position.set(0, d.cy, d.cz);
  group.add(cabin);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(d.cw + 0.04, d.ch - 0.14, d.cl - 0.3), glassMat);
  windows.position.set(0, d.cy + 0.02, d.cz);
  group.add(windows);

  const wind = new THREE.Mesh(new THREE.BoxGeometry(d.cw - 0.04, d.ch, 0.12), glassMat);
  wind.position.set(0, d.cy - 0.04, d.cz - d.cl / 2);
  wind.rotation.x = -0.5;
  group.add(wind);

  const wx = d.bw / 2 - 0.03;
  const wz = d.bl / 2 - 0.95;
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b3, roughness: 0.3, metalness: 0.8 });
  for (const sx of [-wx, wx]) {
    for (const sz of [-wz, wz]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(sx, 0.42, sz);
      group.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(sx, 0.42, sz);
      group.add(rim);
    }
  }

  const front = -d.bl / 2;
  const rear = d.bl / 2;
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(d.bw + 0.05, 0.25, 0.3), tireMat);
  bumper.position.set(0, d.by - 0.15, front + 0.05);
  group.add(bumper);

  const hx = d.bw * 0.34;
  for (const sx of [-hx, hx]) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.18, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff6d5 }),
    );
    lamp.position.set(sx, d.by + 0.05, front + 0.02);
    group.add(lamp);
    if (isPlayer) {
      const spot = new THREE.SpotLight(0xfff2cc, 120, 60, Math.PI / 6, 0.5, 1.5);
      spot.position.set(sx, 0.8, front + 0.1);
      spot.target.position.set(sx, 0, front - 22);
      group.add(spot);
      group.add(spot.target);
    }
  }

  // Big bright taillights (these bloom) so traffic ahead is obvious.
  const tx = d.bw * 0.34;
  for (const sx of [-tx, tx]) {
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.26, 0.12),
      new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    );
    tl.position.set(sx, d.by + 0.08, rear - 0.02);
    group.add(tl);
  }
  // Traffic gets a glowing roof strip so it stands out on the dark road.
  if (!isPlayer) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(d.cw * 0.85, 0.12, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0 }),
    );
    roof.position.set(0, d.cy + d.ch / 2 + 0.08, d.cz);
    group.add(roof);
  }

  // Sport spoiler.
  if (style.kind === 'sport') {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(d.bw * 0.9, 0.07, 0.35), paint);
    wing.position.set(0, d.by + 0.45, rear - 0.5);
    group.add(wing);
    for (const sx of [-0.7, 0.7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.1), tireMat);
      post.position.set(sx, d.by + 0.25, rear - 0.5);
      group.add(post);
    }
  }

  if (style.taxi) {
    for (const sx of [-(d.bw / 2 - 0.02), d.bw / 2 - 0.02]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.18, d.bl - 0.2),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      );
      stripe.position.set(sx, d.by + 0.02, 0);
      group.add(stripe);
    }
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
    );
    sign.position.set(0, d.cy + d.ch / 2 + 0.12, d.cz + 0.15);
    group.add(sign);
  }

  const car: Car = { group };
  if (style.police) {
    const ly = d.cy + d.ch / 2 + 0.1;
    const lightsArr: THREE.Mesh[] = [];
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    blue.position.set(-0.28, ly, 0);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }),
    );
    red.position.set(0.28, ly, 0);
    group.add(blue, red);
    lightsArr.push(blue, red);
    car.policeLights = lightsArr;
  }

  return car;
}

// ===========================================================================
// Player + traffic
// ===========================================================================

let playerStyle = CAR_STYLES[0];
let player: Car = buildCar(playerStyle, true);
scene.add(player.group);

function setPlayerCar(style: CarStyle): void {
  scene.remove(player.group);
  playerStyle = style;
  player = buildCar(style, true);
  scene.add(player.group);
}

const TRAFFIC_COLORS = [0xd23a3a, 0x3a6bff, 0xedeef2, 0x9aa3b3, 0x3fbf7a, 0xe8b53a];
const TRAFFIC_KINDS: CarKind[] = ['sedan', 'sedan', 'van', 'sport', 'classic'];
interface Traffic {
  car: Car;
  active: boolean;
  own: number;
}
const traffic: Traffic[] = [];
for (let i = 0; i < 10; i++) {
  const style: CarStyle = {
    id: 't',
    name: 't',
    color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
    kind: TRAFFIC_KINDS[i % TRAFFIC_KINDS.length],
  };
  const car = buildCar(style, false);
  car.group.visible = false;
  car.group.position.set(0, 0, 60);
  scene.add(car.group);
  traffic.push({ car, active: false, own: 0 });
}

function laneIsFree(x: number): boolean {
  for (const t of traffic) {
    if (t.active && Math.abs(t.car.group.position.x - x) < 0.1 && t.car.group.position.z < -55) {
      return false;
    }
  }
  return true;
}

function spawnTraffic(): void {
  const freeLanes = LANES.filter(laneIsFree);
  if (freeLanes.length === 0) return;
  const lane = freeLanes[Math.floor(Math.random() * freeLanes.length)];
  const t = traffic.find((c) => !c.active);
  if (!t) return;
  t.active = true;
  t.own = 4 + Math.random() * 10;
  t.car.group.visible = true;
  t.car.group.position.set(lane, 0, -95);
}

// ===========================================================================
// City landmarks (recognisable structures per city)
// ===========================================================================

// Landmarks sit in the centre, far down the avenue, so the player drives
// toward them; they recycle back into the distance before reaching the car.
const LM_SPACING = 120;
const LM_RECYCLE = -34;
const landmarks: THREE.Group[] = [];
for (let i = 0; i < 2; i++) {
  const g = new THREE.Group();
  g.position.set(0, 0, -60 - i * LM_SPACING);
  scene.add(g);
  landmarks.push(g);
}

function clearGroup(g: THREE.Group): void {
  while (g.children.length) g.remove(g.children[0]);
}

function buildLandmark(g: THREE.Group, city: CityTheme): void {
  clearGroup(g);
  const std = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
  const glow = (color: number) => new THREE.MeshBasicMaterial({ color });

  if (city.id === 'nyc') {
    // Statue of Liberty (softly self-lit green so it reads at night).
    const green = 0x8fd0bd;
    const gmat = () => std(green, { emissive: 0x2f6f5e, emissiveIntensity: 0.5 });
    const ped = new THREE.Mesh(new THREE.BoxGeometry(7, 12, 7), std(0x8a93a3, { emissive: 0x2a3038, emissiveIntensity: 0.4 }));
    ped.position.y = 6;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 13, 10), gmat());
    body.position.y = 18;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 10), gmat());
    head.position.y = 25.5;
    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.4, 6), gmat());
      const a = (i / 6) * Math.PI - Math.PI / 2;
      spike.position.set(Math.cos(a) * 1.7, 27, Math.sin(a) * 1.7);
      g.add(spike);
    }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 6, 8), gmat());
    arm.position.set(2, 24, 0);
    arm.rotation.z = -0.5;
    const torch = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), glow(0xffd166));
    torch.position.set(3.4, 27, 0);
    g.add(ped, body, head, arm, torch);
  } else if (city.id === 'tokyo') {
    // Tokyo Tower (red lattice + lit tip).
    const tower = new THREE.Mesh(
      new THREE.ConeGeometry(7, 34, 4, 4, true),
      new THREE.MeshBasicMaterial({ color: 0xe23b3b, wireframe: true }),
    );
    tower.position.y = 17;
    tower.rotation.y = Math.PI / 4;
    const core = new THREE.Mesh(new THREE.ConeGeometry(2.5, 30, 4), std(0x3a1414));
    core.position.y = 16;
    core.rotation.y = Math.PI / 4;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8, 6), std(0xe23b3b));
    antenna.position.y = 36;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), glow(0xff5e5e));
    tip.position.y = 40;
    g.add(tower, core, antenna, tip);
  } else if (city.id === 'vegas') {
    // Luxor-style pyramid + sky beam.
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(9, 13, 4), std(0x1a1712, { metalness: 0.4 }));
    pyr.position.y = 6.5;
    pyr.rotation.y = Math.PI / 4;
    const trim = new THREE.Mesh(
      new THREE.ConeGeometry(9.05, 13.05, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd400, wireframe: true }),
    );
    trim.position.y = 6.5;
    trim.rotation.y = Math.PI / 4;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 70, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff8e0, transparent: true, opacity: 0.4 }),
    );
    beam.position.y = 48;
    g.add(pyr, trim, beam);
  } else {
    // Miami: palm trees + pastel Art-Deco tower.
    const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 18, 5), std(0xff9ec7, { emissive: 0x3a1030, emissiveIntensity: 0.4 }));
    tower.position.y = 9;
    const band = new THREE.Mesh(new THREE.BoxGeometry(5.1, 1.2, 5.1), glow(0x00e5ff));
    band.position.y = 14;
    g.add(tower, band);
    for (const px of [-3, 3.5]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 6), std(0x6b4f2a));
      trunk.position.set(px, 4.5, 4);
      g.add(trunk);
      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.2, 4), std(0x2f9e5a));
        const a = (i / 6) * Math.PI * 2;
        frond.position.set(px + Math.cos(a) * 1.1, 9, 4 + Math.sin(a) * 1.1);
        frond.rotation.z = Math.cos(a) * 1.1;
        frond.rotation.x = Math.sin(a) * 1.1;
        g.add(frond);
      }
    }
  }

  // Floodlight so the landmark is clearly lit at night.
  const flood = new THREE.PointLight(0xfff2d8, 50, 80, 2);
  flood.position.set(0, 18, 12);
  g.add(flood);
}

// ===========================================================================
// Theme application
// ===========================================================================

function applyCity(city: CityTheme): void {
  scene.background = new THREE.Color(city.bg);
  scene.fog!.color.setHex(city.fog);
  ambient.color.setHex(city.ambient);
  for (const b of buildings) (b.material as THREE.MeshStandardMaterial).color.setHex(city.building);
  for (let i = 0; i < neonLights.length; i++) {
    neonLights[i].color.setHex(city.neon[i % city.neon.length]);
  }
  for (let i = 0; i < billboards.length; i++) {
    (billboards[i].material as THREE.MeshBasicMaterial).color.setHex(city.neon[i % city.neon.length]);
  }
  for (const g of landmarks) buildLandmark(g, city);
}
let currentCity = CITIES[0];
applyCity(currentCity);

// ===========================================================================
// Post-processing
// ===========================================================================

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.5, 0.6);
composer.addPass(bloom);

// ===========================================================================
// Game state
// ===========================================================================

type State = 'menu' | 'playing' | 'gameover';
let state: State = 'menu';

let speed = 26;
let spawnInterval = 1.1;
let spawnAcc = 0;
let level = 1;
let levelDist = 0;
let totalScore = 0;
let lives = 3;
let invuln = 0;
let shake = 0;
let targetX = 0;

const BASE_SPEED = 26;
const BASE_SPAWN = 1.1;
function levelTarget(lvl: number): number {
  return 600 + lvl * 400;
}

function resetGame(): void {
  speed = BASE_SPEED;
  spawnInterval = BASE_SPAWN;
  spawnAcc = 0;
  level = 1;
  levelDist = 0;
  totalScore = 0;
  lives = 3;
  invuln = 1.0;
  shake = 0;
  targetX = 0;
  player.group.position.set(0, 0, 0);
  player.group.visible = true;
  for (const t of traffic) {
    t.active = false;
    t.car.group.visible = false;
    t.car.group.position.z = 60;
  }
  updateHud();
}

// ===========================================================================
// DOM / UI
// ===========================================================================

const el = (id: string) => document.getElementById(id)!;
const menuEl = el('menu');
const hudEl = el('hud');
const crashEl = el('crash');
const toastEl = el('toast');

let selectedCarId = CAR_STYLES[0].id;
let selectedCityId = CITIES[0].id;

function buildChips(): void {
  const carRow = el('car-row');
  carRow.innerHTML = '';
  for (const s of CAR_STYLES) {
    const chip = document.createElement('div');
    chip.className = 'chip' + (s.id === selectedCarId ? ' active' : '');
    chip.textContent = s.name;
    chip.onclick = () => {
      selectedCarId = s.id;
      buildChips();
    };
    carRow.appendChild(chip);
  }
  const cityRow = el('city-row');
  cityRow.innerHTML = '';
  for (const c of CITIES) {
    const chip = document.createElement('div');
    chip.className = 'chip' + (c.id === selectedCityId ? ' active' : '');
    chip.textContent = c.name;
    chip.onclick = () => {
      selectedCityId = c.id;
      buildChips();
    };
    cityRow.appendChild(chip);
  }
}
buildChips();

function updateHud(): void {
  el('hud-level').textContent = String(level);
  el('hud-score').textContent = String(Math.floor(totalScore));
  el('hud-lives').textContent = '❤'.repeat(Math.max(lives, 0)) || '—';
}

function showToast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.remove('hidden');
  window.setTimeout(() => toastEl.classList.add('hidden'), 1400);
}

function startGame(): void {
  const style = CAR_STYLES.find((s) => s.id === selectedCarId) ?? CAR_STYLES[0];
  if (style.id !== playerStyle.id) setPlayerCar(style);
  currentCity = CITIES.find((c) => c.id === selectedCityId) ?? CITIES[0];
  applyCity(currentCity);
  resetGame();
  menuEl.classList.add('hidden');
  crashEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  state = 'playing';
}

function gameOver(): void {
  state = 'gameover';
  hudEl.classList.add('hidden');
  el('crash-score').textContent = `Дистанція: ${Math.floor(totalScore)} м · Рівень ${level}`;
  crashEl.classList.remove('hidden');
}

function showMenu(): void {
  state = 'menu';
  crashEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
}

el('play-btn').onclick = startGame;
el('retry-btn').onclick = startGame;
el('menu-btn').onclick = showMenu;

// ---- Steering --------------------------------------------------------------

function setTargetFromX(clientX: number): void {
  const nx = (clientX / window.innerWidth) * 2 - 1;
  targetX = THREE.MathUtils.clamp(nx * 3.0, -2.9, 2.9);
}
let pointerDown = false;
window.addEventListener('pointerdown', (e) => {
  if (state !== 'playing') return;
  pointerDown = true;
  setTargetFromX(e.clientX);
});
window.addEventListener('pointermove', (e) => {
  if (state === 'playing' && pointerDown) setTargetFromX(e.clientX);
});
window.addEventListener('pointerup', () => (pointerDown = false));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ===========================================================================
// Collision + crash
// ===========================================================================

function crash(): void {
  lives -= 1;
  invuln = 1.2;
  shake = 0.4;
  hapticHurt();
  updateHud();
  // Push nearby traffic away so we don't instantly re-collide.
  for (const t of traffic) {
    if (t.active && Math.abs(t.car.group.position.z - player.group.position.z) < 14) {
      t.active = false;
      t.car.group.visible = false;
      t.car.group.position.z = 60;
    }
  }
  if (lives <= 0) gameOver();
}

// ===========================================================================
// Loop
// ===========================================================================

const clock = new THREE.Clock();
let policePhase = 0;

function animate(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  const dz = (state === 'playing' ? speed : 14) * dt;

  // World streaming (always, so the menu has a live backdrop).
  for (const b of buildings) {
    b.position.z += dz;
    if (b.position.z > 14) {
      b.position.z -= CORRIDOR;
      styleBuilding(b);
      (b.material as THREE.MeshStandardMaterial).color.setHex(currentCity.building);
      b.position.x = (b.position.x < 0 ? -1 : 1) * (9 + Math.random() * 3);
    }
  }
  for (const lane of laneMarks) {
    lane.position.z += dz;
    if (lane.position.z > 12) lane.position.z -= 24 * 8;
  }
  for (const g of lamps) {
    g.position.z += dz;
    if (g.position.z > 14) g.position.z -= 6 * 16;
  }
  for (const g of landmarks) {
    g.position.z += dz;
    if (g.position.z > LM_RECYCLE) g.position.z -= landmarks.length * LM_SPACING;
  }
  for (let i = 0; i < neonLights.length; i++) {
    const l = neonLights[i];
    l.position.z += dz;
    if (l.position.z > 14) {
      l.position.z -= CORRIDOR;
      l.color.setHex(currentCity.neon[Math.floor(Math.random() * currentCity.neon.length)]);
    }
  }
  for (const bb of billboards) {
    bb.position.z += dz;
    if (bb.position.z > 14) bb.position.z -= 10 * 16;
  }

  // Police light flash.
  if (player.policeLights) {
    policePhase += dt * 6;
    const on = Math.floor(policePhase) % 2 === 0;
    (player.policeLights[0].material as THREE.MeshBasicMaterial).color.setHex(on ? 0x2244ff : 0x0a1030);
    (player.policeLights[1].material as THREE.MeshBasicMaterial).color.setHex(on ? 0x0a1030 : 0xff2233);
  }

  if (state === 'playing') {
    // Score + level progression.
    totalScore += speed * dt;
    levelDist += speed * dt;
    if (levelDist >= levelTarget(level)) {
      level += 1;
      levelDist = 0;
      speed += 4;
      spawnInterval = Math.max(0.5, spawnInterval - 0.06);
      showToast(`РІВЕНЬ ${level}`);
    }
    updateHud();

    // Spawn traffic.
    spawnAcc += dt;
    if (spawnAcc >= spawnInterval) {
      spawnAcc = 0;
      spawnTraffic();
    }

    // Invulnerability blink.
    if (invuln > 0) {
      invuln -= dt;
      player.group.visible = Math.floor(invuln * 12) % 2 === 0;
      if (invuln <= 0) player.group.visible = true;
    }

    // Steering.
    player.group.position.x += (targetX - player.group.position.x) * Math.min(1, dt * 8);
    player.group.rotation.z = (targetX - player.group.position.x) * -0.06;
    player.group.rotation.y = (targetX - player.group.position.x) * -0.04;
  }

  // Move traffic toward the player and check collisions.
  for (const t of traffic) {
    if (!t.active) continue;
    t.car.group.position.z += dz - t.own * dt;
    if (t.car.group.position.z > 16) {
      t.active = false;
      t.car.group.visible = false;
      t.car.group.position.z = 60;
      continue;
    }
    if (state === 'playing' && invuln <= 0) {
      const cx = t.car.group.position.x;
      const cz = t.car.group.position.z;
      if (Math.abs(cz - player.group.position.z) < 2.6 && Math.abs(cx - player.group.position.x) < 1.6) {
        crash();
      }
    }
  }

  // Camera follow + shake.
  let camShakeX = 0;
  let camShakeY = 0;
  if (shake > 0) {
    shake -= dt;
    camShakeX = (Math.random() - 0.5) * shake;
    camShakeY = (Math.random() - 0.5) * shake;
  }
  camera.position.x += (player.group.position.x * 0.6 - camera.position.x) * Math.min(1, dt * 4);
  camera.position.y = 4.2 + camShakeY;
  camera.lookAt(player.group.position.x * 0.4 + camShakeX, 1.6, -14);

  composer.render();
  requestAnimationFrame(animate);
}
animate();
