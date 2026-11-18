import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './rng.js';

const P = CFG.palette;
const { cells, block, road, cell, half, size } = CFG.city;

// Facade / window / awning palettes: Puerto Sol is a warm pastel town, not a grey grid.
const FACADE = [0xf2e2c4, 0xfaf5ec, 0xc0634a, 0x86a8c8, 0xf3d089, 0x7fb3a6, 0xd9b89a, 0xb9c4d6];
const AWNING = [0xc0392b, 0x2e6f5e, 0xd68910, 0x2f4b7c, 0x8e44ad, 0xc25b8a];
const SHOP_NAMES = ['CAFÉ SOL', 'PANADERÍA REYES', 'FARMACIA LUNA', 'MERCADO VIEJO', 'HOTEL MARIPOSA', 'AGUAS PUERTO', 'RADIO SOL 88.5', 'COBRA AZUL'];

// Everything is a unit-shape instance: {x,y,z,sx,sy,sz,c,rx,ry,rz}.
// One InstancedMesh per shape keeps the whole city at a handful of draw calls.
export function buildCity(seed = CFG.city.seed) {
  const rng = makeRng(seed);
  const boxes = [], glow = [], cyls = [], cones = [], halos = [];
  const roads = [], blocks = [], buildings = [], colliders = [], props = [], signs = [];

  const B = (x, y, z, w, h, d, c, ry = 0, rx = 0) => boxes.push({ x, y, z, sx: w, sy: h, sz: d, c, ry, rx });
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
      if (vertical) B(r.x, 0.035, p, 0.3, 0.07, 4.2, P.line);
      else B(p, 0.035, r.z, 4.2, 0.07, 0.3, P.line);
    }
  }
  // zebra crossings on every approach
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    const x = -half + i * cell + road / 2, z = -half + j * cell + road / 2;
    for (let s = -1; s <= 1; s += 2) for (let k = -1; k <= 1; k++) {
      B(x + s * (road / 2 + 2.2), 0.06, z + k * 3.8, 3.6, 0.09, 2.0, P.cross);
      B(x + k * 3.8, 0.06, z + s * (road / 2 + 2.2), 2.0, 0.09, 3.6, P.cross);
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
  function tree(x, z, s = 1) {
    CY(x, 1.5 * s, z, 0.2 * s, 3 * s, P.trunk);
    CO(x, 4.0 * s, z, 1.7 * s, 2.4 * s, 0x3d7a4e);
    CO(x, 5.1 * s, z, 1.2 * s, 1.7 * s, 0x46875a);
    props.push({ x, z, kind: 'tree' });
  }
  function lamp(x, z) {
    CY(x, 2.4, z, 0.09, 4.8, P.trim);
    B(x, 4.95, z, 0.55, 0.2, 0.55, P.trim);
    G(x, 4.72, z, 0.45, 0.36, 0.45, P.lamp);
    halos.push({ x, y: 4.7, z });
  }

  // ---------- landmarks ----------
  function mall(cx, cz) {
    const w = 34, d = 34, h = 11, y0 = 0.24;
    B(cx, y0 + h / 2, cz, w, h, d, 0xe6dcc8);
    colliders.push({ x: cx, z: cz, w, d, h: h + y0 });
    B(cx, y0 + h + 0.4, cz, w + 1, 0.8, d + 1, P.trim);
    B(cx, y0 + h + 1.4, cz, w * 0.45, 1.8, d * 0.45, P.trim);
    for (let k = 0; k < 3; k++) G(cx, 1.8 + k * 3.2, cz + d / 2 + 0.08, w * 0.9, 1.3, 0.1, P.glass);
    G(cx, y0 + h - 2, cz + d / 2 + 0.12, 14, 2.2, 0.12, P.neon);
    for (let k = -2; k <= 2; k++) B(cx + k * 6, 1.9, cz + d / 2 + 2.4, 0.8, 3.8, 0.8, P.trim);
    B(cx, 0.3, cz + d / 2 + 5, 26, 0.1, 8, P.sidewalk);
    signs.push({ x: cx, y: y0 + h + 3.2, z: cz + d / 2 + 0.4, ry: 0, text: 'CENTRO SOL', color: '#ff7a4d' });
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
    signs.push({ x: cx, y: 16, z: cz + 4.6, ry: 0, text: 'RADIO SOL 88.5', color: '#ffb25e' });
    props.push({ x: cx, z: cz, kind: 'tower' });
  }

  function park(cx, cz) {
    B(cx, 0.2, cz, block - 2, 0.2, block - 2, P.grass);
    CY(cx, 0.7, cz, 3.2, 0.7, 0xe6dcc8);
    CY(cx, 1.4, cz, 0.5, 1.6, P.glass);
    for (const [ox, oz] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) palm(cx + ox, cz + oz, 1.1);
    for (const [ox, oz] of [[-6, 8], [6, -8], [10, 12], [-10, -4]]) tree(cx + ox, cz + oz, 0.95);
    B(cx, 0.26, cz + 12, 28, 0.12, 4, P.sidewalk);
    props.push({ x: cx, z: cz, kind: 'park' });
  }

  // big local billboard: pole, two legs and a lit panel (the text is painted in createCityMeshes)
  function billboard(x, z, ry, text, color) {
    CY(x - 3.4, 4, z, 0.2, 8, P.trim);
    CY(x + 3.4, 4, z, 0.2, 8, P.trim);
    B(x, 10.5, z, 9.6, 0.5, 0.5, P.trim, ry);
    signs.push({ x, y: 12.2, z, ry, text, color, w: 10, h: 3.6 });
    B(x, 12.2, z - 0.2, 10.4, 4.2, 0.3, 0x2a2733, ry);
    props.push({ x, z, kind: 'billboard' });
  }

  // traffic light: pole on the corner, arm over the road, one three-lamp head per approach
  function signal(x, z, state) {
    const px = x - 10, pz = z - 10;
    CY(px, 3, pz, 0.1, 6, P.trim);
    B(px + 2.4, 5.85, pz, 5, 0.16, 0.16, P.trim);
    B(px + 4.6, 4.9, pz, 0.62, 2.0, 0.5, 0x23222a);
    const on = (dy, c, active) => G(px + 4.9, 4.9 + dy, pz + 0.28, 0.34, 0.34, 0.06, active ? c : 0x403840);
    on(0.62, 0xff3a3a, state === 'stop');
    on(0, 0xffc23a, false);
    on(-0.62, 0x4ce07a, state === 'go');
    // the cross street gets the opposite head
    const qx = x + 10, qz = z + 10;
    CY(qx, 3, qz, 0.1, 6, P.trim);
    B(qx - 2.4, 5.85, qz, 5, 0.16, 0.16, P.trim);
    B(qx - 4.6, 4.9, qz, 0.62, 2.0, 0.5, 0x23222a);
    G(qx - 4.9, 5.52, qz - 0.28, 0.34, 0.34, 0.06, state === 'go' ? 0xff3a3a : 0x403840);
    G(qx - 4.9, 4.9, qz - 0.28, 0.34, 0.34, 0.06, 0x403840);
    G(qx - 4.9, 4.28, qz - 0.28, 0.34, 0.34, 0.06, state === 'stop' ? 0x4ce07a : 0x403840);
  }

  for (const [x, z, s] of [[7, -49, 'go'], [63, 7, 'stop'], [7, 63, 'stop'], [-49, -49, 'go'], [119, -105, 'go']]) signal(x, z, s);

  // ---------- buildings ----------
  const WIN_DARK = 0x35485c, WIN_LIT = 0xffd39a, WIN_COOL = 0x6f93aa;

  function building(x, z, w, d, levels, color, { shop = true, sign = false } = {}) {
    const h = levels * 3.4, y0 = 0.24;
    B(x, y0 + h / 2, z, w, h, d, color);
    buildings.push({ x, z, w, d, h: h + y0 });
    colliders.push({ x, z, w, d, h: h + y0 });
    B(x, y0 + h + 0.25, z, w + 0.6, 0.5, d + 0.6, 0x8d8272);

    // window grid: one small pane per bay, warm or cool, a few dark
    const colsX = Math.max(3, Math.min(6, Math.round(w / 3)));
    const colsZ = Math.max(3, Math.min(6, Math.round(d / 3)));
    const floors = Math.min(7, Math.max(1, levels - 1));
    for (let f = 0; f < floors; f++) {
      const wy = y0 + 2.5 + f * 3.4;
      if (wy > y0 + h - 0.9) break;
      for (let c = 0; c < colsX; c++) {
        const ox = (c - (colsX - 1) / 2) * (w / (colsX + 0.2));
        const lit = rng.chance(0.35);
        const cc = lit ? WIN_LIT : (rng.chance(0.5) ? WIN_COOL : WIN_DARK);
        G(x + ox, wy, z + d / 2 + 0.05, Math.min(1.35, w / (colsX + 0.5)), 1.6, 0.07, cc);
        G(x + ox, wy, z - d / 2 - 0.05, Math.min(1.35, w / (colsX + 0.5)), 1.6, 0.07, cc);
      }
      // a thin floor ledge under each row reads as storeys, not one tall slab
      B(x, wy - 1.55, z, w + 0.18, 0.14, d + 0.18, 0x9a8f80);
      for (let c = 0; c < colsZ; c++) {
        const oz = (c - (colsZ - 1) / 2) * (d / (colsZ + 0.2));
        const lit = rng.chance(0.3);
        const cc = lit ? WIN_LIT : WIN_DARK;
        G(x + w / 2 + 0.05, wy, z + oz, 0.07, 1.6, Math.min(1.35, d / (colsZ + 0.5)), cc);
        G(x - w / 2 - 0.05, wy, z + oz, 0.07, 1.6, Math.min(1.35, d / (colsZ + 0.5)), cc);
      }
    }

    // ground floor shop: glazed front and a coloured awning on the street side
    if (shop && levels <= 9 && rng.chance(0.82)) {
      G(x, y0 + 1.35, z + d / 2 + 0.07, w * 0.86, 2.0, 0.07, 0x3f6274);
      B(x, y0 + 2.62, z + d / 2 + 0.85, w * 0.92, 0.16, 1.7, rng.pick(AWNING), 0, 0.2);
      B(x, y0 + 2.7, z + d / 2 + 0.1, w * 0.9, 0.1, 0.1, 0xf2ead8);
    }

    // rooftop clutter: water tank, AC units, parapet sign
    if (rng.chance(0.55)) {
      const tx = x + rng.range(-w / 4, w / 4), tz = z + rng.range(-d / 4, d / 4);
      CY(tx, y0 + h + 1.5, tz, 1.05, 2.2, 0x9a8b76);
      for (const [ax, az] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) CY(tx + ax, y0 + h + 0.55, tz + az, 0.09, 0.7, 0x6a6155);
    }
    if (rng.chance(0.6)) B(x + rng.range(-w / 4, w / 4), y0 + h + 0.8, z + rng.range(-d / 4, d / 4), 1.7, 0.85, 1.3, 0xa8b0b8);
    if (levels > 9) { CY(x, y0 + h + 2.8, z, 0.13, 5, P.trim); G(x, y0 + h + 5.4, z, 0.4, 0.4, 0.4, 0xff3a3a); }
    if (sign && levels >= 2) {
      signs.push({ x, y: y0 + h + 2.2, z: z + d / 2 + 0.2, ry: 0, text: rng.pick(SHOP_NAMES), color: rng.pick(['#ff7a4d', '#ffd76a', '#7de0c0', '#ff9ec4']), w: Math.min(w, 11), h: 1.6 });
    }
  }

  // ---------- blocks ----------
  let signBudget = 22;
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
      const sign = signBudget > 0 && levels > 2 && rng.chance(0.35);
      if (sign) signBudget--;
      building(lx + rng.range(-0.8, 0.8), lz + rng.range(-0.8, 0.8), rng.range(11, 16), rng.range(11, 16),
        coast ? Math.min(levels, 3) : levels, coast ? rng.pick([0xe9dfc9, 0x93b8ac, 0xf0d489]) : rng.pick(FACADE), { sign });
    }
    palm(cx - block / 2 + 2, cz - block / 2 + 2);
    tree(cx + block / 2 - 2.5, cz - block / 2 + 2.5, 0.9);
    tree(cx - block / 2 + 2.5, cz + block / 2 - 2.5, 0.9);
  }

  billboard(-14, 28, 0.4, 'COBRA AZUL', '#e8453c');
  billboard(100, 58, -0.5, 'PLAYA SOL', '#2fb39a');

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
    B(x + 8, 2.2, half + len + 2, 8, 4.4, 8, 0xe9dfc9);
    CO(x + 8, 5.6, half + len + 2, 6.4, 3, 0xb0472f, 0, 0, 0.8);
    props.push({ x, z: z0 + len / 2, kind: 'bridge' });
  })(110);

  return { roads, blocks, buildings, colliders, props, boxes, glow, cyls, cones, halos, signs };
}

export function districtAt(x, z) {
  if (z > half + 2) return 'Playa Sol';
  if (x < 0 && z < 0) return 'Centro Alto';
  if (x < 0) return 'Mercado Viejo';
  if (z < 0) return 'Puerto Nuevo';
  return 'Barrio Sol';
}

// A canvas-textured panel per sign: cheap, and the only way to get readable local names.
function signMesh(s) {
  const w = s.w || 9, h = s.h || 1.4;
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * (h / w));
  const g = c.getContext('2d');
  g.fillStyle = '#1a1622';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = s.color;
  g.lineWidth = 14;
  g.strokeRect(7, 7, c.width - 14, c.height - 14);
  g.fillStyle = s.color;
  g.font = `bold ${Math.round(c.height * 0.5)}px ui-monospace, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(s.text, c.width / 2, c.height * 0.53, c.width * 0.9);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: true }),
  );
  m.position.set(s.x, s.y, s.z);
  m.rotation.y = s.ry || 0;
  return m;
}

export function createCityMeshes(city) {
  const group = new THREE.Group();
  const solid = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const light = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const o = new THREE.Object3D(), col = new THREE.Color();

  const inst = (geo, list, mat, name) => {
    if (!list.length) return null;
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
    if (name) im.name = name;
    group.add(im);
    return im;
  };

  const box = new THREE.BoxGeometry(1, 1, 1);
  inst(box, city.boxes, solid);
  inst(new THREE.CylinderGeometry(1, 1, 1, 6), city.cyls, solid);
  inst(new THREE.ConeGeometry(1, 1, 6), city.cones, solid);
  inst(box, city.glow, light);

  // soft additive halos around the lamp heads: dark until dusk, then the street lights bloom
  const halo = inst(box, city.halos.map((h) => ({ ...h, sx: 1.9, sy: 1.9, sz: 1.9, c: 0xffc37a })),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }), 'lampHalos');
  if (halo) halo.visible = false;

  for (const s of city.signs) group.add(signMesh(s));

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
