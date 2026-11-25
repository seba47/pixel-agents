// Agent bodies and how they move. Each Walker follows an agent record that the
// scene keeps up to date from the office's real state (see scene.js).
import * as THREE from './three.js';

export const STATUS = {
  work: { color: '#4fd1ff', label: 'Working' },
  need: { color: '#ffb020', label: 'Needs you' },
  done: { color: '#6fe08a', label: 'Done' },
  idle: { color: '#a4acd0', label: 'Idle' },
};

// ── Bodies ────────────────────────────────────────────────────────────────
const std = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.05, ...o });
function part(geo, material) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

const BODY_SCALE = 1.35;
/** The fishing rod: where the hand holds it, how far it leans out, how long. */
const ROD_BASE = new THREE.Vector3(0.3, 0.55, 0.25);
const ROD_TILT = 0.95;
const ROD_LENGTH = 1.7;
/** Ground this close to sea level is water: a body there stands on its board. */
const WATER_Y = 0.08;
/** How fast a paddler sweeps along its arc (radians of the sine per second). */
const PADDLE_SWEEP_RATE = 0.07;

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
  // Free-time gear, hidden until a pose shows it: a fishing rod held from the
  // right hand, a paddle board under the feet and a paddle held across.
  const rod = new THREE.Group();
  rod.position.copy(ROD_BASE);
  rod.rotation.x = ROD_TILT;
  const pole = part(
    new THREE.CylinderGeometry(0.012, 0.03, ROD_LENGTH, 6).translate(0, ROD_LENGTH / 2, 0),
    std('#7a4b2a'),
  );
  rod.add(pole);
  const reel = part(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), std('#c9ccd6'));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.05, 0.25, 0);
  rod.add(reel);
  rod.visible = false;
  inner.add(rod);
  const line = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 1, 4).translate(0, -0.5, 0),
    new THREE.MeshBasicMaterial({ color: '#f4f1ea' }),
  );
  line.visible = false;
  inner.add(line);
  const bobber = new THREE.Group();
  const bobTop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std('#ff4d4d'));
  const bobBot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), std('#ffffff'));
  bobTop.position.y = 0.04;
  bobBot.position.y = -0.02;
  bobber.add(bobTop, bobBot);
  bobber.visible = false;
  inner.add(bobber);
  const board = part(
    new THREE.CapsuleGeometry(0.3, 1.5, 6, 16),
    std('#ffd36e', { roughness: 0.3 }),
  );
  board.rotation.x = Math.PI / 2;
  board.scale.set(1, 1, 0.16);
  board.position.y = 0.02;
  board.visible = false;
  root.add(board);
  const paddle = new THREE.Group();
  const shaft = part(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), std('#2a2d40'));
  const blade = part(new THREE.BoxGeometry(0.16, 0.36, 0.03), std(color));
  blade.position.y = -0.8;
  paddle.add(shaft, blade);
  paddle.position.set(0, 0.7, 0.3);
  paddle.visible = false;
  inner.add(paddle);
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
    rod,
    line,
    bobber,
    board,
    paddle,
    phase: Math.random() * 6,
  };
}

/**
 * One agent in the world: walks its path, then holds a pose for its state.
 * `pose`: 'work' (typing), 'need' (hop + wave), 'sit', 'lie', 'idle',
 * 'fish' (sitting on the shore with a rod), 'paddle' (on a board, sweeping
 * along an arc off the island: `orbit` = { cx, cz, R, base, sweep }).
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
  goTo(points, pose, face, seatY = 0, orbit = null) {
    this.path = points.map(([x, z]) => new THREE.Vector2(x, z));
    this.pose = pose;
    this.finalFace = face;
    this.seatY = seatY;
    this.orbit = orbit;
    this.orbitT = 0;
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
    } else if (this.pose === 'paddle' && this.orbit) {
      // Back and forth along an arc off the shore, slowly.
      const o = this.orbit;
      this.orbitT += dt * PADDLE_SWEEP_RATE;
      const ang = o.base + o.sweep * Math.sin(this.orbitT);
      this.pos.set(o.cx + Math.cos(ang) * o.R, o.cz + Math.sin(ang) * o.R);
      const dir = Math.cos(this.orbitT) >= 0 ? 1 : -1;
      const want = Math.atan2(-Math.sin(ang) * dir, Math.cos(ang) * dir);
      this.face = lerpAngle(this.face, want, Math.min(1, dt * 2));
    } else if (this.finalFace !== undefined)
      this.face = lerpAngle(this.face, this.finalFace, Math.min(1, dt * 6));
    const ground = this.world.groundY(this.pos.x, this.pos.y);
    // In the water: on the board, riding the swell.
    const afloat = ground < WATER_Y;
    const gy = afloat ? 0.06 + Math.sin(t * 1.3 + b.phase) * 0.05 : ground;
    b.root.position.set(this.pos.x, gy, this.pos.y);
    b.root.rotation.y = this.face;
    b.board.visible = afloat;
    b.paddle.visible = afloat;
    b.rod.visible = false;
    b.line.visible = false;
    b.bobber.visible = false;
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
    b.ring.visible = !afloat;
    b.ringMat.opacity = 0.35 + Math.sin(t * 4 + b.phase) * 0.15;
    if (afloat) {
      // Paddling: both hands on the paddle, a stroke on one side, then the other.
      const stroke = Math.sin(t * 1.8 + b.phase);
      b.paddle.rotation.set(-0.35, 0, stroke * 0.55);
      b.paddle.position.x = stroke * 0.42;
      b.armL.rotation.set(-0.9 + stroke * 0.25, 0, 0);
      b.armR.rotation.set(-0.9 - stroke * 0.25, 0, 0);
      b.inner.rotation.z = stroke * 0.06;
      b.inner.rotation.x = Math.sin(t * 1.3 + b.phase + 0.6) * 0.04;
      b.tipMat.emissiveIntensity = 1;
      return;
    }
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
      case 'fish': {
        // Sitting at the water's edge, rod out, line down to a bobber that
        // now and then gets a nibble.
        b.inner.position.y = -0.24;
        b.footL.position.set(-0.15, 0.2, 0.32);
        b.footR.position.set(0.15, 0.2, 0.32);
        b.armL.rotation.x = -0.7;
        b.armR.rotation.x = -0.95;
        b.ring.visible = false;
        b.tipMat.emissiveIntensity = 0.9;
        const bite = Math.max(0, Math.sin(t * 0.9 + b.phase * 3) - 0.85) / 0.15;
        const twitch = bite * Math.sin(t * 22) * 0.06;
        b.rod.visible = true;
        b.rod.rotation.x = ROD_TILT + bite * 0.12 + twitch;
        const tilt = b.rod.rotation.x;
        const tipY = ROD_BASE.y + Math.cos(tilt) * ROD_LENGTH;
        const tipZ = ROD_BASE.z + Math.sin(tilt) * ROD_LENGTH;
        // Down to the sea (y 0), in the body's units, from where the tip is.
        const sea = gy / BODY_SCALE + b.inner.position.y + tipY - 0.02;
        const drop = Math.max(0.3, sea - bite * 0.08) + Math.sin(t * 1.7 + b.phase) * 0.02;
        b.line.visible = true;
        b.line.position.set(ROD_BASE.x, tipY, tipZ);
        b.line.scale.y = drop;
        b.bobber.visible = true;
        b.bobber.position.set(ROD_BASE.x, tipY - drop, tipZ);
        break;
      }
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
