# Sunset City

[![Make GTA 6 entry](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Admin976/gta6-01-sunset-city/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Admin976/gta6-01-sunset-city/reward.svg)](https://make.fun/bounty/gta6-01)

Sunset City is a small open-world crime sandbox set in Puerto Sol, a fictional pastel
coastal town where the sun sits low over the bay and nobody's paperwork is in order.
You play Nico Reyes, a courier who borrowed from the Cobra Azul syndicate and now works
the debt off one job at a time: run a package across town, shake a debtor down, steal a
black Sol GT, run down the man who talked, and finish it with a firefight on the old pier.
The city is a real street grid you can walk or drive, with traffic that stops for you,
pedestrians who scatter when you fire, police cruisers that give chase at up to five stars,
and a minimap painted from the same road data the world is built from. Everything is
three.js geometry and synthesised audio: no image or sound file is loaded, and the page
makes no network request at all.

## Running it

The game is plain static files, so any static server works. From inside `game/`:

```
python3 -m http.server 8080
```

and open http://localhost:8080. Or from the repository root, using the bundled server:

```
node serve.ts          # serves game/ on http://localhost:8080
node serve.ts --port 8099
```

`python3 -m http.server` inside `game/` and `node serve.ts` both just serve the same
files; nothing is built or installed.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` / arrows | Move, and throttle / brake / steer while driving |
| `Shift` | Sprint |
| `Space` | Jump |
| `E` | Enter or leave the nearest car |
| Left click | Shoot |
| `F` / right click | Punch |
| Mouse drag | Look around |
| Mouse wheel | Zoom the camera |
| `Esc` | Pause: Resume, Controls, Missions, Restart |
| `M` | Open the mission list directly |
| `R` | Restart the current mission |

Missions are picked from the pause menu: each one unlocks when the previous job is done,
pays cash, and can be retried after a failure. Progress (position, money, completed
missions, wanted level) is saved to `localStorage` every few seconds and on every event,
and restored when you press Play.

## Modules in `game/src/`

- `main.js` — bootstraps the renderer, scene, sky and lights, wires every system together and runs the frame loop.
- `config.js` — the city dimensions, palette, physics constants, day clock and fog, all in one place.
- `city.js` — generates Puerto Sol (streets, crosswalks, traffic lights, pastel facades with window grids, awnings, roof tanks, signage, coastline) and batches it into instanced meshes.
- `player.js` — the on-foot character: acceleration, friction, jumping, wall sliding and the walk cycle.
- `camera.js` — the third-person orbit camera with pointer lock, zoom and building-aware pull-in.
- `driving.js` — arcade car physics (forward/lateral grip, drift, per-axis building collisions) and enter/exit.
- `vehicles.js` — the four vehicle bodies and their specs, built from boxes and cylinders.
- `traffic.js` — NPC cars that follow the road graph, keep right, and stop for the player and each other.
- `peds.js` — the shared humanoid builder plus pedestrians who walk block corners and panic when shots are fired.
- `police.js` — wanted level, cruiser spawning with liveries and light bars, pursuit driving and officers who dismount and shoot.
- `combat.js` — shooting, punching, damage, tracers, muzzle flashes and sparks.
- `missions.js` — the five-mission Nico Reyes chain: stage checks, world beacon and ring, dialogue, spawned gangsters and the fleeing runner.
- `hud.js` — the DOM HUD: clock, district, health, money, stars, speed, objective line, subtitles and banners.
- `minimap.js` — the minimap painted once from the city data (roads by width, blocks, park, coast) plus player, police and objective blips.
- `menu.js` — the pause and game-over overlays, including the mission list.
- `audio.js` — one WebAudio graph synthesising engine, gunfire, impacts, horns, footsteps and a slow ambient pad.
- `rng.js` — the seeded PRNG that makes Puerto Sol the same city on every load.

## Credits

Sunset City was made for the Make GTA 6 bounty on make.fun.
