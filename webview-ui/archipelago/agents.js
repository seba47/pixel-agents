// The crew: simulated agents (states over time) and their 3D bodies.
import * as THREE from './three.js';

export const STATUS = {
  work: { color: '#4fd1ff', label: 'Working' },
  need: { color: '#ffb020', label: 'Needs you' },
  done: { color: '#6fe08a', label: 'Done' },
  idle: { color: '#a4acd0', label: 'Idle' },
};

export const PROJECTS = {
  'pixel-agents': '#ff6fae',
  'horus-api': '#ffcc4d',
  'horus-web': '#6fe08a',
  scratch: '#b48cff',
};

/** Each script step: [state, what it's doing, seconds]. */
const CREW_DEFS = [
  {
    id: 1,
    name: 'Lead',
    project: 'pixel-agents',
    color: '#ff6fae',
    context: 0.42,
    script: [
      ['work', 'Editing renderer.ts', 10],
      ['work', 'Running npm test', 7],
      ['done', 'Finished — your turn', 8],
      ['work', 'Reading CLAUDE.md', 6],
    ],
  },
  {
    id: 2,
    name: 'Stylist',
    project: 'pixel-agents',
    lead: 1,
    color: '#4fd1ff',
    context: 0.18,
    script: [
      ['work', 'Writing Orb.tsx', 9],
      ['need', 'Wants to run npm install', 12],
      ['work', 'Editing index.css', 7],
      ['idle', 'Idle', 7],
    ],
  },
  {
    id: 3,
    name: 'API',
    project: 'horus-api',
    color: '#ffcc4d',
    context: 0.76,
    script: [
      ['need', 'Wants to git push', 14],
      ['work', 'Editing routes.ts', 8],
      ['work', 'Running migrations', 6],
      ['done', 'Finished — your turn', 7],
    ],
  },
  {
    id: 4,
    name: 'Web',
    project: 'horus-web',
    color: '#6fe08a',
    context: 0.3,
    sub: 'Sub-agent · auditing pages',
    script: [
      ['work', 'Building with Vite', 9],
      ['done', 'Finished — your turn', 8],
      ['idle', 'Idle', 9],
      ['work', 'Fixing layout.tsx', 7],
    ],
  },
  {
    id: 5,
    name: 'Scratch',
    project: 'scratch',
    color: '#b48cff',
    context: 0.55,
    script: [
      ['idle', 'Idle', 8],
      ['work', 'Searching the web', 7],
      ['work', 'Writing notes.md', 8],
      ['done', 'Finished — your turn', 6],
    ],
  },
];

export function makeCrew() {
  return CREW_DEFS.map((d, i) => ({
    ...d,
    step: i % d.script.length,
    left: d.script[i % d.script.length][2] * (0.3 + (0.6 * ((i * 37) % 10)) / 10),
    get state() {
      return this.script[this.step][0];
    },
    get activity() {
      return this.script[this.step][1];
    },
  }));
}
export function stepCrew(crew, dt) {
  const changed = [];
  for (const a of crew) {
    a.left -= dt;
    if (a.left <= 0) {
      a.step = (a.step + 1) % a.script.length;
      a.left = a.script[a.step][2];
      changed.push(a);
    }
  }
  return changed;
}
/** Approve: the agent's wait ends now. */
export function approve(a) {
  if (a.state === 'need') a.left = 0;
}

// ── Bodies ────────────────────────────────────────────────────────────────
const std = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.05, ...o });
function part(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

const BODY_SCALE = 1.35;

export function makeBody(color) {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  root.add(inner);
  const body = part(new THREE.CapsuleGeometry(0.34, 0.42, 8, 18), std(color));
  body.position.y = 0.64;
  inner.add(body);
  const belly = part(new THREE.CapsuleGeometry(0.22, 0.2, 6, 14), std('#f4f1ea'));
  belly.position.set(0, 0.52, 0.17);
  belly.scale.set(1, 1, 0.45);
  inner.add(belly);
  const visor = part(
    new THREE.CapsuleGeometry(0.15, 0.3, 6, 14),
    std('#121428', { roughness: 0.15, metalness: 0.5 }),
  );
  visor.rotation.z = Math.PI / 2;
  visor.position.set(0, 0.9, 0.24);
  visor.scale.set(1, 1, 0.6);
  inner.add(visor);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: '#bff6ff',
    emissive: '#bff6ff',
    emissiveIntensity: 1.6,
  });
  const eyes = [-0.1, 0.1].map((x) => {
    const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.05, 4, 8), eyeMat);
    e.position.set(x, 0.91, 0.335);
    inner.add(e);
    return e;
  });
  const stalk = part(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 6), std('#c9ccd6'));
  stalk.position.set(0, 1.2, 0);
  inner.add(stalk);
  const tipMat = new THREE.MeshStandardMaterial({
    color: '#4fd1ff',
    emissive: '#4fd1ff',
    emissiveIntensity: 2.5,
  });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), tipMat);
  tip.position.set(0, 1.36, 0);
  inner.add(tip);
  const arm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.37, 0.8, 0);
    const a = part(new THREE.CapsuleGeometry(0.075, 0.26, 4, 10), std(color));
    a.position.y = -0.18;
    pivot.add(a);
    inner.add(pivot);
    return pivot;
  };
  const armL = arm(-1);
  const armR = arm(1);
  const foot = (side) => {
    const f = part(new THREE.SphereGeometry(0.12, 12, 8), std('#2a2d40'));
    f.scale.set(1, 0.6, 1.35);
    f.position.set(side * 0.15, 0.07, 0.03);
    root.add(f);
    return f;
  };
  const footL = foot(-1);
  const footR = foot(1);
  const ringMat = new THREE.MeshBasicMaterial({
    color: '#4fd1ff',
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 40), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  root.add(ring);
  // A bit bigger than life-size against the props, so agents read from afar.
  root.scale.setScalar(BODY_SCALE);
  return {
    root,
    inner,
    armL,
    armR,
    footL,
    footR,
    tipMat,
    ringMat,
    ring,
    eyes,
    phase: Math.random() * 6,
  };
}

/**
 * One agent in the world: walks its path, then holds a pose for its state.
 * `pose`: 'work' (typing), 'need' (hop + wave), 'sit', 'lie', 'idle'.
 */
export class Walker {
  constructor(agent, body, world) {
    this.agent = agent;
    this.body = body;
    this.world = world;
    this.path = [];
    this.pose = 'idle';
    this.face = 0;
    this.pos = new THREE.Vector2();
    this.seatY = 0;
  }
  place(x, z, face = 0) {
    this.pos.set(x, z);
    this.face = face;
    this.body.root.rotation.y = face;
  }
  goTo(points, pose, face, seatY = 0) {
    this.path = points.map(([x, z]) => new THREE.Vector2(x, z));
    this.pose = pose;
    this.finalFace = face;
    this.seatY = seatY;
  }
  get moving() {
    return this.path.length > 0;
  }
  update(t, dt) {
    const b = this.body;
    const speed = 2.6;
    if (this.path.length) {
      const target = this.path[0];
      const d = target.clone().sub(this.pos);
      const L = d.length();
      if (L < 0.05) this.path.shift();
      else {
        const step = Math.min(L, speed * dt);
        this.pos.addScaledVector(d.normalize(), step);
        const want = Math.atan2(d.x, d.y);
        this.face = lerpAngle(this.face, want, Math.min(1, dt * 10));
      }
    } else if (this.finalFace !== undefined)
      this.face = lerpAngle(this.face, this.finalFace, Math.min(1, dt * 6));
    const gy = this.world.groundY(this.pos.x, this.pos.y);
    b.root.position.set(this.pos.x, gy, this.pos.y);
    b.root.rotation.y = this.face;
    const st = STATUS[this.agent.state];
    b.tipMat.color.set(st.color);
    b.tipMat.emissive.set(st.color);
    b.ringMat.color.set(st.color);
    // Reset.
    b.inner.position.set(0, 0, 0);
    b.inner.rotation.set(0, 0, 0);
    b.inner.scale.set(1, 1, 1);
    b.armL.rotation.set(0, 0, 0);
    b.armR.rotation.set(0, 0, 0);
    b.footL.position.set(-0.15, 0.07, 0.03);
    b.footR.position.set(0.15, 0.07, 0.03);
    b.ring.visible = true;
    b.ringMat.opacity = 0.35 + Math.sin(t * 4 + b.phase) * 0.15;
    if (this.moving) {
      b.phase += dt * 11;
      const s = Math.sin(b.phase);
      b.inner.position.y = Math.abs(s) * 0.07;
      b.inner.rotation.x = 0.08;
      b.footL.position.z = 0.03 + s * 0.16;
      b.footR.position.z = 0.03 - s * 0.16;
      b.armL.rotation.x = s * 0.7;
      b.armR.rotation.x = -s * 0.7;
      b.tipMat.emissiveIntensity = 2.2;
      return;
    }
    switch (this.pose) {
      case 'work':
        b.inner.position.y = Math.sin(t * 6 + b.phase) * 0.01;
        b.inner.rotation.x = 0.1;
        b.armL.rotation.x = -1.15 + Math.sin(t * 16 + b.phase) * 0.12;
        b.armR.rotation.x = -1.15 + Math.sin(t * 16 + b.phase + 1.7) * 0.12;
        b.tipMat.emissiveIntensity = 2 + Math.sin(t * 8) * 0.8;
        break;
      case 'need': {
        const hop = Math.max(0, Math.sin(t * 4.5 + b.phase));
        b.inner.position.y = hop * 0.22;
        b.armR.rotation.z = 2.6 + Math.sin(t * 9) * 0.35;
        b.tipMat.emissiveIntensity = Math.sin(t * 10) > 0 ? 4 : 0.6;
        b.ringMat.opacity = 0.5 + Math.sin(t * 10) * 0.3;
        break;
      }
      case 'sit':
        b.inner.position.y = -0.24 + this.seatY;
        b.footL.position.set(-0.15, 0.2 + this.seatY, 0.32);
        b.footR.position.set(0.15, 0.2 + this.seatY, 0.32);
        b.armL.rotation.x = -0.5;
        b.armR.rotation.x = -0.5;
        b.inner.rotation.z = Math.sin(t * 1.2 + b.phase) * 0.04;
        b.ring.visible = false;
        b.tipMat.emissiveIntensity = 1.6;
        break;
      case 'lie':
        b.inner.position.set(0, this.seatY + 0.15, 0.4);
        b.inner.rotation.x = -1.35;
        b.footL.position.set(-0.15, this.seatY + 0.22, -0.55);
        b.footR.position.set(0.15, this.seatY + 0.22, -0.55);
        b.ring.visible = false;
        b.tipMat.emissiveIntensity = 0.6;
        break;
      default:
        b.inner.scale.y = 1 + Math.sin(t * 1.6 + b.phase) * 0.02;
        b.inner.rotation.z = Math.sin(t * 0.8 + b.phase) * 0.05;
        b.tipMat.emissiveIntensity = 0.8;
    }
  }
  /** World position of the head, for the floating label. */
  head(out = new THREE.Vector3()) {
    return out
      .copy(this.body.root.position)
      .add(new THREE.Vector3(0, (this.pose === 'lie' ? 1.0 : 1.75) * BODY_SCALE, 0));
  }
}

function lerpAngle(a, b, f) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}
