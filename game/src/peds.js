import * as THREE from 'three';
import { CFG } from './config.js';

const TAU = Math.PI * 2;
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  return a + d * t;
};
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });

// One small humanoid used by both pedestrians and police officers.
export function buildPerson({ shirt = 0x4a6b8a, pants = 0x2f3542, skin = 0xc98f6a, cap = null, scale = 1 } = {}) {
  const g = new THREE.Group();
  const box = (w, h, d, c, y, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(c));
    m.position.set(0, y, z);
    g.add(m);
    return m;
  };
  box(0.56, 0.68, 0.32, shirt, 1.14);
  box(0.34, 0.34, 0.32, skin, 1.66);
  if (cap !== null) box(0.38, 0.10, 0.36, cap, 1.86);
  const limb = (x, y, h, c) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, h, 0.16), lam(c));
    m.position.y = -h / 2;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };
  const armL = limb(-0.36, 1.44, 0.60, shirt);
  const armR = limb(0.36, 1.44, 0.60, shirt);
  const legL = limb(-0.14, 0.78, 0.76, pants);
  const legR = limb(0.14, 0.78, 0.76, pants);
  g.scale.setScalar(scale);
  return { group: g, limbs: { armL, armR, legL, legR } };
}

const H = (CFG.city.block - 10) / 2;      // sidewalk walk radius around a block centre
const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const SHIRTS = [0x4a6b8a, 0x8a5a4a, 0x5f7a54, 0xa08a5a, 0x7a5f8a, 0x9c4a4a];
const SKINS = [0xc98f6a, 0xa9744f, 0xe0b48c, 0x8a5f42];

export class Peds {
  constructor(scene, city) {
    this.scene = scene;
    this.blocks = city.blocks;
    this.list = [];

    for (let k = 0; k < 16; k++) {
      const b = this.blocks[(k * 11) % this.blocks.length];
      const p = buildPerson({
        shirt: SHIRTS[k % SHIRTS.length],
        skin: SKINS[k % SKINS.length],
        pants: k % 3 ? 0x2f3542 : 0x3d3a46,
      });
      scene.add(p.group);
      const ped = {
        ...p, pos: new THREE.Vector3(), heading: 0, phase: k, health: 100, dead: false,
        panicT: 0, away: new THREE.Vector3(1, 0, 0), speed: 0,
        bx: b.x, bz: b.z, corner: k % 4, cross: null, tx: 0, tz: 0,
      };
      this.list.push(ped);
      this._next(ped, true);
      ped.pos.set(ped.tx, 0, ped.tz);
      ped.group.position.copy(ped.pos);
    }
  }

  _next(p, first = false) {
    if (!first) {
      if (p.cross) {
        p.bx = p.cross.bx;
        p.bz = p.cross.bz;
        p.corner = p.cross.corner;
        p.cross = null;
      }
      p.corner = (p.corner + 1) % 4;
      if (Math.random() < 0.32) {
        const [sx, sz] = CORNERS[p.corner];
        const lim = CFG.city.half - 24;
        const axis = Math.random() < 0.5 ? 'x' : 'z';
        let nx = p.bx, nz = p.bz, tx = 0, tz = 0, nc = 0;
        if (axis === 'x' && Math.abs(p.bx + sx * CFG.city.cell) < lim) {
          nx = p.bx + sx * CFG.city.cell;
          tx = nx - sx * H;
          tz = p.bz + sz * H;
          nc = sx > 0 ? (sz > 0 ? 3 : 0) : (sz > 0 ? 2 : 1);
        } else if (axis === 'z' && Math.abs(p.bz + sz * CFG.city.cell) < lim) {
          nz = p.bz + sz * CFG.city.cell;
          tx = p.bx + sx * H;
          tz = nz - sz * H;
          nc = sz > 0 ? (sx > 0 ? 1 : 0) : (sx > 0 ? 2 : 3);
        }
        if (nx !== p.bx || nz !== p.bz) {
          p.cross = { bx: nx, bz: nz, corner: nc };
          p.tx = tx;
          p.tz = tz;
          return;
        }
      }
    }
    const [sx, sz] = CORNERS[p.corner];
    p.tx = p.bx + sx * H;
    p.tz = p.bz + sz * H;
  }

  panic(at, radius) {
    for (const p of this.list) {
      if (p.dead) continue;
      if (p.pos.distanceTo(at) < radius) {
        p.panicT = 4 + Math.random() * 3;
        p.away.set(p.pos.x - at.x, 0, p.pos.z - at.z);
        if (p.away.lengthSq() < 0.01) p.away.set(1, 0, 0);
        p.away.normalize();
      }
    }
  }

  update(dt) {
    for (const p of this.list) {
      if (p.dead) {
        p.group.rotation.x = Math.min(Math.PI / 2, p.group.rotation.x + dt * 5);
        p.group.position.y = 0.16;
        continue;
      }
      let speed = 1.45;
      if (p.panicT > 0) {
        p.panicT -= dt;
        speed = 6.6;
        p.tx = p.pos.x + p.away.x * 12;
        p.tz = p.pos.z + p.away.z * 12;
        if (p.panicT <= 0) {
          let best = this.blocks[0], bd = Infinity;
          for (const b of this.blocks) {
            const d = (b.x - p.pos.x) ** 2 + (b.z - p.pos.z) ** 2;
            if (d < bd) { bd = d; best = b; }
          }
          p.bx = best.x;
          p.bz = best.z;
          p.corner = 0;
          this._next(p);
        }
      }

      const dx = p.tx - p.pos.x, dz = p.tz - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.05) p.heading = lerpAngle(p.heading, Math.atan2(dx, dz), Math.min(1, dt * 7));
      p.speed += (speed - p.speed) * Math.min(1, dt * 6);
      p.pos.x += Math.sin(p.heading) * p.speed * dt;
      p.pos.z += Math.cos(p.heading) * p.speed * dt;
      if (d < 0.8 && p.panicT <= 0) this._next(p);

      p.phase += p.speed * dt * 2.2;
      const a = Math.sin(p.phase) * (0.35 + Math.min(1, p.speed / 4) * 0.55);
      p.limbs.legL.rotation.x = a;
      p.limbs.legR.rotation.x = -a;
      const arm = p.panicT > 0 ? 2.2 : -a * 0.7;
      p.limbs.armL.rotation.x = arm;
      p.limbs.armR.rotation.x = p.panicT > 0 ? 2.2 : a * 0.7;

      p.group.position.set(p.pos.x, Math.abs(Math.sin(p.phase)) * 0.04, p.pos.z);
      p.group.rotation.y = p.heading;
    }
  }
}
