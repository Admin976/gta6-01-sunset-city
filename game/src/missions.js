import * as THREE from 'three';
import { buildPerson } from './peds.js';

// Nico Reyes, a courier who borrowed from the Cobra Azul syndicate, works the debt off one job at a time.
export const MISSIONS = [
  {
    id: 1, title: 'El Paquete', reward: 450, time: 150,
    brief: 'Cobra Azul wants a package moved across town. No questions.',
    stages: [
      {
        at: [63, 63], r: 6, obj: 'Pick up the package in Mercado Viejo',
        lines: [['COBRA AZUL', 'Nico. You owe us. Start with a delivery — no questions.'],
          ['NICO', 'Package in the Mercado. I know the drill.']],
      },
      {
        at: [91, -55], r: 7, obj: 'Deliver the package to Centro Sol mall',
        lines: [['NICO', 'One box, one address. Easy money.'], ['COBRA AZUL', 'Do not open it.']],
      },
    ],
  },
  {
    id: 2, title: 'La Deuda', reward: 700, time: 150,
    brief: 'El Gordo has been sitting on syndicate money for two weeks.',
    stages: [
      {
        at: [119, 7], r: 6, obj: 'Find El Gordo in Barrio Sol',
        lines: [['COBRA AZUL', 'El Gordo still has our money. Go remind him.'],
          ['NICO', 'Remind him how?'], ['COBRA AZUL', 'With your knuckles.']],
      },
      {
        kind: 'wait', at: [119, 7], r: 4.5, hold: 3, obj: 'Collect the debt — stand your ground',
        lines: [['EL GORDO', 'Take it! Take it, Reyes!'], ['NICO', 'Bad day for both of us.']],
      },
      {
        at: [63, 119], r: 8, obj: 'Get back to Benito’s garage in Puerto Nuevo',
        lines: [['COBRA AZUL', 'Good. Now get to the garage before the cops do.']],
      },
    ],
  },
  {
    id: 3, title: 'El Sol GT', reward: 1100, time: 190,
    brief: 'A gold-rimmed Sol GT is parked downtown. Nobody will report it missing.',
    stages: [
      {
        kind: 'steal', at: [-105, 119], r: 6, car: { type: 'sport', color: 0x1b1a22 }, drop: [7, -161],
        obj: 'Steal the black Sol GT at Centro Alto',
        lines: [['BENITO', 'The Sol GT is parked downtown. Black one, gold rims.'],
          ['NICO', 'Whose is it?'], ['BENITO', 'Not ours. That is the point.']],
      },
      {
        at: [7, -161], r: 9, obj: 'Drive the Sol GT to Puerto Nuevo',
        lines: [['NICO', 'I am in. Where does it go?'], ['BENITO', 'Puerto Nuevo. Muelle 4.']],
      },
    ],
  },
  {
    id: 4, title: 'El Soplón', reward: 1500, time: 130,
    brief: 'Someone talked to the police. He is running right now.',
    stages: [
      {
        kind: 'chase', at: [63, 63], r: 8, obj: 'Chase down the blue pickup',
        lines: [['COBRA AZUL', 'One of ours talked. Little runner in a blue pickup.'],
          ['NICO', 'And you want him?'], ['COBRA AZUL', 'Alive is fine. Silent is better.']],
      },
      {
        at: [35, 246], r: 9, obj: 'Take him to the pier in Playa Sol',
        lines: [['COBRA AZUL', 'Bring him to the pier. We will do the rest.']],
      },
    ],
  },
  {
    id: 5, title: 'Muelle de Cobra', reward: 2500, time: 220,
    brief: 'The syndicate meets at the old pier. Nico is done paying with errands.',
    stages: [
      {
        at: [-60, 250], r: 9, obj: 'Go to the old pier at Playa Sol',
        lines: [['COBRA AZUL', 'Cobra Azul meets at the pier. So do the police.'],
          ['NICO', 'This is not my debt anymore.'], ['COBRA AZUL', 'No. It is your war.']],
      },
      {
        kind: 'kill', at: [-60, 250], r: 30, n: 5, obj: 'Take out the Cobra Azul crew',
        lines: [['NICO', 'Five of them. One of me.'], ['NICO', 'Good odds.']],
      },
    ],
  },
];

const TAU = Math.PI * 2;
const lerpAngle = (a, b, t) => {
  const d = (((b - a + Math.PI) % TAU) + TAU) % TAU - Math.PI;
  return a + d * t;
};

// Drives the five-mission chain: stage checks, world markers, dialogue, spawned gangsters and runners.
export class Missions {
  constructor(scene, city, { player, driving, police, combat, audio, hud }) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.driving = driving;
    this.police = police;
    this.combat = combat;
    this.audio = audio;
    this.hud = hud;
    this.done = [];
    this.active = null;
    this.stg = null;
    this.enemies = [];
    this.runner = null;
    this.onMoney = null;

    this.xs = [...new Set(city.roads.filter((r) => r.w < r.d).map((r) => r.x))].sort((a, b) => a - b);
    this.zs = [...new Set(city.roads.filter((r) => r.w > r.d).map((r) => r.z))].sort((a, b) => a - b);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 32, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    beam.position.y = 16;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.16, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.8, depthWrite: false, fog: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.4;
    this.marker = new THREE.Group();
    this.marker.add(beam, ring);
    this.marker.visible = false;
    scene.add(this.marker);

    this.dialog = [];
    this.dialogT = 0;
    this._lines = [];
    this._lineT = 0;
  }

  get markerPos() {
    return this.marker.visible ? this.marker.position : null;
  }

  start(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def || this.done.includes(id)) return false;
    this.clear();
    this.active = { def, i: 0, time: def.time };
    this.hud.banner(def.title.toUpperCase(), 'Mission ' + id + ' — ' + def.brief, 4200);
    this._stage();
    return true;
  }

  next() {
    const open = MISSIONS.find((m) => !this.done.includes(m.id));
    return open ? open.id : null;
  }

  clear() {
    this.active = null;
    this.stg = null;
    this.marker.visible = false;
    this.hud.setObjective('');
    this._clearSpawns();
  }

  _clearSpawns() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies = [];
    if (this.runner) { this.scene.remove(this.runner.group); this.runner = null; }
  }

  _say(lines) {
    this._lines = lines ? lines.slice() : [];
    this._lineT = 0;
    if (this._lines.length) {
      const [who, what] = this._lines.shift();
      this.hud.say(who, what);
      this._lineT = 0.4 + Math.min(3.4, what.length * 0.045);
    }
  }

  _stage() {
    const st = this.active.def.stages[this.active.i];
    this.stg = { ...st, hold: 0, holdReq: st.hold || 3, spawned: false, entered: false, target: null };
    this.hud.setObjective(st.obj);
    this._say(st.lines);
    this._place(st.at[0], st.at[1]);
    if (st.kind === 'kill') this._spawnEnemies(st.at, st.n);
    if (st.kind === 'chase') this._spawnRunner(st.at);
    if (st.kind === 'steal') this._spawnCar(st);
  }

  _place(x, z) {
    this.marker.position.set(x, 0, z);
    this.marker.visible = true;
  }

  _advance() {
    this.active.i++;
    if (this.active.i >= this.active.def.stages.length) return this._complete();
    this._stage();
  }

  _complete() {
    const def = this.active.def;
    this.done.push(def.id);
    if (this.onMoney) this.onMoney(def.reward);
    this.hud.banner('MISSION COMPLETE', def.title + ' — $' + def.reward.toLocaleString('en-US'), 4200);
    this.active = null;
    this.stg = null;
    this.marker.visible = false;
    this.hud.setObjective('');
    this._clearSpawns();
  }

  fail(reason) {
    if (!this.active) return;
    this.hud.banner('MISSION FAILED', reason + ' — press R to retry', 4200);
    this.hud.setObjective('');
    this.active = null;
    this.stg = null;
    this.marker.visible = false;
    this._clearSpawns();
  }

  _spawnEnemies(at, n) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + 0.4;
      const x = at[0] + Math.cos(a) * 7, z = at[1] + Math.sin(a) * 7;
      const p = buildPerson({ shirt: 0x2a2433, pants: 0x1b1a22, skin: 0xb07b52, cap: 0x101018 });
      p.group.position.set(x, 0, z);
      this.scene.add(p.group);
      this.enemies.push({ ...p, pos: new THREE.Vector3(x, 0, z), heading: a, health: 100, dead: false, phase: k, fire: 0.6, speed: 0 });
    }
  }

  _spawnRunner(at) {
    const car = this.driving.spawn('pickup', at[0], at[1], 0, 0x2f5f9a);
    car.stolen = true;
    car.fleeAway = true;
    this.runner = {
      car, target: this._fleeNode(at[0], at[1]), speed: 21, heading: 0,
    };
    this.runner.car.group.position.set(at[0], 0, at[1]);
  }

  _fleeNode(x, z) {
    const px = this.player.pos.x, pz = this.player.pos.z;
    let best = { x, z }, bd = -1;
    for (const nx of this.xs) for (const nz of this.zs) {
      const d = Math.hypot(nx - x, nz - z);
      if (d < 40 || d > 150) continue;
      const score = Math.hypot(nx - px, nz - pz) - d * 0.1;
      if (score > bd) { bd = score; best = { x: nx, z: nz }; }
    }
    return best;
  }

  _spawnCar(st) {
    const car = this.driving.spawn(st.car.type, st.car.at ? st.car.at[0] : st.at[0], st.car.at ? st.car.at[1] : st.at[1], 0, st.car.color);
    car.missionCar = true;
    this.stg.car = car;
  }

  update(dt, targetPos) {
    // dialogue queue runs even while the objective changes
    if (this._lines.length || this._lineT > 0) {
      this._lineT -= dt;
      if (this._lineT <= 0 && this._lines.length) {
        const [who, what] = this._lines.shift();
        this.hud.say(who, what);
        this._lineT = 0.4 + Math.min(3.4, what.length * 0.045);
      }
    }

    this.marker.children[1].rotation.z += dt * 0.9;
    this.marker.position.y = Math.sin(performance.now() * 0.002) * 0.15;

    if (!this.active) {
      this._updateEnemies(dt, targetPos);
      return;
    }

    this.active.time -= dt;
    if (this.active.time <= 0) return this.fail('Out of time');
    const st = this.stg;
    const d = st.at ? Math.hypot(targetPos.x - st.at[0], targetPos.z - st.at[1]) : 0;

    if (st.kind === 'wait') {
      st.hold = d < st.r ? st.hold + dt : 0;
      if (st.hold >= st.holdReq) return this._advance();
    } else if (st.kind === 'steal') {
      this._updateSteal(st, targetPos);
    } else if (st.kind === 'chase') {
      this._updateChase(dt, targetPos);
    } else if (st.kind === 'kill') {
      if (this.enemies.every((e) => e.dead)) return this._advance();
    } else if (d < st.r) {
      return this._advance();
    }

    this._updateEnemies(dt, targetPos);
  }

  _updateSteal(st, targetPos) {
    if (!st.car) return;
    if (!st.entered) {
      if (this.driving.car === st.car) {
        st.entered = true;
        this.hud.setObjective('Drive it to Puerto Nuevo');
        this._place(st.drop[0], st.drop[1]);
      }
      return;
    }
    if (Math.hypot(st.car.pos.x - st.drop[0], st.car.pos.z - st.drop[1]) < 10) this._advance();
  }

  _updateChase(dt, targetPos) {
    const r = this.runner;
    if (!r) return;
    const c = r.car;
    const t = r.target;
    const dx = t.x - c.pos.x, dz = t.z - c.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) r.target = this._fleeNode(c.pos.x, c.pos.z);
    else {
      c.heading = lerpAngle(c.heading, Math.atan2(dx, dz), Math.min(1, dt * 3));
      c.pos.x += Math.sin(c.heading) * r.speed * dt;
      c.pos.z += Math.cos(c.heading) * r.speed * dt;
      c.group.position.set(c.pos.x, 0, c.pos.z);
      c.group.rotation.y = c.heading;
      for (const w of c.wheels) w.rotation.x += r.speed * dt * 2.4;
    }
    this.marker.position.set(c.pos.x, 0, c.pos.z);
    if (c.pos.distanceTo(targetPos) < 9) {
      this.scene.remove(c.group);
      this.runner = null;
      this._advance();
    }
  }

  _updateEnemies(dt, targetPos) {
    for (const e of this.enemies) {
      if (e.dead) {
        e.group.rotation.x = Math.min(Math.PI / 2, e.group.rotation.x + dt * 5);
        continue;
      }
      const dx = targetPos.x - e.pos.x, dz = targetPos.z - e.pos.z;
      const d = Math.hypot(dx, dz);
      e.heading = lerpAngle(e.heading, Math.atan2(dx, dz), Math.min(1, dt * 4));
      if (d > 14) {
        e.pos.x += (dx / d) * 3.4 * dt;
        e.pos.z += (dz / d) * 3.4 * dt;
        e.speed = 3.4;
      } else e.speed = 0;
      e.phase += e.speed * dt * 2.4;
      const a = Math.sin(e.phase) * 0.6;
      e.limbs.legL.rotation.x = a;
      e.limbs.legR.rotation.x = -a;
      e.group.position.set(e.pos.x, 0, e.pos.z);
      e.group.rotation.y = e.heading;
      if (d < 22) {
        e.fire -= dt;
        if (e.fire <= 0) {
          e.fire = 1.3;
          this.audio.gun();
          this.combat.copTracer(e.pos, targetPos);
          this.combat.damagePlayer(3);
        }
      }
    }
  }
}
