import * as THREE from 'three';
import { CFG } from './config.js';

const C = CFG.camera;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class ThirdPersonCamera {
  constructor(camera, dom, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.yaw = Math.PI;      // direction from the player to the camera
    this.pitch = 0.34;
    this.dist = C.dist;
    this.cur = C.dist;
    this._bind(dom);
  }

  _bind(dom) {
    let dragging = false;
    dom.addEventListener('mousedown', () => {
      dragging = true;
      if (dom.requestPointerLock && !document.pointerLockElement) {
        const p = dom.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      }
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      const locked = document.pointerLockElement === dom;
      if (!locked && !dragging) return;
      const k = locked ? 0.0026 : 0.006;
      this.yaw -= e.movementX * k;
      this.pitch = clamp(this.pitch + e.movementY * k * 0.8, 0.05, 1.15);
    });
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = clamp(this.dist + e.deltaY * 0.012, C.min, C.max);
    }, { passive: false });
  }

  update(dt, target) {
    const look = new THREE.Vector3(target.x, target.y + C.height, target.z);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);

    let d = this.dist;
    for (let s = 0.2; s <= 1.0001; s += 0.05) {
      const p = look.clone().addScaledVector(dir, this.dist * s);
      if (this._blocked(p)) { d = Math.max(1.2, this.dist * s - 0.5); break; }
    }
    this.cur = d < this.cur ? d : this.cur + (d - this.cur) * Math.min(1, dt * C.lerp);

    this.camera.position.copy(look).addScaledVector(dir, this.cur);
    if (this.camera.position.y < 0.9) this.camera.position.y = 0.9;
    this.camera.lookAt(look);
  }

  _blocked(p) {
    for (const c of this.colliders) {
      if (p.y < c.h + 0.6 && Math.abs(p.x - c.x) < c.w / 2 + 0.35 && Math.abs(p.z - c.z) < c.d / 2 + 0.35) return true;
    }
    return false;
  }
}
