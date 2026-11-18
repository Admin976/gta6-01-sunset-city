import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './rng.js';

const P = CFG.palette;
const { cells, block, road, cell, half, size } = CFG.city;

// Everything is a unit-shape instance: {x,y,z,sx,sy,sz,c,rx,ry,rz}.
// One InstancedMesh per shape keeps the whole city at a handful of draw calls.
export function buildCity(seed = CFG.city.seed) {
  const rng = makeRng(seed);
  const boxes = [], glow = [], cyls = [], cones = [];
  const roads = [], blocks = [], buildings = [], colliders = [], props = [];

  const B = (x, y, z, w, h, d, c, ry = 0) => boxes.push({ x, y, z, sx: w, sy: h, sz: d, c, ry });
  const G = (x, y, z, w, h, d, c) => glow.push({ x, y, z, sx: w, sy: h, sz: d, c, ry: 0 });
  const CY = (x, y, z, r, h, c, rx = 0, rz = 0) => cyls.push({ x, y, z, sx: r, sy: h, sz: r, c, rx, rz });
  const CO = (x, y, z, r, h, c, rx = 0, rz = 0, ry = 0) => cones.push({ x, y, z, sx: r, sy: h, sz: r, c, rx, rz, ry });

  // ---------- street grid ----------
  for (let i = 0; i < cells; i++) {
    const a = -half + i * cell + road / 2;
    roads.push({ x: a, z: 0, w: road, d: size });
    roads.push({ x: 0, z: a, w: size, d: road });
  }
  for (const r of roads) {
    const vertical = r.w < r.d;
    const len = vertical ? r.d : r.w;
    for (let p = -len / 2 + 3; p < len / 2 - 3; p += 9) {
      const near = Math.round((p + half - road / 2) / cell) * cell - half + road / 2;
      if (Math.abs(p - near) < road) continue; // no dashes inside intersections
      if (vertical) B(r.x, 0.03, p, 0.32, 0.06, 4, P.line);
      else B(p, 0.03, r.z, 4, 0.06, 0.32, P.line);
    }
  }
  // zebra crossings on every approach
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    const x = -half + i * cell + road / 2, z = -half + j * cell + road / 2;
    for (let s = -1; s <= 1; s += 2) for (let k = -1; k <= 1; k++) {
      B(x + s * (road / 2 + 1.8), 0.05, z + k * 3.6, 3.2, 0.08, 2.2, P.line);
      B(x + k * 3.6, 0.05, z + s * (road / 2 + 1.8), 2.2, 0.08, 3.2, P.line);
    }
    lamp(x - road / 2 - 3, z - road / 2 - 3);
    lamp(x + road / 2 + 3, z + road / 2 + 3);
  }

  // ---------- props ----------
  function palm(x, z, s = 1) {
    const h = rng.range(4.5, 7) * s, tilt = rng.range(-0.1, 0.1);
    CY(x, h / 2, z, 0.17 * s, h, P.trunk, tilt, tilt * 0.7);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + rng.range(0, 1);
      CO(x + Math.cos(a) * 1.0, h + 0.15, z + Math.sin(a) * 1.0, 1.15 * s, 0.4, P.leaf, 1.15, 0, a);
    }
    CO(x, h + 0.3, z, 0.9 * s, 0.5, P.leaf, 0, 0, 0);
    props.push({ x, z, kind: 'palm' });
  }
  function lamp(x, z) {
    CY(x, 2.4, z, 0.09, 4.8, P.trim);
    B(x, 4.95, z, 0.55, 0.2, 0.55, P.trim);
    G(x, 4.72, z, 0.4, 0.36, 0.4, P.lamp);
  }

  // ---------- landmarks ----------
  function mall(cx, cz) {
    const w = 34, d = 34, h = 11, y0 = 0.24;
    B(cx, y0 + h / 2, cz, w, h, d, P.walls[5]);
    colliders.push({ x: cx, z: cz, w, d, h: h + y0 });
    B(cx, y0 + h + 0.4, cz, w + 1, 0.8, d + 1, P.trim);
    B(cx, y0 + h + 1.4, cz, w * 0.45, 1.8, d * 0.45, P.trim);
    for (let k = 0; k < 3; k++) G(cx, 1.8 + k * 3.2, cz + d / 2 + 0.08, w * 0.9, 1.3, 0.1, P.glass);
    G(cx, y0 + h - 2, cz + d / 2 + 0.12, 14, 2.2, 0.12, P.neon);
    for (let k = -2; k <= 2; k++) B(cx + k * 6, 1.9, cz + d / 2 + 2.4, 0.8, 3.8, 0.8, P.trim);
    B(cx, 0.3, cz + d / 2 + 5, 26, 0.1, 8, P.sidewalk);
    props.push({ x: cx, z: cz, kind: 'mall' });
  }

  function radioTower(cx, cz) {
    for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) CY(cx + ox, 14, cz + oz, 0.32, 28, P.neon);
    for (let k = 1; k <= 4; k++) {
      const s = 12 - k * 1.6;
      B(cx, k * 7, cz, s, 0.28, 0.28, P.trim, 0.75);
      B(cx, k * 7, cz, s, 0.28, 0.28, P.trim, -0.75);
    }
    CY(cx, 30, cz, 0.45, 6, P.trim);
    G(cx, 33.2, cz, 0.9, 0.9, 0.9, 0xff3a3a);
    colliders.push({ x: cx, z: cz, w: 9, d: 9, h: 30 });
    props.push({ x: cx, z: cz, kind: 'tower' });
  }

  function park(cx, cz) {
    B(cx, 0.2, cz, block - 2, 0.2, block - 2, P.grass);
    CY(cx, 0.7, cz, 3.2, 0.7, P.walls[5]);
    CY(cx, 1.4, cz, 0.5, 1.6, P.glass);
    for (const [ox, oz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) palm(cx + ox, cz + oz, 1.1);
    B(cx, 0.26, cz + 12, 28, 0.12, 4, P.sidewalk);
    props.push({ x: cx, z: cz, kind: 'park' });
  }

  function building(x, z, w, d, levels, color) {
    const h = levels * 3.4, y0 = 0.24;
    B(x, y0 + h / 2, z, w, h, d, color);
    buildings.push({ x, z, w, d, h: h + y0 });
    colliders.push({ x, z, w, d, h: h + y0 });
    B(x, y0 + h + 0.25, z, w + 0.6, 0.5, d + 0.6, P.trim);
    if (rng.chance(0.45)) B(x + rng.range(-w / 4, w / 4), y0 + h + 0.95, z, 2.4, 0.9, 2.4, P.trim);
    if (levels > 9) { CY(x, y0 + h + 2.8, z, 0.13, 5, P.trim); G(x, y0 + h + 5.4, z, 0.4, 0.4, 0.4, 0xff3a3a); }
    // sunset-lit window band, one per façade
    const fy = y0 + 1.7 + Math.floor(rng() * Math.max(1, levels - 1)) * 3.4;
    G(x, fy, z + d / 2 + 0.03, w * 0.8, 0.95, 0.06, P.glow);
    G(x, fy, z - d / 2 - 0.03, w * 0.8, 0.95, 0.06, P.glow);
    G(x + w / 2 + 0.03, fy, z, 0.06, 0.95, d * 0.8, P.glow);
    G(x - w / 2 - 0.03, fy, z, 0.06, 0.95, d * 0.8, P.glow);
  }

  // ---------- blocks ----------
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    const cx = -half + i * cell + road + block / 2;
    const cz = -half + j * cell + road + block / 2;
    blocks.push({ x: cx, z: cz, s: block });
    B(cx, 0.12, cz, block, 0.24, block, P.sidewalk);

    if (i === 5 && j === 2) { mall(cx, cz); continue; }
    if (i === 1 && j === 1) { radioTower(cx, cz); continue; }
    if (i === 6 && j === 5) { park(cx, cz); continue; }

    const coast = j === cells - 1;
    const near = 1 - Math.min(1, Math.hypot(i - 3.5, j - 3.5) / 4.6);
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      const lx = cx + (a ? 9 : -9), lz = cz + (b ? 9 : -9);
      if (rng.chance(0.1)) { palm(lx, lz); continue; }
      const levels = Math.min(12, 1 + Math.round(rng() * rng() * (4 + near * 8)));
      building(lx + rng.range(-0.8, 0.8), lz + rng.range(-0.8, 0.8), rng.range(11, 16), rng.range(11, 16),
        coast ? Math.min(levels, 3) : levels, coast ? P.walls[3] : rng.pick(P.walls));
    }
    palm(cx - block / 2 + 2, cz - block / 2 + 2);
    palm(cx + block / 2 - 2, cz + block / 2 - 2);
  }

  // ---------- coast: beach, pier, bridge ----------
  B(0, 0.06, half + 34, size + 90, 0.12, 68, P.sand);
  for (let k = 0; k < 24; k++) {
    const x = rng.range(-half - 34, half + 34), z = rng.range(half + 6, half + 58);
    if (Math.abs(x - 110) < 13) continue;
    palm(x, z, 0.95);
  }
  for (let k = 0; k < 12; k++) {
    const x = rng.range(-half, half), z = rng.range(half + 10, half + 50);
    if (Math.abs(x - 110) < 14) continue;
    CY(x, 1.1, z, 0.06, 2.2, P.trim);
    CO(x, 2.35, z, 1.5, 0.7, rng.pick([0xe8664a, 0xe8c25a, 0x5f8fb0]));
  }
  function pier(x, len) {
    B(x, 0.15, half + len / 2, 11, 0.3, len, P.trim);
    for (let z = 8; z < len; z += 14) {
      CY(x - 4.4, -0.9, half + z, 0.35, 2.4, P.trunk);
      CY(x + 4.4, -0.9, half + z, 0.35, 2.4, P.trunk);
    }
    B(x + 10, 0.25, half + len * 0.6, 4, 1.1, 8, P.boat);
    B(x + 10, 1.7, half + len * 0.6, 0.18, 2.4, 0.18, P.trim);
    B(x - 9, 0.25, half + len * 0.35, 3.4, 1, 6, P.boat);
    props.push({ x, z: half + len / 2, kind: 'pier' });
  }
  pier(-60, 84);
  pier(35, 62);

  // bridge over the bay, deck at road level so you can walk it
  (function bridge(x) {
    const z0 = half - 12, len = 120;
    B(x, 0.1, z0 + len / 2, 14, 0.45, len, P.asphalt);
    for (let k = 0; k <= len; k += 30) {
      CY(x - 6.5, -1.2, z0 + k, 0.4, 3, P.trim);
      CY(x + 6.5, -1.2, z0 + k, 0.4, 3, P.trim);
    }
    for (const s of [-1, 1]) {
      B(x + s * 7, 0.85, z0 + len / 2, 0.4, 1.2, len, P.trim);
      for (let k = 0; k < len; k += 12) CY(x + s * 7, 1.9, z0 + k, 0.12, 1.4, P.trim);
    }
    B(x, 0.3, half + len - 4, 34, 0.4, 34, P.sand); // little island at the far end
    B(x + 8, 2.2, half + len + 2, 8, 4.4, 8, P.walls[4]);
    CO(x + 8, 5.6, half + len + 2, 6.4, 3, 0xb0472f, 0, 0, 0.8);
    props.push({ x, z: z0 + len / 2, kind: 'bridge' });
  })(110);

  return { roads, blocks, buildings, colliders, props, boxes, glow, cyls, cones };
}

export function districtAt(x, z) {
  if (z > half + 2) return 'Playa Sol';
  if (x < 0 && z < 0) return 'Centro Alto';
  if (x < 0) return 'Mercado Viejo';
  if (z < 0) return 'Puerto Nuevo';
  return 'Barrio Sol';
}

export function createCityMeshes(city) {
  const group = new THREE.Group();
  const solid = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const light = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const o = new THREE.Object3D(), col = new THREE.Color();

  const inst = (geo, list, mat) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      o.position.set(b.x, b.y, b.z);
      o.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0);
      o.scale.set(b.sx, b.sy, b.sz);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      im.setColorAt(i, col.setHex(b.c));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false; // one giant batch, culling it never helps
    group.add(im);
  };

  const box = new THREE.BoxGeometry(1, 1, 1);
  inst(box, city.boxes, solid);
  inst(new THREE.CylinderGeometry(1, 1, 1, 6), city.cyls, solid);
  inst(new THREE.ConeGeometry(1, 1, 6), city.cones, solid);
  inst(box, city.glow, light);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size + 40, size + 120),
    new THREE.MeshLambertMaterial({ color: P.asphalt }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = 20;
  group.add(ground);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshLambertMaterial({ color: P.water }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.45;
  group.add(water);
  return group;
}
