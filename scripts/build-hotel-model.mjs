#!/usr/bin/env node
/**
 * Generates public/models/hotel.glb, the 3D hero's only model.
 *
 * Everything is authored here so there is no third-party model to license and
 * no asset to fetch from a CDN. Lighting (dusk ambient, a warm key, uplights,
 * pool glow, fake contact shadows) is baked into vertex colours at build time,
 * so the browser draws unlit geometry: no real-time lights, no shadow maps.
 * Geometry is then quantized and meshopt-compressed.
 *
 *   npm run build:model
 *
 * Meshes in the file, each one draw call:
 *   solid    baked, unlit       (architecture, ground, furniture)
 *   far      baked, unlit       (mountain ridges, kept apart for precision)
 *   foliage  baked, sways       (uv.x sway weight, uv.y phase)
 *   lit      emissive, flickers (room windows, uv.x phase, uv.y dim chance)
 *   glass    additive           (balcony glass)
 *   pools    additive, radial   (light pooling on the ground, uv across the quad)
 *   halos    additive points    (lamp glow, uv.x size / 10, uv.y phase)
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO, Primitive } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/models/hotel.glb');

/* ---------- Deterministic random, so rebuilds are byte-stable ---------- */

let seed = 0x5eed1926;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const range = (a, b) => a + (b - a) * rnd();
const pick = (list) => list[Math.floor(rnd() * list.length)];

/* ---------- Colour ---------- */

const toLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [toLinear((n >> 16) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const C = {
  stone: hex('#d8cbb2'),
  pier: hex('#c2b296'),
  soffit: hex('#a0703f'),
  brass: hex('#d9a94f'),
  darkGlass: hex('#33456b'),
  deck: hex('#b9ad98'),
  deckAlt: hex('#a99c86'),
  coping: hex('#e8dfcb'),
  forecourt: hex('#8f8676'),
  lawn: hex('#4d7040'),
  hedge: hex('#2f5230'),
  hedgeLit: hex('#4d7a3c'),
  frond: hex('#3f6b3a'),
  frondAlt: hex('#2e5a3d'),
  trunk: hex('#6f5a44'),
  cypress: hex('#1f3d30'),
  tree: hex('#28483a'),
  fabric: hex('#efe6d4'),
  teak: hex('#7a5533'),
  iron: hex('#2a2a2c'),
};

/* ---------- Baked lighting ---------- */

const SKY = [0.26, 0.33, 0.52];
const BOUNCE = [0.075, 0.07, 0.085];
const KEY_DIR = norm([-0.62, 0.42, 0.66]);
const KEY = [0.42, 0.25, 0.17];
const FAR_RIM = [0.5, 0.3, 0.24];

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Local lights: warm uplights, canopy downlights, pool glow. Filled in below. */
const lights = [];
const addLight = (x, y, z, color, power, radius) => lights.push({ p: [x, y, z], c: mul(color, power), r: radius });

const WARM = hex('#ffb066');
const AMBER = hex('#ff9440');
const TEAL = hex('#34e0d0');

/** Footprints that darken the ground around them, as a stand-in for contact shadows. */
const blockers = [];
const contactShadow = (x, z) => {
  let shade = 1;
  for (const b of blockers) {
    const dx = Math.max(b.x0 - x, 0, x - b.x1);
    const dz = Math.max(b.z0 - z, 0, z - b.z1);
    shade = Math.min(shade, 1 - b.k * (1 - smooth(0, b.reach, Math.hypot(dx, dz))));
  }
  return shade;
};

function bake(albedo, p, n, gain = 1) {
  const hemi = n[1] * 0.5 + 0.5;
  let r = BOUNCE[0] + (SKY[0] - BOUNCE[0]) * hemi;
  let g = BOUNCE[1] + (SKY[1] - BOUNCE[1]) * hemi;
  let b = BOUNCE[2] + (SKY[2] - BOUNCE[2]) * hemi;

  const key = Math.max(0, n[0] * KEY_DIR[0] + n[1] * KEY_DIR[1] + n[2] * KEY_DIR[2]);
  r += KEY[0] * key;
  g += KEY[1] * key;
  b += KEY[2] * key;

  for (const l of lights) {
    const dx = l.p[0] - p[0];
    const dy = l.p[1] - p[1];
    const dz = l.p[2] - p[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > l.r * l.r) continue;
    const d = Math.sqrt(d2) || 1;
    const wrap = Math.max(0, (n[0] * dx + n[1] * dy + n[2] * dz) / d * 0.75 + 0.25);
    const fade = (1 - d2 / (l.r * l.r)) ** 2;
    const a = (wrap * fade) / (1 + d2 * 0.05);
    r += l.c[0] * a;
    g += l.c[1] * a;
    b += l.c[2] * a;
  }

  // Corners close to the ground read as occluded.
  const ao = n[1] > 0.5 ? contactShadow(p[0], p[2]) : 0.55 + 0.45 * smooth(0, 2.6, p[1]);
  return [clamp01(albedo[0] * r * ao * gain), clamp01(albedo[1] * g * ao * gain), clamp01(albedo[2] * b * ao * gain)];
}

/* ---------- Mesh buckets ---------- */

const bucket = () => ({ pos: [], col: [], uv: [], idx: [] });
const B = { solid: bucket(), far: bucket(), foliage: bucket(), lit: bucket(), glass: bucket(), pools: bucket(), halos: bucket() };

const faceNormal = (a, b, c) => {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  return norm([uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]);
};

const pushVertex = (b, p, c, uv = [0, 0]) => {
  b.pos.push(p[0], p[1], p[2]);
  b.col.push(clamp01(c[0]), clamp01(c[1]), clamp01(c[2]));
  b.uv.push(uv[0], uv[1]);
};

/** A flat, baked quad. `albedo` is a colour, or a function of the vertex. */
function quad(b, p0, p1, p2, p3, albedo, { gain = 1, uv = null, baked = true } = {}) {
  const n = faceNormal(p0, p1, p2);
  const base = b.pos.length / 3;
  [p0, p1, p2, p3].forEach((p, i) => {
    const a = typeof albedo === 'function' ? albedo(p, i) : albedo;
    pushVertex(b, p, baked ? bake(a, p, n, gain) : a, uv ? uv[i] : [0, 0]);
  });
  b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function tri(b, p0, p1, p2, albedo, { uv = null, gain = 1 } = {}) {
  const n = faceNormal(p0, p1, p2);
  const base = b.pos.length / 3;
  [p0, p1, p2].forEach((p, i) => pushVertex(b, p, bake(typeof albedo === 'function' ? albedo(p) : albedo, p, n, gain), uv ? uv[i] : [0, 0]));
  b.idx.push(base, base + 1, base + 2);
}

/** Axis-aligned box given by its min and max corners. `omit` drops hidden faces. */
function box(b, x0, y0, z0, x1, y1, z1, albedo, { omit = '', gain = 1, under = null } = {}) {
  const o = { gain };
  if (!omit.includes('f')) quad(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], albedo, o);
  if (!omit.includes('k')) quad(b, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], albedo, o);
  if (!omit.includes('r')) quad(b, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], albedo, o);
  if (!omit.includes('l')) quad(b, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], albedo, o);
  if (!omit.includes('t')) quad(b, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], albedo, o);
  if (!omit.includes('b')) {
    if (under) {
      const base = b.pos.length / 3;
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]].forEach((p) => pushVertex(b, p, under));
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    } else {
      quad(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], albedo, o);
    }
  }
}

/** Upright tapered cylinder. */
function cylinder(b, x, y0, z, r0, y1, r1, albedo, segments = 8, { caps = false } = {}) {
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI * 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2;
    const ring = (a, r, y) => [x + Math.sin(a) * r, y, z + Math.cos(a) * r];
    quad(b, ring(a0, r0, y0), ring(a1, r0, y0), ring(a1, r1, y1), ring(a0, r1, y1), albedo);
    if (caps && r1 > 0) tri(b, ring(a0, r1, y1), ring(a1, r1, y1), [x, y1, z], albedo);
  }
}

/** Faceted blob for trees and topiary: an icosahedron, optionally subdivided once. */
const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  const f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return f.map((tr) => tr.map((i) => v[i]));
})();

function blob(b, x, y, z, sx, sy, sz, albedo, { sway = 0, phase = 0, subdivide = false } = {}) {
  const emit = (p0, p1, p2) => {
    const at = (p) => [x + p[0] * sx * (1 + range(-0.05, 0.05)), y + p[1] * sy, z + p[2] * sz];
    const a = at(p0), c = at(p1), d = at(p2);
    const uvOf = (q) => [clamp01(sway * smooth(y - sy, y + sy, q[1])), phase];
    tri(b, a, c, d, albedo, { uv: [uvOf(a), uvOf(c), uvOf(d)] });
  };
  for (const [p0, p1, p2] of ICO) {
    if (!subdivide) { emit(p0, p1, p2); continue; }
    const m = (a, c) => norm([a[0] + c[0], a[1] + c[1], a[2] + c[2]]);
    const a = m(p0, p1), c = m(p1, p2), d = m(p2, p0);
    emit(p0, a, d); emit(a, p1, c); emit(d, c, p2); emit(a, c, d);
  }
}

/** Radial light pool lying on the ground. */
function lightPool(x, z, size, color, y = 0.09) {
  const s = size / 2;
  const base = B.pools.pos.length / 3;
  [[x - s, y, z + s], [x + s, y, z + s], [x + s, y, z - s], [x - s, y, z - s]].forEach((p, i) =>
    pushVertex(B.pools, p, color, [[0, 0], [1, 0], [1, 1], [0, 1]][i]));
  B.pools.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

const halo = (x, y, z, size, color) => pushVertex(B.halos, [x, y, z], color, [clamp01(size / 10), rnd()]);

/* ---------- Site plan: world units are metres, +z points at the camera ---------- */

const POOL = { x0: -46, x1: 34, z0: 20, z1: 62 };
const insidePool = (x, z, pad = 0) => x > POOL.x0 - pad && x < POOL.x1 + pad && z > POOL.z0 - pad && z < POOL.z1 + pad;
const ISLAND = { x: 14, z: 42, r: 5.2 };

const BAY = 5;
const PODIUM = 6.6;
const FLOOR = 3.4;

/** Wing steps down to the left, giving a terraced skyline. */
const wings = [
  { x0: -86, floors: 2 },
  { x0: -76, floors: 2 },
  { x0: -66, floors: 3 },
  { x0: -56, floors: 3 },
  { x0: -46, floors: 4 },
  { x0: -36, floors: 5 },
  { x0: -26, floors: 5 },
  { x0: -16, floors: 6 },
  { x0: -6, floors: 6 },
  { x0: 29, floors: 7 },
  { x0: 39, floors: 5 },
  { x0: 49, floors: 4 },
  { x0: 59, floors: 3 },
  { x0: 69, floors: 2 },
];
const TOWER = { x0: 4, x1: 29, z0: -18, z1: 4, floors: 10 };
const WING_DEPTH = -15;
const WING_BAYS = 2;

/* Lights must exist before any baking, so they are declared first. */

// Canopy downlights over the drop-off.
for (let x = -13; x <= 3; x += 4) for (let z = 3; z <= 10; z += 3.5) addLight(x, 5.2, z, WARM, 3.6, 10);
// Glow spilling out of the lobby.
for (let x = -14; x <= 4; x += 4.5) addLight(x, 3, 1.4, WARM, 2.4, 13);
// Facade wash along the wing.
for (const [a, c] of [[-86, -16], [29, 79]]) for (let x = a; x <= c; x += 5) addLight(x + 2.5, 0.5, 3.6, AMBER, 1.5, 11);
// Tower uplights, tall and dramatic.
for (let x = TOWER.x0 + 2.5; x < TOWER.x1; x += 5) addLight(x, 0.6, TOWER.z1 + 3.2, AMBER, 5, 19);
// Pool glow along all four edges.
for (let x = POOL.x0 + 3; x < POOL.x1; x += 7) {
  addLight(x, 0.8, POOL.z0 - 0.5, TEAL, 1.5, 9);
  addLight(x, 0.8, POOL.z1 + 0.5, TEAL, 1.9, 9);
}
for (let z = POOL.z0 + 3; z < POOL.z1; z += 7) {
  addLight(POOL.x0 - 0.5, 0.8, z, TEAL, 1.5, 9);
  addLight(POOL.x1 + 0.5, 0.8, z, TEAL, 1.5, 9);
}
// Walkway bollards.
const bollards = [];
for (let z = 13; z <= 19; z += 3) {
  for (const x of [-11, 1]) bollards.push([x, z]);
}
for (let x = POOL.x0 - 4; x <= POOL.x1 + 4; x += 7.5) {
  bollards.push([x, POOL.z1 + 12]);
  bollards.push([x, POOL.z0 - 3.4]);
}
for (let z = POOL.z0; z <= POOL.z1 + 8; z += 7.5) {
  bollards.push([POOL.x0 - 7, z]);
  bollards.push([POOL.x1 + 6, z]);
}
for (const [x, z] of bollards) addLight(x, 0.9, z, WARM, 1.6, 7);

blockers.push({ x0: -86, x1: 79, z0: -15, z1: 2, k: 0.5, reach: 7 });
blockers.push({ x0: TOWER.x0, x1: TOWER.x1, z0: TOWER.z0, z1: TOWER.z1, k: 0.5, reach: 7 });
blockers.push({ x0: POOL.x0 - 0.8, x1: POOL.x1 + 0.8, z0: POOL.z0 - 0.8, z1: POOL.z1 + 0.8, k: 0.12, reach: 2 });

/* ---------- Rooms ---------- */

const ROOM_TINTS = ['#ffb765', '#ffa64d', '#ff9a3f', '#ffc98a', '#ffae58', '#ff8e38'].map(hex);

function room(x0, x1, y0, y1, z, face = 'z') {
  // Maps facade coordinates (u across, v up) onto the wall the room sits on.
  const at = face === 'z' ? (u, v) => [u, v, z] : (u, v) => [z, v, u];
  const q = (b, u0, u1, v0, v1, c0, c1, opts) => {
    const list = face === 'z'
      ? [at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1)]
      : [at(u1, v0), at(u0, v0), at(u0, v1), at(u1, v1)];
    quad(b, list[0], list[1], list[2], list[3], (_, i) => (i < 2 ? c0 : c1), opts);
  };

  const lit = rnd() < 0.62;
  const inset = 0.25;
  const u0 = x0 + inset, u1 = x1 - inset;
  const v0 = y0 + 0.05, v1 = y1 - 0.12;

  if (!lit) {
    // Unlit room: dark glass picking up the dusk sky.
    q(B.solid, u0, u1, v0, v1, mul(C.darkGlass, 0.8), mix(C.darkGlass, hex('#b97f6b'), 0.35), { baked: false });
    return;
  }

  const tint = pick(ROOM_TINTS);
  const bright = range(0.4, 1);
  const phase = rnd();
  const dim = rnd();
  const opts = { baked: false, uv: [[phase, dim], [phase, dim], [phase, dim], [phase, dim]] };
  const wide = u1 - u0;
  const curtain = wide * range(0.1, 0.24);
  // Curtains either side, a glowing ceiling at the top, darker furniture below.
  q(B.lit, u0, u0 + curtain, v0, v1, mul(tint, 0.2 * bright), mul(tint, 0.38 * bright), opts);
  q(B.lit, u1 - curtain, u1, v0, v1, mul(tint, 0.2 * bright), mul(tint, 0.38 * bright), opts);
  const mid = v0 + (v1 - v0) * 0.34;
  q(B.lit, u0 + curtain, u1 - curtain, v0, mid, mul(tint, 0.2 * bright), mul(tint, 0.42 * bright), opts);
  q(B.lit, u0 + curtain, u1 - curtain, mid, v1, mul(tint, 0.42 * bright), mul(tint, bright), opts);
}

/** One balcony bay on the street front. */
function bay(x0, x1, y0, z, topOfBlock = false) {
  const y1 = y0 + FLOOR;
  room(x0, x1, y0, y1, z);

  const depth = 1.8;
  // Warm soffit: rooms light the balcony ceiling above them.
  box(B.solid, x0, y1 - 0.14, z, x1, y1 + 0.14, z + depth, C.stone, {
    omit: 'k',
    under: mul(mix(C.soffit, WARM, 0.5), 0.6),
  });
  // Dividing fin.
  box(B.solid, x1 - 0.14, y0, z, x1 + 0.14, y1, z + depth, C.pier, { omit: 'kb' });
  // Brass rail and balcony glass.
  box(B.solid, x0, y0 + 1.12, z + depth - 0.06, x1, y0 + 1.17, z + depth, C.brass, { gain: 2.2, omit: 'kb' });
  const gl = hex('#7fa0bd');
  quad(B.glass, [x0, y0 + 0.12, z + depth - 0.03], [x1, y0 + 0.12, z + depth - 0.03], [x1, y0 + 1.12, z + depth - 0.03], [x0, y0 + 1.12, z + depth - 0.03], mul(gl, 0.09), { baked: false });

  // Cascading planters on the terraced floors.
  if (topOfBlock || rnd() < 0.05) {
    const yy = y0 + 0.14;
    for (let u = x0 + 0.5; u < x1 - 0.2; u += 0.9) {
      blob(B.foliage, u, yy + 0.05, z + depth + 0.05, 0.5, range(0.3, 0.6), 0.3, mul(C.hedgeLit, 1.7), { sway: 0.1, phase: rnd() });
    }
  }
}

/* ---------- Building ---------- */

function buildWing() {
  wings.forEach((w, i) => {
    const x1 = w.x0 + BAY * WING_BAYS;
    const top = PODIUM + w.floors * FLOOR;
    const prev = wings[i - 1];
    const next = wings[i + 1];
    const steppedDown = (next && next.floors > w.floors) || (prev && prev.floors > w.floors) || w.x0 >= 29;

    // Solid core behind the rooms.
    box(B.solid, w.x0, 0, WING_DEPTH, x1, top, -0.3, C.stone, { omit: 'b' });

    // Terrace pergola and planting on the step, where the next block rises above it.
    if (steppedDown) {
      const py = top + 0.14;
      for (let u = w.x0 + 1; u < x1; u += 3) cylinder(B.solid, u, py, -2, 0.08, py + 2.5, 0.08, C.brass, 4);
      box(B.solid, w.x0 + 0.6, py + 2.4, -5, x1 - 0.5, py + 2.55, -1.6, C.teak, { under: mul(WARM, 0.5) });
      halo(w.x0 + 5, py + 2.1, -3, 3.2, mul(WARM, 0.8));
      for (let u = w.x0 + 0.6; u < x1; u += 1.2) blob(B.foliage, u, py + 0.3, -0.5, 0.75, 0.55, 0.6, C.hedgeLit, { sway: 0.15, phase: rnd() });
    } else {
      box(B.solid, w.x0, top, WING_DEPTH + 1, x1, top + 1.1, -1, C.pier, { omit: 'b' });
    }

    // Lobby-level base of this block: stone arcade, except where the lobby itself is.
    if (w.x0 < -16 || w.x0 >= 29) {
      box(B.solid, w.x0, 0, -0.3, x1, PODIUM, 0.45, mul(C.stone, 0.62), { omit: 'kb' });
      for (let b = 0; b < WING_BAYS; b++) {
        const u0 = w.x0 + b * BAY;
        const glow = hex('#ffa95c');
        const opts = { baked: false, uv: [[0, 0], [0, 0], [0, 0], [0, 0]] };
        quad(B.lit, [u0 + 0.7, 0.5, 0.62], [u0 + BAY - 0.7, 0.5, 0.62], [u0 + BAY - 0.7, 5.3, 0.62], [u0 + 0.7, 5.3, 0.62], (_, i) => (i < 2 ? mul(glow, 0.62) : mul(glow, 0.26)), opts);
      }
    }

    for (let b = 0; b < WING_BAYS; b++) {
      for (let f = 0; f < w.floors; f++) {
        const u0 = w.x0 + b * BAY;
        bay(u0, u0 + BAY, PODIUM + f * FLOOR, 0, f === w.floors - 1 && rnd() < 0.5);
      }
    }
  });
}

function buildTower() {
  const { x0, x1, z0, z1, floors } = TOWER;
  const top = PODIUM + floors * FLOOR;
  box(B.solid, x0, 0, z0, x1, top, z1 - 0.3, C.stone, { omit: 'b' });

  for (let u = x0; u < x1; u += BAY) {
    for (let f = 0; f < floors; f++) bay(u, u + BAY, PODIUM + f * FLOOR, z1);
    // Base of the tower: tall glass restaurant frontage.
    const glow = hex('#ffc288');
    quad(B.lit, [u + 0.3, 0.3, z1], [u + BAY - 0.3, 0.3, z1], [u + BAY - 0.3, PODIUM - 0.4, z1], [u + 0.3, PODIUM - 0.4, z1],
      (_, i) => (i < 2 ? mul(glow, 0.95) : mul(glow, 0.6)), { baked: false, uv: [[0, 0], [0, 0], [0, 0], [0, 0]] });
    box(B.solid, u + BAY - 0.14, 0, z1, u + BAY + 0.14, PODIUM, z1 + 0.5, C.pier, { omit: 'kb' });
  }

  // Tower's left flank, visible above the wing.
  const wingTop = PODIUM + 6 * FLOOR;
  for (let u = z1 - BAY; u > z0; u -= BAY) {
    for (let f = 6; f < floors; f++) {
      room(u, u + BAY, PODIUM + f * FLOOR, PODIUM + (f + 1) * FLOOR, x0 - 0.15, 'x');
    }
  }
  box(B.solid, x0 - 0.12, wingTop, z1 - 0.1, x0 + 0.1, top, z1 + 0.1, C.pier, { omit: '' });

  // Crown: a sky bar with a glowing band and a floating roof.
  const barY = top + 0.2;
  const barH = 3.2;
  box(B.solid, x0 + 0.8, top, z0 + 1, x1 - 0.8, barY, z1 - 0.2, C.pier, { omit: 'b' });
  const glow = hex('#ffcf96');
  for (let u = x0 + 1.5; u < x1 - 1.5; u += 2.4) {
    quad(B.lit, [u, barY, z1 - 1.5], [u + 2.2, barY, z1 - 1.5], [u + 2.2, barY + barH, z1 - 1.5], [u, barY + barH, z1 - 1.5],
      (_, i) => (i < 2 ? mul(glow, 0.8) : glow), { baked: false, uv: [[0, 0], [0, 0], [0, 0], [0, 0]] });
    box(B.solid, u + 2.2, barY, z1 - 1.5, u + 2.4, barY + barH, z1 - 1.3, C.brass, { omit: 'bk', gain: 1.8 });
  }
  box(B.solid, x0 + 0.1, barY + barH, z0 + 0.4, x1 - 0.1, barY + barH + 0.5, z1 + 0.5, C.stone, { under: mul(WARM, 0.75) });
  for (let u = x0 + 2.5; u < x1; u += 5) halo(u, barY + barH - 0.4, z1 - 0.6, 3.4, mul(WARM, 0.7));
}

function buildLobby() {
  const x0 = -16, x1 = 4;
  const glow = hex('#ffcf96');
  // Double-height glass wall with brass mullions.
  for (let u = x0; u < x1; u += 2.5) {
    quad(B.lit, [u, 0.1, 0.1], [u + 2.5, 0.1, 0.1], [u + 2.5, PODIUM - 0.1, 0.1], [u, PODIUM - 0.1, 0.1],
      (_, i) => (i < 2 ? mul(glow, 0.95) : glow), { baked: false, uv: [[0, 0], [0, 0], [0, 0], [0, 0]] });
    box(B.solid, u - 0.06, 0, 0.1, u + 0.06, PODIUM, 0.28, C.brass, { omit: 'kb', gain: 1.2 });
  }
  // Interior silhouettes: columns behind the glass.
  for (let u = x0 + 3; u < x1; u += 5) box(B.solid, u - 0.28, 0, 0.14, u + 0.28, PODIUM, 0.2, hex('#7a5a36'), { omit: 'kb', gain: 1.3 });
  // Transom and hotel fascia above the glass.
  box(B.solid, x0, PODIUM - 0.2, 0, x1, PODIUM + 0.4, 0.5, C.pier, { omit: 'kb' });

  // Chandeliers seen through the glass.
  for (let u = x0 + 2.5; u < x1; u += 5) halo(u, 4.8, 0.6, 3, mul(glow, 0.9));

  // Cantilevered canopy over the drop-off.
  const cz = 11;
  box(B.solid, -15, 5.7, 0.2, 3, 6.3, cz, C.stone, { omit: 'k', under: mul(mix(C.soffit, WARM, 0.65), 0.95) });
  box(B.solid, -15.1, 6.3, 0.2, 3.1, 6.5, cz + 0.1, C.brass, { omit: 'kb', gain: 1.3 });
  for (const x of [-13.8, -8.5, -3.5, 1.8]) {
    cylinder(B.solid, x, 0, cz - 1, 0.2, 5.7, 0.16, C.brass, 8);
    lightPool(x, cz - 1, 3.5, mul(WARM, 0.5));
  }
  // Downlight points and the pool of light they throw.
  for (let x = -13; x <= 2; x += 3.75) for (let z = 3; z <= 9; z += 3) halo(x, 5.62, z, 1.5, mul(WARM, 0.9));
  lightPool(-6, 6, 26, mul(WARM, 0.42));
  // Entry steps.
  for (let s = 0; s < 3; s++) box(B.solid, -10 + s * 0.3, 0, 0.3 + (2 - s) * 0.7, -2 - s * 0.3, 0.17 * (s + 1), 0.3 + (3 - s) * 0.7, C.coping, { omit: 'bk' });
}

/* ---------- Ground ---------- */

function buildTerrain() {
  const X0 = -220, X1 = 220, Z0 = -120, Z1 = 150, STEP = 5;
  const lawn = (p) => mix(C.lawn, hex('#2d4930'), (Math.sin(p[0] * 0.21) + Math.cos(p[2] * 0.17)) * 0.25 + 0.5);
  for (let x = X0; x < X1; x += STEP) {
    for (let z = Z0; z < Z1; z += STEP) {
      const inFootprint = x > -84 && x + STEP < 77 && z > -12 && z + STEP < 0;
      if (inFootprint) continue;
      quad(B.solid, [x, 0, z + STEP], [x + STEP, 0, z + STEP], [x + STEP, 0, z], [x, 0, z], lawn);
    }
  }
  // Coarse apron beyond the detailed area, seen only at the edges and under the camera.
  const COARSE = 40;
  for (let x = -460; x < 460; x += COARSE) {
    for (let z = -120; z < 480; z += COARSE) {
      if (x >= X0 && x + COARSE <= X1 && z >= Z0 && z + COARSE <= Z1) continue;
      quad(B.solid, [x, -0.05, z + COARSE], [x + COARSE, -0.05, z + COARSE], [x + COARSE, -0.05, z], [x, -0.05, z], lawn);
    }
  }
  // Valley floor running out to the ridges. Lives in the far mesh, fog does the rest.
  const valley = hex('#223229');
  const add = (x0, x1) => {
    const base = B.far.pos.length / 3;
    [[x0, -0.1, -120], [x1, -0.1, -120], [x1, -0.1, -900], [x0, -0.1, -900]].forEach((p) => pushVertex(B.far, p, mul(valley, 0.75)));
    B.far.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  add(-2200, 2200);
}

function paved(x0, z0, x1, z1, size, colors, { skip = () => false, y = 0.04 } = {}) {
  for (let x = x0; x < x1; x += size) {
    for (let z = z0; z < z1; z += size) {
      const xe = Math.min(x + size - 0.05, x1);
      const ze = Math.min(z + size - 0.05, z1);
      if (skip((x + xe) / 2, (z + ze) / 2)) continue;
      const c = mix(pick(colors), pick(colors), rnd());
      quad(B.solid, [x, y, ze], [xe, y, ze], [xe, y, z], [x, y, z], c);
    }
  }
}

function buildDrive() {
  for (const [a, c] of [[-190, -22], [10, 190]]) {
    paved(a, 9.5, c, 14, 5, [mul(C.forecourt, 0.62), mul(C.forecourt, 0.55)]);
    for (let x = a + 6; x < c; x += 13) {
      const side = Math.round((x - a) / 13) % 2 ? 8.8 : 14.7;
      cylinder(B.solid, x, 0, side, 0.07, 3.7, 0.05, C.iron, 5);
      halo(x, 3.8, side, 2.2, mul(WARM, 0.95));
      lightPool(x, side, 9, mul(WARM, 0.34));
    }
  }
}

function buildPaving() {
  // Pool deck, wrapping the water.
  paved(POOL.x0 - 8, POOL.z0 - 6, POOL.x1 + 8, POOL.z1 + 14, 2.5, [C.deck, C.deckAlt], {
    skip: (x, z) => insidePool(x, z, 0.1),
  });
  // Forecourt under the canopy and the walk from it to the deck.
  paved(-22, 0.5, 10, 14.5, 3, [C.forecourt, mul(C.forecourt, 0.86)]);

  // Coping stone around the pool.
  const { x0, x1, z0, z1 } = POOL;
  const w = 0.7, h = 0.16;
  box(B.solid, x0 - w, 0, z0 - w, x1 + w, h, z0, C.coping, { omit: 'bk' });
  box(B.solid, x0 - w, 0, z1, x1 + w, h, z1 + w, C.coping, { omit: 'b' });
  box(B.solid, x0 - w, 0, z0, x0, h, z1, C.coping, { omit: 'bl' });
  box(B.solid, x1, 0, z0, x1 + w, h, z1, C.coping, { omit: 'br' });
}

/* ---------- Planting ---------- */

function palm(x, z, height, { lean = 0.5, fronds = 12, spread = 1, dark = false } = {}) {
  const dir = rnd() * Math.PI * 2;
  const phase = rnd();
  const segments = 6;
  const spine = (t) => [
    x + Math.sin(dir) * lean * height * 0.13 * t * t,
    height * t,
    z + Math.cos(dir) * lean * height * 0.13 * t * t,
  ];

  // Trunk: uplit, so bright at the base and falling off upward.
  const trunkColor = (p) => mix(mul(C.trunk, dark ? 0.35 : 3.4), mul(C.trunk, dark ? 0.2 : 0.75), smooth(0, height * 0.9, p[1]));
  for (let s = 0; s < segments; s++) {
    const t0 = s / segments, t1 = (s + 1) / segments;
    const a = spine(t0), c = spine(t1);
    const r0 = 0.3 - t0 * 0.14, r1 = 0.3 - t1 * 0.14;
    for (let k = 0; k < 6; k++) {
      const a0 = (k / 6) * Math.PI * 2, a1 = ((k + 1) / 6) * Math.PI * 2;
      const pt = (ctr, r, an) => [ctr[0] + Math.sin(an) * r, ctr[1], ctr[2] + Math.cos(an) * r];
      const sw0 = t0 * 0.3, sw1 = t1 * 0.3;
      const base = B.foliage.pos.length / 3;
      const pts = [pt(a, r0, a0), pt(a, r0, a1), pt(c, r1, a1), pt(c, r1, a0)];
      const n = faceNormal(pts[0], pts[1], pts[2]);
      pts.forEach((p, i) => pushVertex(B.foliage, p, bake(trunkColor(p), p, n), [i < 2 ? sw0 : sw1, phase]));
      B.foliage.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  // Crown of arching fronds.
  const crown = spine(1);
  const reach = height * 0.36 * spread;
  for (let f = 0; f < fronds; f++) {
    const az = (f / fronds) * Math.PI * 2 + range(-0.2, 0.2);
    const up = f % 2 ? range(0.35, 0.55) : range(0.1, 0.3);
    const len = reach * range(0.82, 1.1);
    const pieces = 6;
    const sideX = Math.cos(az), sideZ = -Math.sin(az);
    const dirX = Math.sin(az), dirZ = Math.cos(az);
    const color = rnd() < 0.5 ? C.frond : C.frondAlt;
    const fp = rnd();

    const point = (t) => [
      crown[0] + dirX * len * t,
      crown[1] + (up * t - 0.9 * t * t) * len * 0.75,
      crown[2] + dirZ * len * t,
    ];
    const swayAt = (t) => clamp01(0.3 + t * 0.7);
    for (let p = 0; p < pieces; p++) {
      const t0 = p / pieces, t1 = (p + 1) / pieces;
      const w0 = Math.sin(Math.PI * Math.min(1, t0 + 0.08)) * len * 0.11 + 0.02;
      const w1 = Math.sin(Math.PI * Math.min(1, t1 + 0.08)) * len * 0.11 + 0.02;
      const m0 = point(t0), m1 = point(t1);
      const drop = 0.28;
      const l0 = [m0[0] + sideX * w0, m0[1] - w0 * drop, m0[2] + sideZ * w0];
      const l1 = [m1[0] + sideX * w1, m1[1] - w1 * drop, m1[2] + sideZ * w1];
      const r0 = [m0[0] - sideX * w0, m0[1] - w0 * drop, m0[2] - sideZ * w0];
      const r1 = [m1[0] - sideX * w1, m1[1] - w1 * drop, m1[2] - sideZ * w1];
      const shade = dark ? 0.42 : 1;
      // Uplight catches the underside close to the trunk and fades toward the tips.
      const col = (q) => {
        const warmth = dark ? 0 : (1 - smooth(0, 1, Math.hypot(q[0] - crown[0], q[2] - crown[2]) / len)) * 0.9;
        return mix(mul(color, shade * 1.9), mul(WARM, 0.7), warmth * 0.35);
      };
      const add = (a, c, d, e, side) => {
        const n = faceNormal(a, c, d);
        const nUp = n[1] < 0 ? [-n[0], -n[1], -n[2]] : n;
        const base = B.foliage.pos.length / 3;
        [a, c, d, e].forEach((q, i) => pushVertex(B.foliage, q, bake(col(q), q, nUp, side), [swayAt(i === 0 || i === 3 ? t0 : t1), fp]));
        B.foliage.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      };
      add(m0, m1, l1, l0, 1);
      add(r0, r1, m1, m0, 0.8);
    }
  }

  if (!dark) {
    lightPool(x, z, 7, mul(WARM, 0.3));
    halo(x, 0.5, z, 1.3, mul(WARM, 0.7));
  }
}

function hedge(x0, z0, x1, z1, h = 1.1, litFrom = true) {
  const nx = Math.max(1, Math.round((x1 - x0) / 1.8));
  const nz = Math.max(1, Math.round((z1 - z0) / 1.8));
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const u0 = x0 + ((x1 - x0) * i) / nx, u1 = x0 + ((x1 - x0) * (i + 1)) / nx;
      const v0 = z0 + ((z1 - z0) * k) / nz, v1 = z0 + ((z1 - z0) * (k + 1)) / nz;
      const top = h + range(-0.07, 0.07);
      const color = (p) => mix(litFrom ? C.hedgeLit : C.hedge, C.hedge, smooth(0, top, p[1]));
      box(B.solid, u0, 0, v0, u1, top, v1, color, { omit: 'b', gain: range(0.92, 1.1) });
    }
  }
}

function topiary(x, z, r = 0.9) {
  cylinder(B.solid, x, 0, z, 0.5, 0.75, 0.62, C.coping, 8, { caps: true });
  blob(B.foliage, x, 0.75 + r * 0.95, z, r, r, r, C.hedgeLit, { sway: 0.04, phase: rnd(), subdivide: true });
  lightPool(x, z, 4.5, mul(WARM, 0.2));
}

function cypress(x, z, h) {
  const r = h * 0.11;
  for (let k = 0; k < 8; k++) {
    const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
    const rim = (a, rr, y) => [x + Math.sin(a) * rr, y, z + Math.cos(a) * rr];
    const col = (p) => mix(C.hedge, C.cypress, smooth(0, h * 0.5, p[1]));
    const base = B.foliage.pos.length / 3;
    const pts = [rim(a0, r * 0.75, 0), rim(a1, r * 0.75, 0), rim(a1, r, h * 0.42), rim(a0, r, h * 0.42)];
    const n = faceNormal(pts[0], pts[1], pts[2]);
    pts.forEach((p, i) => pushVertex(B.foliage, p, bake(col(p), p, n), [i < 2 ? 0 : 0.06, 0.3]));
    B.foliage.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    const tip = [x, h, z];
    const tb = B.foliage.pos.length / 3;
    const tp = [pts[3], pts[2], tip];
    const tn = faceNormal(tp[0], tp[1], tp[2]);
    tp.forEach((p, i) => pushVertex(B.foliage, p, bake(col(p), p, tn), [i < 2 ? 0.06 : 0.16, 0.3]));
    B.foliage.idx.push(tb, tb + 1, tb + 2);
  }
}

function buildPlanting() {
  // Palms framing the drop-off and the walk to the pool.
  [[-19, 11, 12], [7, 11.5, 12.5], [-27, 15, 14], [15, 15.5, 13], [-40, 15, 13], [28, 15, 14.5]].forEach(([x, z, h]) => palm(x, z, h));
  // Around the deck.
  [[-53, 26, 15], [-55, 38, 12], [-54, 53, 15], [41, 27, 14.5], [43, 42, 12.5], [42, 56, 15],
    [-38, 72, 13.5], [-16, 75, 11], [6, 74, 12], [26, 72, 15]].forEach(([x, z, h]) => palm(x, z, h));
  // Island in the pool.
  palm(ISLAND.x - 1.4, ISLAND.z, 12.5, { lean: 0.9 });
  palm(ISLAND.x + 1.8, ISLAND.z + 1, 10, { lean: 1.2 });
  palm(ISLAND.x + 0.6, ISLAND.z - 2, 8, { lean: 1.1 });
  // Against the building, for depth over the facade.
  [[-81, 7, 15], [-70, 6, 18], [-58, 6.5, 15], [-44, 5, 15], [-31, 5.5, 17], [-21, 4.6, 12], [33, 9, 16], [44, 7, 18], [56, 7, 15], [68, 6.5, 17], [78, 8, 14]].forEach(([x, z, h]) => palm(x, z, h));
  // Close to the camera: frame the shot and give the cursor strong parallax.
  [[-47, 122, 36], [-57, 104, 28], [44, 126, 34], [55, 108, 26]].forEach(([x, z, h]) => palm(x, z, h, { dark: true, fronds: 16, spread: 0.72 }));

  // Cypress rows beyond the wings.
  for (let i = 0; i < 12; i++) cypress(-92 - i * 4.2, -4 + (i % 2) * 2, range(10, 15));
  for (let i = 0; i < 12; i++) cypress(84 + i * 4.4, -2 + (i % 2) * 2, range(10, 15));

  // Hedges around the forecourt and deck.
  hedge(-22, 14.5, -12.5, 15.8);
  hedge(2.5, 14.5, 10, 15.8);
  hedge(-90, 2.5, -24, 3.4, 0.9);
  hedge(32, 7, 84, 8, 1);
  const edge = { x0: POOL.x0 - 9, x1: POOL.x1 + 9, z1: POOL.z1 + 15 };
  hedge(edge.x0, edge.z1, edge.x1, edge.z1 + 1.2, 1.25, false);
  hedge(edge.x0 - 1.2, 15, edge.x0, edge.z1, 1.25);
  hedge(edge.x1, 15, edge.x1 + 1.2, edge.z1, 1.25);

  [-20, -16, 4.5, 8.5].forEach((x) => topiary(x, 13.5));
  [[-21.5, 2.5], [8.5, 2.5], [-17, 2.6]].forEach(([x, z]) => topiary(x, z, 0.8));

  // Tree mass behind and beside the hotel; low detail, mostly silhouette.
  for (let i = 0; i < 420; i++) {
    const side = rnd();
    const x = side < 0.55 ? range(-250, 250) : side < 0.78 ? range(-250, -100) : range(92, 250);
    const z = side < 0.55 ? range(-112, -25) : range(-20, 55);
    const s = range(2.8, 6.2);
    blob(B.foliage, x, s * range(0.9, 1.3), z, s * range(0.85, 1.1), s * range(1, 1.5), s, mix(C.tree, C.frond, rnd() * 0.7), { sway: 0.015, phase: rnd() });
  }
  // Low planting in the foreground lawn.
  for (let i = 0; i < 60; i++) {
    const x = range(66, 150) * (rnd() < 0.5 ? -1 : 1);
    const z = range(60, 118);
    const s = range(1, 2.4);
    blob(B.foliage, x, s * 0.65, z, s * 1.3, s * 0.9, s, C.frondAlt, { sway: 0.04, phase: rnd() });
  }
}

/* ---------- Pool-side furniture and lamps ---------- */

function lounger(x, z, yaw = 1) {
  const y = 0.32;
  box(B.solid, x - 0.35, 0.05, z - 0.95, x + 0.35, y - 0.05, z + 0.5, C.teak, { omit: 'b' });
  quad(B.solid, [x - 0.33, y, z + 0.5], [x + 0.33, y, z + 0.5], [x + 0.33, y, z - 0.5], [x - 0.33, y, z - 0.5], C.fabric);
  const back = yaw > 0 ? -0.5 : 0.5;
  quad(B.solid, [x - 0.33, y, z + back], [x + 0.33, y, z + back], [x + 0.33, y + 0.55, z + back * 1.9], [x - 0.33, y + 0.55, z + back * 1.9], C.fabric, { gain: 1 });
}

function parasol(x, z, closed = false) {
  cylinder(B.solid, x, 0, z, 0.045, 2.6, 0.04, C.teak, 5);
  const r = closed ? 0.34 : 1.9;
  const base = closed ? 1.2 : 2.25;
  cylinder(B.solid, x, base, z, r, closed ? 2.7 : 2.85, 0.03, C.fabric, 8);
  if (!closed) {
    // A small warm lamp under each open parasol.
    halo(x, 2.15, z, 1.4, mul(WARM, 0.75));
    lightPool(x, z, 4.8, mul(WARM, 0.22));
  }
}

function cabana(x, z) {
  const w = 2, h = 3.1, d = 2;
  for (const [u, v] of [[-w, -d], [w, -d], [-w, d], [w, d]]) box(B.solid, x + u - 0.1, 0, z + v - 0.1, x + u + 0.1, h, z + v + 0.1, C.teak, { omit: 'b' });
  box(B.solid, x - w - 0.3, h, z - d - 0.3, x + w + 0.3, h + 0.3, z + d + 0.3, C.fabric, { under: mul(WARM, 0.8) });
  // Warm curtain at the back and a daybed.
  quad(B.lit, [x - w, 0.1, z - d], [x + w, 0.1, z - d], [x + w, h, z - d], [x - w, h, z - d], (_, i) => mul(hex('#ffbd7f'), i < 2 ? 0.5 : 0.25), { baked: false, uv: [[0.2, 0], [0.2, 0], [0.2, 0], [0.2, 0]] });
  box(B.solid, x - 1.5, 0.05, z - 1.3, x + 1.5, 0.55, z + 1.3, C.fabric, { omit: 'b' });
  halo(x, h - 0.2, z, 2.4, mul(WARM, 0.8));
  lightPool(x, z, 7.5, mul(WARM, 0.32));
}

function buildFurniture() {
  // Bollards.
  for (const [x, z] of bollards) {
    box(B.solid, x - 0.07, 0, z - 0.07, x + 0.07, 0.72, z + 0.07, C.iron, { omit: 'b' });
    box(B.solid, x - 0.09, 0.72, z - 0.09, x + 0.09, 0.8, z + 0.09, C.brass, { omit: 'b', gain: 4 });
    halo(x, 0.76, z, 0.9, mul(WARM, 0.95));
    lightPool(x, z, 3.6, mul(WARM, 0.3));
  }

  // Island.
  const { x, z, r } = ISLAND;
  cylinder(B.solid, x, 0, z, r, 0.28, r - 0.1, C.coping, 20);
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
    tri(B.solid, [x + Math.sin(a0) * (r - 0.1), 0.28, z + Math.cos(a0) * (r - 0.1)], [x + Math.sin(a1) * (r - 0.1), 0.28, z + Math.cos(a1) * (r - 0.1)], [x, 0.28, z], C.hedgeLit);
  }
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, rr = range(0.6, r - 0.7);
    blob(B.foliage, x + Math.sin(a) * rr, 0.6, z + Math.cos(a) * rr, 0.75, 0.55, 0.75, C.hedgeLit, { sway: 0.06, phase: rnd() });
  }

  // Sun loungers in pairs, with a parasol between each pair, along the near deck.
  for (let lx = POOL.x0 + 1; lx < POOL.x1 - 2; lx += 6.5) {
    lounger(lx - 0.6, POOL.z1 + 3.2);
    lounger(lx + 0.6, POOL.z1 + 3.2);
    parasol(lx, POOL.z1 + 5.4, Math.floor(lx) % 3 === 0);
  }
  // And along the far deck, facing the water.
  for (let lx = POOL.x0 + 3; lx < POOL.x1 - 2; lx += 8) {
    lounger(lx - 0.6, POOL.z0 - 2.1, -1);
    lounger(lx + 0.6, POOL.z0 - 2.1, -1);
  }
  [[POOL.x0 - 5.5, 28], [POOL.x0 - 5.5, 40], [POOL.x0 - 5.5, 52], [POOL.x1 + 5.5, 34], [POOL.x1 + 5.5, 46]].forEach(([cx, cz]) => cabana(cx, cz));

  // Low string of lamps above the far deck, sagging between posts.
  const posts = [POOL.x0 - 4, -14, 2, POOL.x1 + 4];
  const py = 4.2;
  const pz = POOL.z0 - 4.6;
  posts.forEach((px) => cylinder(B.solid, px, 0, pz, 0.06, py, 0.05, C.iron, 5));
  for (let s = 0; s < posts.length - 1; s++) {
    const a = posts[s], c = posts[s + 1];
    const lamps = Math.round((c - a) / 1.5);
    for (let i = 0; i <= lamps; i++) {
      const t = i / lamps;
      halo(a + (c - a) * t, py - 0.9 * 4 * t * (1 - t), pz, 0.75, mul(hex('#ffc47f'), 0.95));
    }
  }
}

/* ---------- Mountains ---------- */

const noise1 = (x) => Math.sin(x * 0.0093 + 1.3) * 0.5 + Math.sin(x * 0.021 + 4.1) * 0.28 + Math.sin(x * 0.047 + 0.7) * 0.15 + Math.sin(x * 0.103 + 2.2) * 0.07;

function ridge(z, height, offset, color, lightEdge, step) {
  const X = 1700;
  const crest = (px) => Math.max(6, height * (0.46 + 0.54 * (noise1(px + offset) * 0.5 + 0.5)) + Math.sin(px * 0.13 + offset) * height * 0.035);
  const colorAt = (p) => mix(color, lightEdge, smooth(0.25, 1, p[1] / height));
  const add = (p0, p1, p2, facet) => {
    const base = B.far.pos.length / 3;
    [p0, p1, p2].forEach((p) => pushVertex(B.far, p, mul(colorAt(p), facet)));
    B.far.idx.push(base, base + 1, base + 2);
  };
  const shoulderOf = (px) => [px, crest(px) * 0.52, z + 30];
  for (let x = -X; x < X; x += step) {
    const a = [x, crest(x), z];
    const c = [x + step, crest(x + step), z];
    const a2 = shoulderOf(x);
    const c2 = shoulderOf(x + step);
    // Crest to shoulder, faceted; shoulder to the ground, plain.
    add(a2, c, a, range(0.8, 1.2));
    add(a2, c2, c, range(0.8, 1.2));
    add([x, 0, z + 60], c2, a2, 0.82);
    add([x, 0, z + 60], [x + step, 0, z + 60], c2, 0.82);
  }
}

/* ---------- Assemble ---------- */

buildTerrain();
buildPaving();
buildDrive();
buildWing();
buildTower();
buildLobby();
buildPlanting();
buildFurniture();
ridge(-300, 44, 300, hex('#14242c'), hex('#26333f'), 26);
ridge(-520, 62, 900, hex('#2a3550'), hex('#463f5e'), 38);
ridge(-800, 92, 1700, hex('#3f3b59'), hex('#6a5168'), 56);

/* ---------- Write the GLB ---------- */

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('hotel');

let triangles = 0;
for (const [name, b] of Object.entries(B)) {
  const prim = doc.createPrimitive();
  prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.pos)).setBuffer(buffer));
  prim.setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(b.col)).setBuffer(buffer));
  prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(b.uv)).setBuffer(buffer));
  if (name === 'halos') {
    prim.setMode(Primitive.Mode.POINTS);
  } else {
    const verts = b.pos.length / 3;
    const Idx = verts > 65535 ? Uint32Array : Uint16Array;
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Idx(b.idx)).setBuffer(buffer));
    triangles += b.idx.length / 3;
  }
  const mesh = doc.createMesh(name).addPrimitive(prim);
  scene.addChild(doc.createNode(name).setMesh(mesh));
  console.log(`  ${name.padEnd(8)} ${name === 'halos' ? `${b.pos.length / 3} points` : `${b.idx.length / 3} triangles`}`);
}

await MeshoptEncoder.ready;
await doc.transform(
  // Position precision is per mesh, which is why mountains live in their own.
  quantize({ quantizePosition: 15, quantizeTexcoord: 10, quantizeColor: 10 }),
  reorder({ encoder: MeshoptEncoder, target: 'size' }),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({
  method: EXTMeshoptCompression.EncoderMethod.QUANTIZE,
});

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, await io.writeBinary(doc));
console.log(`  total    ${triangles} triangles, ${(statSync(OUT).size / 1024).toFixed(0)} KB → ${OUT}`);
