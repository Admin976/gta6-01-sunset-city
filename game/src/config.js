// Every magic number for Sunset City lives here.
export const CFG = {
  city: { cells: 8, block: 42, road: 14, cell: 56, size: 448, half: 224, seed: 20261119 },

  palette: {
    skyTop: 0x2f4f7a, skyMid: 0x7ba0c4, skyLow: 0xffc48a, skyEdge: 0xff9a5c,
    fog: 0xa8c0d8, hemiSky: 0xffe2bc, hemiGround: 0x5a4a63, sunLight: 0xffb070, sun: 0xffe0a3,
    asphalt: 0x3a3844, line: 0xd9c07a, cross: 0xf4f0e4, sidewalk: 0xa9a2b0, trim: 0x33303c,
    sand: 0xe6cd97, water: 0x2a6a86, grass: 0x4a7f56,
    walls: [0xe9dfc9, 0xb2654a, 0x8fb0c9, 0xf0d489],
    glass: 0x9fd0e0, glow: 0xffc478, neon: 0xff7a4d,
    trunk: 0x6b4a34, leaf: 0x357a52, lamp: 0xffdb9e, boat: 0xe6e1d4,
  },

  player: { walk: 5.2, run: 11, accel: 34, friction: 14, jump: 8.4, gravity: 26, radius: 0.55, bounds: 55 },
  camera: { dist: 9, min: 3.5, max: 26, height: 1.5, lerp: 10, fov: 62, far: 900 },
  time: { start: 18.2, speed: 0.06, dawn: 6, dusk: 22 }, // game hours per real second
  fog: { near: 140, far: 640 },
};
