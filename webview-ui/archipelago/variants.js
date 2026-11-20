// The four archipelago variants: same crew, different worlds and meanings.
import * as THREE from './three.js';
import {
  beachChair,
  boat,
  bush,
  campfire,
  crystal,
  desk,
  dock,
  dome,
  flowers,
  glowMat,
  hammock,
  holoSign,
  house,
  lantern,
  lighthouse,
  lightBridge,
  networkOrb,
  palm,
  parasol,
  plankBridge,
  podTower,
  rock,
  signalMast,
  waterfall,
} from './props.js';
import { rng } from './world.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

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
  { palms = 3, rocks = 3, bushes = 3, flowers: fl = 2, pal = {} } = {},
  avoid = [],
) {
  const r = rng(seed);
  const used = [...avoid];
  const place = (count, lo, hi, minH, make, gap = 2.0) => {
    for (let i = 0, tries = 0; i < count && tries < 80; tries++) {
      const p = at(isl, r() * Math.PI * 2, lo + r() * (hi - lo));
      if (world.groundY(p[0], p[1]) < minH || !far(p, used, gap)) continue;
      used.push(p);
      make(p, i++);
    }
  };
  place(palms, 0.5, 0.82, 0.05, (p, i) => {
    const pm = put(world, palm(seed * 10 + i, 3.2 + r() * 1.2, pal), p[0], p[1]);
    world.onUpdate((t) => pm.userData.sway(t));
  });
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

/** Bridge two islands with a plank bridge; returns its ends. */
function bridgeIslands(world, A, B, opts) {
  const ang = Math.atan2(B.z - A.z, B.x - A.x);
  const a = [A.x + Math.cos(ang) * A.r * 0.72, A.z + Math.sin(ang) * A.r * 0.72];
  const b = [B.x - Math.cos(ang) * B.r * 0.72, B.z - Math.sin(ang) * B.r * 0.72];
  const span = world.addSpan(a, b, 0.5);
  const br = plankBridge(world, span, opts);
  world.root.add(br.group);
  return { a, b, from: A.key, to: B.key };
}

/** Route over bridges between islands (BFS), then to the spot. */
function router(links) {
  return (from, to) => {
    if (!from || from.isl === to.isl) return [[to.x, to.z]];
    const prev = new Map([[from.isl, null]]);
    const q = [from.isl];
    while (q.length) {
      const k = q.shift();
      if (k === to.isl) break;
      for (const L of links) {
        const [u, v, a, b] =
          L.from === k ? [L.from, L.to, L.a, L.b] : L.to === k ? [L.to, L.from, L.b, L.a] : [];
        if (u && !prev.has(v)) {
          prev.set(v, { k: u, a, b });
          q.push(v);
        }
      }
    }
    const hops = [];
    for (let k = to.isl; prev.get(k); k = prev.get(k).k) hops.unshift(prev.get(k));
    const pts = [];
    for (const h of hops) pts.push(h.a, h.b);
    pts.push([to.x, to.z]);
    return pts;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Sunset — one island per project
// ═══════════════════════════════════════════════════════════════════════════
const SUNSET = {
  key: 'sunset',
  name: 'Atardecer',
  title: 'Islas por proyecto',
  tagline: 'Cada proyecto es una isla. Tus agentes viven y trabajan en la isla de su proyecto.',
  info: `
    <ul>
      <li><b>Trabajando</b>: en su escritorio, con la laptop encendida; sale humo de la chimenea.</li>
      <li><b>Te necesita</b>: corre al mástil, sube la bandera y salta. El <b>faro</b> del centro se pone ámbar y gira.</li>
      <li><b>Terminó</b>: se sienta al final del muelle a esperar tu próximo mensaje.</li>
      <li><b>Sin nada</b>: descansa en la hamaca.</li>
      <li>Los <b>sub-agentes</b> son botes que salen de la isla y vuelven al terminar.</li>
    </ul>
    <p class="why">Se adapta a tu día a día: varios proyectos (Directories) en paralelo, cada uno con su gente.</p>`,
  pal: {
    skyTop: '#2a2a6c',
    skyMid: '#b7678c',
    horizon: '#ffb48c',
    sunDisc: '#ffdca6',
    sunDir: V(-0.5, 0.11, -1),
    sunSize: 0.0018,
    skyClouds: 0.7,
    cloudColor: '#ffc4b2',
    deep: '#373c80',
    shallow: '#47c1b6',
    foam: '#fff3e8',
    waterSky: '#f4a08a',
    sunGlint: '#ffd6a0',
    fog: '#e7a192',
    fogDensity: 0.0052,
    sunLight: '#ffc89e',
    sunIntensity: 2.8,
    hemiSky: '#ffc3ac',
    hemiGround: '#40345e',
    hemiIntensity: 1.15,
    land: {
      grass: '#68a64e',
      grassLight: '#84c05c',
      sand: '#f1d49e',
      sandWet: '#c9a477',
      rock: '#9b8579',
      rockDark: '#5d4c55',
    },
  },
  bloom: { strength: 0.5, radius: 0.55, threshold: 0.85 },
  camera: { pos: V(-4, 25, 66), target: V(-10, -1, -6) },
  build(world, crew) {
    const I = {
      'pixel-agents': world.addIsland({ x: -14, z: 3, r: 10, h: 1.5, seed: 3 }),
      'horus-api': world.addIsland({ x: 13, z: -8, r: 8, h: 1.9, seed: 7 }),
      'horus-web': world.addIsland({ x: 15, z: 12, r: 7.5, h: 1.3, seed: 11 }),
      scratch: world.addIsland({ x: -30, z: -10, r: 5.5, h: 1.0, seed: 19 }),
      rock: world.addIsland({ x: -1, z: -19, r: 3.2, h: 2.4, seed: 23 }),
    };
    for (const [k, v] of Object.entries(I)) v.key = k;
    const spots = {};
    const houses = {};
    const roofs = {
      'pixel-agents': '#d0584a',
      'horus-api': '#4a7bd0',
      'horus-web': '#3e9a6a',
      scratch: '#8a5ad0',
    };
    for (const key of ['pixel-agents', 'horus-api', 'horus-web', 'scratch']) {
      const isl = I[key];
      const hs = house({
        roof: roofs[key],
        w: key === 'scratch' ? 2 : 2.8,
        d: key === 'scratch' ? 1.8 : 2.2,
      });
      const hx = isl.x - isl.r * 0.15;
      const hz = isl.z - isl.r * 0.35;
      put(world, hs.group, hx, hz, 0.15);
      houses[key] = hs;
      const mine = crew.filter((a) => a.project === key);
      const desks = mine.map((a, i) =>
        addDesk(
          world,
          isl.x + (i - (mine.length - 1) / 2) * 2.4 + 0.6,
          isl.z + isl.r * 0.18,
          a.color === '#ffcc4d' ? '#ffe19a' : '#8fe3ff',
        ),
      );
      const mast = signalMast();
      const [mx, mz] = at(isl, -0.3, 0.55);
      put(world, mast, mx, mz);
      world.onUpdate((t) =>
        mast.userData.set(
          t,
          mine.some((a) => a.state === 'need'),
        ),
      );
      const dk = addDock(
        world,
        isl,
        key === 'horus-api' ? 0.2 : key === 'scratch' ? 2.4 : 1.25,
        4.5,
      );
      const hm = hammock(
        ['#ff9a6a', '#6ac8ff', '#ffd36b', '#c58bff'][Object.keys(roofs).indexOf(key)],
      );
      const [ax, az] = at(isl, 3.6, 0.5);
      put(world, hm.group, ax, az, 0.4);
      const avoid = [[hx, hz], [mx, mz], [ax, az], ...desks.map((d) => [d.x, d.z + 0.8])];
      scatter(
        world,
        isl,
        isl.x * 3 + 5,
        { palms: key === 'scratch' ? 2 : 4, bushes: 4, rocks: 4, flowers: 3 },
        avoid,
      );
      smoke(world, hs.group.localToWorld(hs.smokeFrom.clone()), () =>
        mine.some((a) => a.state === 'work'),
      );
      world.onUpdate((t) => {
        const on = mine.some((a) => a.state === 'work');
        hs.windowMats.forEach(
          (m) => (m.emissiveIntensity += ((on ? 1.6 : 0.25) - m.emissiveIntensity) * 0.05),
        );
      });
      mine.forEach((a, i) => {
        world.onUpdate(
          (t) =>
            (desks[i].screenMat.emissiveIntensity =
              a.state === 'work' ? 1.1 + Math.sin(t * 9 + i) * 0.15 : 0.08),
        );
        spots[a.id] = {
          work: { ...desks[i], isl: key },
          need: { x: mx + 1.0 + i * 0.9, z: mz + 0.6, face: 0, pose: 'need', isl: key },
          done: {
            ...dk,
            x: dk.x - Math.sin(dk.face) * i * 0.9,
            z: dk.z - Math.cos(dk.face) * i * 0.9,
          },
          idle:
            i === 0
              ? { x: ax, z: az, face: 0.4 + Math.PI / 2, pose: 'lie', seatY: 0.45, isl: key }
              : { x: ax + 1.5, z: az + 1.6, face: 0.3, pose: 'idle', isl: key },
        };
      });
    }
    // The lighthouse: lights up amber when anyone needs you.
    const lh = lighthouse();
    put(world, lh.group, I.rock.x, I.rock.z);
    scatter(world, I.rock, 77, { palms: 0, bushes: 1, rocks: 5, flowers: 0 }, [
      [I.rock.x, I.rock.z],
    ]);
    world.onUpdate((t) => {
      const need = crew.some((a) => a.state === 'need');
      const c = need ? '#ffb020' : '#fff1c2';
      lh.lampMat.emissive.set(c);
      lh.lampMat.color.set(c);
      lh.beamMat.color.set(c);
      lh.light.color.set(c);
      lh.beamMat.opacity = need ? 0.28 : 0.1;
      lh.pivot.rotation.y = t * (need ? 1.6 : 0.4);
      lh.lampMat.emissiveIntensity = need ? 3 + Math.sin(t * 8) : 1.2;
    });
    // A sub-agent's boat around horus-web.
    const web = crew.find((a) => a.sub);
    const b = boat('#f4efe6', '#ffffff', web.color);
    world.root.add(b);
    world.onUpdate((t) => {
      const show = web.state === 'work';
      b.visible = show;
      const a = t * 0.25;
      const R = I['horus-web'].r + 3.2;
      b.position.set(
        I['horus-web'].x + Math.cos(a) * R,
        Math.sin(t * 1.4) * 0.08,
        I['horus-web'].z + Math.sin(a) * R * 0.9,
      );
      b.rotation.y = -a;
      b.rotation.z = Math.sin(t * 1.2) * 0.05;
    });
    // Sailboats on the horizon.
    for (let i = 0; i < 3; i++) {
      const sb = boat('#e9e2d0', '#ffffff', '#d8463c');
      sb.scale.setScalar(1.2);
      world.root.add(sb);
      world.onUpdate((t) => {
        sb.position.set(-70 + ((t * 1.2 + i * 45) % 140), Math.sin(t + i) * 0.1, -48 - i * 9);
        sb.rotation.y = Math.PI / 2;
      });
    }
    const labels = Object.entries(I)
      .filter(([k]) => k !== 'rock')
      .map(([k, v]) => ({ text: k, pos: V(v.x, v.h + 4.8, v.z - v.r * 0.35), color: '#ffffff' }));
    labels.push({ text: 'Lighthouse', pos: V(I.rock.x, 9.5, I.rock.z), small: true });
    return { spots, route: (f, t) => [[t.x, t.z]], labels };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. Night — a harbour of states
// ═══════════════════════════════════════════════════════════════════════════
const NIGHT = {
  key: 'night',
  name: 'Noche',
  title: 'Puerto por estados',
  tagline: 'Pocas islas, una por estado. Los agentes cruzan los puentes cuando cambian de estado.',
  info: `
    <ul>
      <li><b>Taller</b>: los que están trabajando, cada uno en su escritorio bajo los faroles.</li>
      <li><b>Faro</b>: los que te necesitan. Se juntan al pie del faro, que se pone ámbar.</li>
      <li><b>Playa</b>: los que terminaron se sientan alrededor de la fogata; los que no tienen nada, en las hamacas.</li>
      <li><b>Llegadas</b>: el muelle por donde entran los agentes nuevos.</li>
    </ul>
    <p class="why">Es la versión más fácil de leer: contás personas en el faro y sabés cuántos te esperan.</p>`,
  pal: {
    skyTop: '#03061a',
    skyMid: '#0b1838',
    horizon: '#20385f',
    sunDisc: '#e8f0ff',
    sunDir: V(0.45, 0.3, -1),
    sunSize: 0.0011,
    stars: 1,
    skyClouds: 0.35,
    cloudColor: '#2a3a66',
    deep: '#06112a',
    shallow: '#12566e',
    foam: '#7fb4d8',
    ripple: 0.06,
    foamAmount: 0.5,
    waterSky: '#1f3a66',
    sunGlint: '#6f85bc',
    fog: '#0c1730',
    fogDensity: 0.0078,
    sunLight: '#9fb8ff',
    sunIntensity: 1.2,
    hemiSky: '#3b5aa2',
    hemiGround: '#0a0d1a',
    hemiIntensity: 0.85,
    land: {
      grass: '#3c6a4e',
      grassLight: '#4b7d59',
      sand: '#b8a27e',
      sandWet: '#8a7a62',
      rock: '#5e6478',
      rockDark: '#33364a',
    },
  },
  bloom: { strength: 1.0, radius: 0.6, threshold: 0.55 },
  camera: { pos: V(-2, 25, 64), target: V(-7, -1, -4) },
  build(world, crew) {
    const T = world.addIsland({ x: -9, z: 2, r: 11, h: 1.6, seed: 31 });
    const F = world.addIsland({ x: 17, z: -12, r: 4.6, h: 2.4, seed: 37 });
    const P = world.addIsland({ x: 18, z: 12, r: 8.5, h: 0.9, seed: 41 });
    const L = world.addIsland({ x: -28, z: 15, r: 4.6, h: 0.8, seed: 43 });
    Object.assign(T, { key: 'taller' });
    Object.assign(F, { key: 'faro' });
    Object.assign(P, { key: 'playa' });
    Object.assign(L, { key: 'llegada' });
    const links = [
      bridgeIslands(world, T, F),
      bridgeIslands(world, T, P),
      bridgeIslands(world, T, L),
    ];
    // Workshop: a big house and a row of desks under lanterns.
    const ws = house({ w: 4.6, d: 2.8, h: 2.2, wall: '#e6d7bd', roof: '#7a4a6a' });
    put(world, ws.group, T.x - 2, T.z - 5, 0.1);
    ws.windowMats.forEach((m) => (m.emissiveIntensity = 2.2));
    smoke(world, ws.group.localToWorld(ws.smokeFrom.clone()), () => true, '#8a90a8');
    const desks = crew.map((a, i) =>
      addDesk(world, T.x - 6 + i * 2.6, T.z + 1.5 + (i % 2) * 0.6, '#8fe3ff'),
    );
    world.onUpdate((t) =>
      crew.forEach(
        (a, i) =>
          (desks[i].screenMat.emissiveIntensity =
            a.state === 'work' ? 1.4 + Math.sin(t * 9 + i) * 0.2 : 0.05),
      ),
    );
    const lanterns = [];
    for (let i = 0; i < 4; i++) {
      const ln = lantern();
      put(world, ln.group, T.x - 7.5 + i * 4.4, T.z - 0.5);
      lanterns.push(ln);
    }
    const lamp = new THREE.PointLight('#ffc77a', 18, 16, 1.6);
    lamp.position.set(T.x - 1, 3.5, T.z + 1);
    world.root.add(lamp);
    scatter(world, T, 131, { palms: 4, bushes: 4, rocks: 5, flowers: 2 }, [
      [T.x - 2, T.z - 5],
      ...desks.map((d) => [d.x, d.z + 0.8]),
      ...links.map((l) => l.a),
    ]);
    // Lighthouse.
    const lh = lighthouse();
    put(world, lh.group, F.x + 0.6, F.z - 0.8);
    scatter(world, F, 137, { palms: 1, bushes: 1, rocks: 6, flowers: 0 }, [
      [F.x + 0.6, F.z - 0.8],
      links[0].b,
    ]);
    world.onUpdate((t) => {
      const need = crew.some((a) => a.state === 'need');
      const c = need ? '#ffb020' : '#fff1c2';
      [lh.lampMat.emissive, lh.lampMat.color, lh.beamMat.color, lh.light.color].forEach((x) =>
        x.set(c),
      );
      lh.beamMat.opacity = need ? 0.3 : 0.12;
      lh.pivot.rotation.y = t * (need ? 1.5 : 0.35);
      lh.lampMat.emissiveIntensity = need ? 3.5 + Math.sin(t * 8) : 1.6;
      lh.light.intensity = need ? 14 : 6;
    });
    // Beach: campfire, hammocks, a moored boat.
    const fire = campfire();
    put(world, fire, P.x, P.z + 0.5);
    world.onUpdate((t) => fire.userData.flicker(t));
    const fireSeats = [0, 1, 2, 3, 4].map((i) => {
      const a = -Math.PI / 2 + (i - 2) * 0.75;
      const x = P.x + Math.cos(a) * 2.1;
      const z = P.z + 0.5 + Math.sin(a) * 2.1;
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.9, 7),
        new THREE.MeshStandardMaterial({ color: '#6a4528', flatShading: true }),
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = a + Math.PI / 2;
      log.castShadow = true;
      put(world, log, x, z, 0, 0.18);
      return {
        x,
        z,
        face: Math.atan2(P.x - x, P.z + 0.5 - z),
        pose: 'sit',
        seatY: 0.3,
        isl: 'playa',
      };
    });
    const hammocks = [0, 1].map((i) => {
      const h = hammock(i ? '#6ac8ff' : '#ff9a6a');
      const x = P.x + 3.5 + i * 0.2;
      const z = P.z - 3 + i * 3.4;
      put(world, h.group, x, z, 1.2);
      return { x, z, face: 1.2 + Math.PI / 2, pose: 'lie', seatY: 0.45, isl: 'playa' };
    });
    scatter(world, P, 141, { palms: 5, bushes: 2, rocks: 4, flowers: 1 }, [
      [P.x, P.z],
      ...fireSeats.map((s) => [s.x, s.z]),
      ...hammocks.map((s) => [s.x, s.z]),
      links[1].b,
    ]);
    const moored = boat('#e9e2d0', '#ffffff', '#4a7bd0');
    world.root.add(moored);
    world.onUpdate((t) => {
      moored.position.set(P.x + 9, Math.sin(t * 1.3) * 0.08, P.z + 4);
      moored.rotation.set(0, 0.6, Math.sin(t) * 0.04);
    });
    // Arrivals dock + a ferry.
    const arr = addDock(world, L, 2.3, 5);
    const ln = lantern();
    put(world, ln.group, L.x + 1.5, L.z - 1);
    scatter(world, L, 151, { palms: 2, bushes: 1, rocks: 3, flowers: 1 }, [
      [L.x + 1.5, L.z - 1],
      links[2].b,
      [arr.x, arr.z],
    ]);
    const ferry = boat('#3a3f5a', '#e6e8f2', '#ffb020');
    ferry.scale.setScalar(1.3);
    world.root.add(ferry);
    world.onUpdate((t) => {
      const a = (t * 0.03) % 1;
      const x = -60 + a * 34;
      ferry.position.set(x, Math.sin(t * 1.2) * 0.1, 26);
      ferry.rotation.y = Math.PI / 2;
    });
    // Fireflies over the beach.
    const flies = Array.from({ length: 18 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), glowMat('#d8ff8a', 4));
      world.root.add(m);
      return m;
    });
    world.onUpdate((t) =>
      flies.forEach((m, i) =>
        m.position.set(
          P.x + Math.sin(t * 0.3 + i * 1.7) * 6,
          1.5 + Math.sin(t * 0.8 + i) * 0.6,
          P.z + Math.cos(t * 0.27 + i * 2.3) * 5,
        ),
      ),
    );
    const needSpots = [0, 1, 2].map((i) => {
      const a = 1.9 + i * 0.6;
      return {
        x: F.x + 0.6 + Math.cos(a) * 1.9,
        z: F.z - 0.8 + Math.sin(a) * 1.9,
        face: 0,
        pose: 'need',
        isl: 'faro',
      };
    });
    const spots = {};
    crew.forEach((a, i) => {
      spots[a.id] = {
        work: { ...desks[i], isl: 'taller' },
        need: needSpots[i % 3],
        done: fireSeats[i],
        idle: i % 2 ? hammocks[0] : { ...fireSeats[(i + 2) % 5], pose: 'idle' },
      };
    });
    // Two agents may want the same hammock: give the second its own spot.
    let hm = 0;
    crew.forEach((a) => {
      if (spots[a.id].idle.pose === 'lie') spots[a.id].idle = hammocks[hm++ % 2];
    });
    return {
      spots,
      route: router(links),
      labels: [
        { text: 'Workshop', sub: 'working', pos: V(T.x - 2, 6.5, T.z - 5) },
        { text: 'Lighthouse', sub: 'needs you', pos: V(F.x, 10.5, F.z), accent: '#ffb020' },
        { text: 'Beach', sub: 'done · idle', pos: V(P.x, 4.5, P.z - 3) },
        { text: 'Arrivals', sub: 'new agents', pos: V(L.x, 3.5, L.z - 2) },
      ],
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. Day — one island per agent
// ═══════════════════════════════════════════════════════════════════════════
const DAY = {
  key: 'day',
  name: 'Día',
  title: 'Una isla por agente',
  tagline: 'Cada agente tiene su propia isla y su casita. La isla entera te cuenta cómo está.',
  info: `
    <ul>
      <li>Techo del color del agente; su nombre flota encima.</li>
      <li><b>Trabajando</b>: en la compu, con humo en la chimenea.</li>
      <li><b>Te necesita</b>: sube la bandera ámbar y te saluda.</li>
      <li><b>Terminó</b>: en la reposera, bajo la sombrilla. <b>Sin nada</b>: en la hamaca.</li>
      <li>Un <b>puente colgante</b> une al Lead con sus Teammates; los <b>sub-agentes</b> salen en bote.</li>
      <li>El <b>banco de arena con el "+"</b> es para lanzar un agente nuevo.</li>
    </ul>
    <p class="why">La más personal: con pocos agentes, cada uno tiene identidad propia.</p>`,
  pal: {
    skyTop: '#2b78dc',
    skyMid: '#79c2f2',
    horizon: '#e4f6fb',
    sunDisc: '#fffbe6',
    sunDir: V(0.55, 0.85, 0.45),
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
  },
  bloom: { strength: 0.22, radius: 0.4, threshold: 0.95 },
  camera: { pos: V(-3, 24, 62), target: V(-5, -1, -6) },
  build(world, crew) {
    const pos = [
      [-27, 1],
      [-13, -9],
      [2, -13],
      [17, -8],
      [28, 3],
    ];
    const isl = crew.map((a, i) => {
      const I = world.addIsland({ x: pos[i][0], z: pos[i][1], r: 5.6, h: 1.25, seed: 60 + i * 7 });
      I.key = `a${a.id}`;
      return I;
    });
    const plus = world.addIsland({ x: 12, z: 12, r: 3.2, h: 0.35, seed: 99 });
    plus.key = 'plus';
    const links = [];
    crew.forEach((a, i) => {
      if (a.lead)
        links.push(
          bridgeIslands(world, isl[crew.findIndex((c) => c.id === a.lead)], isl[i], {
            lanterns: false,
          }),
        );
    });
    const spots = {};
    crew.forEach((a, i) => {
      const I = isl[i];
      const hs = house({ roof: a.color, w: 2.3, d: 1.9, h: 1.5, wall: '#fbf3e2' });
      const hx = I.x - 1.2;
      const hz = I.z - 2.2;
      put(world, hs.group, hx, hz, 0.1);
      smoke(world, hs.group.localToWorld(hs.smokeFrom.clone()), () => a.state === 'work');
      const dk = addDesk(world, I.x + 1.6, I.z + 0.4, '#8fe3ff');
      world.onUpdate(
        (t) =>
          (dk.screenMat.emissiveIntensity =
            a.state === 'work' ? 1.0 + Math.sin(t * 9) * 0.15 : 0.05),
      );
      const mast = signalMast();
      const [mx, mz] = [I.x + 2.6, I.z - 2.0];
      put(world, mast, mx, mz);
      world.onUpdate((t) => mast.userData.set(t, a.state === 'need'));
      const ch = beachChair(a.color);
      const [cx, cz] = [I.x - 2.6, I.z + 2.4];
      put(world, ch.group, cx, cz, 0.3);
      const ps = parasol(a.color);
      put(world, ps, cx - 0.9, cz - 0.6);
      const hm = hammock('#f4efe6');
      const [hmx, hmz] = [I.x - 0.2, I.z + 3.6];
      put(world, hm.group, hmx, hmz, 0);
      scatter(world, I, 300 + i * 17, { palms: 3, bushes: 2, rocks: 3, flowers: 2 }, [
        [hx, hz],
        [I.x + 1.6, I.z - 0.4],
        [mx, mz],
        [cx, cz],
        [hmx, hmz],
        ...links.flatMap((l) => [l.a, l.b]),
      ]);
      spots[a.id] = {
        work: { ...dk, isl: I.key },
        need: { x: mx - 0.9, z: mz + 0.7, face: 0, pose: 'need', isl: I.key },
        done: { x: cx, z: cz, face: 0.3, pose: 'sit', seatY: 0.35, isl: I.key },
        idle: { x: hmx, z: hmz, face: Math.PI / 2, pose: 'lie', seatY: 0.45, isl: I.key },
      };
      if (a.sub) {
        const b = boat('#f4efe6', '#ffffff', a.color);
        world.root.add(b);
        world.onUpdate((t) => {
          b.visible = a.state === 'work';
          const an = t * 0.3;
          b.position.set(
            I.x + Math.cos(an) * 8.5,
            Math.sin(t * 1.4) * 0.08,
            I.z + Math.sin(an) * 7.5,
          );
          b.rotation.y = -an;
        });
      }
    });
    // The "+" sandbar: a sign to launch a new agent.
    const sign = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: '#8d6845', flatShading: true }),
    );
    post.position.y = 0.8;
    sign.add(post);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.0, 0.1),
      new THREE.MeshStandardMaterial({ color: '#fbf3e2', flatShading: true }),
    );
    board.position.y = 1.7;
    sign.add(board);
    const plusMat = glowMat('#ff6fae', 0.6);
    for (const [w, h] of [
      [0.7, 0.18],
      [0.18, 0.7],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), plusMat);
      bar.position.set(0, 1.7, 0.07);
      sign.add(bar);
    }
    put(world, sign, plus.x, plus.z, -0.2);
    world.onUpdate((t) => (plusMat.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.3));
    const labels = crew.map((a, i) => ({
      text: a.name,
      sub: a.project,
      pos: V(isl[i].x - 1.2, 5.2, isl[i].z - 2.2),
      accent: a.color,
    }));
    labels.push({ text: 'New agent', pos: V(plus.x, 3.4, plus.z), accent: '#ff6fae' });
    return { spots, route: router(links), labels };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. Futurist — floating islands over a sea of clouds
// ═══════════════════════════════════════════════════════════════════════════
const FLOAT = {
  key: 'float',
  name: 'Futurista',
  title: 'Islas flotantes',
  tagline:
    'Islas flotando sobre un mar de nubes, unidas por puentes de luz a un núcleo con el orbe de la red.',
  info: `
    <ul>
      <li>Una isla por proyecto, con su cartel holográfico.</li>
      <li>Por los <b>puentes de luz</b> viajan paquetes de datos: es la actividad de cada proyecto.</li>
      <li>El <b>orbe</b> del núcleo tiene un nodo por agente, del color de su estado.</li>
      <li><b>Te necesita</b>: se levanta una columna de luz ámbar sobre la isla.</li>
      <li>Los <b>sub-agentes</b> son drones que orbitan la isla.</li>
    </ul>
    <p class="why">La que retoma tu idea futurista, con la estructura del archipiélago.</p>`,
  pal: {
    skyTop: '#0a0524',
    skyMid: '#3b1460',
    horizon: '#e05a8c',
    sunDisc: '#ffb8dc',
    sunDir: V(-0.4, 0.14, -1),
    sunSize: 0.0022,
    stars: 0.9,
    cloudLow: '#2c1548',
    cloudHigh: '#f08ab4',
    cloudY: -26,
    fog: '#5a2464',
    fogDensity: 0.0072,
    sunLight: '#ffb6e2',
    sunIntensity: 1.7,
    hemiSky: '#b06ad8',
    hemiGround: '#1a0d2a',
    hemiIntensity: 0.95,
    land: {
      grass: '#4caa88',
      grassLight: '#6ccfa2',
      sand: '#d6c2e8',
      sandWet: '#a890c0',
      rock: '#6a5a8a',
      rockDark: '#24183a',
    },
  },
  bloom: { strength: 1.05, radius: 0.65, threshold: 0.6 },
  camera: { pos: V(-4, 23, 66), target: V(-10, -3, -4) },
  build(world, crew) {
    const defs = {
      'pixel-agents': { x: -15, z: 3, r: 8.5, h: 1.1, seed: 203 },
      'horus-api': { x: 14, z: -10, r: 7, h: 1.3, seed: 207 },
      'horus-web': { x: 15, z: 12, r: 6.5, h: 1.0, seed: 211 },
      scratch: { x: -31, z: -12, r: 5, h: 0.9, seed: 219 },
      core: { x: 0, z: 1, r: 4, h: 0.8, seed: 223 },
    };
    const I = {};
    for (const [k, d] of Object.entries(defs)) {
      I[k] = world.addIsland({ ...d, floating: true });
      I[k].key = k;
    }
    const neon = {
      'pixel-agents': '#ff4fd8',
      'horus-api': '#ffcc4d',
      'horus-web': '#5affb4',
      scratch: '#a98bff',
    };
    const spots = {};
    for (const key of Object.keys(neon)) {
      const isl = I[key];
      const dm = dome('#c8d0ff', neon[key]);
      put(world, dm.group, isl.x - isl.r * 0.2, isl.z - isl.r * 0.35);
      const tw = podTower(neon[key]);
      put(world, tw.group, isl.x + isl.r * 0.45, isl.z - isl.r * 0.3);
      world.onUpdate((t) => (tw.tipMat.emissiveIntensity = Math.sin(t * 3) > 0 ? 4 : 0.4));
      const sign = holoSign(key, neon[key]);
      sign.position.set(isl.x, 8.4, isl.z - isl.r * 0.3);
      sign.scale.setScalar(1.9);
      world.root.add(sign);
      world.onUpdate((t) => sign.userData.flicker(t));
      for (let i = 0; i < 2; i++) {
        const c = crystal(isl.x * 7 + i, neon[key]);
        const p = at(isl, 2.4 + i * 1.6, 0.7);
        put(world, c, p[0], p[1]);
      }
      // Waterfalls off the front edge.
      for (const ang of [1.2, 2.0]) {
        const rimPt = isl.rim[Math.round((ang / (Math.PI * 2)) * isl.rim.length) % isl.rim.length];
        const wf = waterfall(V(rimPt[0], rimPt[1] - 0.1, rimPt[2] + 0.2), 26, 0.9);
        wf.rotation.y = -ang + Math.PI / 2;
        world.root.add(wf);
        world.onUpdate((t) => wf.userData.flow(t));
      }
      const mine = crew.filter((a) => a.project === key);
      const desks = mine.map((a, i) =>
        addDesk(
          world,
          isl.x + (i - (mine.length - 1) / 2) * 2.4 + 0.5,
          isl.z + isl.r * 0.2,
          neon[key],
        ),
      );
      // The "needs you" pillar of light.
      const pillarMat = new THREE.MeshBasicMaterial({
        color: '#ffb020',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.4, 30, 20, 1, true),
        pillarMat,
      );
      const [px, pz] = at(isl, -0.4, 0.45);
      pillar.position.set(px, 15, pz);
      world.root.add(pillar);
      world.onUpdate((t) => {
        const on = mine.some((a) => a.state === 'need');
        pillarMat.opacity += ((on ? 0.22 + Math.sin(t * 6) * 0.06 : 0) - pillarMat.opacity) * 0.08;
      });
      const ch = beachChair(neon[key]);
      const [cx, cz] = at(isl, 3.5, 0.55);
      put(world, ch.group, cx, cz, 0.5);
      scatter(
        world,
        isl,
        isl.x * 11 + 3,
        {
          palms: 2,
          bushes: 3,
          rocks: 2,
          flowers: 2,
          pal: { leaf: '#3fae8a', leafLight: '#5fd0a8', flowers: [neon[key], '#ffffff'] },
        },
        [
          [isl.x - isl.r * 0.2, isl.z - isl.r * 0.35],
          [isl.x + isl.r * 0.45, isl.z - isl.r * 0.3],
          [px, pz],
          [cx, cz],
          ...desks.map((d) => [d.x, d.z + 0.8]),
        ],
      );
      mine.forEach((a, i) => {
        world.onUpdate(
          (t) =>
            (desks[i].screenMat.emissiveIntensity =
              a.state === 'work' ? 1.6 + Math.sin(t * 9 + i) * 0.2 : 0.1),
        );
        spots[a.id] = {
          work: { ...desks[i], isl: key },
          need: { x: px + i * 0.9, z: pz + 0.9, face: 0, pose: 'need', isl: key },
          done: {
            x: cx + i * 0.8,
            z: cz + i * 0.6,
            face: 0.5,
            pose: i ? 'idle' : 'sit',
            seatY: 0.35,
            isl: key,
          },
          idle: {
            x: isl.x - isl.r * 0.2 + 1.4 + i * 0.8,
            z: isl.z - isl.r * 0.35 + 2.1,
            face: 0.2,
            pose: 'idle',
            isl: key,
          },
        };
      });
      // A light bridge to the core.
      const C = I.core;
      const ang = Math.atan2(isl.z - C.z, isl.x - C.x);
      const a = V(C.x + Math.cos(ang) * C.r * 0.8, 0.6, C.z + Math.sin(ang) * C.r * 0.8);
      const b = V(isl.x - Math.cos(ang) * isl.r * 0.8, 0.6, isl.z - Math.sin(ang) * isl.r * 0.8);
      const lb = lightBridge(a, b, neon[key]);
      world.root.add(lb.group);
      world.onUpdate((t) => {
        const busy = mine.some((x) => x.state === 'work');
        lb.group.userData.flow(busy ? t : t * 0.15);
      });
    }
    // The core and its orb.
    const orb = networkOrb(crew.map((a) => a.color));
    orb.group.position.set(I.core.x, 5.2, I.core.z);
    world.root.add(orb.group);
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.3, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: '#e6e8f2', metalness: 0.4, roughness: 0.3 }),
    );
    put(world, ped, I.core.x, I.core.z, 0, 0.6);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.6, 2.4, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#7ff3ff',
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    beam.position.set(I.core.x, 2.4, I.core.z);
    world.root.add(beam);
    world.onUpdate((t) => {
      orb.group.userData.spin(t);
      orb.group.position.y = 5.2 + Math.sin(t * 1.2) * 0.25;
      crew.forEach((a, i) => {
        const c = { work: a.color, need: '#ffb020', done: '#6fe08a', idle: '#6a6f96' }[a.state];
        orb.nodes[i].material.color.set(c);
        orb.nodes[i].material.emissive.set(c);
        orb.nodes[i].material.emissiveIntensity =
          a.state === 'need' ? (Math.sin(t * 8) > 0 ? 5 : 1) : 3;
      });
    });
    // Drone sub-agent.
    const web = crew.find((a) => a.sub);
    const drone = new THREE.Group();
    const dbody = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 14, 10),
      new THREE.MeshStandardMaterial({ color: '#e6e8f2', metalness: 0.4, roughness: 0.3 }),
    );
    drone.add(dbody);
    const dring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 24), glowMat(web.color, 3));
    dring.rotation.x = Math.PI / 2;
    drone.add(dring);
    world.root.add(drone);
    world.onUpdate((t) => {
      drone.visible = web.state === 'work';
      const a = t * 0.6;
      const W = I['horus-web'];
      drone.position.set(
        W.x + Math.cos(a) * 5,
        3.2 + Math.sin(t * 2) * 0.4,
        W.z + Math.sin(a) * 4.5,
      );
    });
    const labels = [
      { text: 'Core', sub: 'agent network', pos: V(I.core.x, 8.6, I.core.z), accent: '#7ff3ff' },
    ];
    return { spots, route: (f, t) => [[t.x, t.z]], labels, noIslandLabels: true };
  },
};

export const VARIANTS = [SUNSET, NIGHT, DAY, FLOAT];
