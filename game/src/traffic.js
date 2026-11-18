import * as THREE from 'three';
import { CFG } from './config.js';
import { buildVehicle } from './vehicles.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = Math.PI * 2;
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  return a + d * t;
};
const TYPES = ['sedan', 'pickup', 'van', 'sport'];

// NPC cars drive the city's own road grid: nodes are intersections, cars hop node to node
// and keep to the right of the travel direction. They stop for the player and each other.
export class Traffic {
  constructor(scene, city) {
    this.scene = scene;
    this.cars = [];
    this.audio = null;
    this.night = false;
    this._lit = false;

    const xs = [...new Set(city.roads.filter((r) => r.w < r.d).map((r) => r.x))].sort((a, b) => a - b);
    const zs = [...new Set(city.roads.filter((r) => r.w > r.d).map((r) => r.z))].sort((a, b) => a - b);
    this.xs = xs;
    this.zs = zs;

    const n = Math.min(12, (xs.length - 1) * (zs.length - 1));
    for (let k = 0; k < n; k++) {
      const i = 1 + ((k * 3) % (xs.length - 2));
      const j = 1 + ((k * 5) % (zs.length - 2));
      const alongX = k % 2 === 0;
      const v = buildVehicle(TYPES[k % TYPES.length]);
      scene.add(v.group);
      const car = {
        group: v.group, wheels: v.wheels, head: v.headlights, spec: v.spec,
        pos: new THREE.Vector3(), heading: 0, speed: 0, max: 8 + (k % 4),
        i, j, pi: i, pj: j,
        ti: alongX ? clamp(i + 1, 0, xs.length - 1) : i,
        tj: alongX ? j : clamp(j + 1, 0, zs.length - 1),
        hornCd: 0,
      };
      this._place(car);
      this.cars.push(car);
    }
  }

  _node(i, j) { return { x: this.xs[i], z: this.zs[j] }; }

  // point on the right-hand lane toward the target node
  _point(car) {
    const t = this._node(car.ti, car.tj);
    const dx = t.x - car.pos.x, dz = t.z - car.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const fz = dz / len, fx = dx / len;
    return { x: t.x + fz * 2.8, z: t.z - fx * 2.8 };
  }

  _place(car) {
    const p = this._point(car);
    car.pos.set(p.x, 0, p.z);
    car.heading = Math.atan2(this.xs[car.ti] - car.pos.x, this.zs[car.tj] - car.pos.z);
    car.group.position.copy(car.pos);
    car.group.rotation.y = car.heading;
  }

  _advance(car) {
    const from = { i: car.i, j: car.j };
    car.i = car.ti;
    car.j = car.tj;
    const opts = [
      [car.i + 1, car.j], [car.i - 1, car.j], [car.i, car.j + 1], [car.i, car.j - 1],
    ].filter(([i, j]) => i >= 0 && j >= 0 && i < this.xs.length && j < this.zs.length && !(i === from.i && j === from.j));
    const pick = opts.length ? opts[Math.floor(Math.random() * opts.length)] : [from.i, from.j];
    car.ti = pick[0];
    car.tj = pick[1];
  }

  setNight(on) {
    this.night = on;
    if (on === this._lit) return;
    this._lit = on;
    for (const c of this.cars) for (const h of c.head) h.visible = on;
  }

  update(dt, playerPos, playerCar) {
    for (const car of this.cars) {
      let p = this._point(car);
      let dx = p.x - car.pos.x, dz = p.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      car.heading = lerpAngle(car.heading, desired, Math.min(1, dt * 2.8));

      let want = dist < 10 ? 4.5 : car.max;
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const blockedBy = (x, z, gap) => {
        const ax = x - car.pos.x, az = z - car.pos.z;
        const ahead = ax * fx + az * fz;
        const side = Math.abs(ax * fz - az * fx);
        return ahead > 0.5 && ahead < gap && side < 2.4;
      };
      if (blockedBy(playerPos.x, playerPos.z, 9) || (playerCar && blockedBy(playerCar.pos.x, playerCar.pos.z, 9))) want = 0;
      for (const o of this.cars) if (o !== car && blockedBy(o.pos.x, o.pos.z, 7)) { want = 0; break; }

      car.speed += (want - car.speed) * Math.min(1, dt * (want < car.speed ? 6 : 2.2));
      car.pos.x += fx * car.speed * dt;
      car.pos.z += fz * car.speed * dt;
      car.group.position.set(car.pos.x, 0, car.pos.z);
      car.group.rotation.y = car.heading;
      for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.4;

      if (dist < 4.5) this._advance(car);

      car.hornCd = Math.max(0, car.hornCd - dt);
      if (want < 0.5 && car.hornCd <= 0 && car.pos.distanceTo(playerPos) < 14 && Math.random() < dt * 0.35) {
        car.hornCd = 4;
        if (this.audio) this.audio.horn();
      }
    }
    this.setNight(this.night);
  }
}
