// The four archipelago variants: same crew, different worlds and meanings.
import * as THREE from './three.js';
import {
  beachChair,
  boat,
  bush,
  crystal,
  desk,
  dock,
  dome,
  flowers,
  glowMat,
  hammock,
  holoSign,
  house,
  lighthouse,
  lightBridge,
  networkOrb,
  palm,
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

// ═══════════════════════════════════════════════════════════════════════════
// 1. Sunset — one island per project
// ═══════════════════════════════════════════════════════════════════════════
const PROJECT_INFO = `
    <ul>
      <li><b>Una isla por carpeta</b> donde lanzás agentes (Directory). Una carpeta nueva hace aparecer una isla nueva.</li>
      <li><b>Trabajando</b>: en su escritorio, con la laptop encendida; sale humo de la chimenea.</li>
      <li><b>Te necesita</b>: corre al mástil, sube la bandera y salta. El <b>faro</b> del centro se pone ámbar y gira, para que lo veas aunque no mires esa isla.</li>
      <li><b>Terminó</b>: se sienta al final del muelle a esperar tu próximo mensaje.</li>
      <li><b>Sin nada</b>: descansa en la hamaca.</li>
      <li>Los <b>sub-agentes</b> son botes que salen de la isla y vuelven al terminar.</li>
    </ul>
    <p class="why">Tocá un agente o su tarjeta para ir a su terminal; los pedidos de permiso se aprueban desde la tarjeta de la derecha.</p>`;

const SUNSET = {
  key: 'sunset',
  name: 'Atardecer',
  title: 'Islas por proyecto',
  tagline: 'Golden hour: el mismo archipiélago con el sol bajo y el agua rosada.',
  info: PROJECT_INFO,
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

const DAYLIGHT = {
  ...SUNSET,
  key: 'day',
  name: 'Día',
  tagline: 'Media tarde: luz clara, agua turquesa, todo bien legible.',
  pal: {
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
  },
  bloom: { strength: 0.22, radius: 0.4, threshold: 0.95 },
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. Futurist — floating islands over a sea of clouds
// ═══════════════════════════════════════════════════════════════════════════
const FLOAT = {
  key: 'float',
  name: 'Futurista',
  title: 'Islas flotantes',
  tagline:
    'Las mismas islas por proyecto, flotando sobre un mar de nubes a plena luz, unidas por puentes de luz a un núcleo.',
  info: `
    <ul>
      <li><b>Una isla por carpeta</b> (Directory), con su cartel arriba.</li>
      <li><b>Trabajando</b>: en su escritorio; por el puente de luz de su isla viajan paquetes de datos hacia el núcleo.</li>
      <li><b>Te necesita</b>: se levanta una columna de luz ámbar sobre su isla y su nodo del orbe titila.</li>
      <li><b>Terminó</b>: se sienta en la reposera. <b>Sin nada</b>: pasea junto al domo.</li>
      <li>El <b>orbe</b> del núcleo tiene un nodo por agente, del color de su estado.</li>
      <li>Los <b>sub-agentes</b> son drones que orbitan la isla.</li>
    </ul>
    <p class="why">Tocá un agente o su tarjeta para ir a su terminal; los pedidos de permiso se aprueban desde la tarjeta de la derecha.</p>`,
  pal: {
    skyTop: '#2f3fc4',
    skyMid: '#8a86f0',
    horizon: '#ffd3ec',
    sunDisc: '#fff6fb',
    sunDir: V(0.45, 0.6, 0.6),
    sunSize: 0.0016,
    skyClouds: 0.6,
    cloudColor: '#ffffff',
    cloudLow: '#7d6fd8',
    cloudHigh: '#ffffff',
    cloudY: -26,
    fog: '#c7bdf4',
    fogDensity: 0.0026,
    sunLight: '#fff8f0',
    sunIntensity: 3.2,
    hemiSky: '#dcd4ff',
    hemiGround: '#4a3a7a',
    hemiIntensity: 0.95,
    land: {
      grass: '#36b884',
      grassLight: '#5ad6a0',
      sand: '#f3ecff',
      sandWet: '#c9b8ee',
      rock: '#7a68c0',
      rockDark: '#3a2c74',
    },
  },
  bloom: { strength: 0.4, radius: 0.5, threshold: 0.86 },
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
        color: '#ffa31a',
        transparent: true,
        opacity: 0,
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
        pillarMat.opacity += ((on ? 0.38 + Math.sin(t * 6) * 0.08 : 0) - pillarMat.opacity) * 0.08;
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

export const VARIANTS = [DAYLIGHT, SUNSET, FLOAT];
