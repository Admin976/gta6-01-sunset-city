import * as THREE from 'three';
import { CFG } from './config.js';
import { buildCity, createCityMeshes, districtAt } from './city.js';
import { Player } from './player.js';
import { ThirdPersonCamera } from './camera.js';
import { HUD } from './hud.js';
import { Minimap } from './minimap.js';
import { GameAudio } from './audio.js';
import { Driving } from './driving.js';
import { Traffic } from './traffic.js';
import { Peds } from './peds.js';
import { Police } from './police.js';
import { Combat } from './combat.js';

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

const audio = new GameAudio();
const combat = new Combat(scene, audio);
const driving = new Driving(scene, city, { player, cam });
const traffic = new Traffic(scene, city);
const peds = new Peds(scene, city);
const police = new Police(scene, city, { player, driving, combat, audio });
traffic.audio = audio;

// one car parked right where you start, so E actually does something
driving.spawn('sport', 8.5, 4.5, 0, 0xb03a2b);

// destination marker (mall forecourt), drawn on the minimap and as a light column
const objective = new THREE.Vector3(91, 0, -52);
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, 26, 8, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, fog: false }),
);
beacon.position.set(objective.x, 13, objective.z);
scene.add(beacon);

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
  audio.start();
}

driving.onEnter = (car) => {
  const witness = peds.list.some((p) => !p.dead && p.pos.distanceTo(car.pos) < 28);
  if (witness && !car.stolen) {
    car.stolen = true;
    police.addWanted(1, car.pos);
  }
};
driving.onCrash = (pos, impact) => {
  audio.crash();
  peds.panic(pos, 24);
  if (impact > 11) police.addWanted(1, pos);
};
combat.onKill = (t) => {
  police.addWanted(1, t.pos);
  peds.panic(t.pos, 40);
};

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (state.mode !== 'play') return;
  if (e.code === 'KeyE') driving.toggle();
  if (e.code === 'KeyF') aimAndPunch();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const aim = new THREE.Vector3();

function originNow() {
  return driving.car ? driving.car.pos.clone() : player.pos.clone();
}

function aimDir() {
  camera.getWorldDirection(aim);
  return aim.clone().normalize();
}

function aimAndPunch() {
  combat.punch(originNow(), aimDir());
}

canvas.addEventListener('mousedown', (e) => {
  if (state.mode !== 'play') return;
  if (e.button === 2) { aimAndPunch(); return; }
  if (e.button !== 0) return;
  const c = combat;
  if (c.shoot(originNow(), aimDir())) {
    peds.panic(originNow(), 38);
  }
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

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
  if (shot === 'chase') {
    player.pos.set(7, 0, -34);
    player.facing = 0;
    police.addWanted(3, player.pos);
    police.cars.forEach((c, i) => {
      c.pos.set(7 + (i ? -4.5 : 4.5), 0, -24 - i * 6);
      c.heading = Math.PI;
      c.speed = 12;
      c.group.position.copy(c.pos);
      c.group.rotation.y = c.heading;
    });
    cam.yaw = Math.PI;
  }
  if (shot === 'drive') {
    const car = driving.cars[0];
    car.pos.set(7, 0, -30);
    car.heading = 0;
    car.vel.set(0, 0, 19);
    car.group.position.copy(car.pos);
    driving.enter(car);
    keys.add('KeyW');
  }
}

let stepAcc = 0;

function update(dt) {
  // in-game day clock
  state.time += dt * CFG.time.speed;
  if (state.time >= CFG.time.dusk) state.time = CFG.time.dawn;
  const t = (state.time - CFG.time.dawn) / (CFG.time.dusk - CFG.time.dawn);
  const ang = Math.PI * (0.12 + t * 0.76);
  sunLight.position.set(Math.cos(ang) * 240, Math.sin(ang) * 150 + 12, -200);
  sunLight.intensity = 0.35 + Math.max(0, Math.sin(ang)) * 1.25;
  hemi.intensity = 0.45 + Math.max(0, Math.sin(ang)) * 0.85;
  traffic.setNight(state.time > 19.2 || state.time < 6.6);

  if (state.mode !== 'play') return;

  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  right.crossVectors(fwd, camera.up).normalize();

  const ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const iz = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  wish.set(0, 0, 0).addScaledVector(right, ix).addScaledVector(fwd, iz);
  if (wish.lengthSq() > 0) wish.normalize();

  const inCar = !!driving.car;
  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (!inCar) player.update(dt, wish, running, keys.has('Space'), city.colliders, CFG.player.bounds);
  else player.group.position.set(player.pos.x, 0, player.pos.z); // keep the hidden body at the wheel

  driving.update(dt, keys, city.colliders, [...traffic.cars, ...police.cars]);

  const target = driving.car ? driving.car.pos : player.pos;
  cam.update(dt, target);

  traffic.update(dt, target, driving.car);
  peds.update(dt);
  police.update(dt, target);
  combat.setTargets([...peds.list, ...police.officers]);
  combat.update(dt);

  if (police.wanted > 0 && police.cars.length === 0) police.addWanted(0, target);

  // footsteps
  if (!inCar) {
    stepAcc += player.speed * dt;
    if (stepAcc > 2.1) { stepAcc = 0; audio.step(); }
  }
  audio.engine(driving.car ? driving.speed : 0, inCar);

  if (combat.health <= 0) {
    combat.health = 100;
    if (driving.car) driving.exit();
    player.pos.set(7, 0, 7);
    player.vel.set(0, 0, 0);
    state.money = Math.max(0, state.money - 200);
    police.clear();
  }

  state.health = combat.health;
  state.wanted = police.wanted;
  state.district = districtAt(target.x, target.z);
  const speed = driving.car ? driving.speed : player.speed;
  hud.update({
    health: state.health, money: state.money, time: state.time, wanted: state.wanted,
    district: state.district, speed, ammo: combat.ammo,
    ride: driving.car ? driving.car.spec.name : '',
  });
  minimap.update(target, driving.car ? driving.car.heading : player.facing, {
    police: [...police.cars.map((c) => c.pos), ...police.officers.filter((o) => !o.dead).map((o) => o.pos)],
    objective,
  });
  beacon.rotation.y += dt * 0.6;
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

hud.update({ health: state.health, money: state.money, time: state.time, wanted: 0, district: state.district, speed: 0, ammo: combat.ammo, ride: '' });
minimap.update(player.pos, player.facing, { police: [], objective });
requestAnimationFrame(frame);
window.__sunset = { scene, camera, player, cam, state, renderer, driving, traffic, peds, police, combat, audio };
