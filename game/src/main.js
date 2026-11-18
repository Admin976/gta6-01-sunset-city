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
import { Missions, MISSIONS } from './missions.js';
import { Menu } from './menu.js';

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
  grd.addColorStop(0, '#2b5a92');
  grd.addColorStop(0.16, '#5f8fbe');
  grd.addColorStop(0.3, '#9dc0d6');
  grd.addColorStop(0.42, '#f4d3ae');
  grd.addColorStop(0.5, '#ffb072');
  grd.addColorStop(0.56, '#e08a5c');
  grd.addColorStop(0.62, '#6a5d6a');
  grd.addColorStop(1, '#241f33');
  g.fillStyle = grd;
  g.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

const camera = new THREE.PerspectiveCamera(CFG.camera.fov, window.innerWidth / window.innerHeight, 0.1, CFG.camera.far);

const hemi = new THREE.HemisphereLight(CFG.palette.hemiSky, CFG.palette.hemiGround, 1.25);
scene.add(hemi);
const sunLight = new THREE.DirectionalLight(CFG.palette.sunLight, 1.9);
scene.add(sunLight);
const fill = new THREE.DirectionalLight(0x9fc4e8, 0.35);
fill.position.set(-120, 60, -180);
scene.add(fill);

// sun disc low over the bay
const sunDisc = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,250,226,1)');
  grd.addColorStop(0.4, 'rgba(255,206,130,.9)');
  grd.addColorStop(1, 'rgba(255,140,70,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(240, 240, 1);
  sp.position.set(-90, 46, -430);
  return sp;
})();
scene.add(sunDisc);

const city = buildCity();
const cityGroup = createCityMeshes(city);
scene.add(cityGroup);
const lampHalos = cityGroup.getObjectByName('lampHalos');

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
const missions = new Missions(scene, city, { player, driving, police, combat, audio, hud });
const menu = new Menu();

// one car parked right where you start, so E actually does something
driving.spawn('sport', 8.5, 4.5, 0, 0xb03a2b);

const state = { mode: 'menu', health: 100, money: 1250, time: CFG.time.start, wanted: 0, district: 'Barrio Sol', dead: false };
const keys = new Set();

const SAVE_KEY = 'sunsetCity.save.v1';
const saveGame = () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      pos: [player.pos.x, player.pos.z], money: state.money, done: missions.done,
      wanted: police.wanted, time: state.time,
    }));
  } catch { /* storage full or blocked: the run just is not saved */ }
};
const loadGame = () => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { s = null; }
  if (!s || !Array.isArray(s.pos)) return;
  player.pos.set(s.pos[0], 0, s.pos[1]);
  player.group.position.copy(player.pos);
  state.money = Number.isFinite(s.money) ? s.money : state.money;
  missions.done = Array.isArray(s.done) ? s.done : [];
  state.time = Number.isFinite(s.time) ? s.time : state.time;
  if (s.wanted > 0) police.addWanted(Math.min(5, s.wanted | 0), player.pos);
};

const SHOT = new URLSearchParams(location.search).get('shot');
const title = document.getElementById('title');
const controlsBox = document.getElementById('controls');
document.getElementById('play').addEventListener('click', start);
document.getElementById('controls-btn').addEventListener('click', () => { controlsBox.hidden = !controlsBox.hidden; });

function start() {
  if (!SHOT) loadGame(); // the staging shots always start from a clean run
  state.mode = 'play';
  title.classList.add('hidden');
  canvas.focus();
  audio.start();
  const next = missions.next();
  if (next !== null) hud.banner('SUNSET CITY', 'Press Esc → Missions to take a job', 4200);
  else hud.banner('SUNSET CITY', 'All five jobs done. Welcome to the top', 4200);
}

const missionRows = () => {
  const top = missions.done.length ? Math.max(...missions.done) : 0;
  return MISSIONS.map((m) => ({
    id: m.id, title: m.title, reward: m.reward,
    done: missions.done.includes(m.id),
    locked: !missions.done.includes(m.id) && m.id > top + 1,
  }));
};

menu.bind({
  resume: () => togglePause(false),
  restart: () => restartGame(),
  retry: () => retryAfterDeath(),
  pick: (id) => { togglePause(false); missions.start(id); saveGame(); },
});

function togglePause(force) {
  if (state.mode === 'menu' || state.mode === 'over') return;
  const open = force ?? !menu.open;
  if (open) { state.mode = 'paused'; menu.showPause(missionRows()); document.exitPointerLock?.(); }
  else { state.mode = 'play'; menu.hidePause(); canvas.focus(); }
}

function restartGame() {
  menu.hidePause();
  menu.hideGameOver();
  missions.clear();
  missions.done = [];
  police.clear();
  combat.health = 100;
  combat.ammo = 48;
  state.money = 1250;
  player.pos.set(7, 0, 7);
  player.vel.set(0, 0, 0);
  state.time = CFG.time.start;
  state.mode = 'play';
  title.classList.add('hidden');
  if (driving.car) driving.exit();
  try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}

function goDown(reason) {
  if (state.dead) return;
  state.dead = true;
  missions.fail(reason);
  state.money = Math.max(0, state.money - 200);
  police.clear();
  if (driving.car) driving.exit();
  saveGame();
  menu.showGameOver(reason + '. The city took $200 off you.');
}

function retryAfterDeath() {
  state.dead = false;
  menu.hideGameOver();
  combat.health = 100;
  player.pos.set(7, 0, 7);
  player.vel.set(0, 0, 0);
  player.group.position.copy(player.pos);
  state.mode = 'play';
  canvas.focus();
}

driving.onEnter = (car) => {
  const witness = peds.list.some((p) => !p.dead && p.pos.distanceTo(car.pos) < 28);
  if (witness && !car.stolen && !car.missionCar) {
    car.stolen = true;
    police.addWanted(1, car.pos);
    state.money += 40;
    hud.toast('Grand theft auto: +$40');
  }
  saveGame();
};
driving.onCrash = (pos, impact) => {
  audio.crash();
  peds.panic(pos, 24);
  if (impact > 11) {
    police.addWanted(1, pos);
    state.money += 20;
    hud.toast('Hit and run: +$20');
  }
};
combat.onKill = (t) => {
  police.addWanted(1, t.pos);
  peds.panic(t.pos, 40);
};
missions.onMoney = (n) => {
  state.money += n;
  saveGame();
};

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') { togglePause(); return; }
  if (state.mode !== 'play') return;
  if (e.code === 'KeyE') driving.toggle();
  if (e.code === 'KeyF') aimAndPunch();
  if (e.code === 'KeyM') togglePause(true);
  if (e.code === 'KeyR' && missions.active) missions.start(missions.active.def.id);
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
  if (combat.shoot(originNow(), aimDir())) peds.panic(originNow(), 38);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- screenshot staging (?shot=city|drive|chase|mission) ----------
const shot = SHOT;
if (shot) {
  start();
  state.time = 18.3;
  hud.bannerEl.classList.remove('on');
  cam.pitch = 0.22;
  if (shot === 'city') {
    player.pos.set(16.2, 0, 36);
    player.facing = Math.PI;
    player.group.position.copy(player.pos);
    player.group.rotation.y = Math.PI;
    cam.yaw = 0.14;
    cam.pitch = 0.19;
    cam.dist = 6.6;
    traffic.cars[0].pos.set(4, 0, 8);
    traffic.cars[1].pos.set(10, 0, -6);
    traffic.cars[2].pos.set(4, 0, -26);
    traffic.cars[3].pos.set(10, 0, -46);
    for (const c of traffic.cars.slice(0, 4)) {
      c.heading = 0;
      c.group.position.copy(c.pos);
      c.group.rotation.y = 0;
    }
    driving.cars[0].pos.set(10, 0, 22);
    driving.cars[0].group.position.copy(driving.cars[0].pos);
    keys.add('KeyW');
  }
  if (shot === 'drive') {
    const car = driving.cars[0];
    car.pos.set(10.5, 0, -46);
    car.heading = 0;
    car.vel.set(0, 0, 15);
    car.group.position.copy(car.pos);
    driving.enter(car);
    car.stolen = true;
    cam.dist = 9;
    cam.pitch = 0.26;
    traffic.cars[0].pos.set(10.5, 0, -22);
    traffic.cars[1].pos.set(10.5, 0, -8);
    traffic.cars[2].pos.set(3.5, 0, -30);
    traffic.cars[3].pos.set(3.5, 0, 6);
    traffic.cars.slice(4).forEach((c, i) => {
      c.pos.set(i % 2 ? 3.5 : 10.5, 0, 30 + i * 16);
      c.heading = i % 2 ? Math.PI : 0;
      c.group.position.copy(c.pos);
      c.group.rotation.y = c.heading;
    });
    for (const c of traffic.cars.slice(0, 4)) { c.heading = 0; c.group.position.copy(c.pos); c.group.rotation.y = 0; }
    keys.add('KeyW');
  }
  if (shot === 'chase') {
    player.pos.set(7, 0, 0);
    player.facing = 0;
    player.group.position.copy(player.pos);
    cam.yaw = Math.PI;
    cam.pitch = 0.2;
    cam.dist = 7.4;
    driving.cars[0].pos.set(34, 0, -52);
    driving.cars[0].group.position.copy(driving.cars[0].pos);
    police.addWanted(4, player.pos);
    police.cars.forEach((c, i) => {
      c.pos.set(7 + (i ? -4.8 : 4.8), 0, 13 + i * 6);
      c.heading = Math.PI + (i ? -0.3 : 0.3);
      c.speed = 0;
      c.group.position.copy(c.pos);
      c.group.rotation.y = c.heading;
    });
    keys.add('KeyW');
  }
  if (shot === 'mission') {
    missions.start(1);
    player.pos.set(63, 0, 47);
    player.facing = 0;
    player.group.position.copy(player.pos);
    cam.yaw = Math.PI + 0.15;
    cam.pitch = 0.2;
    cam.dist = 7.8;
  }
}

let stepAcc = 0;
let saveAcc = 0;

function update(dt) {
  // in-game day clock
  state.time += dt * CFG.time.speed;
  if (state.time >= CFG.time.dusk) state.time = CFG.time.dawn;
  const t = (state.time - CFG.time.dawn) / (CFG.time.dusk - CFG.time.dawn);
  const ang = Math.PI * (0.14 + t * 0.9);
  const elev = Math.sin(ang);
  sunLight.position.set(Math.cos(ang) * 240, elev * 120 + 8, -200);
  sunLight.intensity = 0.55 + Math.max(0, elev) * 1.5;
  hemi.intensity = 0.75 + Math.max(0, elev) * 0.9;
  const night = state.time > 18.6 || state.time < 6.6;
  traffic.setNight(night);
  if (lampHalos) lampHalos.visible = night;

  if (state.mode !== 'play') return;
  if (shot === 'city' || shot === 'chase' || shot === 'drive') keys.add('KeyW');

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
  combat.setTargets([...peds.list, ...police.officers, ...missions.enemies]);
  combat.update(dt);
  missions.update(dt, target);

  if (police.wanted > 0 && police.cars.length === 0) police.addWanted(0, target);

  // footsteps
  if (!inCar) {
    stepAcc += player.speed * dt;
    if (stepAcc > 2.1) { stepAcc = 0; audio.step(); }
  }
  audio.engine(driving.car ? driving.speed : 0, inCar);

  if (combat.health <= 0) goDown('You were wasted in Puerto Sol');

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
    objective: missions.markerPos,
  });

  saveAcc += dt;
  if (saveAcc > 6) { saveAcc = 0; saveGame(); }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

hud.update({ health: state.health, money: state.money, time: state.time, wanted: 0, district: state.district, speed: 0, ammo: combat.ammo, ride: '' });
minimap.update(player.pos, player.facing, { police: [], objective: null });
requestAnimationFrame(frame);
window.__sunset = { scene, camera, player, cam, state, renderer, driving, traffic, peds, police, combat, audio, missions, menu };
