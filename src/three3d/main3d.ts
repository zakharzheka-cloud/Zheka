import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { initTelegram } from '../telegram';

// ---- Renderer / scene / camera --------------------------------------------

const canvas = document.getElementById('app') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);
scene.fog = new THREE.Fog(0x070b1c, 28, 105);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4.2, 8);
camera.lookAt(0, 1.5, -10);

initTelegram('#05070f');

// ---- Lights ----------------------------------------------------------------

scene.add(new THREE.AmbientLight(0x2a3550, 0.55));
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.45);
moon.position.set(-20, 40, 10);
scene.add(moon);

const NEON_COLORS = [0xff2d95, 0x00e5ff, 0xffb300, 0x7cff5a, 0xa05cff];
const neonLights: THREE.PointLight[] = [];
for (let i = 0; i < 3; i++) {
  const light = new THREE.PointLight(NEON_COLORS[i % NEON_COLORS.length], 55, 38, 2);
  light.position.set(i % 2 === 0 ? -7 : 7, 5 + Math.random() * 7, -i * 26);
  scene.add(light);
  neonLights.push(light);
}

// ---- Wet-asphalt street with real reflections ------------------------------

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

// Raised sidewalks down both sides.
for (const side of [-1, 1]) {
  const walk = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.3, 400),
    new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.95 }),
  );
  walk.position.set(side * 7, 0.15, 0);
  scene.add(walk);
}

// Emissive lane markings streaming toward the camera (sense of speed).
const laneMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const lanes: THREE.Mesh[] = [];
for (let i = 0; i < 24; i++) {
  const lane = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 2.4), laneMat);
  lane.position.set(0, 0.32, -i * 8);
  scene.add(lane);
  lanes.push(lane);
}

// ---- Street lamps (warm pools of light) ------------------------------------

const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffdca0 });
const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.7, metalness: 0.5 });
const lamps: { group: THREE.Group; light: THREE.PointLight }[] = [];
for (let i = 0; i < 6; i++) {
  const side = i % 2 === 0 ? -1 : 1;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), poleMat);
  pole.position.y = 3;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), poleMat);
  arm.position.set(-side * 0.7, 5.8, 0);
  g.add(arm);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), lampHeadMat);
  head.position.set(-side * 1.3, 5.7, 0);
  g.add(head);
  const light = new THREE.PointLight(0xffd28a, 22, 16, 2);
  light.position.set(-side * 1.3, 5.6, 0);
  g.add(light);
  g.position.set(side * 5.4, 0, -i * 16);
  scene.add(g);
  lamps.push({ group: g, light });
}

// ---- Procedural building windows texture -----------------------------------

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

// ---- Buildings (recycled corridor) -----------------------------------------

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
  const color = NEON_COLORS[i % NEON_COLORS.length];
  const bb = new THREE.Mesh(
    new THREE.PlaneGeometry(3 + Math.random() * 2, 1.2 + Math.random()),
    new THREE.MeshBasicMaterial({ color }),
  );
  const side = i % 2 === 0 ? -1 : 1;
  bb.position.set(side * 6.4, 4 + Math.random() * 10, -i * 16);
  bb.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(bb);
  billboards.push(bb);
}

// ---- Car builder (used for the player taxi and for traffic) -----------------

interface Car {
  group: THREE.Group;
  headlights: THREE.SpotLight[];
}

function buildCar(bodyColor: number, isTaxi: boolean): Car {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.35,
    metalness: 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0a0f18,
    roughness: 0.1,
    metalness: 0.9,
  });

  // Lower body + hood/trunk for a car-like silhouette.
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 4.3), paint);
  lower.position.y = 0.6;
  group.add(lower);

  // Greenhouse (cabin), set back and narrower.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.0), paint);
  cabin.position.set(0, 1.05, -0.05);
  group.add(cabin);

  // Windows wrapping the cabin.
  const windows = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.42, 1.7), glassMat);
  windows.position.set(0, 1.08, -0.05);
  group.add(windows);

  // Sloped windshield.
  const wind = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.5, 0.12), glassMat);
  wind.position.set(0, 1.0, -1.05);
  wind.rotation.x = -0.5;
  group.add(wind);

  // Wheels with rims.
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

  // Front bumper.
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.25, 0.3), tireMat);
  bumper.position.set(0, 0.45, -2.1);
  group.add(bumper);

  // Headlights (emissive) + real spotlights.
  const head: THREE.SpotLight[] = [];
  for (const hx of [-0.66, 0.66]) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.16, 0.1),
      new THREE.MeshBasicMaterial({ color: 0xfff6d5 }),
    );
    lamp.position.set(hx, 0.62, -2.18);
    group.add(lamp);
    const spot = new THREE.SpotLight(0xfff2cc, isTaxi ? 65 : 30, 42, Math.PI / 7, 0.5, 1.6);
    spot.position.set(hx, 0.7, -2.1);
    spot.target.position.set(hx, 0, -24);
    group.add(spot);
    group.add(spot.target);
    head.push(spot);
  }

  // Taillights (red, emissive).
  for (const tx of [-0.7, 0.7]) {
    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.16, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff3322 }),
    );
    tl.position.set(tx, 0.62, 2.16);
    group.add(tl);
  }

  // Taxi-only: checker stripe + roof sign.
  if (isTaxi) {
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
    sign.position.set(0, 1.45, 0.1);
    group.add(sign);
  }

  return { group, headlights: head };
}

const taxi = buildCar(0xffd400, true);
scene.add(taxi.group);

// ---- Traffic ---------------------------------------------------------------

const TRAFFIC_COLORS = [0xb02a2a, 0x2a4bb0, 0xdedede, 0x222428, 0x2f8f5a];
interface Traffic {
  car: Car;
  lane: number; // x position
  oncoming: boolean;
  rel: number; // relative speed
}
const traffic: Traffic[] = [];
function placeTraffic(t: Traffic): void {
  t.oncoming = Math.random() < 0.5;
  t.lane = (t.oncoming ? -1 : 1) * (1.8 + Math.random() * 0.8);
  t.rel = t.oncoming ? 18 + Math.random() * 10 : -(6 + Math.random() * 6);
  t.car.group.position.set(t.lane, 0, -40 - Math.random() * 80);
  t.car.group.rotation.y = t.oncoming ? Math.PI : 0;
}
for (let i = 0; i < 5; i++) {
  const car = buildCar(TRAFFIC_COLORS[i % TRAFFIC_COLORS.length], false);
  scene.add(car.group);
  const t: Traffic = { car, lane: 0, oncoming: false, rel: 0 };
  placeTraffic(t);
  traffic.push(t);
}

// ---- Rain ------------------------------------------------------------------

const RAIN = 700;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN * 2 * 3);
const rainX = new Float32Array(RAIN);
const rainY = new Float32Array(RAIN);
const rainZ = new Float32Array(RAIN);
for (let i = 0; i < RAIN; i++) {
  rainX[i] = (Math.random() - 0.5) * 50;
  rainY[i] = Math.random() * 40;
  rainZ[i] = -Math.random() * 110;
}
function writeRain(): void {
  for (let i = 0; i < RAIN; i++) {
    const o = i * 6;
    rainPos[o] = rainX[i];
    rainPos[o + 1] = rainY[i];
    rainPos[o + 2] = rainZ[i];
    rainPos[o + 3] = rainX[i];
    rainPos[o + 4] = rainY[i] - 0.9;
    rainPos[o + 5] = rainZ[i];
  }
  rainGeo.attributes.position.needsUpdate = true;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
writeRain();
const rain = new THREE.LineSegments(
  rainGeo,
  new THREE.LineBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0.35 }),
);
scene.add(rain);

// ---- Post-processing (bloom) -----------------------------------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,
  0.5,
  0.6,
);
composer.addPass(bloom);

// ---- Controls --------------------------------------------------------------

let targetX = 0;
let pointerDown = false;
function setTargetFromX(clientX: number): void {
  const nx = (clientX / window.innerWidth) * 2 - 1;
  targetX = THREE.MathUtils.clamp(nx * 4.2, -4.2, 4.2);
}
window.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  setTargetFromX(e.clientX);
});
window.addEventListener('pointermove', (e) => {
  if (pointerDown) setTargetFromX(e.clientX);
});
window.addEventListener('pointerup', () => (pointerDown = false));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Animation loop --------------------------------------------------------

const clock = new THREE.Clock();
const SPEED = 26;

function animate(): void {
  const dt = Math.min(clock.getDelta(), 0.05);
  const dz = SPEED * dt;

  for (const b of buildings) {
    b.position.z += dz;
    if (b.position.z > 14) {
      b.position.z -= CORRIDOR;
      styleBuilding(b);
      b.position.x = (b.position.x < 0 ? -1 : 1) * (9 + Math.random() * 3);
    }
  }
  for (const lane of lanes) {
    lane.position.z += dz;
    if (lane.position.z > 12) lane.position.z -= 24 * 8;
  }
  for (const { group } of lamps) {
    group.position.z += dz;
    if (group.position.z > 14) group.position.z -= 6 * 16;
  }
  for (let i = 0; i < neonLights.length; i++) {
    const l = neonLights[i];
    l.position.z += dz;
    if (l.position.z > 14) {
      l.position.z -= CORRIDOR;
      l.color.setHex(NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]);
    }
  }
  for (const bb of billboards) {
    bb.position.z += dz;
    if (bb.position.z > 14) bb.position.z -= 10 * 16;
  }
  for (const t of traffic) {
    t.car.group.position.z += dz + t.rel * dt;
    if (t.car.group.position.z > 16 || t.car.group.position.z < -150) placeTraffic(t);
  }

  // Rain fall + recycle.
  for (let i = 0; i < RAIN; i++) {
    rainY[i] -= 55 * dt;
    rainZ[i] += dz;
    if (rainY[i] < 0) {
      rainY[i] = 40;
      rainX[i] = (Math.random() - 0.5) * 50;
    }
    if (rainZ[i] > 14) rainZ[i] -= 110;
  }
  writeRain();

  // Taxi steering with a little body roll.
  taxi.group.position.x += (targetX - taxi.group.position.x) * Math.min(1, dt * 6);
  taxi.group.rotation.z = (targetX - taxi.group.position.x) * -0.05;
  taxi.group.rotation.y = (targetX - taxi.group.position.x) * -0.03;

  camera.position.x += (taxi.group.position.x * 0.6 - camera.position.x) * Math.min(1, dt * 4);
  camera.lookAt(taxi.group.position.x * 0.4, 1.6, -14);

  composer.render();
  requestAnimationFrame(animate);
}
animate();
