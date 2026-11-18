// Pause and game-over screens: plain DOM overlays, no game state of their own.
export class Menu {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.pauseEl = $('pause');
    this.overEl = $('gameover');
    this.overSub = $('go-sub');
    this.listEl = $('mission-list');
    this.boxEl = $('p-box');
    this.open = false;
    this.over = false;
  }

  bind({ resume, restart, retry, pick }) {
    this.pick = pick;
    document.getElementById('resume').addEventListener('click', resume);
    document.getElementById('restart').addEventListener('click', restart);
    document.getElementById('retry').addEventListener('click', retry);
    document.getElementById('p-controls').addEventListener('click', () => { this.boxEl.hidden = !this.boxEl.hidden; });
    document.getElementById('p-missions').addEventListener('click', () => {
      this.listEl.hidden = !this.listEl.hidden;
    });
    this.listEl.addEventListener('click', (e) => {
      const row = e.target.closest('.m');
      if (!row || row.classList.contains('locked') || row.classList.contains('done') || !this.pick) return;
      this.pick(Number(row.dataset.id));
    });
  }

  showPause(rows) {
    this.open = true;
    this.pauseEl.hidden = false;
    this.listEl.innerHTML = rows.map((r) => {
      const cls = r.done ? 'done' : r.locked ? 'locked' : '';
      const state = r.done ? 'COMPLETE' : r.locked ? 'LOCKED' : 'OPEN';
      return `<div class="m ${cls}" data-id="${r.id}"><span>${r.id}. ${r.title}</span><span>${state} · $${r.reward}</span></div>`;
    }).join('');
  }

  hidePause() {
    this.open = false;
    this.pauseEl.hidden = true;
  }

  showGameOver(sub) {
    this.over = true;
    this.overSub.textContent = sub;
    this.overEl.hidden = false;
    this.pauseEl.hidden = true;
    this.open = false;
  }

  hideGameOver() {
    this.over = false;
    this.overEl.hidden = true;
  }
}
