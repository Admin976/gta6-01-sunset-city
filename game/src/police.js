import * as THREE from 'three';
import { buildVehicle } from './vehicles.js';
import { buildPerson } from './peds.js';

const TAU = Math.PI * 2;
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  return a + d * t;
};
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });

// Wanted 1..5: cruisers spawn, chase, unload officers who shoot. Heat drops once the
// player has stayed out of sight for a while.
export class Police {
  constructor(scene, city, { player, driving, combat, audio }) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.driving = driving;
    this.combat = combat;
    this.audio = audio;
    this.wanted = 0;
    this.cars = [];
    this.officers = [];
    this.heat = 0;
    this.hide = 0;
    this.t = 0;
  }

  addWanted(n, at) {
    if (n <= 0 && this.wanted === 0) return;
    this.wanted = Math.min(5, Math.max(0, this.wanted + n));
    this.heat = 0;
    this.hide = 0;
    this._ensureCars(at || this.player.pos);
  }

  clear() {
    this.wanted = 0;
    this.heat = 0;
    this.hide = 0;
    for (const c of this.cars) this.scene.remove(c.group);
    for (const o of this.officers) this.scene.remove(o.group);
    this.cars = [];
    this.officers = [];
  }

  _cruiser() {
    const v = buildVehicle('sedan', 0x1b2740);
    // white doors and a white roof stripe, so a cruiser reads as police from any angle
    const white = new THREE.MeshLambertMaterial({ color: 0xf2f4f6 });
    for (const sx of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 1.9), white);
      door.position.set(sx * 0.96, 0.86, 0);
      v.group.add(door);
    }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 2.0), white);
    stripe.position.set(0, 1.33, -0.1);
    v.group.add(stripe);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.x = -0.5;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.26, 0.42), new THREE.MeshBasicMaterial({ color: 0x2a6bff }));
    blue.position.x = 0.5;
    const bar = new THREE.Group();
    bar.add(red, blue);
    bar.position.set(0, 1.98, 0.05);   // above the glass house roof, or it hides inside the cabin
    v.group.add(bar);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.16, 0.4), white);
    sign.position.set(0, 2.14, 0.05);
    v.group.add(sign);
    this.scene.add(v.group);
    return { group: v.group, wheels: v.wheels, red, blue, pos: new THREE.Vector3(), heading: 0, speed: 0, officers: 0 };
  }

  _ensureCars(at) {
    const want = this.wanted === 0 ? 0 : (this.wanted >= 4 ? 2 : 1);
    while (this.cars.length < want) {
      const c = this._cruiser();
      const a = Math.random() * TAU;
      const d = 34 + Math.random() * 16;
      c.pos.set(at.x + Math.cos(a) * d, 0, at.z + Math.sin(a) * d);
      c.heading = Math.atan2(at.x - c.pos.x, at.z - c.pos.z);
      c.group.position.copy(c.pos);
      this.cars.push(c);
    }
    while (this.cars.length > want) this.scene.remove(this.cars.pop().group);
  }

  _deploy(car) {
    const o = buildPerson({ shirt: 0x22304a, pants: 0x1b2430, cap: 0x101820 });
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    const pos = new THREE.Vector3(car.pos.x + rx * 2.2, 0, car.pos.z + rz * 2.2);
    o.group.position.copy(pos);
    this.scene.add(o.group);
    this.officers.push({ ...o, pos, heading: car.heading, health: 100, dead: false, fire: 0.8, phase: 0 });
    car.officers++;
  }

  update(dt, targetPos) {
    this.t += dt;
    if (this.wanted === 0) return;

    this.heat += dt;
    const near = this.cars.some((c) => c.pos.distanceTo(targetPos) < 35) ||
      this.officers.some((o) => !o.dead && o.pos.distanceTo(targetPos) < 22);
    if (this.heat > 8 && !near) {
      this.hide += dt;
      if (this.hide > 5) {
        this.hide = 0;
        this.heat = 0;
        this.wanted = Math.max(0, this.wanted - 1);
        this._ensureCars(targetPos);
        if (this.wanted === 0) { this.clear(); return; }
      }
    } else this.hide = 0;

    const flash = Math.sin(this.t * 9) > 0;
    for (const c of this.cars) {
      c.red.visible = flash;
      c.blue.visible = !flash;
      const d = c.pos.distanceTo(targetPos);
      if (d > 13) {
        c.heading = lerpAngle(c.heading, Math.atan2(targetPos.x - c.pos.x, targetPos.z - c.pos.z), Math.min(1, dt * 2.6));
        c.speed += (Math.min(26, 9 + this.wanted * 3.5) - c.speed) * Math.min(1, dt * 1.8);
        c.pos.x += Math.sin(c.heading) * c.speed * dt;
        c.pos.z += Math.cos(c.heading) * c.speed * dt;
        for (const w of c.wheels) w.rotation.x += c.speed * dt * 2.4;
      } else c.speed *= 0.9;
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.heading;
      // shortcut: cruisers ignore buildings, they only chase in a straight line
      if (d < 16 && c.officers < (this.wanted >= 3 ? 2 : 1)) this._deploy(c);
    }

    for (const o of this.officers) {
      if (o.dead) {
        o.group.rotation.x = Math.min(Math.PI / 2, o.group.rotation.x + dt * 5);
        continue;
      }
      const dx = targetPos.x - o.pos.x, dz = targetPos.z - o.pos.z;
      const d = Math.hypot(dx, dz);
      o.heading = lerpAngle(o.heading, Math.atan2(dx, dz), Math.min(1, dt * 5));
      if (d > 13) {
        o.pos.x += (dx / d) * 4.6 * dt;
        o.pos.z += (dz / d) * 4.6 * dt;
        o.phase += dt * 9;
        const a = Math.sin(o.phase) * 0.7;
        o.limbs.legL.rotation.x = a;
        o.limbs.legR.rotation.x = -a;
      } else {
        o.limbs.legL.rotation.x *= 0.85;
        o.limbs.legR.rotation.x *= 0.85;
        o.fire -= dt;
        if (o.fire <= 0) {
          o.fire = Math.max(0.45, 1.7 - this.wanted * 0.22);
          this.audio.gun();
          this.combat.copTracer(o.pos, targetPos);
          this.combat.damagePlayer(4 + this.wanted * 2);
        }
      }
      o.group.position.set(o.pos.x, 0, o.pos.z);
      o.group.rotation.y = o.heading;
    }
  }
}
