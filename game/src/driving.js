import * as THREE from 'three';
import { CFG } from './config.js';
import { buildVehicle, SPECS } from './vehicles.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = Math.PI * 2;
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  return a + d * t;
};
const COLORS = [0xd8d2c2, 0x6f8fa8, 0xd06a3c, 0x8fa06a, 0xb0a0c0, 0x3f4a58];

// Arcade car physics: velocity is split into forward/lateral, lateral is damped by grip (drift),
// buildings are hit per-axis and cost a little bodywork.
export class Driving {
  constructor(scene, city, { player, cam }) {
    this.scene = scene;
    this.player = player;
    this.cam = cam;
    this.cars = [];
    this.car = null;
    this.health = 100;
    this.speed = 0;
    this.onEnter = null;
    this.onCrash = null;
    this._bumpCd = 0;

    const xs = [...new Set(city.roads.filter((r) => r.w < r.d).map((r) => r.x))].sort((a, b) => a - b);
    const zs = [...new Set(city.roads.filter((r) => r.w > r.d).map((r) => r.z))].sort((a, b) => a - b);
    const types = Object.keys(SPECS);
    for (let k = 0; k < 8; k++) {
      const x = xs[1 + (k % (xs.length - 2))] + (k % 2 ? 4.4 : -4.4);
      const z = zs[2 + (k % (zs.length - 3))] + (k % 2 ? -18 : 18);
      this.spawn(types[k % types.length], x, z, k % 2 ? Math.PI : 0, COLORS[k % COLORS.length]);
    }
  }

  spawn(type, x, z, heading = 0, color) {
    const v = buildVehicle(type, color);
    v.group.position.set(x, 0, z);
    v.group.rotation.y = heading;
    this.scene.add(v.group);
    const car = { ...v, pos: new THREE.Vector3(x, 0, z), heading, vel: new THREE.Vector3(), health: 100, driver: false, stolen: false };
    this.cars.push(car);
    return car;
  }

  toggle() {
    if (this.car) return this.exit();
    let best = null, bd = 3.8;
    for (const c of this.cars) {
      const d = c.pos.distanceTo(this.player.pos);
      if (d < bd) { bd = d; best = c; }
    }
    if (best) this.enter(best);
  }

  enter(car) {
    this.car = car;
    car.driver = true;
    this.player.group.visible = false;
    this.health = car.health;
    this.cam.dist = 12;
    this.cam.pitch = 0.24;
    this.cam.yaw = car.heading + Math.PI;
    if (this.onEnter) this.onEnter(car);
  }

  exit() {
    const c = this.car;
    if (!c) return;
    const rx = Math.cos(c.heading), rz = -Math.sin(c.heading);
    this.player.pos.set(c.pos.x + rx * 2.6, 0, c.pos.z + rz * 2.6);
    this.player.vel.set(0, 0, 0);
    this.player.facing = c.heading;
    this.player.group.visible = true;
    c.vel.set(0, 0, 0);
    c.driver = false;
    this.car = null;
    this.speed = 0;
    this.cam.dist = CFG.camera.dist;
    this.cam.pitch = 0.34;
  }

  update(dt, keys, colliders, others) {
    const c = this.car;
    this._bumpCd = Math.max(0, this._bumpCd - dt);
    if (!c) return;
    this.health = c.health;

    const f = new THREE.Vector3(Math.sin(c.heading), 0, Math.cos(c.heading));
    const r = new THREE.Vector3(Math.cos(c.heading), 0, -Math.sin(c.heading));
    let vf = c.vel.dot(f);
    let vr = c.vel.dot(r);

    const spec = c.spec;
    const wear = c.health < 35 ? 0.6 : 1;
    const throttle = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
    const brake = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;

    if (throttle) vf += spec.accel * wear * dt * (1 - clamp(vf / spec.speed, 0, 1) * 0.75);
    if (brake) {
      if (vf > 0.5) vf -= spec.accel * 2.2 * dt;
      else vf = Math.max(-spec.speed * 0.35, vf - spec.accel * 0.7 * dt);
    }
    vf *= 1 - 0.55 * dt;                                        // drag
    if (!throttle && !brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3.0 * dt);

    const steerIn = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    const grip = clamp(Math.abs(vf) / 6, 0, 1);
    c.heading += steerIn * (0.55 + spec.grip * 0.1) * grip * dt * Math.sign(vf || 1);
    vr *= Math.exp(-spec.grip * dt);                            // lateral grip = light drift

    c.vel.copy(f).multiplyScalar(vf).addScaledVector(r, vr);
    c.pos.addScaledVector(c.vel, dt);
    this.speed = c.vel.length();

    this._collide(c, colliders, this.speed);
    for (const o of others) {
      if (o === c) continue;
      const dx = c.pos.x - o.pos.x, dz = c.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 8.4 || d2 < 1e-4) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      const push = 2.9 - d;
      c.pos.x += nx * push;
      c.pos.z += nz * push;
      const vn = c.vel.x * nx + c.vel.z * nz;
      if (vn < 0) { c.vel.x -= nx * vn * 1.3; c.vel.z -= nz * vn * 1.3; }
      this._bump(c, Math.abs(vn), 1.2);
      if (o.vel && !o.driver) { o.vel.x -= nx * 0.6; o.vel.z -= nz * 0.6; }
    }
    c.pos.x = clamp(c.pos.x, -CFG.city.half - 20, CFG.city.half + 20);
    c.pos.z = clamp(c.pos.z, -CFG.city.half - 20, CFG.city.half + 90);

    c.group.position.set(c.pos.x, 0, c.pos.z);
    c.group.rotation.y = c.heading;
    const spin = c.vel.length() * dt * 2.4 * Math.sign(vf || 1);
    for (const w of c.wheels) w.rotation.x += spin;

    this.cam.yaw = lerpAngle(this.cam.yaw, c.heading + Math.PI, Math.min(1, dt * 2.4));
  }

  _collide(c, colliders, speed) {
    const R = 1.7;   // shortcut: car is one circle, good enough for buildings
    for (const col of colliders) {
      const dx = c.pos.x - col.x, dz = c.pos.z - col.z;
      if (Math.abs(dx) > col.w / 2 + R || Math.abs(dz) > col.d / 2 + R) continue;
      const px = col.w / 2 + R - Math.abs(dx);
      const pz = col.d / 2 + R - Math.abs(dz);
      if (px < pz) { c.pos.x += Math.sign(dx || 1) * px; c.vel.x *= -0.2; }
      else { c.pos.z += Math.sign(dz || 1) * pz; c.vel.z *= -0.2; }
      this._bump(c, speed, 1);
    }
  }

  _bump(c, impact, scale) {
    const dmg = Math.max(0, impact - 3) * 1.6 * scale;
    if (dmg > 0.3) c.health = Math.max(0, c.health - dmg);
    if (dmg > 1.5 && this._bumpCd <= 0) {
      this._bumpCd = 0.35;
      if (this.onCrash) this.onCrash(c.pos, impact);
    }
  }
}
