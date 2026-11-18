import { CFG } from './config.js';

// The road map is painted once into an offscreen canvas; each frame just blits it and stamps the player.
export class Minimap {
  constructor(city) {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.size = 200;
    this.k = this.size / CFG.city.size;

    this.base = document.createElement('canvas');
    this.base.width = this.base.height = this.size;
    const g = this.base.getContext('2d');
    const toPx = (v) => v * this.k + this.size / 2;

    g.fillStyle = '#12101a';
    g.fillRect(0, 0, this.size, this.size);
    g.fillStyle = '#22303a';
    g.fillRect(0, toPx(CFG.city.half), this.size, this.size);

    g.fillStyle = '#2b2836';
    for (const b of city.blocks) {
      g.fillRect(toPx(b.x - b.s / 2), toPx(b.z - b.s / 2), b.s * this.k, b.s * this.k);
    }
    g.fillStyle = '#57506a';
    for (const r of city.roads) {
      g.fillRect(toPx(r.x - r.w / 2), toPx(r.z - r.d / 2), Math.max(1, r.w * this.k), Math.max(1, r.d * this.k));
    }
    g.fillStyle = '#c9b06a';
    for (const p of city.props) {
      if (p.kind === 'bridge' || p.kind === 'pier') g.fillRect(toPx(p.x) - 1, toPx(p.z) - 1, 2, 2);
    }
    g.strokeStyle = '#ffd9a0';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, this.size - 1, this.size - 1);
  }

  update(pos, facing) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(this.base, 0, 0);

    const px = pos.x * this.k + this.size / 2;
    const py = pos.z * this.k + this.size / 2;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - facing);
    ctx.fillStyle = '#ffe6b8';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,214,150,.75)';
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.stroke();
  }
}
