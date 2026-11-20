// Low-poly props, built from primitives: palms, houses, a lighthouse, docks,
// bridges, desks with laptops, a campfire, hammocks, boats, and the futurist
// set (domes, light bridges, waterfalls, the network orb).
import * as THREE from './three.js';
import { rng } from './world.js';

const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
    matCache.set(key, m);
  }
  return m;
}
/** An emissive material of its own (so each can be dimmed or lit). */
export const glowMat = (color, intensity = 1.5) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
  });

function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
const UP = new THREE.Vector3(0, 1, 0);
function between(a, b, radiusTop, radiusBottom, material, seg = 6) {
  const dir = b.clone().sub(a);
  const m = mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, dir.length(), seg), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

// ── Nature ────────────────────────────────────────────────────────────────
let leafGeo;
function getLeafGeo() {
  if (leafGeo) return leafGeo;
  const N = 9;
  const L = 2.1;
  const pos = [];
  const row = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const x = s * L;
    const y = 0.45 * s - 1.25 * s * s;
    const w = 0.42 * Math.sin(Math.PI * Math.min(1, s * 1.08)) * (1 - s * 0.35);
    row.push([
      [x, y - 0.04, -w],
      [x, y + 0.07, 0],
      [x, y - 0.04, w],
    ]);
  }
  for (let i = 0; i < N; i++) {
    const a = row[i];
    const b = row[i + 1];
    for (const [p, q, r] of [
      [a[0], b[0], a[1]],
      [a[1], b[0], b[1]],
      [a[1], b[1], a[2]],
      [a[2], b[1], b[2]],
    ])
      pos.push(...p, ...q, ...r);
  }
  leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  leafGeo.computeVertexNormals();
  return leafGeo;
}

export function palm(seed, h = 3.6, pal = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const lean = (r() - 0.5) * 1.4;
  const pts = [];
  for (let i = 0; i <= 7; i++) {
    const t = i / 7;
    pts.push(new THREE.Vector3(lean * t * t, t * h, lean * 0.3 * t * t));
  }
  for (let i = 0; i < 7; i++) {
    const rb = 0.19 - 0.08 * (i / 7);
    g.add(
      between(
        pts[i],
        pts[i + 1],
        rb - 0.015,
        rb,
        mat(i % 2 ? (pal.trunk ?? '#8b6a48') : (pal.trunkDark ?? '#74563a')),
      ),
    );
  }
  const top = pts[7];
  const crown = new THREE.Group();
  crown.position.copy(top);
  const leaves = [];
  const n = 8;
  for (let k = 0; k < n; k++) {
    const leaf = mesh(
      getLeafGeo(),
      mat(k % 2 ? (pal.leaf ?? '#3f9a52') : (pal.leafLight ?? '#5bb65f'), {
        side: THREE.DoubleSide,
      }),
    );
    const holder = new THREE.Group();
    holder.rotation.y = (k / n) * Math.PI * 2 + r() * 0.4;
    leaf.rotation.z = 0.15 + r() * 0.25;
    const s = 0.85 + r() * 0.3;
    leaf.scale.set(s, s, s);
    holder.add(leaf);
    crown.add(holder);
    leaves.push(leaf);
  }
  for (let k = 0; k < 3; k++) {
    const c = mesh(new THREE.IcosahedronGeometry(0.13, 0), mat('#5a3b22'));
    c.position.set(Math.cos(k * 2.1) * 0.16, -0.15, Math.sin(k * 2.1) * 0.16);
    crown.add(c);
  }
  g.add(crown);
  g.rotation.y = r() * Math.PI * 2;
  g.userData.sway = (t) => {
    crown.rotation.z = Math.sin(t * 0.9 + seed) * 0.05;
    crown.rotation.x = Math.cos(t * 0.7 + seed) * 0.04;
    leaves.forEach((l, i) => (l.rotation.x = Math.sin(t * 1.6 + i + seed) * 0.06));
  };
  return g;
}

export function rock(seed, s = 0.6, color = '#8a8f9e') {
  const r = rng(seed);
  const geo = new THREE.DodecahedronGeometry(s, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++)
    p.setXYZ(
      i,
      p.getX(i) * (0.8 + r() * 0.4),
      p.getY(i) * (0.55 + r() * 0.3),
      p.getZ(i) * (0.8 + r() * 0.4),
    );
  geo.computeVertexNormals();
  return mesh(geo, mat(color));
}

export function bush(seed, s = 0.6, color = '#3e8a4a') {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = mesh(
      new THREE.IcosahedronGeometry(s * (0.7 + r() * 0.4), 0),
      mat(i ? color : new THREE.Color(color).offsetHSL(0, 0, 0.06).getStyle()),
    );
    b.position.set((r() - 0.5) * s * 1.2, s * 0.5, (r() - 0.5) * s * 1.2);
    g.add(b);
  }
  return g;
}

export function flowers(seed, colors = ['#ff7aa8', '#ffd36b', '#ffffff']) {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const f = mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(colors[i % colors.length]), {
      cast: false,
    });
    f.position.set((r() - 0.5) * 1.1, 0.12, (r() - 0.5) * 1.1);
    g.add(f);
  }
  return g;
}

// ── Buildings ─────────────────────────────────────────────────────────────
export function house({
  w = 2.6,
  d = 2.1,
  h = 1.7,
  wall = '#f3e6cc',
  roof = '#c9553f',
  trim = '#7a5238',
  chimney = true,
} = {}) {
  const g = new THREE.Group();
  const plinth = mesh(new THREE.BoxGeometry(w + 0.25, 0.2, d + 0.25), mat(trim));
  plinth.position.y = 0.1;
  g.add(plinth);
  const walls = mesh(new THREE.BoxGeometry(w, h, d), mat(wall));
  walls.position.y = 0.2 + h / 2;
  g.add(walls);
  const rh = h * 0.75;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.3, 0);
  shape.lineTo(w / 2 + 0.3, 0);
  shape.lineTo(0, rh);
  shape.closePath();
  const rg = new THREE.ExtrudeGeometry(shape, { depth: d + 0.4, bevelEnabled: false });
  rg.translate(0, 0, -(d + 0.4) / 2);
  const rf = mesh(rg, mat(roof));
  rf.position.y = 0.2 + h;
  g.add(rf);
  const door = mesh(new THREE.BoxGeometry(0.5, 0.9, 0.06), mat(trim));
  door.position.set(0, 0.2 + 0.45, d / 2 + 0.03);
  g.add(door);
  const windowMats = [];
  for (const sx of [-1, 1]) {
    const wm = glowMat('#ffd58a', 0);
    windowMats.push(wm);
    const win = mesh(new THREE.BoxGeometry(0.46, 0.42, 0.06), wm, { cast: false });
    win.position.set(sx * w * 0.3, 0.2 + h * 0.6, d / 2 + 0.03);
    g.add(win);
    const frame = mesh(new THREE.BoxGeometry(0.56, 0.08, 0.1), mat(trim), { cast: false });
    frame.position.set(sx * w * 0.3, 0.2 + h * 0.6 - 0.25, d / 2 + 0.05);
    g.add(frame);
  }
  let smokeFrom = null;
  if (chimney) {
    const c = mesh(new THREE.BoxGeometry(0.32, 0.8, 0.32), mat('#8a6a5a'));
    c.position.set(w * 0.25, 0.2 + h + rh * 0.55, 0);
    g.add(c);
    smokeFrom = new THREE.Vector3(w * 0.25, 0.2 + h + rh * 0.55 + 0.45, 0);
  }
  return { group: g, windowMats, smokeFrom };
}

export function lighthouse() {
  const g = new THREE.Group();
  const H = 0.75;
  for (let i = 0; i < 7; i++) {
    const rb = 1.0 - i * 0.06;
    const s = mesh(
      new THREE.CylinderGeometry(rb - 0.06, rb, H, 16),
      mat(i % 2 ? '#d8463c' : '#f4efe6'),
    );
    s.position.y = H / 2 + i * H;
    g.add(s);
  }
  const topY = 7 * H;
  const gallery = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.14, 20), mat('#3a3a48'));
  gallery.position.y = topY + 0.07;
  g.add(gallery);
  const lampMat = glowMat('#fff3c4', 1.2);
  const lamp = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 12), lampMat, { cast: false });
  lamp.position.y = topY + 0.5;
  g.add(lamp);
  const cap = mesh(new THREE.ConeGeometry(0.6, 0.6, 12), mat('#c43c34'));
  cap.position.y = topY + 1.15;
  g.add(cap);
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#fff3c4',
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamGeo = new THREE.ConeGeometry(2.6, 22, 24, 1, true);
  beamGeo.translate(0, -11, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  const pivot = new THREE.Group();
  pivot.position.y = topY + 0.5;
  pivot.add(beam);
  g.add(pivot);
  const light = new THREE.PointLight('#fff1c2', 6, 18, 1.6);
  light.position.y = topY + 0.5;
  g.add(light);
  return { group: g, lampMat, beamMat, pivot, light, topY };
}

// ── Waterfront ────────────────────────────────────────────────────────────
/** A dock along local +z, `len` long; returns its end (local). */
export function dock(len = 5) {
  const g = new THREE.Group();
  const n = Math.round(len / 0.42);
  for (let i = 0; i < n; i++) {
    const p = mesh(new THREE.BoxGeometry(1.5, 0.1, 0.36), mat(i % 3 ? '#a37b52' : '#8d6845'));
    p.position.set(0, 0.35, i * 0.42);
    p.rotation.y = Math.sin(i * 7.3) * 0.03;
    g.add(p);
  }
  for (let i = 0; i <= len; i += 1.6)
    for (const sx of [-0.68, 0.68]) {
      const post = mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.2, 6), mat('#6a4c32'));
      post.position.set(sx, -0.5, i);
      g.add(post);
    }
  return { group: g, end: new THREE.Vector3(0, 0.4, (n - 1) * 0.42) };
}

/** A plank bridge along a world span (see World.addSpan). */
export function plankBridge(
  world,
  span,
  { rope = '#d8c39a', plank = '#a37b52', lanterns = true } = {},
) {
  const g = new THREE.Group();
  const [ax, az] = span.a;
  const [bx, bz] = span.b;
  const L = Math.hypot(bx - ax, bz - az);
  const ang = Math.atan2(bx - ax, bz - az);
  const n = Math.round(L / 0.42);
  const ropePts = [[], []];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = world.spanY(span, t);
    const p = mesh(new THREE.BoxGeometry(1.4, 0.09, 0.33), mat(i % 3 ? plank : '#8d6845'));
    p.position.set(ax + (bx - ax) * t, y - 0.05, az + (bz - az) * t);
    p.rotation.y = ang;
    g.add(p);
    for (const [k, side] of [
      [0, -0.7],
      [1, 0.7],
    ])
      ropePts[k].push(
        new THREE.Vector3(
          p.position.x + Math.cos(ang) * side,
          y + 0.75,
          p.position.z - Math.sin(ang) * side,
        ),
      );
  }
  for (const pts of ropePts) {
    g.add(
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 5), mat(rope), {
        cast: false,
      }),
    );
    for (let i = 0; i < pts.length; i += 6) {
      const q = pts[i];
      const post = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 5), mat('#6a4c32'));
      post.position.set(q.x, q.y - 0.4, q.z);
      g.add(post);
    }
  }
  const lights = [];
  if (lanterns)
    for (const end of [0, 1]) {
      const q = ropePts[end][end ? ropePts[end].length - 1 : 0];
      const lm = glowMat('#ffcf7a', 2);
      const l = mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), lm, { cast: false });
      l.position.set(q.x, q.y + 0.25, q.z);
      g.add(l);
      lights.push(lm);
    }
  return { group: g, lanterns: lights };
}

export function boat(color = '#e9e2d0', sail = '#ffffff', stripe = '#d8463c') {
  const g = new THREE.Group();
  const hull = mesh(
    new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    mat(color, { side: THREE.DoubleSide }),
  );
  hull.scale.set(0.55, 0.42, 1.35);
  hull.position.y = 0.32;
  g.add(hull);
  const rim = mesh(new THREE.TorusGeometry(1, 0.05, 4, 20), mat('#8d6845'));
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(0.55, 1.35, 1);
  rim.position.y = 0.33;
  g.add(rim);
  const mast = mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), mat('#6a4c32'));
  mast.position.set(0, 1.4, 0.1);
  g.add(mast);
  const sh = new THREE.Shape();
  sh.moveTo(0, 0);
  sh.lineTo(0, 1.9);
  sh.lineTo(-1.1, 0);
  sh.closePath();
  const s = mesh(new THREE.ShapeGeometry(sh), mat(sail, { side: THREE.DoubleSide }));
  s.rotation.y = Math.PI / 2;
  s.position.set(0, 0.45, 0.15);
  g.add(s);
  const st = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.9), mat(stripe), { cast: false });
  st.position.set(0, 0.6, -0.35);
  g.add(st);
  return g;
}

// ── Work and rest ─────────────────────────────────────────────────────────
export function desk(screenColor = '#7fdcff') {
  const g = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(1.3, 0.08, 0.7), mat('#b88a5a'));
  top.position.y = 0.78;
  g.add(top);
  for (const [x, z] of [
    [-0.58, -0.28],
    [0.58, -0.28],
    [-0.58, 0.28],
    [0.58, 0.28],
  ]) {
    const leg = mesh(new THREE.BoxGeometry(0.07, 0.76, 0.07), mat('#8d6845'));
    leg.position.set(x, 0.38, z);
    g.add(leg);
  }
  const base = mesh(
    new THREE.BoxGeometry(0.56, 0.03, 0.38),
    mat('#c9ccd6', { metalness: 0.4, roughness: 0.4 }),
  );
  base.position.set(0, 0.835, 0.02);
  g.add(base);
  const screenMat = glowMat(screenColor, 0.9);
  const screen = mesh(new THREE.BoxGeometry(0.56, 0.36, 0.025), screenMat, { cast: false });
  screen.position.set(0, 1.02, -0.17);
  screen.rotation.x = -0.25;
  g.add(screen);
  const back = mesh(
    new THREE.BoxGeometry(0.58, 0.38, 0.02),
    mat('#c9ccd6', { metalness: 0.4, roughness: 0.4 }),
  );
  back.position.set(0, 1.02, -0.19);
  back.rotation.x = -0.25;
  g.add(back);
  const mug = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), mat('#e8635a'));
  mug.position.set(0.45, 0.88, 0.1);
  g.add(mug);
  return { group: g, screenMat, seat: new THREE.Vector3(0, 0, 0.75) };
}

export function parasol(color = '#ff7a6a', alt = '#ffffff') {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), mat('#e8e2d6'));
  pole.position.y = 1.2;
  g.add(pole);
  for (let i = 0; i < 8; i++) {
    const seg = mesh(
      new THREE.ConeGeometry(1.4, 0.55, 3, 1, true, (i / 8) * Math.PI * 2, (Math.PI * 2) / 8),
      mat(i % 2 ? color : alt, { side: THREE.DoubleSide }),
    );
    seg.position.y = 2.35;
    g.add(seg);
  }
  return g;
}

export function beachChair(color = '#4fb7d8') {
  const g = new THREE.Group();
  const seat = mesh(new THREE.BoxGeometry(0.7, 0.06, 0.9), mat(color));
  seat.position.set(0, 0.3, 0);
  g.add(seat);
  const back = mesh(new THREE.BoxGeometry(0.7, 0.06, 0.8), mat(color));
  back.position.set(0, 0.62, -0.55);
  back.rotation.x = 1.0;
  g.add(back);
  for (const x of [-0.33, 0.33]) {
    const leg = mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), mat('#d6c7a8'));
    leg.position.set(x, 0.15, 0.35);
    g.add(leg);
  }
  return { group: g, seat: new THREE.Vector3(0, 0.1, 0.05) };
}

export function hammock(color = '#ff9a6a') {
  const g = new THREE.Group();
  for (const x of [-1.3, 1.3]) {
    const post = mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.8, 6), mat('#7a5a3c'));
    post.position.set(x, 0.9, 0);
    g.add(post);
  }
  const geo = new THREE.PlaneGeometry(2.4, 0.8, 16, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setXYZ(i, x, -Math.cos((x / 2.4) * Math.PI) * 0.45 + 0.1, p.getY(i));
  }
  geo.computeVertexNormals();
  const cloth = mesh(geo, mat(color, { side: THREE.DoubleSide }));
  cloth.position.y = 1.05;
  g.add(cloth);
  return { group: g, seat: new THREE.Vector3(0, 0.45, 0) };
}

export function campfire() {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const s = mesh(new THREE.DodecahedronGeometry(0.17, 0), mat('#7c7f8c'));
    const a = (i / 7) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55);
    g.add(s);
  }
  for (let i = 0; i < 3; i++) {
    const log = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 6), mat('#6a4528'));
    log.rotation.z = Math.PI / 2 - 0.35;
    log.rotation.y = (i / 3) * Math.PI;
    log.position.y = 0.2;
    g.add(log);
  }
  const flames = [];
  for (const [c, s, y] of [
    ['#ff5a1f', 0.32, 0.4],
    ['#ff9a2a', 0.22, 0.45],
    ['#ffe38a', 0.12, 0.42],
  ]) {
    const f = mesh(new THREE.ConeGeometry(s, s * 3.2, 7), glowMat(c, 3), { cast: false });
    f.position.y = y;
    g.add(f);
    flames.push(f);
  }
  const light = new THREE.PointLight('#ff9a4a', 14, 14, 1.8);
  light.position.y = 0.9;
  light.castShadow = false;
  g.add(light);
  g.userData.flicker = (t) => {
    flames.forEach((f, i) => {
      f.scale.y = 1 + Math.sin(t * 11 + i * 2) * 0.18 + Math.sin(t * 23 + i) * 0.08;
      f.rotation.y = t * (1 + i);
    });
    light.intensity = 12 + Math.sin(t * 13) * 2 + Math.sin(t * 29) * 1.5;
  };
  return g;
}

export function lantern() {
  const g = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), mat('#3a3a48'));
  post.position.y = 0.8;
  g.add(post);
  const lm = glowMat('#ffcf7a', 2.4);
  const l = mesh(new THREE.BoxGeometry(0.24, 0.3, 0.24), lm, { cast: false });
  l.position.y = 1.7;
  g.add(l);
  const cap = mesh(new THREE.ConeGeometry(0.22, 0.18, 4), mat('#3a3a48'));
  cap.position.y = 1.92;
  cap.rotation.y = Math.PI / 4;
  g.add(cap);
  return { group: g, lampMat: lm };
}

/** A signal mast: a flag that rises and a flare that lights when an agent needs you. */
export function signalMast(color = '#ffb020') {
  const g = new THREE.Group();
  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6), mat('#e6e1d6'));
  pole.position.y = 1.6;
  g.add(pole);
  const flagGeo = new THREE.PlaneGeometry(1.0, 0.6, 8, 1);
  flagGeo.translate(0.5, 0, 0);
  const flag = mesh(flagGeo, mat(color, { side: THREE.DoubleSide }), { cast: false });
  flag.position.y = 1.0;
  g.add(flag);
  const flareMat = glowMat(color, 0);
  const flare = mesh(new THREE.IcosahedronGeometry(0.16, 1), flareMat, { cast: false });
  flare.position.y = 3.3;
  g.add(flare);
  const base = flagGeo.attributes.position.array.slice();
  g.userData.set = (t, raised) => {
    const target = raised ? 2.8 : 1.0;
    flag.position.y += (target - flag.position.y) * 0.05;
    const p = flagGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3];
      p.setZ(i, Math.sin(x * 4 - t * 6) * 0.08 * x);
    }
    p.needsUpdate = true;
    flareMat.emissiveIntensity = raised ? 2 + Math.sin(t * 8) * 1.5 : 0;
  };
  return g;
}

// ── Futurist set ──────────────────────────────────────────────────────────
export function dome(color = '#b8c4ff', neon = '#4fe3ff') {
  const g = new THREE.Group();
  const shell = mesh(
    new THREE.SphereGeometry(1.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.78,
    }),
  );
  g.add(shell);
  const ring = mesh(new THREE.TorusGeometry(1.62, 0.07, 6, 40), glowMat(neon, 2.5), {
    cast: false,
  });
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  const inner = mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 10), glowMat('#ffd58a', 0.8));
  inner.position.y = 0.6;
  g.add(inner);
  return { group: g, ringMat: ring.material, innerMat: inner.material };
}

export function podTower(neon = '#ff4fd8') {
  const g = new THREE.Group();
  const body = mesh(
    new THREE.CylinderGeometry(0.55, 0.75, 3.4, 10),
    mat('#e6e8f2', { metalness: 0.3, roughness: 0.35 }),
  );
  body.position.y = 1.7;
  g.add(body);
  const mats = [];
  for (let i = 0; i < 3; i++) {
    const m = glowMat(neon, 2);
    mats.push(m);
    const ring = mesh(new THREE.TorusGeometry(0.66 - i * 0.05, 0.04, 6, 30), m, { cast: false });
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.9 + i * 0.9;
    g.add(ring);
  }
  const top = mesh(
    new THREE.SphereGeometry(0.62, 16, 10),
    mat('#e6e8f2', { metalness: 0.3, roughness: 0.35 }),
  );
  top.position.y = 3.5;
  g.add(top);
  const ant = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), mat('#9aa0b8'));
  ant.position.y = 4.6;
  g.add(ant);
  const tipMat = glowMat('#ff3050', 3);
  const tip = mesh(new THREE.SphereGeometry(0.07, 8, 6), tipMat, { cast: false });
  tip.position.y = 5.2;
  g.add(tip);
  return { group: g, neonMats: mats, tipMat };
}

export function crystal(seed, color = '#c58bff') {
  const r = rng(seed);
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const c = mesh(new THREE.OctahedronGeometry(0.25 + r() * 0.2, 0), glowMat(color, 1.2), {
      cast: false,
    });
    c.scale.y = 2 + r();
    c.position.set((r() - 0.5) * 0.6, 0.4, (r() - 0.5) * 0.6);
    c.rotation.z = (r() - 0.5) * 0.6;
    g.add(c);
  }
  return g;
}

/** A holographic sign: text on a canvas, glowing. */
export function holoSign(label, color = '#4fe3ff') {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d');
  c.font = '600 64px "Space Grotesk", Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.shadowColor = color;
  c.shadowBlur = 24;
  c.fillStyle = color;
  c.fillText(label, 256, 64);
  c.shadowBlur = 0;
  c.fillStyle = '#ffffff';
  c.fillText(label, 256, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), m);
  plane.userData.flicker = (t) =>
    (m.opacity = 0.75 + Math.sin(t * 3) * 0.08 + (Math.sin(t * 37) > 0.97 ? -0.4 : 0));
  return plane;
}

/** A glowing bridge of light from a to b (Vector3), with packets running along it. */
export function lightBridge(a, b, color = '#4fe3ff', packets = 6) {
  const g = new THREE.Group();
  const mid = a.clone().lerp(b, 0.5);
  mid.y += a.distanceTo(b) * 0.12;
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  g.add(mesh(new THREE.TubeGeometry(curve, 48, 0.06, 6), glowMat(color, 2.2), { cast: false }));
  const deck = mesh(
    new THREE.TubeGeometry(curve, 48, 0.5, 8),
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
    { cast: false },
  );
  deck.scale.y = 0.2;
  g.add(deck);
  const dots = [];
  for (let i = 0; i < packets; i++) {
    const d = mesh(new THREE.SphereGeometry(0.11, 8, 6), glowMat('#ffffff', 3), { cast: false });
    g.add(d);
    dots.push(d);
  }
  g.userData.flow = (t) =>
    dots.forEach((d, i) => d.position.copy(curve.getPoint((t * 0.18 + i / packets) % 1)));
  return { group: g, curve };
}

/** A waterfall pouring off an edge: a ribbon with a scrolling shader. */
export function waterfall(top, height = 14, width = 1.4) {
  const geo = new THREE.PlaneGeometry(width, height, 1, 24);
  geo.translate(0, -height / 2, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float time; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        float streak = h(vec2(floor(vUv.x * 9.0), 0.0));
        float s = fract(vUv.y * 3.0 + time * (1.2 + streak) );
        float a = smoothstep(0.0, 0.5, s) * (0.22 + 0.25 * streak);
        a *= smoothstep(0.0, 0.25, vUv.y) * smoothstep(0.0, 0.15, 1.0 - abs(vUv.x - 0.5) * 2.0);
        gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * a, a);
      }`,
  });
  const w = new THREE.Mesh(geo, m);
  w.position.copy(top);
  w.userData.flow = (t) => (m.uniforms.time.value = t);
  return w;
}

/** The network orb: a wire globe with one node per agent. */
export function networkOrb(colors) {
  const g = new THREE.Group();
  const core = mesh(
    new THREE.IcosahedronGeometry(2.1, 2),
    new THREE.MeshStandardMaterial({
      color: '#0b1030',
      roughness: 0.3,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85,
    }),
    { cast: false },
  );
  g.add(core);
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.3, 2)),
    new THREE.LineBasicMaterial({ color: '#7ff3ff', transparent: true, opacity: 0.55 }),
  );
  g.add(wire);
  const nodes = colors.map((c, i) => {
    const y = 0.75 - (1.5 * i) / Math.max(1, colors.length - 1);
    const rr = Math.sqrt(1 - y * y);
    const n = mesh(new THREE.SphereGeometry(0.2, 12, 8), glowMat(c, 3), { cast: false });
    n.position.set(Math.cos(i * 2.4) * rr * 2.32, y * 2.32, Math.sin(i * 2.4) * rr * 2.32);
    g.add(n);
    return n;
  });
  g.userData.spin = (t) => {
    g.rotation.y = t * 0.25;
    wire.rotation.y = -t * 0.08;
  };
  return { group: g, nodes };
}
