import { CFG } from './config.js';

// The map is painted once into an offscreen canvas from the city data; each frame just blits it and
// stamps the player, the police and the current objective on top.
const WORLD = 560;   // world units the 200x200 map covers, centred on the city
const OFF = WORLD / 2;

export class Minimap {
  constructor(city) {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.size = 200;
    this.k = this.size / WORLD;

    this.base = document.createElement('canvas');
    this.base.width = this.base.height = this.size;
    const g = this.base.getContext('2d');
    const X = (v) => (v + OFF) * this.k;

    // sea under everything, then the landmass and the beach strip along the south shore
    g.fillStyle = '#123444';
    g.fillRect(0, 0, this.size, this.size);
    g.fillStyle = '#1d2129';
    g.fillRect(X(-236), X(-236), 472 * this.k, 460 * this.k);
    g.fillStyle = '#c9ae7c';
    g.fillRect(X(-236), X(224), 472 * this.k, 68 * this.k);

    // blocks dark, roads pale and thick to their real width
    g.fillStyle = '#2a2f3b';
    for (const b of city.blocks) {
      const s = b.s * this.k;
      g.fillRect(X(b.x) - s / 2, X(b.z) - s / 2, s, s);
    }
    g.fillStyle = '#6f6a7e';
    for (const r of city.roads) {
      g.fillRect(X(r.x - r.w / 2), X(r.z - r.d / 2), Math.max(2, r.w * this.k), Math.max(2, r.d * this.k));
    }
    // lane dashes on the two centre lines of every road, so the grid reads as streets and not a grid
    g.strokeStyle = 'rgba(240,226,180,.45)';
    g.lineWidth = 1;
    g.setLineDash([3, 4]);
    for (const r of city.roads) {
      const vertical = r.w < r.d;
      g.beginPath();
      if (vertical) { g.moveTo(X(r.x), X(-CFG.city.half)); g.lineTo(X(r.x), X(CFG.city.half)); }
      else { g.moveTo(X(-CFG.city.half), X(r.z)); g.lineTo(X(CFG.city.half), X(r.z)); }
      g.stroke();
    }
    g.setLineDash([]);

    // park, piers, bridge
    for (const p of city.props) {
      if (p.kind === 'park') {
        g.fillStyle = '#3f6b4a';
        const s = (CFG.city.block - 2) * this.k;
        g.fillRect(X(p.x) - s / 2, X(p.z) - s / 2, s, s);
      }
      if (p.kind === 'bridge') {
        g.fillStyle = '#8d8798';
        g.fillRect(X(p.x) - 1.5, X(p.z) - 20 * this.k, 3, 40 * this.k);
      }
      if (p.kind === 'pier') {
        g.fillStyle = '#8d7f66';
        g.fillRect(X(p.x) - 1, X(p.z) - 2, 2, 4);
      }
    }

    // shoreline
    g.strokeStyle = '#7fd0e0';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(X(-236), X(CFG.city.half + 2));
    g.lineTo(X(236), X(CFG.city.half + 2));
    g.stroke();

    g.strokeStyle = 'rgba(255,217,160,.85)';
    g.lineWidth = 1;
    g.strokeRect(0.5, 0.5, this.size - 1, this.size - 1);
  }

  update(pos, facing, extra) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size, this.size);
    ctx.drawImage(this.base, 0, 0);
    const X = (v) => (v + OFF) * this.k;

    if (extra && extra.objective) {
      const o = extra.objective;
      const t = (Math.sin(performance.now() * 0.005) + 1) / 2;
      ctx.strokeStyle = 'rgba(255,215,106,.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(X(o.x), X(o.z), 4 + t * 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(X(o.x) - 2.5, X(o.z) - 2.5, 5, 5);
    }

    const px = X(pos.x), py = X(pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - facing);
    ctx.fillStyle = '#ffe6b8';
    ctx.strokeStyle = 'rgba(0,0,0,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const px0 = X(pos.x), py0 = X(pos.z);
    if (extra && extra.police) {
      for (const p of extra.police) {
        // nudge a blip that would sit under the player arrow so pursuers stay readable
        let bx = X(p.x), by = X(p.z);
        const dx = bx - px0, dy = by - py0, d = Math.hypot(dx, dy);
        if (d < 12) { const k = 12 / (d || 1); bx = px0 + dx * k; by = py0 + dy * k; }
        ctx.fillStyle = '#2f6bff';
        ctx.fillRect(bx - 4.5, by - 4.5, 9, 9);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx - 4.5, by - 4.5, 9, 9);
        ctx.fillStyle = '#ff3a3a';
        ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
      }
    }
  }
}
