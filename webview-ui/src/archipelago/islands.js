// One island per Directory, in daylight: the archipelago view's world.
import * as THREE from './three.js';
import {
  bench,
  cellTower,
  cottage,
  dumbbellRack,
  foldPhone,
  gymPavilion,
  kettlebell,
  fountain,
  labDome,
  lampPost,
  officeTower,
  pineTree,
  roundTree,
  serverRack,
} from './landmarks.js';
import {
  boat,
  bush,
  crystal,
  desk,
  dock,
  flowers,
  hammock,
  palm,
  rock,
  signalMast,
} from './props.js';
import { rng } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
/** The island radius the ground paint is laid out for (= ISLAND_R). */
const ISLAND_R_FOR_PAINT = 11;

// ── Shared helpers ────────────────────────────────────────────────────────
function put(world, obj, x, z, rotY = 0, dy = 0) {
  obj.position.set(x, world.groundY(x, z) + dy, z);
  obj.rotation.y = rotY;
  world.root.add(obj);
  obj.updateMatrixWorld(true);
  return obj;
}
const at = (isl, ang, frac) => [
  isl.x + Math.cos(ang) * isl.r * frac,
  isl.z + Math.sin(ang) * isl.r * frac,
];
const far = (p, avoid, d) => avoid.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > d);

function scatter(
  world,
  isl,
  seed,
  { palms = 3, rocks = 3, bushes = 3, flowers: fl = 2, trees = 0, tree = null, pal = {} } = {},
  avoid = [],
) {
  const r = rng(seed);
  const used = [...avoid];
  const place = (count, lo, hi, minH, make, gap = 2.0, accept = () => true) => {
    for (let i = 0, tries = 0; i < count && tries < 120; tries++) {
      const p = at(isl, r() * Math.PI * 2, lo + r() * (hi - lo));
      if (world.groundY(p[0], p[1]) < minH || !far(p, used, gap) || !accept(p)) continue;
      used.push(p);
      make(p, i++);
    }
  };
  // Palms stay out of the work area (the front half, where desks, mast and
  // dock are): behind it, or out on the sides.
  const behindOrSide = (p) => p[1] < isl.z - isl.r * 0.15 || Math.abs(p[0] - isl.x) > isl.r * 0.62;
  // Tall props (palms, trees) fade when they hide an agent: own materials each.
  const tall = (obj) => {
    const mats = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      mats.push(o.material);
    });
    (world.palms ??= []).push({ group: obj, mats, opacity: 1 });
  };
  place(
    palms,
    0.5,
    0.84,
    0.05,
    (p, i) => {
      const pm = put(world, palm(seed * 10 + i, 3.2 + r() * 1.2, pal), p[0], p[1]);
      world.onUpdate((t) => pm.userData.sway(t));
      tall(pm);
    },
    2.0,
    behindOrSide,
  );
  if (tree)
    place(
      trees,
      0.45,
      0.86,
      0.05,
      (p, i) => tall(put(world, tree(seed * 20 + i, 2.0 + r() * 0.9), p[0], p[1], r() * 6)),
      1.8,
      behindOrSide,
    );
  place(
    bushes,
    0.15,
    0.65,
    0.4,
    (p, i) => put(world, bush(seed + i, 0.45 + r() * 0.3, pal.bush), p[0], p[1]),
    1.4,
  );
  place(
    fl,
    0.15,
    0.6,
    0.4,
    (p, i) => put(world, flowers(seed + 50 + i, pal.flowers), p[0], p[1]),
    1.2,
  );
  place(
    rocks,
    0.85,
    1.05,
    -1.5,
    (p, i) => put(world, rock(seed + 70 + i, 0.4 + r() * 0.5, pal.rock), p[0], p[1], r() * 6, -0.1),
    1.2,
  );
  return used;
}

/** Puffs of smoke over a chimney; on only while `isOn()`. */
function smoke(world, origin, isOn, color = '#e8e6ef') {
  const puffs = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.3, 1),
      new THREE.MeshStandardMaterial({
        color,
        transparent: true,
        opacity: 0,
        roughness: 1,
        depthWrite: false,
      }),
    );
    world.root.add(m);
    return m;
  });
  let level = 0;
  world.onUpdate((t, dt) => {
    level += ((isOn() ? 1 : 0) - level) * Math.min(1, dt * 1.5);
    puffs.forEach((p, i) => {
      const a = (t * 0.3 + i / puffs.length) % 1;
      p.position.set(
        origin.x + Math.sin(a * 5 + i) * 0.25 + a * 1.1,
        origin.y + a * 3.6,
        origin.z + a * 0.3,
      );
      p.scale.setScalar(0.35 + a * 1.1);
      p.material.opacity = (1 - a) * 0.5 * level;
    });
  });
}

/** A dock out from an island's shore at angle `ang`; returns where to sit at its end. */
function addDock(world, isl, ang, len = 5) {
  const [sx, sz] = at(isl, ang, 0.86);
  const dir = [Math.cos(ang), Math.sin(ang)];
  const d = dock(len);
  d.group.position.set(sx, 0, sz);
  d.group.rotation.y = Math.atan2(dir[0], dir[1]);
  world.root.add(d.group);
  const end = [sx + dir[0] * (len - 0.6), sz + dir[1] * (len - 0.6)];
  world.bridges.push({
    a: [sx - dir[0] * 1.5, sz - dir[1] * 1.5],
    b: [sx + dir[0] * len, sz + dir[1] * len],
    ya: 0.42,
    yb: 0.42,
    sag: 0,
  });
  return {
    x: end[0],
    z: end[1],
    face: Math.atan2(dir[0], dir[1]),
    pose: 'sit',
    seatY: 0.05,
    isl: isl.key,
  };
}

/** A desk on land; the agent stands behind it facing the camera (+z). */
function addDesk(world, x, z, screen, face = 0) {
  const d = desk(screen);
  put(world, d.group, x, z, face + Math.PI);
  return {
    x: x - Math.sin(face) * 0.8,
    z: z - Math.cos(face) * 0.8,
    face,
    pose: 'work',
    screenMat: d.screenMat,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Sunset — one island per project
// ═══════════════════════════════════════════════════════════════════════════

export const DAY_PAL = {
  skyTop: '#2b78dc',
  skyMid: '#79c2f2',
  horizon: '#e4f6fb',
  sunDisc: '#fffbe6',
  sunDir: V(0.5, 0.7, 0.55),
  sunSize: 0.0012,
  skyClouds: 1.0,
  cloudColor: '#ffffff',
  deep: '#1270b0',
  shallow: '#3fe0cf',
  foam: '#ffffff',
  waterSky: '#bfe8f8',
  sunGlint: '#ffffff',
  fog: '#cdedf8',
  fogDensity: 0.0038,
  sunLight: '#fff4e0',
  sunIntensity: 3.0,
  hemiSky: '#d4ecff',
  hemiGround: '#5c8c6c',
  hemiIntensity: 1.25,
  land: {
    grass: '#73c159',
    grassLight: '#92d56a',
    sand: '#f7e3b2',
    sandWet: '#d8bd8a',
    rock: '#a39a90',
    rockDark: '#6d6760',
  },
};

/** Where the nth island goes (more than ten wrap onto a wider ring). */
const LAYOUT = [
  [-14, 3],
  [13, -8],
  [15, 12],
  [-30, -10],
  [0, -22],
  [31, -3],
  [-4, 22],
  [-33, 15],
  [30, 22],
  [-18, -26],
];
const ROOFS = [
  '#d0584a',
  '#4a7bd0',
  '#3e9a6a',
  '#8a5ad0',
  '#d0a03a',
  '#3aa8c0',
  '#c0508a',
  '#6a8a3a',
];
const HAMMOCKS = ['#ff9a6a', '#6ac8ff', '#ffd36b', '#c58bff'];
/** Desks per island; a fifth agent shares a desk (offset). */
const SLOTS = 4;
/** Ground at least this high is land a robot can sit on (the sea is at 0). */
const SHORE_MIN_Y = 0.2;
/** How far off the coast a paddle boarder keeps. */
const PADDLE_OFFSHORE = 2.4;
/** Island radius, and how far apart the layout spreads them. */
const ISLAND_R = 11;
const SPREAD = 1.35;

// Ground paint, in island-local coordinates (dx, dz from its centre). The
// landmark stands at HOME (see buildIslands), the desks along z ≈ +1.1.
const HOME = [-ISLAND_R_FOR_PAINT * 0.15, -ISLAND_R_FOR_PAINT * 0.4];
const inRect = (dx, dz, x0, x1, z0, z1) => dx >= x0 && dx <= x1 && dz >= z0 && dz <= z1;
const ring = (dx, dz, cx, cz, rx, rz) => Math.hypot((dx - cx) / rx, (dz - cz) / rz);

/**
 * Island styles (ids shared with islandThemes.ts). Each brings its landmark,
 * its ground, what grows on it and a few props of its own. The desks, the
 * mast, the dock and the hammock (where agents stand) are the same in all.
 */
const THEMES = {
  beach: {
    landmark: cottage,
    scatter: { palms: 4, bushes: 4, rocks: 4, flowers: 3 },
  },
  company: {
    landmark: officeTower,
    // Round and tidy, a flat lawn: a campus.
    shape: { wobble: 0.07, bumpy: 0.2 },
    paint(dx, dz) {
      // The plaza before the tower, the office terrace under the desks, a path between.
      if (inRect(dx, dz, HOME[0] - 3.2, HOME[0] + 3.2, HOME[1] - 2.2, HOME[1] + 2.6))
        return (Math.floor(dx * 0.9) + Math.floor(dz * 0.9)) % 2 ? '#d9d6cf' : '#cbc7be';
      if (inRect(dx, dz, -6.4, 6.8, -0.4, 2.6)) return '#c7c2b8';
      if (inRect(dx, dz, -0.7, 0.7, HOME[1] + 2.6, -0.4)) return '#d4cfc5';
      if (inRect(dx, dz, 2.2, 9, 3.4, 4.4)) return '#d4cfc5';
      return null;
    },
    land: {
      grass: '#5fae55',
      grassLight: '#7cc466',
      sand: '#e9e1cc',
      sandWet: '#cbbf9f',
      rock: '#a8a8a8',
      rockDark: '#707070',
    },
    scatter: { palms: 0, bushes: 6, rocks: 2, flowers: 5, trees: 6, tree: roundTree },
    screen: '#bfe0ff',
    extras(world, isl, accent, crewOf, spot) {
      const out = [];
      for (const [ang, frac, rot] of [
        [2.3, 0.7, 0.9],
        [0.8, 0.72, -0.9],
      ]) {
        const [x, z] = spot(ang, frac);
        put(world, bench(), x, z, rot);
        out.push([x, z]);
      }
      const fx = isl.x + 5.4;
      const fz = isl.z + 3.9;
      const fo = fountain();
      put(world, fo, fx, fz);
      world.onUpdate((t) => fo.userData.update(t));
      out.push([fx, fz]);
      for (const [lx, lz] of [
        [-2.6, -1.6],
        [2.0, -1.6],
        [-6.8, 1],
        [7.2, 1],
      ]) {
        put(world, lampPost(accent), isl.x + lx, isl.z + lz);
        out.push([isl.x + lx, isl.z + lz]);
      }
      return out;
    },
  },
  lab: {
    landmark: labDome,
    // Craggy, rocky: a research outpost.
    shape: { wobble: 0.34, bumpy: 1.4 },
    paint(dx, dz) {
      const d = ring(dx, dz, HOME[0], HOME[1], 1, 1);
      if (d < 2.7) return '#8d97a3';
      if (d < 3.15) return '#3fd4c4';
      // A tiled metal floor under the desks and the racks.
      if (
        inRect(dx, dz, -6.4, 7.4, -0.6, 2.4) ||
        inRect(dx, dz, 0.4, 5.4, HOME[1] - 1, HOME[1] + 1.6)
      )
        return (Math.floor(dx) + Math.floor(dz)) % 2 ? '#6c7682' : '#5b6470';
      return null;
    },
    land: {
      grass: '#7aa88a',
      grassLight: '#93bf9c',
      sand: '#e2dccb',
      sandWet: '#c2b99f',
      rock: '#8e96a0',
      rockDark: '#5e6670',
    },
    scatter: { palms: 0, bushes: 3, rocks: 6, flowers: 1, trees: 6, tree: pineTree },
    screen: '#7affc4',
    extras(world, isl, accent, crewOf, spot, home) {
      const out = [];
      for (let k = 0; k < 3; k++) {
        const rack = serverRack(isl.seed + k);
        const x = home[0] + 2.6 + k * 0.78;
        const z = home[1] + 0.2;
        put(world, rack, x, z, 0);
        world.onUpdate((t) =>
          rack.userData.update(
            t,
            crewOf(isl.key).some((a) => a.state === 'work'),
          ),
        );
        out.push([x, z]);
      }
      const [cx, cz] = spot(3.0, 0.72);
      put(world, crystal(isl.seed + 9, accent), cx, cz);
      out.push([cx, cz]);
      return out;
    },
  },
  device: {
    landmark: foldPhone,
    shape: { wobble: 0.16, bumpy: 0.7 },
    paint(dx, dz) {
      // The phone stands on a charging pad, its ring lit blue.
      const d = ring(dx, dz, HOME[0], HOME[1], 1, 1);
      if (d < 2.7) return '#ece8df';
      if (d < 3.1) return '#4f8dff';
      if (inRect(dx, dz, -6.4, 6.8, -0.4, 2.6)) return '#e4ddcf';
      return null;
    },
    scatter: { palms: 2, bushes: 4, rocks: 3, flowers: 3, trees: 2, tree: roundTree },
    screen: '#ffd36b',
    extras(world, isl, accent, crewOf, spot, home) {
      const tower = cellTower();
      const x = home[0] + 2.9;
      const z = home[1] - 0.4;
      put(world, tower, x, z);
      world.onUpdate((t) => tower.userData.update(t));
      return [[x, z]];
    },
  },
  gym: {
    landmark: gymPavilion,
    // Flat as a sports field, with a running track round the gym.
    shape: { wobble: 0.1, bumpy: 0.25 },
    paint(dx, dz) {
      const d = ring(dx, dz, HOME[0] + 0.6, HOME[1] + 0.2, 5.6, 3.0);
      if (d > 0.84 && d < 1.14) return '#c8573e';
      if (d <= 0.84) return '#5cb84e';
      return null;
    },
    land: {
      grass: '#6cc45a',
      grassLight: '#8ad86c',
      sand: '#f2dfb0',
      sandWet: '#d4ba88',
      rock: '#a39a90',
      rockDark: '#6d6760',
    },
    scatter: { palms: 2, bushes: 4, rocks: 3, flowers: 2, trees: 2, tree: roundTree },
    screen: '#ff9ac8',
    extras(world, isl, accent, crewOf, spot, home) {
      const out = [];
      const rx = home[0] + 3.0;
      const rz = home[1] + 0.4;
      put(world, dumbbellRack(), rx, rz, -0.3);
      out.push([rx, rz]);
      for (let k = 0; k < 3; k++) {
        const x = rx - 0.6 + k * 0.5;
        const z = rz + 1.0;
        put(world, kettlebell(['#2a2c34', '#e05a4a', '#4a8ae0'][k]), x, z, k);
      }
      return out;
    },
  },
};

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Builds an island per project. `crewOf(project)` returns that island's agents
 * (live records with `state`), read every frame by the props that react.
 * Returns where each agent stands for each state, the island labels and bounds.
 */
export function buildIslands(world, projects, crewOf, themeOf = () => 'beach') {
  const themes = projects.map((name) => THEMES[themeOf(name)] ?? THEMES.beach);
  const islands = projects.map((name, i) => {
    const base = LAYOUT[i % LAYOUT.length];
    const ring = 1 + Math.floor(i / LAYOUT.length) * 0.75;
    const seed = (hash(name) % 997) + 3;
    const isl = world.addIsland({
      x: base[0] * ring * SPREAD,
      z: base[1] * ring * SPREAD,
      r: ISLAND_R,
      h: 1.5,
      seed,
      land: themes[i].land,
      ...themes[i].shape,
      paint: themes[i].paint,
    });
    isl.key = name;
    isl.seed = seed;
    return isl;
  });
  const spotTable = new Map();
  islands.forEach((isl, idx) => {
    const key = isl.key;
    const theme = themes[idx];
    const accent = ROOFS[idx % ROOFS.length];
    const hs = theme.landmark(accent);
    const hx = isl.x - isl.r * 0.15;
    const hz = isl.z - isl.r * 0.4;
    put(world, hs.group, hx, hz, 0.15);
    const desks = Array.from({ length: SLOTS }, (_, i) =>
      addDesk(
        world,
        isl.x + (i - (SLOTS - 1) / 2) * 2.8 + 0.4,
        isl.z + isl.r * 0.1,
        theme.screen ?? '#8fe3ff',
      ),
    );
    const mast = signalMast();
    const [mx, mz] = at(isl, -0.35, 0.62);
    put(world, mast, mx, mz);
    world.onUpdate((t) =>
      mast.userData.set(
        t,
        crewOf(key).some((a) => a.state === 'need'),
      ),
    );
    const DOCK_ANG = 1.25;
    const dk = addDock(world, isl, DOCK_ANG, 5);
    const hm = hammock(HAMMOCKS[idx % HAMMOCKS.length]);
    const [ax, az] = at(isl, 3.6, 0.52);
    put(world, hm.group, ax, az, 0.4);
    const extra =
      theme.extras?.(world, isl, accent, crewOf, (ang, frac) => at(isl, ang, frac), [hx, hz]) ?? [];
    scatter(world, isl, (hash(key) % 9973) + 5, theme.scatter, [
      [hx, hz],
      [hx + 1.6, hz],
      [hx - 1.6, hz],
      [mx, mz],
      [ax, az],
      ...desks.map((d) => [d.x, d.z + 0.8]),
      ...extra,
    ]);
    const working = () => crewOf(key).some((a) => a.state === 'work');
    if (hs.smokeFrom) smoke(world, hs.group.localToWorld(hs.smokeFrom.clone()), working);
    world.onUpdate((t) => hs.update(t, working()));
    world.onUpdate((t) => {
      const crew = crewOf(key);
      desks.forEach((d, i) => {
        const busy = crew.some((a) => a.slot % SLOTS === i && a.state === 'work');
        d.screenMat.emissiveIntensity = busy ? 1.1 + Math.sin(t * 9 + i) * 0.15 : 0.08;
      });
    });
    // A sub-agent's boat, while any agent here runs one.
    const b = boat('#f4efe6', '#ffffff', ROOFS[idx % ROOFS.length]);
    world.root.add(b);
    world.onUpdate((t) => {
      b.visible = crewOf(key).some((a) => a.sub && a.state === 'work');
      const an = t * 0.25 + idx;
      const R = isl.r + 3.2;
      b.position.set(
        isl.x + Math.cos(an) * R,
        Math.sin(t * 1.4) * 0.08,
        isl.z + Math.sin(an) * R * 0.9,
      );
      b.rotation.y = -an;
    });
    // Free time by the water (not over a sea of clouds): fishing from the
    // shore on one side of the dock, paddle boarding off the other.
    const wet = !world.pal?.cloudLow;
    // The coast along a ray from the centre: the outermost point still on
    // land (an island's outline wanders well inside its nominal radius).
    const shoreAt = (ang) => {
      for (let f = 1.3; f > 0.2; f -= 0.01) {
        const p = at(isl, ang, f);
        if (world.groundY(p[0], p[1]) >= SHORE_MIN_Y) return { f, p };
      }
      return { f: 0.5, p: at(isl, ang, 0.5) };
    };
    const fishSpot = (k) => {
      const ang = DOCK_ANG - 0.75 - k * 0.4;
      const [x, z] = shoreAt(ang).p;
      return { x, z, face: Math.atan2(Math.cos(ang), Math.sin(ang)), pose: 'fish', isl: key };
    };
    const paddleSpot = (k) => {
      const base = DOCK_ANG + 1.7 + k * 0.6;
      const sweep = 0.45;
      // Clear of the coast all along the arc.
      let far = 0;
      for (let a = base - sweep; a <= base + sweep; a += 0.05)
        far = Math.max(far, shoreAt(a).f * isl.r);
      const R = far + PADDLE_OFFSHORE;
      return {
        x: isl.x + Math.cos(base) * R,
        z: isl.z + Math.sin(base) * R,
        via: shoreAt(base).p,
        face: Math.atan2(-Math.sin(base), Math.cos(base)),
        pose: 'paddle',
        orbit: { cx: isl.x, cz: isl.z, R, base, sweep },
        isl: key,
      };
    };
    spotTable.set(key, (slot, state, agent) => {
      const k = slot % SLOTS;
      const extra = Math.floor(slot / SLOTS) * 0.6;
      switch (state) {
        case 'work':
          return { ...desks[k], x: desks[k].x + extra, isl: key };
        case 'need':
          return { x: mx - 1.2 + k * 0.9, z: mz + 1.0 + extra, face: 0, pose: 'need', isl: key };
        case 'done':
          return {
            ...dk,
            x: dk.x - Math.sin(dk.face) * slot * 0.9,
            z: dk.z - Math.cos(dk.face) * slot * 0.9,
          };
        default:
          // A main agent with nothing to do goes fishing or paddling, by id
          // so it keeps its pastime; Sub-agents wait by the hammock.
          if (wet && agent && agent.parentId === null) {
            const n = Math.abs(agent.id);
            return n % 2 === 0 ? fishSpot(k) : paddleSpot(k);
          }
          return slot === 0
            ? { x: ax, z: az, face: 0.4 + Math.PI / 2, pose: 'lie', seatY: 0.45, isl: key }
            : { x: ax + 1.2 + slot * 0.8, z: az + 1.6, face: 0.3, pose: 'idle', isl: key };
      }
    });
  });
  // Bounds, for framing the camera.
  let cx = 0;
  let cz = 0;
  for (const i of islands) {
    cx += i.x;
    cz += i.z;
  }
  cx /= islands.length;
  cz /= islands.length;
  let span = 0;
  for (const i of islands) span = Math.max(span, Math.hypot(i.x - cx, i.z - cz) + i.r);
  return {
    spotFor: (project, slot, state, agent) => spotTable.get(project)(slot, state, agent),
    labels: islands.map((v) => ({ text: v.key, pos: V(v.x, v.h + 4.8, v.z - v.r * 0.4) })),
    islands: islands.map((v) => ({ name: v.key, center: V(v.x, v.h, v.z), r: v.r })),
    center: V(cx, 0, cz),
    span,
  };
}
