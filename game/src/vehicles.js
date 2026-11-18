import * as THREE from 'three';

// speed = top speed m/s, accel = m/s^2, grip = lateral damping (higher sticks harder).
// cab = [length, height, z offset]. All four bodies are built from boxes + cylinders.
export const SPECS = {
  sedan:  { name: 'Vela Sedan',  speed: 27, accel: 11.0, grip: 7.5, len: 4.3, wid: 1.90, body: 0.72, cab: [2.00, 0.62, 0.00], color: 0xd8d2c2 },
  pickup: { name: 'Dune Pickup', speed: 24, accel: 9.5,  grip: 6.2, len: 4.9, wid: 2.00, body: 0.80, cab: [1.60, 0.72, 0.75], color: 0x9c5a3c },
  van:    { name: 'Bay Van',     speed: 21, accel: 8.0,  grip: 5.4, len: 5.1, wid: 2.05, body: 0.90, cab: [3.00, 1.10, -0.10], color: 0xb9c2c8 },
  sport:  { name: 'Sol GT',      speed: 38, accel: 18.0, grip: 9.2, len: 4.4, wid: 1.95, body: 0.58, cab: [1.80, 0.50, -0.10], color: 0xc0392b },
};

const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const lit = (c) => new THREE.MeshBasicMaterial({ color: c });

export function buildVehicle(type = 'sedan', color) {
  const s = SPECS[type] || SPECS.sedan;
  const g = new THREE.Group();
  const paint = color ?? s.color;
  const L = s.len, W = s.wid, y0 = 0.5;

  const box = (w, h, d, c, x, y, z, material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || lam(c));
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  box(W, s.body, L, paint, 0, y0 + s.body / 2, 0);                       // hull
  box(W * 0.97, 0.16, L * 0.98, 0x1e1c22, 0, y0 - 0.02, 0);              // skirt
  const [cl, ch, cz] = s.cab;
  box(W * 0.88, ch, cl, 0x2a3a46, 0, y0 + s.body + ch / 2, cz);          // glass house
  box(W * 0.90, 0.08, cl * 0.99, paint, 0, y0 + s.body + ch + 0.02, cz); // roof

  if (type === 'pickup') {
    box(W * 0.90, 0.30, 1.70, 0x4d4238, 0, y0 + s.body + 0.14, -1.45);   // bed floor
    box(W * 0.94, 0.44, 0.18, paint, 0, y0 + s.body + 0.28, -L / 2 + 0.10);
  }
  if (type === 'van') box(W * 0.82, 0.52, 0.06, 0x22303c, 0, y0 + s.body + 0.22, L / 2 - 0.02);
  if (type === 'sport') {
    box(W * 1.04, 0.10, 0.45, 0x17161c, 0, y0 + s.body + 0.42, -L / 2 + 0.20);
    box(0.10, 0.30, 0.10, 0x17161c, -W * 0.35, y0 + s.body + 0.22, -L / 2 + 0.20);
    box(0.10, 0.30, 0.10, 0x17161c, W * 0.35, y0 + s.body + 0.22, -L / 2 + 0.20);
  }

  const headlights = [], taillights = [];
  for (const sx of [-1, 1]) {
    headlights.push(box(0.42, 0.16, 0.08, 0, sx * W * 0.32, y0 + s.body * 0.62, L / 2 + 0.02, lit(0xfff1c0)));
    taillights.push(box(0.40, 0.16, 0.08, 0, sx * W * 0.32, y0 + s.body * 0.62, -L / 2 - 0.02, lit(0xff3a2a)));
  }

  const wheels = [];
  const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.30, 8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * (W / 2 + 0.02), 0.42, sz * L * 0.31);
    const tyre = new THREE.Mesh(geo, lam(0x181820));
    tyre.rotation.z = Math.PI / 2;
    pivot.add(tyre);
    g.add(pivot);
    wheels.push(pivot);
  }

  return { group: g, spec: s, type, wheels, headlights, taillights };
}
