// Every magic number for Sunset City lives here.
export const CFG = {
  city: { cells: 8, block: 42, road: 14, cell: 56, size: 448, half: 224, seed: 20261119 },

  palette: {
    skyTop: 0x2a1e46, skyMid: 0x7a3a63, skyLow: 0xe0623f, skyEdge: 0xffb25e,
    fog: 0xe89a6a, hemiSky: 0xffcfa0, hemiGround: 0x40334f, sunLight: 0xffa763, sun: 0xffe0a3,
    asphalt: 0x2c2a35, line: 0xd9c07a, sidewalk: 0x9b93a4, trim: 0x33303c,
    sand: 0xdfc48c, water: 0x21506b, grass: 0x3f6b4a,
    walls: [0x7d7a92, 0x8f8496, 0x5f6b7e, 0xb2a191, 0x6a5f77, 0x94a2ab, 0xc3b6a4],
    glass: 0x9fd0e0, glow: 0xffc478, neon: 0xff7a4d,
    trunk: 0x6b4a34, leaf: 0x2f6a48, lamp: 0xffdb9e, boat: 0xe6e1d4,
  },

  player: { walk: 5.2, run: 11, accel: 34, friction: 14, jump: 8.4, gravity: 26, radius: 0.55, bounds: 55 },
  camera: { dist: 9, min: 3.5, max: 26, height: 1.5, lerp: 10, fov: 62, far: 900 },
  time: { start: 17.6, speed: 0.06, dawn: 6, dusk: 22 }, // game hours per real second
  fog: { near: 110, far: 520 },
};
