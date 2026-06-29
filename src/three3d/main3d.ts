import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { initTelegram, hapticHurt } from '../telegram';

// ===========================================================================
// Config: car styles and city themes
// ===========================================================================

interface CarStyle {
  id: string;
  name: string;
  color: number;
  taxi?: boolean;
  police?: boolean;
  low?: boolean;
}

const CAR_STYLES: CarStyle[] = [
  { id: 'taxi', name: 'Таксі', color: 0xffd400, taxi: true },
  { id: 'sport', name: 'Спорт', color: 0xff3b30, low: true },
  { id: 'police', name: 'Поліція', color: 0x1e3a8a, police: true },
  { id: 'classic', name: 'Класика', color: 0x14171d },
  { id: 'lime', name: 'Лайм', color: 0x7cff5a },
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

function buildCar(style: CarStyle, isPlayer: boolean): Car {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: style.color,
    roughness: 0.35,
    metalness: 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f18,
    roughness: 0.1,
    metalness: 0.9,
  });
  const cabinY = style.low ? 0.95 : 1.05;

  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 4.3), paint);
  lower.position.y = 0.6;
  group.add(lower);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.0), paint);
  cabin.position.set(0, cabinY, -0.05);
  group.add(cabin);

  const windows = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.42, 1.7), glassMat);
  windows.position.set(0, cabinY + 0.03, -0.05);
  group.add(windows);

  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.5, 0.12), glassMat);
  wind.position.set(0, cabinY - 0.05, -1.05);
  wind.rotation.x = -0.5;
  group.add(wind);

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b3, roughness: 0.3, metalness: 0.8 });
  for (const wx of [-0.92, 0.92]) {
    for (const wz of [-1.4, 1.4]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, 0.42, wz);
      group.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 12), rimMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, 0.42, wz);
      group.add(rim);
    }
  }

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.25, 0.3), tireMat);
  bumper.position.set(0, 0.45, -2.1);
  group.add(bumper);

  for (const hx of [-0.66, 0.66]) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff6d5 }),
    );
    lamp.position.set(hx, 0.62, -2.18);
    group.add(lamp);
    if (isPlayer) {
      const spot = new THREE.SpotLight(0xfff2cc, 65, 42, Math.PI / 7, 0.5, 1.6);
      spot.position.set(hx, 0.7, -2.1);
      spot.target.position.set(hx, 0, -24);
      group.add(spot);
      group.add(spot.target);
    }
  }

  for (const tx of [-0.7, 0.7]) {
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.16, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff3322 }),
    );
    tl.position.set(tx, 0.62, 2.16);
    group.add(tl);
  }

  if (style.taxi) {
    for (const sx of [-0.96, 0.96]) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.18, 4.2),
        new THREE.MeshStandardMaterial({ color: 0x111111 }),
      );
      stripe.position.set(sx, 0.62, 0);
      group.add(stripe);
    }
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.34),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
    );
    sign.position.set(0, cabinY + 0.4, 0.1);
    group.add(sign);
  }

  const car: Car = { group };
  if (style.police) {
    const lightsArr: THREE.Mesh[] = [];
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.3),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    blue.position.set(-0.28, cabinY + 0.4, 0);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xff2233 }),
    );
    red.position.set(0.28, cabinY + 0.4, 0);
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

const TRAFFIC_COLORS = [0xb02a2a, 0x2a4bb0, 0xdedede, 0x222428, 0x2f8f5a, 0xc9a227];
interface Traffic {
  car: Car;
  active: boolean;
  own: number;
}
const traffic: Traffic[] = [];
for (let i = 0; i < 10; i++) {
  const style: CarStyle = { id: 't', name: 't', color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length] };
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
