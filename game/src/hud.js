// DOM HUD: nothing here draws, it only writes text and widths once per frame.
export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.hp = $('hp-fill');
    this.money = $('money');
    this.clock = $('clock');
    this.district = $('district');
    this.stars = $('stars');
    this.speed = $('speed');
    this.ammo = $('ammo');
    this.ride = $('ride');
    this._district = '';
    this._wanted = -1;
    this._money = -1;
    this._ammo = -1;
    this._ride = '';
  }

  update(s) {
    this.hp.style.width = Math.max(0, Math.min(100, s.health)) + '%';

    const m = Math.round(s.money);
    if (m !== this._money) {
      this._money = m;
      this.money.textContent = '$' + m.toLocaleString('en-US');
    }

    const h = Math.floor(s.time) % 24, min = Math.floor((s.time % 1) * 60);
    this.clock.textContent = String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');

    if (s.wanted !== this._wanted) {
      this._wanted = s.wanted;
      this.stars.textContent = '\u2605'.repeat(s.wanted) + '\u2606'.repeat(Math.max(0, 5 - s.wanted));
      this.stars.classList.toggle('hot', s.wanted > 0);
    }

    const a = s.ammo | 0;
    if (a !== this._ammo) {
      this._ammo = a;
      this.ammo.textContent = a;
    }

    const ride = s.ride || '';
    if (ride !== this._ride) {
      this._ride = ride;
      this.ride.textContent = ride;
    }

    if (s.district !== this._district) {
      this._district = s.district;
      this.district.textContent = s.district;
    }

    this.speed.textContent = Math.round(s.speed * 3.6);
  }
}
