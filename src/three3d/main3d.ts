import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { initTelegram, hapticHurt, hapticHit, persist, loadCloud, readLocal } from '../telegram';

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

// What lines each side of the avenue. 'city'/'casino' = buildings,
// 'park' = trees + lake, 'palms' = beach palms, 'sea' = open water.
type Terrain = 'city' | 'park' | 'palms' | 'sea' | 'casino';

interface CityTheme {
  id: string;
  name: string;
  bg: number;
  fog: number;
  building: number;
  ambient: number;
  neon: number[];
  sideL: Terrain;
  sideR: Terrain;
}

const CITIES: CityTheme[] = [
  { id: 'nyc', name: 'Нью-Йорк', bg: 0x05070f, fog: 0x070b1c, building: 0x0c1020, ambient: 0x2a3550, neon: [0xff2d95, 0x00e5ff, 0xffb300, 0x7cff5a, 0xa05cff], sideL: 'park', sideR: 'city' },
  { id: 'miami', name: 'Маямі', bg: 0x1a0b2e, fog: 0x2a1240, building: 0x1a1030, ambient: 0x3a2050, neon: [0xff2d95, 0x00e5ff, 0xff6ec7, 0xa05cff, 0xffd166], sideL: 'palms', sideR: 'sea' },
  { id: 'tokyo', name: 'Токіо', bg: 0x0a0510, fog: 0x150818, building: 0x140a16, ambient: 0x301525, neon: [0xff2233, 0xffffff, 0xff66aa, 0x33ddff, 0xffd400], sideL: 'city', sideR: 'city' },
  { id: 'vegas', name: 'Вегас', bg: 0x0d0a04, fog: 0x1a1408, building: 0x14110a, ambient: 0x352a10, neon: [0xffd400, 0xffae42, 0xff5e5e, 0x00e5ff, 0xff2d95], sideL: 'casino', sideR: 'casino' },
];

// Active theme, set before buildings are first styled (avoids TDZ).
let activeCity: CityTheme = CITIES[0];

function sideTerrain(side: number): Terrain {
  return side < 0 ? activeCity.sideL : activeCity.sideR;
}

const LANES = [-2.4, -0.8, 0.8, 2.4];
const ROAD_HALF = 4.4;

// --- Upgrades (each car has its own levels) --------------------------------

interface UpgradeDef {
  id: 'handling' | 'armor' | 'magnet' | 'shield';
  name: string;
  desc: string;
  max: number;
  price: (level: number) => number;
}
const UPGRADES: UpgradeDef[] = [
  { id: 'handling', name: 'Керування', desc: 'Швидше кермування', max: 3, price: (l) => 40 * (l + 1) },
  { id: 'armor', name: 'Броня', desc: '+1 життя на старті', max: 3, price: (l) => 70 * (l + 1) },
  { id: 'magnet', name: 'Магніт', desc: 'Притягує монети', max: 3, price: (l) => 60 * (l + 1) },
  { id: 'shield', name: 'Щит', desc: 'Поглинає удари на старті', max: 3, price: (l) => 90 * (l + 1) },
];
type CarUpgrades = Record<string, number>;
interface Store {
  tokens: number;
  up: Record<string, CarUpgrades>;
}
const STORE_KEY = 'nd_store_v1';
const store: Store = { tokens: 0, up: {} };
function loadStoreSync(): void {
  const raw = readLocal(STORE_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw) as Store;
      store.tokens = s.tokens || 0;
      store.up = s.up || {};
    } catch {
      /* ignore */
    }
  }
}
function saveStore(): void {
  persist(STORE_KEY, JSON.stringify(store));
}
function carUp(carId: string): CarUpgrades {
  if (!store.up[carId]) store.up[carId] = { handling: 0, armor: 0, magnet: 0, shield: 0 };
  return store.up[carId];
}
loadStoreSync();

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
scene.fog = new THREE.Fog(0x070b1c, 30, 120);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 500);

initTelegram('#05070f');

const ambient = new THREE.AmbientLight(0x2a3550, 0.6);
scene.add(ambient);
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.45);
moon.position.set(-20, 40, 10);
scene.add(moon);

// ===========================================================================
// Track: procedural curving centreline in (distance s, lateral) space
// ===========================================================================

const DS = 4;
const VIEW_AHEAD = 210;
const VIEW_BEHIND = 26;

interface Sample {
  s: number;
  x: number;
  z: number;
  th: number;
}
const samples: Sample[] = [{ s: 0, x: 0, z: 0, th: 0 }];
const buildHead = { s: 0, x: 0, z: 0, th: 0 };

// Smoothly varying curvature → gentle, then sharper bends.
function curvature(s: number): number {
  return 0.011 * Math.sin(s * 0.0075) + 0.006 * Math.sin(s * 0.0031 + 2.1);
}

function extendTrack(toS: number): void {
  while (buildHead.s < toS) {
    const k = curvature(buildHead.s);
    buildHead.th += k * DS;
    buildHead.x += Math.sin(buildHead.th) * DS;
    buildHead.z += -Math.cos(buildHead.th) * DS;
    buildHead.s += DS;
    samples.push({ s: buildHead.s, x: buildHead.x, z: buildHead.z, th: buildHead.th });
  }
}
extendTrack(VIEW_AHEAD);

function sampleAt(s: number): Sample {
  const first = samples[0].s;
  let i = Math.floor((s - first) / DS);
  if (i < 0) i = 0;
  if (i > samples.length - 2) i = samples.length - 2;
  const a = samples[i];
  const b = samples[i + 1];
  const t = (s - a.s) / DS;
  return { s, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, th: a.th + (b.th - a.th) * t };
}

const _v = new THREE.Vector3();
function worldOf(s: number, lat: number, y: number): THREE.Vector3 {
  const c = sampleAt(s);
  // perp (lat>0 → right): (cosθ, sinθ) in (x,z)
  return _v.set(c.x + Math.cos(c.th) * lat, y, c.z + Math.sin(c.th) * lat);
}
function headingY(s: number): number {
  return -sampleAt(s).th;
}

// ===========================================================================
// Road + sidewalk ribbons
// ===========================================================================

function makeRibbon(color: number, opts: THREE.MeshStandardMaterialParameters = {}): {
  mesh: THREE.Mesh;
  pos: Float32Array;
  index: number[];
} {
  const maxSamples = Math.ceil((VIEW_AHEAD + VIEW_BEHIND) / DS) + 6;
  const pos = new Float32Array(maxSamples * 2 * 3);
  const index: number[] = [];
  for (let i = 0; i < maxSamples - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, ...opts }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { mesh, pos, index };
}

const road = makeRibbon(0x0c1018, { roughness: 0.32, metalness: 0.72 });
const sidewalkL = makeRibbon(0x161b22, { roughness: 0.95 });
const sidewalkR = makeRibbon(0x161b22, { roughness: 0.95 });

function fillRibbon(rb: { mesh: THREE.Mesh; pos: Float32Array }, latL: number, latR: number, y: number, sStart: number, sEnd: number): void {
  let n = 0;
  for (let s = sStart; s <= sEnd; s += DS) {
    const l = worldOf(s, latL, y);
    rb.pos[n * 6] = l.x; rb.pos[n * 6 + 1] = l.y; rb.pos[n * 6 + 2] = l.z;
    const r = worldOf(s, latR, y);
    rb.pos[n * 6 + 3] = r.x; rb.pos[n * 6 + 4] = r.y; rb.pos[n * 6 + 5] = r.z;
    n++;
  }
  rb.mesh.geometry.setDrawRange(0, (n - 1) * 6);
  (rb.mesh.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  rb.mesh.geometry.computeVertexNormals();
}

// ===========================================================================
// Lights that travel along the track (neon)
// ===========================================================================

const neonLights: { light: THREE.PointLight; s: number; side: number }[] = [];
for (let i = 0; i < 3; i++) {
  const light = new THREE.PointLight(0xffffff, 60, 42, 2);
  scene.add(light);
  neonLights.push({ light, s: i * 30, side: i % 2 === 0 ? -1 : 1 });
}

// ===========================================================================
// Buildings (groups with rooftop + antenna for realism)
// ===========================================================================

const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.7, metalness: 0.5 });

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

interface Building {
  group: THREE.Group;
  body: THREE.Mesh;
  roof: THREE.Mesh;
  ant: THREE.Mesh;
  tip: THREE.Mesh;
  s: number;
  side: number;
  lat: number;
}

const BSPACE = 9;
const buildings: Building[] = [];
const perSide = Math.ceil((VIEW_AHEAD + VIEW_BEHIND) / BSPACE) + 1;

const PASTELS = [0xff9ec7, 0xffc6e0, 0x9fe0d0, 0xa0d8ff, 0xffe0a0];

function styleBuilding(b: Building): void {
  const terrain = sideTerrain(b.side);
  // Nature / water sides have no skyscrapers.
  if (terrain === 'park' || terrain === 'sea') {
    b.group.visible = false;
    return;
  }
  b.group.visible = true;
  const casino = terrain === 'casino';
  const palms = terrain === 'palms';
  const h = palms ? 6 + Math.random() * 7 : casino ? 8 + Math.random() * 12 : 9 + Math.random() * 32;
  const w = 4 + Math.random() * 4;
  const d = 5 + Math.random() * 4;
  b.body.scale.set(w, h, d);
  b.body.position.y = h / 2;
  const mat = b.body.material as THREE.MeshStandardMaterial;
  const tex = makeWindowTexture();
  tex.repeat.set(Math.round(w / 2), Math.round(h / 3));
  mat.map = tex;
  mat.emissiveMap = tex;
  mat.emissive = new THREE.Color(0xffffff);
  mat.emissiveIntensity = casino ? 0.85 : 0.45;
  mat.color.setHex(palms ? PASTELS[(Math.random() * PASTELS.length) | 0] : casino ? 0x2a2110 : activeCity.building);
  mat.needsUpdate = true;
  b.roof.scale.set(w * 0.55, 1.4, d * 0.55);
  b.roof.position.y = h + 0.7;
  const hasAnt = !palms && Math.random() < 0.5;
  b.ant.visible = hasAnt;
  b.tip.visible = hasAnt;
  if (hasAnt) {
    const al = 2 + Math.random() * 3;
    b.ant.scale.set(1, al, 1);
    b.ant.position.y = h + 1.4 + al / 2;
    b.tip.position.y = h + 1.4 + al;
  }
  b.lat = b.side * (palms ? 9 + Math.random() * 3 : 7 + Math.random() * 4);
}

for (let i = 0; i < perSide * 2; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const group = new THREE.Group();
  const body = new THREE.Mesh(buildingGeo, new THREE.MeshStandardMaterial({ color: 0x0c1020, roughness: 0.9 }));
  const roof = new THREE.Mesh(buildingGeo, new THREE.MeshStandardMaterial({ color: 0x0a0d16, roughness: 0.9 }));
  const ant = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1, 0.12), poleMat);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  group.add(body, roof, ant, tip);
  scene.add(group);
  const b: Building = { group, body, roof, ant, tip, s: Math.floor(i / 2) * BSPACE - VIEW_BEHIND, side, lat: 0 };
  styleBuilding(b);
  buildings.push(b);
}

// Neon billboards lining the road.
const billboards: { mesh: THREE.Mesh; s: number; side: number }[] = [];
for (let i = 0; i < 10; i++) {
  const bb = new THREE.Mesh(
    new THREE.PlaneGeometry(3 + Math.random() * 2, 1.2 + Math.random()),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
  );
  scene.add(bb);
  billboards.push({ mesh: bb, s: i * 16, side: i % 2 === 0 ? -1 : 1 });
}

// ===========================================================================
// Street lamps + props
// ===========================================================================

const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffdca0 });
interface Lamp {
  group: THREE.Group;
  light: THREE.PointLight;
  s: number;
  side: number;
}
const lamps: Lamp[] = [];
const LSPACE = 18;
const lampCount = Math.ceil((VIEW_AHEAD + VIEW_BEHIND) / LSPACE) + 1;
for (let i = 0; i < lampCount; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), poleMat);
  pole.position.y = 3;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lampHeadMat);
  head.position.set(-side * 1.2, 5.7, 0);
  const light = new THREE.PointLight(0xffd28a, 18, 15, 2);
  light.position.set(-side * 1.2, 5.6, 0);
  // small kerb prop (hydrant / bin)
  const prop = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.8, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x556070, roughness: 0.8 }),
  );
  prop.position.set(0, 0.4, 2);
  g.add(pole, head, light, prop);
  scene.add(g);
  lamps.push({ group: g, light, s: i * LSPACE, side });
}

// Centre-line dashes.
const laneMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
interface Dash { mesh: THREE.Mesh; s: number; }
const dashes: Dash[] = [];
const DASH_SPACE = 7;
const dashCount = Math.ceil((VIEW_AHEAD + VIEW_BEHIND) / DASH_SPACE) + 1;
for (let i = 0; i < dashCount; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 2.4), laneMat);
  scene.add(m);
  dashes.push({ mesh: m, s: i * DASH_SPACE });
}

// ===========================================================================
// Side nature (trees / palms) + water (lake / sea)
// ===========================================================================

function buildTree(): THREE.Group {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3722, roughness: 0.9 }),
  );
  trunk.position.y = 1.2;
  t.add(trunk);
  const folMat = new THREE.MeshStandardMaterial({ color: 0x2f6e3a, roughness: 0.85, emissive: 0x0c2614, emissiveIntensity: 0.35 });
  for (const [oy, r] of [[3.0, 1.7], [3.9, 1.3], [4.6, 0.9]] as [number, number][]) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 7), folMat);
    blob.position.y = oy;
    t.add(blob);
  }
  return t;
}

function buildPalm(): THREE.Group {
  const p = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.28, 6.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.9 }),
  );
  trunk.position.y = 3.25;
  trunk.rotation.z = 0.08;
  p.add(trunk);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f9e5a, roughness: 0.8, emissive: 0x0f3a20, emissiveIntensity: 0.3 });
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.2, 4), frondMat);
    const a = (i / 7) * Math.PI * 2;
    frond.position.set(Math.cos(a) * 1.1, 6.4, Math.sin(a) * 1.1);
    frond.rotation.z = Math.cos(a) * 1.2;
    frond.rotation.x = Math.sin(a) * 1.2;
    p.add(frond);
  }
  return p;
}

interface NatureProp { group: THREE.Group; tree: THREE.Group; palm: THREE.Group; s: number; }
const natureProps: NatureProp[] = [];
const NAT_SPACE = 10;
const natCount = Math.ceil((VIEW_AHEAD + VIEW_BEHIND) / NAT_SPACE) + 1;
for (let i = 0; i < natCount; i++) {
  const group = new THREE.Group();
  const tree = buildTree();
  const palm = buildPalm();
  tree.visible = false;
  palm.visible = false;
  group.add(tree, palm);
  scene.add(group);
  natureProps.push({ group, tree, palm, s: i * NAT_SPACE });
}

const waterOpts: THREE.MeshStandardMaterialParameters = {
  roughness: 0.14,
  metalness: 0.9,
  emissive: 0x0a2238,
  emissiveIntensity: 0.7,
};
const waterL = makeRibbon(0x0b1f33, waterOpts);
const waterR = makeRibbon(0x0b1f33, waterOpts);
waterL.mesh.visible = false;
waterR.mesh.visible = false;

function updateWater(rb: ReturnType<typeof makeRibbon>, terrain: Terrain, side: number, sA: number, sB: number): void {
  if (terrain !== 'sea' && terrain !== 'park') {
    rb.mesh.visible = false;
    return;
  }
  rb.mesh.visible = true;
  const near = terrain === 'park' ? ROAD_HALF + 9 : ROAD_HALF + 4;
  const far = terrain === 'park' ? ROAD_HALF + 26 : ROAD_HALF + 70;
  if (side < 0) fillRibbon(rb, -far, -near, -0.05, sA, sB);
  else fillRibbon(rb, near, far, -0.05, sA, sB);
}

// ===========================================================================
// Car builder
// ===========================================================================

interface Dims { bl: number; bw: number; bh: number; by: number; cw: number; ch: number; cl: number; cy: number; cz: number; }
const CAR_DIMS: Record<CarKind, Dims> = {
  sedan: { bl: 4.3, bw: 1.9, bh: 0.45, by: 0.6, cw: 1.7, ch: 0.55, cl: 2.0, cy: 1.05, cz: -0.05 },
  sport: { bl: 4.8, bw: 1.96, bh: 0.38, by: 0.5, cw: 1.62, ch: 0.4, cl: 1.5, cy: 0.9, cz: 0.15 },
  van: { bl: 3.9, bw: 1.96, bh: 0.5, by: 0.62, cw: 1.86, ch: 1.0, cl: 2.7, cy: 1.3, cz: 0.1 },
  classic: { bl: 4.4, bw: 1.8, bh: 0.55, by: 0.66, cw: 1.64, ch: 0.62, cl: 1.7, cy: 1.22, cz: 0.0 },
};

interface Car { group: THREE.Group; policeLights?: THREE.Mesh[]; }

function buildCar(style: CarStyle, isPlayer: boolean): Car {
  const d = CAR_DIMS[style.kind];
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: style.color,
    roughness: 0.35,
    metalness: 0.45,
    emissive: new THREE.Color(style.color),
    emissiveIntensity: isPlayer ? 0.12 : 0.85,
  });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.1, metalness: 0.9 });

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
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff6d5 }));
    lamp.position.set(sx, d.by + 0.05, front + 0.02);
    group.add(lamp);
    if (isPlayer) {
      const spot = new THREE.SpotLight(0xfff2cc, 120, 65, Math.PI / 6, 0.5, 1.5);
      spot.position.set(sx, 0.8, front + 0.1);
      spot.target.position.set(sx, 0, front - 24);
      group.add(spot);
      group.add(spot.target);
    }
  }

  const tx = d.bw * 0.34;
  for (const sx of [-tx, tx]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.26, 0.12), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
    tl.position.set(sx, d.by + 0.08, rear - 0.02);
    group.add(tl);
  }
  if (!isPlayer) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(d.cw * 0.85, 0.12, 0.7), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
    roof.position.set(0, d.cy + d.ch / 2 + 0.08, d.cz);
    group.add(roof);
  }

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
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, d.bl - 0.2), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      stripe.position.set(sx, d.by + 0.02, 0);
      group.add(stripe);
    }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.34), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
    sign.position.set(0, d.cy + d.ch / 2 + 0.12, d.cz + 0.15);
    group.add(sign);
  }

  const car: Car = { group };
  if (style.police) {
    const ly = d.cy + d.ch / 2 + 0.1;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(-0.28, ly, 0);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2233 }));
    red.position.set(0.28, ly, 0);
    group.add(blue, red);
    car.policeLights = [blue, red];
  }
  return car;
}

// ===========================================================================
// Player + traffic (in track space)
// ===========================================================================

let playerStyle = CAR_STYLES[0];
let player: Car = buildCar(playerStyle, true);
scene.add(player.group);
let playerS = 0;
let playerLat = 0;

function setPlayerCar(style: CarStyle): void {
  scene.remove(player.group);
  playerStyle = style;
  player = buildCar(style, true);
  scene.add(player.group);
}

const TRAFFIC_COLORS = [0xd23a3a, 0x3a6bff, 0xedeef2, 0x9aa3b3, 0x3fbf7a, 0xe8b53a];
const TRAFFIC_KINDS: CarKind[] = ['sedan', 'sedan', 'van', 'sport', 'classic'];
interface Traffic { car: Car; active: boolean; own: number; s: number; lat: number; }
const traffic: Traffic[] = [];
for (let i = 0; i < 10; i++) {
  const style: CarStyle = { id: 't', name: 't', color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], kind: TRAFFIC_KINDS[i % TRAFFIC_KINDS.length] };
  const car = buildCar(style, false);
  car.group.visible = false;
  scene.add(car.group);
  traffic.push({ car, active: false, own: 0, s: 0, lat: 0 });
}

function laneFree(lat: number): boolean {
  for (const t of traffic) {
    if (t.active && Math.abs(t.lat - lat) < 0.1 && t.s > playerS + 55) return false;
  }
  return true;
}
function spawnTraffic(): void {
  const free = LANES.filter(laneFree);
  if (!free.length) return;
  const t = traffic.find((c) => !c.active);
  if (!t) return;
  t.active = true;
  t.own = 4 + Math.random() * 10;
  t.lat = free[Math.floor(Math.random() * free.length)];
  t.s = playerS + 95;
  t.car.group.visible = true;
}

// ===========================================================================
// Coins (currency on the road)
// ===========================================================================

interface Coin { mesh: THREE.Mesh; active: boolean; s: number; lat: number; }
const coins: Coin[] = [];
const coinGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16);
for (let i = 0; i < 14; i++) {
  const m = new THREE.Mesh(coinGeo, new THREE.MeshStandardMaterial({ color: 0xffd54a, emissive: 0xffb000, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }));
  m.rotation.x = Math.PI / 2;
  m.visible = false;
  scene.add(m);
  coins.push({ mesh: m, active: false, s: 0, lat: 0 });
}
function spawnCoins(): void {
  // A short row of coins in one lane for a satisfying pickup streak.
  const lane = LANES[Math.floor(Math.random() * LANES.length)];
  const startS = playerS + 70;
  let placed = 0;
  for (const c of coins) {
    if (c.active) continue;
    c.active = true;
    c.lat = lane;
    c.s = startS + placed * 4;
    c.mesh.visible = true;
    placed++;
    if (placed >= 4) break;
  }
}

// ===========================================================================
// Landmarks (down the avenue, follow the curve)
// ===========================================================================

const LM_SPACING = 130;
const LM_AHEAD = 36;
// Central landmark towers removed by request — the avenue is lined with
// per-city side scenery (park/lake, palms/sea, casinos) instead.
const landmarks: { group: THREE.Group; s: number }[] = [];

function clearGroup(g: THREE.Group): void {
  while (g.children.length) g.remove(g.children[0]);
}
function buildLandmark(g: THREE.Group, city: CityTheme): void {
  clearGroup(g);
  const std = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
  const glow = (color: number) => new THREE.MeshBasicMaterial({ color });
  if (city.id === 'nyc') {
    // Statue of Liberty: stepped star base, robe, crown, raised torch, tablet.
    const green = 0x8fd0bd;
    const gmat = () => std(green, { emissive: 0x2f6f5e, emissiveIntensity: 0.55 });
    const stoneMat = std(0x8a93a3, { emissive: 0x2a3038, emissiveIntensity: 0.4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 9), stoneMat);
    base.position.y = 2.5;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 6), stoneMat);
    ped.position.y = 9.5;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.4, 13, 12), gmat());
    body.position.y = 20.5;
    const robe = new THREE.Mesh(new THREE.ConeGeometry(3.5, 5, 12), gmat());
    robe.position.y = 16.5;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 12), gmat());
    head.position.y = 28;
    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 6), gmat());
      const a = (i / 6) * Math.PI - Math.PI / 2;
      spike.position.set(Math.cos(a) * 1.6, 29.6, Math.sin(a) * 1.6);
      spike.rotation.z = -Math.cos(a) * 0.5;
      g.add(spike);
    }
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 8), gmat());
    arm.position.set(2.4, 27, 0);
    arm.rotation.z = -0.6;
    const torchCup = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 0.9, 8), std(0xb8902a, { emissive: 0x5a4010, emissiveIntensity: 0.5 }));
    torchCup.position.set(4.1, 30.4, 0);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 10), glow(0xffe08a));
    flame.position.set(4.1, 31.7, 0);
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.2, 1.6), gmat());
    tablet.position.set(-1.9, 18, 0.6);
    tablet.rotation.z = 0.4;
    g.add(base, ped, body, robe, head, arm, torchCup, flame, tablet);
  } else if (city.id === 'tokyo') {
    // Tokyo Tower: red/white lattice with two observation decks + blinking tip.
    const redLat = (r: number, h: number, y: number) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4, 3, true), new THREE.MeshBasicMaterial({ color: 0xff4438, wireframe: true }));
      m.position.y = y;
      m.rotation.y = Math.PI / 4;
      return m;
    };
    const lower = redLat(8, 20, 10);
    const upper = redLat(3.2, 18, 25);
    const core = new THREE.Mesh(new THREE.ConeGeometry(2.6, 32, 4), std(0x2a0e0e));
    core.position.y = 16;
    core.rotation.y = Math.PI / 4;
    const deck1 = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 6), std(0xff8a3a, { emissive: 0x6a2e00, emissiveIntensity: 0.6 }));
    deck1.position.y = 19;
    const deck2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 3.4), std(0xff8a3a, { emissive: 0x6a2e00, emissiveIntensity: 0.6 }));
    deck2.position.y = 31;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 10, 6), std(0xdedede));
    antenna.position.y = 39;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), glow(0xff3030));
    tip.position.y = 44;
    g.add(lower, upper, core, deck1, deck2, antenna, tip);
  } else if (city.id === 'vegas') {
    // Luxor pyramid with gold edges, marquee sign and sky beam.
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(9, 13, 4), std(0x14110c, { metalness: 0.5, roughness: 0.4 }));
    pyr.position.y = 6.5;
    pyr.rotation.y = Math.PI / 4;
    const trim = new THREE.Mesh(new THREE.ConeGeometry(9.1, 13.1, 4), new THREE.MeshBasicMaterial({ color: 0xffd400, wireframe: true }));
    trim.position.y = 6.5;
    trim.rotation.y = Math.PI / 4;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 80, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    beam.position.y = 53;
    const marquee = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 0.5), glow(0xffd400));
    marquee.position.set(0, 4, 6.4);
    const marqueeFrame = new THREE.Mesh(new THREE.BoxGeometry(7.6, 3.6, 0.4), std(0xff2d95, { emissive: 0xff2d95, emissiveIntensity: 0.8 }));
    marqueeFrame.position.set(0, 4, 6.2);
    g.add(pyr, trim, beam, marqueeFrame, marquee);
  } else {
    // Miami: stepped Art-Deco tower with neon outline + palms.
    const tones = [0xff9ec7, 0xffc6e0, 0xffe0ef];
    let y = 0;
    for (let i = 0; i < 3; i++) {
      const w = 6 - i * 1.3;
      const h = 7 - i;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), std(tones[i], { emissive: 0x3a1030, emissiveIntensity: 0.45 }));
      seg.position.y = y + h / 2;
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.5, w + 0.15), glow(i % 2 === 0 ? 0x00e5ff : 0xff2d95));
      band.position.y = y + h - 0.3;
      g.add(seg, band);
      y += h;
    }
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 4, 6), glow(0x00e5ff));
    spire.position.y = y + 2;
    g.add(spire);
    for (const px of [-4, 4, -2.5]) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 9, 6), std(0x6b4f2a));
      trunk.position.set(px, 4.5, 5);
      g.add(trunk);
      for (let i = 0; i < 7; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3.4, 4), std(0x2f9e5a, { emissive: 0x0f3a20, emissiveIntensity: 0.3 }));
        const a = (i / 7) * Math.PI * 2;
        frond.position.set(px + Math.cos(a) * 1.2, 9, 5 + Math.sin(a) * 1.2);
        frond.rotation.z = Math.cos(a) * 1.2;
        frond.rotation.x = Math.sin(a) * 1.2;
        g.add(frond);
      }
    }
  }
  // Floodlights for grandeur.
  const flood = new THREE.PointLight(0xfff2d8, 55, 90, 2);
  flood.position.set(0, 20, 14);
  g.add(flood);
  const glowRing = new THREE.PointLight(0x88aaff, 20, 40, 2);
  glowRing.position.set(0, 3, 6);
  g.add(glowRing);
}

// ===========================================================================
// Theme application
// ===========================================================================

function applyCity(city: CityTheme): void {
  activeCity = city;
  scene.background = new THREE.Color(city.bg);
  scene.fog!.color.setHex(city.fog);
  ambient.color.setHex(city.ambient);
  for (const b of buildings) styleBuilding(b);
  for (let i = 0; i < neonLights.length; i++) neonLights[i].light.color.setHex(city.neon[i % city.neon.length]);
  for (let i = 0; i < billboards.length; i++) (billboards[i].mesh.material as THREE.MeshBasicMaterial).color.setHex(city.neon[i % city.neon.length]);
  const natKind: 'tree' | 'palm' | 'none' = city.sideL === 'park' ? 'tree' : city.sideL === 'palms' ? 'palm' : 'none';
  for (const np of natureProps) {
    np.tree.visible = natKind === 'tree';
    np.palm.visible = natKind === 'palm';
  }
  for (const lm of landmarks) buildLandmark(lm.group, city);
}
let currentCity = CITIES[0];
applyCity(currentCity);

// ===========================================================================
// Rain (around the camera)
// ===========================================================================

const RAIN = 600;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN * 2 * 3);
const rOff = new Float32Array(RAIN * 3);
for (let i = 0; i < RAIN; i++) {
  rOff[i * 3] = (Math.random() - 0.5) * 60;
  rOff[i * 3 + 1] = Math.random() * 45;
  rOff[i * 3 + 2] = (Math.random() - 0.5) * 80;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.35 }));
rain.frustumCulled = false;
scene.add(rain);

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
const BASE_SPEED = 26;
const BASE_SPAWN = 1.1;
let speed = BASE_SPEED;
let spawnInterval = BASE_SPAWN;
let spawnAcc = 0;
let level = 1;
let levelDist = 0;
let totalScore = 0;
let lives = 3;
let invuln = 0;
let shake = 0;
let targetLat = 0;
// Upgrade-driven gameplay state (set in resetGame from the chosen car).
let steerSpeed = 8;
let magnetRange = 0;
let shieldCharges = 0;
let runCoins = 0;
let coinAcc = 0;
function levelTarget(lvl: number): number { return 600 + lvl * 400; }

function resetGame(): void {
  speed = BASE_SPEED;
  spawnInterval = BASE_SPAWN;
  spawnAcc = 0;
  level = 1;
  levelDist = 0;
  totalScore = 0;
  runCoins = 0;
  coinAcc = 0;
  shake = 0;
  targetLat = 0;
  playerLat = 0;
  // Apply this car's upgrades.
  const u = carUp(playerStyle.id);
  steerSpeed = 8 + u.handling * 3;
  magnetRange = u.magnet > 0 ? 1.5 + u.magnet * 1.8 : 0;
  shieldCharges = u.shield;
  lives = 3 + u.armor;
  invuln = 1.0;
  for (const t of traffic) { t.active = false; t.car.group.visible = false; }
  for (const c of coins) { c.active = false; c.mesh.visible = false; }
  player.group.visible = true;
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
    chip.onclick = () => { selectedCarId = s.id; buildChips(); };
    carRow.appendChild(chip);
  }
  const cityRow = el('city-row');
  cityRow.innerHTML = '';
  for (const c of CITIES) {
    const chip = document.createElement('div');
    chip.className = 'chip' + (c.id === selectedCityId ? ' active' : '');
    chip.textContent = c.name;
    chip.onclick = () => { selectedCityId = c.id; buildChips(); };
    cityRow.appendChild(chip);
  }
}
buildChips();

function updateHud(): void {
  el('hud-level').textContent = String(level);
  el('hud-score').textContent = String(Math.floor(totalScore));
  el('hud-coins').textContent = String(runCoins);
  const hearts = '❤'.repeat(Math.max(lives, 0));
  const shields = '🛡'.repeat(Math.max(shieldCharges, 0));
  el('hud-lives').textContent = (shields + hearts) || '—';
}
function updateTokenLabels(): void {
  el('menu-tokens').textContent = String(store.tokens);
  el('shop-tokens').textContent = String(store.tokens);
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
  shopEl.classList.add('hidden');
  crashEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  state = 'playing';
}
function gameOver(): void {
  state = 'gameover';
  hudEl.classList.add('hidden');
  store.tokens += runCoins;
  saveStore();
  updateTokenLabels();
  el('crash-score').textContent = `Дистанція: ${Math.floor(totalScore)} м · 🪙 +${runCoins}`;
  crashEl.classList.remove('hidden');
}
function showMenu(): void {
  state = 'menu';
  crashEl.classList.add('hidden');
  shopEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  updateTokenLabels();
  menuEl.classList.remove('hidden');
}
el('play-btn').onclick = startGame;
el('retry-btn').onclick = startGame;
el('menu-btn').onclick = showMenu;

// --- Shop -------------------------------------------------------------------

const shopEl = el('shop');
let shopCarId = CAR_STYLES[0].id;
function renderShop(): void {
  updateTokenLabels();
  const carsRow = el('shop-cars');
  carsRow.innerHTML = '';
  for (const s of CAR_STYLES) {
    const chip = document.createElement('div');
    chip.className = 'chip' + (s.id === shopCarId ? ' active' : '');
    chip.textContent = s.name;
    chip.onclick = () => { shopCarId = s.id; renderShop(); };
    carsRow.appendChild(chip);
  }
  const ups = el('shop-ups');
  ups.innerHTML = '';
  const u = carUp(shopCarId);
  for (const def of UPGRADES) {
    const lvl = u[def.id];
    const maxed = lvl >= def.max;
    const cost = def.price(lvl);
    const row = document.createElement('div');
    row.className = 'uprow';
    const pips = '●'.repeat(lvl) + '○'.repeat(def.max - lvl);
    row.innerHTML = `<div class="info"><div class="nm">${def.name}</div><div class="ds">${def.desc}</div><div class="pips">${pips}</div></div>`;
    const btn = document.createElement('button');
    btn.className = 'buy';
    btn.textContent = maxed ? 'МАКС' : `🪙 ${cost}`;
    btn.disabled = maxed || store.tokens < cost;
    btn.onclick = () => {
      if (store.tokens < cost || maxed) return;
      store.tokens -= cost;
      u[def.id] = lvl + 1;
      saveStore();
      hapticHit();
      renderShop();
    };
    row.appendChild(btn);
    ups.appendChild(row);
  }
}
function showShop(): void {
  state = 'menu';
  shopCarId = selectedCarId;
  menuEl.classList.add('hidden');
  renderShop();
  shopEl.classList.remove('hidden');
}
el('shop-btn').onclick = showShop;
el('shop-back').onclick = showMenu;

// Tokens may be richer in the cloud than in localStorage — merge on load.
loadCloud(STORE_KEY, (v) => {
  if (!v) return;
  try {
    const s = JSON.parse(v) as Store;
    if ((s.tokens || 0) >= store.tokens) {
      store.tokens = s.tokens || 0;
      store.up = s.up || store.up;
      updateTokenLabels();
    }
  } catch {
    /* ignore */
  }
});
updateTokenLabels();

function setTargetFromX(clientX: number): void {
  const nx = (clientX / window.innerWidth) * 2 - 1;
  targetLat = THREE.MathUtils.clamp(nx * 3.0, -2.9, 2.9);
}
let pointerDown = false;
window.addEventListener('pointerdown', (e) => { if (state !== 'playing') return; pointerDown = true; setTargetFromX(e.clientX); });
window.addEventListener('pointermove', (e) => { if (state === 'playing' && pointerDown) setTargetFromX(e.clientX); });
window.addEventListener('pointerup', () => (pointerDown = false));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

function crash(): void {
  invuln = 1.2;
  shake = 0.4;
  hapticHurt();
  // Clear nearby traffic so we don't instantly re-collide.
  for (const t of traffic) {
    if (t.active && Math.abs(t.s - playerS) < 16) { t.active = false; t.car.group.visible = false; }
  }
  if (shieldCharges > 0) {
    shieldCharges -= 1; // shield absorbs the hit
    showToast('ЩИТ!');
    updateHud();
    return;
  }
  lives -= 1;
  updateHud();
  if (lives <= 0) gameOver();
}

// ===========================================================================
// Per-frame placement helpers
// ===========================================================================

function place(obj: THREE.Object3D, s: number, lat: number, y: number): void {
  const p = worldOf(s, lat, y);
  obj.position.set(p.x, p.y, p.z);
  obj.rotation.y = headingY(s);
}

// ===========================================================================
// Loop
// ===========================================================================

const clock = new THREE.Clock();
let policePhase = 0;

function animate(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  const move = (state === 'playing' ? speed : 12) * dt;
  playerS += move;

  // Keep the track sampled around the player.
  extendTrack(playerS + VIEW_AHEAD);
  while (samples.length > 3 && samples[1].s < playerS - VIEW_BEHIND) samples.shift();

  // Recycle + place buildings.
  for (const b of buildings) {
    if (b.s < playerS - VIEW_BEHIND) { b.s += perSide * BSPACE; styleBuilding(b); }
    place(b.group, b.s, b.lat, 0);
  }
  for (const bb of billboards) {
    if (bb.s < playerS - VIEW_BEHIND) { bb.s += billboards.length * 16; }
    const ter = sideTerrain(bb.side);
    bb.mesh.visible = ter !== 'park' && ter !== 'sea';
    const p = worldOf(bb.s, bb.side * 6.4, 4 + ((bb.s * 7) % 9));
    bb.mesh.position.set(p.x, p.y, p.z);
    bb.mesh.rotation.y = headingY(bb.s) + (bb.side < 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  for (const lp of lamps) {
    if (lp.s < playerS - VIEW_BEHIND) lp.s += lamps.length * LSPACE;
    place(lp.group, lp.s, lp.side * 5.2, 0);
  }
  for (const np of natureProps) {
    if (np.s < playerS - VIEW_BEHIND) np.s += natureProps.length * NAT_SPACE;
    place(np.group, np.s, -(ROAD_HALF + 5 + (np.s % 3)), 0);
  }
  for (const dsh of dashes) {
    if (dsh.s < playerS - VIEW_BEHIND) dsh.s += dashes.length * DASH_SPACE;
    place(dsh.mesh, dsh.s, 0, 0.33);
  }
  for (const nl of neonLights) {
    if (nl.s < playerS - VIEW_BEHIND) {
      nl.s += neonLights.length * 30 + 30;
      nl.light.color.setHex(currentCity.neon[Math.floor(Math.random() * currentCity.neon.length)]);
    }
    const p = worldOf(nl.s, nl.side * 7, 5 + ((nl.s * 3) % 7));
    nl.light.position.set(p.x, p.y, p.z);
  }
  for (const lm of landmarks) {
    if (lm.s - playerS < LM_AHEAD) lm.s += landmarks.length * LM_SPACING;
    place(lm.group, lm.s, 0, 0);
  }

  // Road + sidewalk ribbons.
  const sA = playerS - VIEW_BEHIND;
  const sB = playerS + VIEW_AHEAD;
  fillRibbon(road, -ROAD_HALF, ROAD_HALF, 0.02, sA, sB);
  fillRibbon(sidewalkL, -ROAD_HALF - 2.6, -ROAD_HALF, 0.18, sA, sB);
  fillRibbon(sidewalkR, ROAD_HALF, ROAD_HALF + 2.6, 0.18, sA, sB);
  updateWater(waterL, activeCity.sideL, -1, sA, sB);
  updateWater(waterR, activeCity.sideR, 1, sA, sB);

  // Police flash.
  if (player.policeLights) {
    policePhase += dt * 6;
    const on = Math.floor(policePhase) % 2 === 0;
    (player.policeLights[0].material as THREE.MeshBasicMaterial).color.setHex(on ? 0x2244ff : 0x0a1030);
    (player.policeLights[1].material as THREE.MeshBasicMaterial).color.setHex(on ? 0x0a1030 : 0xff2233);
  }

  if (state === 'playing') {
    totalScore += move;
    levelDist += move;
    if (levelDist >= levelTarget(level)) {
      level += 1; levelDist = 0; speed += 4; spawnInterval = Math.max(0.5, spawnInterval - 0.06);
      showToast(`РІВЕНЬ ${level}`);
    }
    updateHud();
    spawnAcc += dt;
    if (spawnAcc >= spawnInterval) { spawnAcc = 0; spawnTraffic(); }
    coinAcc += dt;
    if (coinAcc >= 2.2) { coinAcc = 0; spawnCoins(); }
    if (invuln > 0) {
      invuln -= dt;
      player.group.visible = Math.floor(invuln * 12) % 2 === 0;
      if (invuln <= 0) player.group.visible = true;
    }
    playerLat += (targetLat - playerLat) * Math.min(1, dt * steerSpeed);
  }

  // Player placement with steering tilt.
  place(player.group, playerS, playerLat, 0);
  player.group.rotation.z = (targetLat - playerLat) * -0.06;

  // Coins: spin, magnet, collect, recycle.
  for (const c of coins) {
    if (!c.active) continue;
    c.mesh.rotation.z += dt * 3;
    if (c.s < playerS - 12) { c.active = false; c.mesh.visible = false; continue; }
    if (state === 'playing' && magnetRange > 0 && c.s - playerS < 18 && Math.abs(c.lat - playerLat) < magnetRange) {
      c.lat += (playerLat - c.lat) * Math.min(1, dt * 4);
    }
    place(c.mesh, c.s, c.lat, 1.0);
    c.mesh.rotation.x = Math.PI / 2; // keep coin facing up after place() yaw
    if (state === 'playing' && Math.abs(c.s - playerS) < 2.2 && Math.abs(c.lat - playerLat) < 1.1) {
      c.active = false;
      c.mesh.visible = false;
      runCoins += 1;
      hapticHit();
      updateHud();
    }
  }

  // Traffic.
  for (const t of traffic) {
    if (!t.active) continue;
    t.s += t.own * dt;
    if (t.s < playerS - 14) { t.active = false; t.car.group.visible = false; continue; }
    place(t.car.group, t.s, t.lat, 0);
    if (state === 'playing' && invuln <= 0) {
      if (Math.abs(t.s - playerS) < 2.6 && Math.abs(t.lat - playerLat) < 1.6) crash();
    }
  }

  // Camera follows the curve behind the car.
  const camP = worldOf(playerS - 7, playerLat * 0.5, 4.3);
  let shx = 0, shy = 0;
  if (shake > 0) { shake -= dt; shx = (Math.random() - 0.5) * shake; shy = (Math.random() - 0.5) * shake; }
  camera.position.set(camP.x, camP.y + shy, camP.z);
  const look = worldOf(playerS + 8, playerLat * 0.3, 1.6);
  camera.lookAt(look.x + shx, look.y, look.z);

  // Rain around the camera.
  for (let i = 0; i < RAIN; i++) {
    rOff[i * 3 + 1] -= 55 * dt;
    if (rOff[i * 3 + 1] < -5) rOff[i * 3 + 1] = 40;
    const bx = camera.position.x + rOff[i * 3];
    const by = camera.position.y + rOff[i * 3 + 1] - 20;
    const bz = camera.position.z + rOff[i * 3 + 2];
    rainPos[i * 6] = bx; rainPos[i * 6 + 1] = by; rainPos[i * 6 + 2] = bz;
    rainPos[i * 6 + 3] = bx; rainPos[i * 6 + 4] = by - 0.9; rainPos[i * 6 + 5] = bz;
  }
  (rainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;

  composer.render();
  requestAnimationFrame(animate);
}
animate();
