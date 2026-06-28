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
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070f);
scene.fog = new THREE.Fog(0x070b1c, 30, 110);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4.2, 8);
camera.lookAt(0, 1.5, -10);

initTelegram('#05070f');

// ---- Lights ----------------------------------------------------------------

scene.add(new THREE.AmbientLight(0x33405f, 0.6));
const moon = new THREE.DirectionalLight(0x9fb4ff, 0.5);
moon.position.set(-20, 40, 10);
scene.add(moon);

// A few coloured neon lights that travel with the world and recycle.
const NEON_COLORS = [0xff2d95, 0x00e5ff, 0xffb300, 0x7cff5a, 0xa05cff];
const neonLights: THREE.PointLight[] = [];
for (let i = 0; i < 6; i++) {
  const light = new THREE.PointLight(NEON_COLORS[i % NEON_COLORS.length], 60, 40, 2);
  light.position.set(i % 2 === 0 ? -7 : 7, 4 + Math.random() * 8, -i * 18);
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
reflector.position.y = 0;
scene.add(reflector);

// Glossy dark overlay so the mirror reads as wet asphalt, not glass.
const street = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 400),
  new THREE.MeshStandardMaterial({
    color: 0x0c1018,
    roughness: 0.35,
    metalness: 0.7,
    transparent: true,
    opacity: 0.55,
  }),
);
street.rotateX(-Math.PI / 2);
street.position.y = 0.01;
scene.add(street);

// Emissive lane markings that stream toward the camera (sense of speed).
const laneMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const lanes: THREE.Mesh[] = [];
for (let i = 0; i < 24; i++) {
  const lane = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 2.4), laneMat);
  lane.position.set(0, 0.03, -i * 8);
  scene.add(lane);
  lanes.push(lane);
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

// ---- Buildings (two rows lining the street, recycled for an endless road) ---

const CORRIDOR = 18 * 9; // total length before recycling
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
    b.castShadow = true;
    scene.add(b);
    buildings.push(b);
  }
}

// Neon billboard planes on some building faces.
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

// ---- Taxi (procedural, from primitives) ------------------------------------

const taxi = new THREE.Group();
const yellow = new THREE.MeshStandardMaterial({ color: 0xffd400, roughness: 0.4, metalness: 0.3 });
const dark = new THREE.MeshStandardMaterial({ color: 0x12161f, roughness: 0.3, metalness: 0.6 });

const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.2), yellow);
body.position.y = 0.7;
body.castShadow = true;
taxi.add(body);

const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2), yellow);
cabin.position.set(0, 1.25, -0.1);
taxi.add(cabin);

const glass = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.55, 1.9), dark);
glass.position.set(0, 1.27, -0.1);
glass.scale.z = 0.98;
taxi.add(glass);

const sign = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 0.25, 0.4),
  new THREE.MeshBasicMaterial({ color: 0xfff3b0 }),
);
sign.position.set(0, 1.7, 0);
taxi.add(sign);

for (const wx of [-0.9, 0.9]) {
  for (const wz of [-1.4, 1.4]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.45, wz);
    taxi.add(wheel);
  }
}

// Headlights: emissive lamps + real spotlights on the road ahead.
for (const hx of [-0.65, 0.65]) {
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff6d5 }),
  );
  lamp.position.set(hx, 0.7, -2.1);
  taxi.add(lamp);

  const spot = new THREE.SpotLight(0xfff2cc, 120, 45, Math.PI / 6, 0.4, 1.5);
  spot.position.set(hx, 0.8, -2.1);
  spot.target.position.set(hx, 0, -22);
  taxi.add(spot);
  taxi.add(spot.target);
}

taxi.position.set(0, 0, 0);
scene.add(taxi);

// ---- Snow ------------------------------------------------------------------

const snowCount = 600;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(snowCount * 3);
for (let i = 0; i < snowCount; i++) {
  snowPos[i * 3] = (Math.random() - 0.5) * 60;
  snowPos[i * 3 + 1] = Math.random() * 50;
  snowPos[i * 3 + 2] = -Math.random() * 120;
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(
  snowGeo,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.8 }),
);
scene.add(snow);

// ---- Post-processing (bloom) -----------------------------------------------

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6, // strength
  0.5, // radius
  0.6, // threshold — only bright neon / lights bloom, not whole buildings
);
composer.addPass(bloom);

// ---- Controls: drag to steer, auto drive -----------------------------------

let targetX = 0;
let pointerDown = false;
function setTargetFromX(clientX: number): void {
  const nx = (clientX / window.innerWidth) * 2 - 1; // -1..1
  targetX = THREE.MathUtils.clamp(nx * 5.5, -5.5, 5.5);
}
window.addEventListener('pointerdown', (e) => {
  pointerDown = true;
  setTargetFromX(e.clientX);
});
window.addEventListener('pointermove', (e) => {
  if (pointerDown) setTargetFromX(e.clientX);
});
window.addEventListener('pointerup', () => (pointerDown = false));

// ---- Resize ----------------------------------------------------------------

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

  // Stream the world toward the camera and recycle past objects.
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

  // Snow fall + recycle.
  const p = snow.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < snowCount; i++) {
    let y = p.getY(i) - 8 * dt;
    let z = p.getZ(i) + dz;
    if (y < 0) y = 50;
    if (z > 14) z -= 120;
    p.setY(i, y);
    p.setZ(i, z);
  }
  p.needsUpdate = true;

  // Taxi steering with a little roll for feel.
  taxi.position.x += (targetX - taxi.position.x) * Math.min(1, dt * 6);
  taxi.rotation.z = (targetX - taxi.position.x) * -0.04;
  taxi.rotation.y = (targetX - taxi.position.x) * -0.03;

  // Chase camera.
  camera.position.x += (taxi.position.x * 0.6 - camera.position.x) * Math.min(1, dt * 4);
  camera.lookAt(taxi.position.x * 0.4, 1.6, -14);

  composer.render();
  requestAnimationFrame(animate);
}
animate();
