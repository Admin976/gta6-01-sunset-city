import * as THREE from 'three';
import { CFG } from './config.js';
import { buildCity, createCityMeshes, districtAt } from './city.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(CFG.palette.fog, CFG.fog.near, CFG.fog.far);
scene.background = skyTexture();

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#221838');
  grd.addColorStop(0.42, '#6d3560');
  grd.addColorStop(0.68, '#d95b3c');
  grd.addColorStop(0.88, '#ffa85e');
  grd.addColorStop(1, '#ffd79a');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

const camera = new THREE.PerspectiveCamera(CFG.camera.fov, window.innerWidth / window.innerHeight, 0.1, CFG.camera.far);

const hemi = new THREE.HemisphereLight(CFG.palette.hemiSky, CFG.palette.hemiGround, 1.15);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(CFG.palette.sunLight, 1.45);
scene.add(sunLight);

// sun disc low over the bay
const sunDisc = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,244,214,1)');
  grd.addColorStop(0.45, 'rgba(255,206,130,.85)');
  grd.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(150, 150, 1);
  sp.position.set(240, 34, 420);
  return sp;
})();
scene.add(sunDisc);

const city = buildCity();
scene.add(createCityMeshes(city));

const player = new Player(scene);
const cam = new ThirdPersonCamera(camera, canvas, city.colliders);
const hud = new HUD();
const minimap = new Minimap(city);

const state = { mode: 'menu', health: 100, money: 1250, time: CFG.time.start, wanted: 0, district: 'Barrio Sol', cine: false };
const keys = new Set();

const title = document.getElementById('title');
const controlsBox = document.getElementById('controls');
document.getElementById('play').addEventListener('click', start);
document.getElementById('controls-btn').addEventListener('click', () => { controlsBox.hidden = !controlsBox.hidden; });

function start() {
  state.mode = 'play';
  title.classList.add('hidden');
  canvas.focus();
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  start();
  if (shot === 'city') {
    state.cine = true;
    player.pos.set(60, 0, 150);
  }
}

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();

function update(dt) {
  // in-game day clock
  state.time += dt * CFG.time.speed;
  if (state.time >= CFG.time.dusk) state.time = CFG.time.dawn;
  const t = (state.time - CFG.time.dawn) / (CFG.time.dusk - CFG.time.dawn);
  const ang = Math.PI * (0.12 + t * 0.76);
  sunLight.position.set(Math.cos(ang) * 240, Math.sin(ang) * 150 + 12, -200);
  sunLight.intensity = 0.35 + Math.max(0, Math.sin(ang)) * 1.25;
  hemi.intensity = 0.45 + Math.max(0, Math.sin(ang)) * 0.85;

  if (state.mode !== 'play') return;

  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  right.crossVectors(fwd, camera.up).normalize();

  const ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const iz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  wish.set(0, 0, 0).addScaledVector(right, ix).addScaledVector(fwd, iz);
  if (wish.lengthSq() > 0) wish.normalize();

  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  player.update(dt, wish, running, keys.has('Space'), city.colliders, CFG.player.bounds);
  cam.update(dt, player.pos);

  state.district = districtAt(player.pos.x, player.pos.z);
  hud.update({ health: state.health, money: state.money, time: state.time, wanted: state.wanted, district: state.district, speed: player.speed });
  minimap.update(player.pos, player.facing);
}

function cinematic(now) {
  const a = now * 0.00004;
  camera.position.set(Math.cos(a) * 250, 120, Math.sin(a) * 250 + 40);
  camera.lookAt(0, 8, 0);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  if (state.cine) cinematic(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

hud.update({ health: state.health, money: state.money, time: state.time, wanted: 0, district: state.district, speed: 0 });
minimap.update(player.pos, player.facing);
requestAnimationFrame(frame);
window.__sunset = { scene, camera, player, cam, state, renderer };
