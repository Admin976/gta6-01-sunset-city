import * as THREE from 'three';

const DEAD = 1e-4;

// Punch, pistol, health and the little hit effects. Targets are supplied by main each frame
// (peds + officers) so this file never needs to know who they are.
export class Combat {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.health = 100;
    this.ammo = 48;
    this.cool = 0;
    this.targets = [];
    this.fx = [];
    this.onKill = null;
    this.onHit = null;
    this._geo = new THREE.BoxGeometry(1, 1, 1);
  }

  setTargets(list) { this.targets = list; }

  damagePlayer(n) {
    this.health = Math.max(0, this.health - n);
  }

  shoot(origin, dir) {
    if (this.cool > 0) return false;
    if (this.ammo <= 0) { this.audio.dry(); this.cool = 0.3; return false; }
    this.cool = 0.24;
    this.ammo--;
    this.audio.gun();

    const from = origin.clone();
    from.y += 1.3;
    let hit = null, best = 55;
    for (const t of this.targets) {
      if (t.dead) continue;
      const tx = t.pos.x - from.x, ty = (t.pos.y || 0) + 1.05 - from.y, tz = t.pos.z - from.z;
      const proj = tx * dir.x + ty * dir.y + tz * dir.z;
      if (proj < 0.5 || proj > best) continue;
      const px = tx - dir.x * proj, py = ty - dir.y * proj, pz = tz - dir.z * proj;
      if (Math.sqrt(px * px + py * py + pz * pz) > 1.0) continue;
      best = proj;
      hit = t;
    }
    const end = from.clone().addScaledVector(dir, hit ? best : 40);
    this._flash(from, dir);
    this._tracer(from, end, 0xffe08a, 0.07);
    if (hit) this._damage(hit, 34, end);
    return true;
  }

  punch(origin, dir) {
    if (this.cool > 0) return;
    this.cool = 0.36;
    this.audio.punch();
    const aim = dir.clone().setY(0).normalize();
    for (const t of this.targets) {
      if (t.dead) continue;
      const dx = t.pos.x - origin.x, dz = t.pos.z - origin.z;
      const d = Math.hypot(dx, dz);
      if (d > 2.5) continue;
      if ((dx * aim.x + dz * aim.z) / (d || DEAD) < 0.45) continue;
      this._damage(t, 30, new THREE.Vector3(t.pos.x, (t.pos.y || 0) + 1.1, t.pos.z));
      break;
    }
  }

  copTracer(from, to) {
    const a = from.clone();
    a.y += 1.25;
    const b = to.clone();
    b.y += 1.1;
    this._tracer(a, b, 0xff9a6a, 0.06);
  }

  _damage(t, amount, at) {
    t.health -= amount;
    this._sparks(at);
    if (this.onHit) this.onHit(t);
    if (t.health <= 0 && !t.dead) {
      t.dead = true;
      if (this.onKill) this.onKill(t);
    }
  }

  _tracer(a, b, color, life) {
    const len = a.distanceTo(b);
    if (len < 0.01) return;
    const m = new THREE.Mesh(this._geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, fog: false }));
    m.scale.set(0.05, 0.05, len);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    this.scene.add(m);
    this.fx.push({ mesh: m, life, max: life, vel: null });
  }

  _flash(at, dir) {
    const m = new THREE.Mesh(this._geo, new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, fog: false }));
    m.scale.setScalar(0.26);
    m.position.copy(at).addScaledVector(dir, 0.6);
    this.scene.add(m);
    this.fx.push({ mesh: m, life: 0.05, max: 0.05, vel: null });
  }

  _sparks(at) {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(this._geo, new THREE.MeshBasicMaterial({ color: 0xffc36a, transparent: true, fog: false }));
      m.scale.setScalar(0.09);
      m.position.copy(at);
      this.scene.add(m);
      this.fx.push({
        mesh: m, life: 0.3, max: 0.3,
        vel: new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 3.5, (Math.random() - 0.5) * 5),
      });
    }
  }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.fx.splice(i, 1);
        continue;
      }
      if (f.vel) {
        f.vel.y -= 9 * dt;
        f.mesh.position.addScaledVector(f.vel, dt);
      }
      f.mesh.material.opacity = f.life / f.max;
    }
  }
}
