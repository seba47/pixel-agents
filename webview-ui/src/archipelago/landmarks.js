// Each island style's landmark (its main building) and the props only it has.
// A landmark returns { group, windowMats, smokeFrom, update(t, working) }:
// windowMats light up while someone there works, smokeFrom (or null) smokes.
import { glowMat, house, mat } from './props.js';
import * as THREE from './three.js';
import { rng } from './world.js';

function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
const box = (w, h, d, material, x = 0, y = 0, z = 0, o) => {
  const m = mesh(new THREE.BoxGeometry(w, h, d), material, o);
  m.position.set(x, y, z);
  return m;
};
const glass = (color = '#9fd4f0') =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0.55, flatShading: true });

/** Windows that glow while someone works, flicker a little. */
const litWindows = (mats) => (t, on) =>
  mats.forEach((m, i) => {
    const want = on ? 1.3 + Math.sin(t * 2 + i * 1.7) * 0.15 : 0.15;
    m.emissiveIntensity += (want - m.emissiveIntensity) * 0.05;
  });

// ── Beach (the default): the cottage ─────────────────────────────────────
export function cottage(roof) {
  const hs = house({ roof, w: 2.8, d: 2.2 });
  return { ...hs, update: litWindows(hs.windowMats) };
}

// ── Company: a glass office tower with its logo band ─────────────────────
export function officeTower(accent) {
  const g = new THREE.Group();
  g.add(box(3.4, 0.25, 2.8, mat('#d9dde3'), 0, 0.12));
  const floors = 4;
  const fh = 1.0;
  const windowMats = [];
  for (let f = 0; f < floors; f++) {
    const y = 0.25 + f * fh;
    g.add(box(3.0, fh - 0.12, 2.4, glass(), 0, y + (fh - 0.12) / 2));
    g.add(box(3.1, 0.12, 2.5, mat('#eef0f3'), 0, y + fh - 0.06));
    // A row of lit panes on the front.
    for (let k = 0; k < 4; k++) {
      const wm = glowMat('#ffe2a0', 0.15);
      windowMats.push(wm);
      g.add(box(0.5, 0.52, 0.04, wm, -1.08 + k * 0.72, y + 0.44, 1.22, { cast: false }));
    }
  }
  const top = 0.25 + floors * fh;
  g.add(box(2.2, 0.5, 1.8, mat('#eef0f3'), 0, top + 0.25));
  // Logo band in the island's colour, and a small antenna.
  g.add(box(2.26, 0.22, 1.86, glowMat(accent, 0.6), 0, top + 0.3, 0, { cast: false }));
  const ant = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5), mat('#9aa0ac'));
  ant.position.set(0.6, top + 1.05, 0);
  g.add(ant);
  const tipMat = glowMat('#ff4040', 2);
  const tip = mesh(new THREE.SphereGeometry(0.07, 8, 6), tipMat, { cast: false });
  tip.position.set(0.6, top + 1.62, 0);
  g.add(tip);
  // Entrance canopy.
  g.add(box(1.3, 0.08, 0.7, mat(accent), 0, 1.05, 1.5));
  const lit = litWindows(windowMats);
  return {
    group: g,
    windowMats,
    smokeFrom: null,
    update: (t, on) => {
      lit(t, on);
      tipMat.emissiveIntensity = 0.6 + (Math.sin(t * 3) > 0.6 ? 2.5 : 0);
    },
  };
}

/** A trimmed round tree (parks, campuses). */
export function roundTree(seed, h = 2.2, leaf = '#4f9a4a') {
  const r = rng(seed);
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.09, 0.13, h * 0.5, 6), mat('#7a5a3e'));
  trunk.position.y = h * 0.25;
  g.add(trunk);
  const crown = mesh(new THREE.IcosahedronGeometry(h * (0.32 + r() * 0.08), 1), mat(leaf));
  crown.position.y = h * 0.62;
  crown.scale.y = 1.15;
  g.add(crown);
  return g;
}

/** A conifer: stacked cones. */
export function pineTree(seed, h = 2.6, leaf = '#2f7a4a') {
  const r = rng(seed);
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.08, 0.1, h * 0.25, 6), mat('#6a4a32'));
  trunk.position.y = h * 0.12;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.ConeGeometry(h * (0.34 - i * 0.08), h * 0.42, 7), mat(leaf));
    c.position.y = h * (0.35 + i * 0.2);
    c.rotation.y = r() * 3;
    g.add(c);
  }
  return g;
}

export function bench(color = '#8a6040') {
  const g = new THREE.Group();
  g.add(box(1.2, 0.07, 0.35, mat(color), 0, 0.42));
  g.add(box(1.2, 0.3, 0.06, mat(color), 0, 0.62, -0.16));
  for (const x of [-0.5, 0.5]) g.add(box(0.06, 0.42, 0.3, mat('#4a4a52'), x, 0.21));
  return g;
}

// ── Technical: a lab dome, a server rack row, a dish ─────────────────────
export function labDome(accent) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(2.0, 2.1, 0.3, 24), mat('#cfd5dc')));
  g.children[0].position.y = 0.15;
  const shell = mesh(
    new THREE.SphereGeometry(1.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: '#e8eef5',
      roughness: 0.3,
      metalness: 0.2,
      flatShading: true,
    }),
  );
  shell.position.y = 0.3;
  g.add(shell);
  const ringMat = glowMat(accent, 0.4);
  const ring = mesh(new THREE.TorusGeometry(1.72, 0.06, 6, 40), ringMat, { cast: false });
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.36;
  g.add(ring);
  const windowMats = [];
  for (let k = 0; k < 5; k++) {
    const wm = glowMat('#bff6ff', 0.15);
    windowMats.push(wm);
    const a = -0.9 + k * 0.45;
    const w = box(0.34, 0.28, 0.05, wm, Math.sin(a) * 1.55, 0.95, Math.cos(a) * 1.55, {
      cast: false,
    });
    w.rotation.y = a;
    w.rotation.x = -0.35;
    g.add(w);
  }
  // A rooftop dish that turns while anyone works.
  const dish = new THREE.Group();
  const bowl = mesh(
    new THREE.SphereGeometry(0.55, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4),
    mat('#f4f6f8', { side: THREE.DoubleSide }),
  );
  bowl.rotation.x = Math.PI * 0.75;
  dish.add(bowl);
  const feed = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 4), mat('#9aa0ac'));
  feed.rotation.x = Math.PI * 0.25;
  feed.position.set(0, 0.15, 0.2);
  dish.add(feed);
  const mast = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), mat('#9aa0ac'));
  mast.position.y = -0.35;
  dish.add(mast);
  dish.position.set(0.5, 2.35, -0.3);
  g.add(dish);
  const lit = litWindows(windowMats);
  return {
    group: g,
    windowMats,
    smokeFrom: null,
    update: (t, on) => {
      lit(t, on);
      ringMat.emissiveIntensity +=
        ((on ? 2.2 + Math.sin(t * 4) * 0.4 : 0.4) - ringMat.emissiveIntensity) * 0.05;
      if (on) dish.rotation.y += 0.01;
    },
  };
}

/** A server rack whose LEDs blink while anyone works. */
export function serverRack(seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  g.add(box(0.7, 1.6, 0.6, mat('#2a3040', { roughness: 0.5, metalness: 0.4 }), 0, 0.8));
  const leds = [];
  for (let i = 0; i < 8; i++) {
    const m = glowMat(r() > 0.3 ? '#4fe38a' : '#4fc3ff', 0.2);
    leds.push({ m, phase: r() * 10, speed: 3 + r() * 8 });
    g.add(
      box(0.08, 0.05, 0.02, m, -0.2 + (i % 2) * 0.12, 0.3 + Math.floor(i / 2) * 0.33, 0.31, {
        cast: false,
      }),
    );
  }
  g.add(box(0.5, 0.02, 0.02, mat('#5a6070'), 0.1, 1.45, 0.31, { cast: false }));
  g.userData.update = (t, on) =>
    leds.forEach(
      (l) =>
        (l.m.emissiveIntensity = on ? (Math.sin(t * l.speed + l.phase) > 0 ? 2.4 : 0.2) : 0.15),
    );
  return g;
}

// ── Device testing: a giant folding phone, half open ─────────────────────
export function foldPhone(accent) {
  const g = new THREE.Group();
  g.add(box(3.4, 0.2, 1.8, mat('#d9dde3'), 0, 0.1));
  g.add(box(3.0, 0.12, 1.4, mat(accent), 0, 0.26));
  const panelMats = [];
  const body = mat('#1c1f27', { roughness: 0.3, metalness: 0.6 });
  const W = 1.5;
  const H = 3.4;
  const half = (side) => {
    const p = new THREE.Group();
    p.add(box(W, H, 0.12, body, side * (W / 2 + 0.04), 0.32 + H / 2, 0));
    const sm = glowMat('#4f8dff', 0.2);
    panelMats.push(sm);
    p.add(
      box(W - 0.16, H - 0.2, 0.02, sm, side * (W / 2 + 0.04), 0.32 + H / 2, 0.07, { cast: false }),
    );
    // App icons: a 2×3 grid, lit with the screen.
    for (let k = 0; k < 6; k++) {
      const tm = glowMat(
        ['#ffffff', '#ffd36b', '#7affc4', '#ff9ac8', '#ffb36b', '#bfe0ff'][k],
        0.15,
      );
      panelMats.push(tm);
      p.add(
        box(
          0.34,
          0.34,
          0.02,
          tm,
          side * (W / 2 + 0.04) + (k % 2 ? 0.26 : -0.26),
          2.95 - Math.floor(k / 2) * 0.6,
          0.085,
          {
            cast: false,
          },
        ),
      );
    }
    p.rotation.y = side * -0.5;
    return p;
  };
  const hinge = mesh(
    new THREE.CylinderGeometry(0.1, 0.1, H, 10),
    mat('#5a5e6a', { metalness: 0.8 }),
  );
  hinge.position.y = 0.32 + H / 2;
  g.add(half(-1), half(1), hinge);
  // A notification pip over the hinge.
  const pipMat = glowMat('#ff5a5a', 0);
  const pip = mesh(new THREE.SphereGeometry(0.14, 10, 8), pipMat, { cast: false });
  pip.position.y = H + 0.75;
  g.add(pip);
  const lit = litWindows(panelMats);
  return {
    group: g,
    windowMats: panelMats,
    smokeFrom: null,
    update: (t, on) => {
      lit(t, on);
      pip.position.y = H + 0.75 + Math.sin(t * 2.4) * 0.12;
      pipMat.emissiveIntensity = on ? 1.8 : 0.2;
    },
  };
}

/** A cell tower: lattice mast with a blinking top. */
export function cellTower() {
  const g = new THREE.Group();
  const m = mat('#c8ccd4', { metalness: 0.5 });
  for (const [x, z] of [
    [-0.2, -0.2],
    [0.2, -0.2],
    [0, 0.22],
  ]) {
    const leg = mesh(new THREE.CylinderGeometry(0.03, 0.05, 3.4, 4), m);
    leg.position.set(x * 0.6, 1.7, z * 0.6);
    leg.rotation.set(-z * 0.12, 0, x * 0.12);
    g.add(leg);
  }
  for (const y of [2.5, 3.0])
    for (const a of [0, 2.1, 4.2]) {
      const pan = box(0.12, 0.42, 0.05, mat('#eef0f3'), Math.sin(a) * 0.16, y, Math.cos(a) * 0.16);
      pan.rotation.y = a;
      g.add(pan);
    }
  const tipMat = glowMat('#ff3030', 2);
  const tip = mesh(new THREE.SphereGeometry(0.07, 8, 6), tipMat, { cast: false });
  tip.position.y = 3.5;
  g.add(tip);
  g.userData.update = (t) => (tipMat.emissiveIntensity = Math.sin(t * 3) > 0.5 ? 3 : 0.2);
  return g;
}

// ── Fitness: an open-air gym ──────────────────────────────────────────────
export function gymPavilion(accent) {
  const g = new THREE.Group();
  g.add(box(3.6, 0.15, 2.6, mat('#3a3d46'), 0, 0.08));
  // Rubber floor mats.
  for (let k = 0; k < 3; k++)
    g.add(box(1.05, 0.03, 2.3, mat(k % 2 ? '#e05a4a' : '#2a2c34'), -1.15 + k * 1.15, 0.17));
  // A roof on four posts.
  for (const [x, z] of [
    [-1.6, -1.1],
    [1.6, -1.1],
    [-1.6, 1.1],
    [1.6, 1.1],
  ])
    g.add(box(0.14, 2.3, 0.14, mat('#eef0f3'), x, 1.3, z));
  g.add(box(3.8, 0.16, 2.8, mat(accent), 0, 2.5));
  // Its sign: a glowing bar under the roof's front.
  const signMat = glowMat('#fff2c0', 0.15);
  g.add(box(2.0, 0.24, 0.05, signMat, 0, 2.2, 1.42, { cast: false }));
  // A squat rack with a barbell.
  for (const x of [-0.7, 0.7])
    g.add(box(0.08, 1.7, 0.08, mat('#9aa0ac', { metalness: 0.6 }), x, 1.0, -0.8));
  const bar = mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 2.0, 6),
    mat('#d0d4dc', { metalness: 0.8 }),
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.45, -0.72);
  g.add(bar);
  for (const x of [-0.85, 0.85]) {
    const plate = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 14), mat('#1e2028'));
    plate.rotation.z = Math.PI / 2;
    plate.position.set(x, 1.45, -0.72);
    g.add(plate);
  }
  const lit = litWindows([signMat]);
  return { group: g, windowMats: [signMat], smokeFrom: null, update: (t, on) => lit(t, on) };
}

export function dumbbellRack() {
  const g = new THREE.Group();
  g.add(box(1.3, 0.08, 0.4, mat('#9aa0ac', { metalness: 0.5 }), 0, 0.5));
  for (const x of [-0.55, 0.55]) g.add(box(0.06, 0.5, 0.36, mat('#5a5e6a'), x, 0.25));
  const colors = ['#e05a4a', '#4a8ae0', '#f0c040', '#3ec07a'];
  for (let k = 0; k < 4; k++) {
    const db = new THREE.Group();
    const h = mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6),
      mat('#c8ccd4', { metalness: 0.7 }),
    );
    h.rotation.z = Math.PI / 2;
    db.add(h);
    for (const s of [-1, 1]) {
      const w = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 8), mat(colors[k]));
      w.rotation.z = Math.PI / 2;
      w.position.x = s * 0.13;
      db.add(w);
    }
    db.position.set(-0.45 + k * 0.3, 0.62, 0);
    g.add(db);
  }
  return g;
}

export function kettlebell(color = '#2a2c34') {
  const g = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(color));
  b.position.y = 0.2;
  g.add(b);
  const handle = mesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12, Math.PI), mat(color));
  handle.position.y = 0.36;
  g.add(handle);
  return g;
}

/** A round fountain whose jet rises and falls. */
export function fountain() {
  const g = new THREE.Group();
  const basin = mesh(new THREE.CylinderGeometry(1.0, 1.1, 0.35, 18), mat('#d9d6cf'));
  basin.position.y = 0.18;
  g.add(basin);
  const water = mesh(
    new THREE.CylinderGeometry(0.88, 0.88, 0.05, 18),
    new THREE.MeshStandardMaterial({ color: '#5fc8ec', roughness: 0.15, metalness: 0.1 }),
    { cast: false },
  );
  water.position.y = 0.33;
  g.add(water);
  const col = mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 8), mat('#cbc7be'));
  col.position.y = 0.6;
  g.add(col);
  const jet = mesh(
    new THREE.ConeGeometry(0.16, 0.9, 8),
    new THREE.MeshStandardMaterial({
      color: '#bfeaff',
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
    }),
    { cast: false },
  );
  jet.position.y = 1.3;
  g.add(jet);
  g.userData.update = (t) => {
    const k = 0.85 + Math.sin(t * 2.2) * 0.15;
    jet.scale.set(1, k, 1);
    jet.position.y = 0.95 + 0.45 * k;
  };
  return g;
}

/** A street lamp; its head in the island's colour. */
export function lampPost(accent) {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.9, 6), mat('#4a4e58'));
  pole.position.y = 0.95;
  g.add(pole);
  const head = mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), mat(accent));
  head.position.y = 1.95;
  g.add(head);
  const bulb = mesh(new THREE.SphereGeometry(0.09, 8, 6), glowMat('#fff2c0', 0.9), { cast: false });
  bulb.position.y = 1.85;
  g.add(bulb);
  return g;
}
