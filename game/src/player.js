import * as THREE from 'three';
import { CFG } from './config.js';

const S = CFG.player;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

export class Player {
  constructor(scene) {
    this.pos = new THREE.Vector3(7, 0, 7);
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.phase = 0;
    this.speed = 0;
    this.onGround = true;

    const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
    const part = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    const g = this.group = new THREE.Group();

    const torso = part(0.62, 0.74, 0.36, 0x3b6ea5); torso.position.y = 1.18;
    const head = part(0.38, 0.38, 0.36, 0xc98f6a); head.position.y = 1.74;
    const hair = part(0.42, 0.16, 0.4, 0x2a1f1a); hair.position.y = 1.9;
    const nape = part(0.38, 0.26, 0.1, 0x2a1f1a); nape.position.set(0, 1.72, -0.15);
    const nose = part(0.1, 0.1, 0.12, 0xc98f6a); nose.position.set(0, 1.72, 0.2);

    // limbs hang from pivots at the joint so the swing looks right
    const limb = (x, y, w, h, d, c) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      const m = part(w, h, d, c);
      m.position.y = -h / 2;
      pivot.add(m);
      g.add(pivot);
      return pivot;
    };
    const armL = limb(-0.4, 1.5, 0.16, 0.68, 0.16, 0x3b6ea5);
    const armR = limb(0.4, 1.5, 0.16, 0.68, 0.16, 0x3b6ea5);
    const legL = limb(-0.16, 0.8, 0.22, 0.8, 0.22, 0x2f3542);
    const legR = limb(0.16, 0.8, 0.22, 0.8, 0.22, 0x2f3542);

    g.add(torso, head, hair, nape, nose);
    this.limbs = { armL, armR, legL, legR };
    g.position.copy(this.pos);
    scene.add(g);
  }

  update(dt, wish, run, jump, colliders, bound) {
    const target = run ? S.run : S.walk;
    const mx = wish.x * target, mz = wish.z * target;
    this.vel.x = approach(this.vel.x, mx, S.accel * dt);
    this.vel.z = approach(this.vel.z, mz, S.accel * dt);
    if (wish.lengthSq() === 0 && this.onGround) {
      this.vel.x = approach(this.vel.x, 0, S.friction * dt);
      this.vel.z = approach(this.vel.z, 0, S.friction * dt);
    }

    if (jump && this.onGround) { this.vel.y = S.jump; this.onGround = false; }
    this.vel.y -= S.gravity * dt;

    // axis by axis so a wall slide keeps the other component
    this._move('x', this.vel.x * dt, colliders, bound);
    this._move('z', this.vel.z * dt, colliders, bound);

    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.speed > 0.25) this.facing = Math.atan2(this.vel.x, this.vel.z);
    this.phase += this.speed * dt * 1.9;

    const sw = Math.min(1, this.speed / S.run);
    const a = Math.sin(this.phase) * (0.35 + sw * 0.55);
    this.limbs.legL.rotation.x = a;
    this.limbs.legR.rotation.x = -a;
    this.limbs.armL.rotation.x = -a * 0.8;
    this.limbs.armR.rotation.x = a * 0.8;
    this.group.position.set(this.pos.x, this.pos.y + Math.abs(Math.sin(this.phase)) * 0.045 * sw, this.pos.z);
    this.group.rotation.y = this.facing;
  }

  _move(axis, d, colliders, bound) {
    if (!d) return;
    const key = axis === 'x' ? 'x' : 'z';
    const r = S.radius;
    this.pos[key] += d;
    for (const c of colliders) {
      if (this.pos.y > c.h - 0.2) continue;
      if (Math.abs(this.pos.x - c.x) > c.w / 2 + r) continue;
      if (Math.abs(this.pos.z - c.z) > c.d / 2 + r) continue;
      const lo = key === 'x' ? c.x - c.w / 2 : c.z - c.d / 2;
      const hi = key === 'x' ? c.x + c.w / 2 : c.z + c.d / 2;
      this.pos[key] = d > 0 ? Math.min(this.pos[key], lo - r) : Math.max(this.pos[key], hi + r);
      this.vel[key] = 0;
    }
    this.pos.x = clamp(this.pos.x, -CFG.city.half - S.bounds, CFG.city.half + S.bounds);
    this.pos.z = clamp(this.pos.z, -CFG.city.half - 10, CFG.city.half + 70);
  }
}
