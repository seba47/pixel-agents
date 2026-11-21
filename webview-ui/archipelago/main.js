// Archipelago mock-up: renderer, camera, the crew, the HUD.
import * as THREE from './three.js';
import { approve, makeBody, makeCrew, STATUS, stepCrew, Walker } from './agents.js';
import { VARIANTS } from './variants.js';
import { World } from './world.js';

const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// ── Renderer ──────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const phone = matchMedia('(max-width: 760px)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, phone ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('#scene').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 1500);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minPolarAngle = 0.45;
controls.maxPolarAngle = 1.38;
controls.minDistance = 14;
controls.maxDistance = 110;

const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new THREE.OutputPass());

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

// ── Camera flights ────────────────────────────────────────────────────────
let flight = null;
/** Narrow (portrait) screens see less sideways: back the camera off to keep the islands in. */
function fitted(pos, target, centre = true) {
  if (camera.aspect >= 1) return { pos: pos.clone(), target: target.clone() };
  // Portrait: no side card to make room for, so centre the islands (+5 x),
  // back off, and look down more steeply so they fill the height.
  const k = Math.min(3, 1.5 / camera.aspect);
  const off = pos.clone().sub(target).multiplyScalar(k);
  off.y *= 1.45;
  const t = target.clone();
  if (centre) t.x += 5;
  return { pos: t.clone().add(off), target: t };
}
function flyTo(pos, target, dur = 1.6, centre = true) {
  ({ pos, target } = fitted(pos, target, centre));
  flight = {
    p0: camera.position.clone(),
    t0: controls.target.clone(),
    p1: pos.clone(),
    t1: target.clone(),
    s: performance.now(),
    dur,
  };
}
function updateFlight() {
  if (!flight) return;
  const k = Math.min(1, (performance.now() - flight.s) / (flight.dur * 1000));
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  camera.position.lerpVectors(flight.p0, flight.p1, e);
  controls.target.lerpVectors(flight.t0, flight.t1, e);
  if (k >= 1) flight = null;
}

// ── The crew and the world ────────────────────────────────────────────────
const crew = makeCrew();
let world = null;
let built = null;
let walkers = [];
let variant = null;
let followId = null;

function load(i, first = false) {
  variant = VARIANTS[i];
  if (world) world.dispose();
  world = new World(scene, variant.pal);
  built = variant.build(world, crew);
  world.finish();
  walkers = crew.map((a) => {
    const w = new Walker(a, makeBody(a.color), world);
    world.root.add(w.body.root);
    const s = built.spots[a.id][a.state];
    w.place(s.x, s.z, s.face);
    w.goTo([], s.pose, s.face, s.seatY ?? 0);
    w.spot = s;
    return w;
  });
  bloom.strength = variant.bloom.strength;
  bloom.radius = variant.bloom.radius;
  bloom.threshold = variant.bloom.threshold;
  document.body.classList.toggle('light', variant.key === 'day');
  followId = null;
  if (phone && first) $('#info').classList.add('min');
  if (first) {
    const f = fitted(variant.camera.pos, variant.camera.target);
    camera.position.copy(f.pos).add(new THREE.Vector3(0, 10, 18));
    controls.target.copy(f.target);
  }
  flyTo(variant.camera.pos, variant.camera.target, first ? 2.4 : 1.2);
  buildLabels();
  renderInfo();
  [...$('#switch').children].forEach((b, k) => b.classList.toggle('on', k === i));
  try {
    localStorage.setItem('archipelago.variant', String(i));
  } catch {}
}

function onStateChange(a) {
  const w = walkers.find((x) => x.agent === a);
  const to = built.spots[a.id][a.state];
  const pts = built.route(w.spot, to);
  w.goTo(pts, to.pose, to.face, to.seatY ?? 0);
  w.spot = to;
}

// ── HUD ───────────────────────────────────────────────────────────────────
VARIANTS.forEach((v, i) => {
  const b = el('button', '', v.name);
  b.title = v.title;
  b.onclick = () => load(i);
  $('#switch').appendChild(b);
});

function renderInfo() {
  const info = $('#info');
  const min = info.classList.contains('min');
  info.innerHTML = `
    <button class="collapse" title="Ocultar">${min ? '+' : '–'}</button>
    <div class="eyebrow">Variante ${VARIANTS.indexOf(variant) + 1} de ${VARIANTS.length} · ${variant.name}</div>
    <h2>${variant.title}</h2>
    <p class="tagline">${variant.tagline}</p>
    ${variant.info}`;
  info.querySelector('.collapse').onclick = () => {
    info.classList.toggle('min');
    renderInfo();
  };
}

const NEED_DETAIL = {
  'Wants to run npm install': ['Quiere ejecutar', 'npm install'],
  'Wants to git push': ['Quiere ejecutar', 'git push origin main'],
};

let lastNeeds = '';
function renderNeeds() {
  const needs = crew.filter((a) => a.state === 'need');
  const key = needs.map((a) => a.id).join(',');
  if (key === lastNeeds) return;
  lastNeeds = key;
  const box = $('#needs');
  box.innerHTML = '';
  for (const a of needs) {
    const [verb, cmd] = NEED_DETAIL[a.activity] ?? ['Necesita tu respuesta', ''];
    const card = el(
      'div',
      'glass need-card',
      `<div class="who"><span class="avatar" style="background:${a.color}"></span><div>${a.name}<small>${a.project}</small></div></div>
       <div class="what">${verb} ${cmd ? `<code>${cmd}</code>` : ''}</div>
       <div class="actions"><button class="btn primary">Aprobar</button><button class="btn">Abrir terminal</button></div>`,
    );
    card.querySelector('.primary').onclick = () => approve(a);
    card.querySelectorAll('.btn')[1].onclick = () => focus(a.id);
    box.appendChild(card);
  }
}

const dockCards = new Map();
crew.forEach((a) => {
  const c = el(
    'div',
    'crew',
    `<div class="row"><span class="avatar" style="background:${a.color}"><span class="st"></span></span>
       <div><div class="name">${a.name}</div><div class="proj">${a.project}</div></div></div>
     <div class="doing"></div>
     <div class="bar" title="Contexto usado"><i style="width:${Math.round(a.context * 100)}%;background:${a.context > 0.66 ? '#ff6a5a' : a.context > 0.33 ? '#ffcc4d' : '#6fe08a'}"></i></div>`,
  );
  c.onclick = () => focus(a.id);
  $('#dock').appendChild(c);
  dockCards.set(a.id, c);
});

function renderDock() {
  for (const a of crew) {
    const c = dockCards.get(a.id);
    c.querySelector('.st').style.background = STATUS[a.state].color;
    c.querySelector('.doing').textContent = `${STATUS[a.state].label} · ${a.activity}`;
    c.classList.toggle('focus', followId === a.id);
  }
  const n = (s) => crew.filter((a) => a.state === s).length;
  const need = n('need');
  $('#summary').innerHTML = `
    <div class="chip glass"><span class="dot" style="background:var(--work)"></span>${n('work')} trabajando</div>
    <div class="chip glass"><span class="dot" style="background:var(--done)"></span>${n('done')} terminaron</div>
    ${need ? `<div class="chip glass need"><span class="dot" style="background:#2a1a00"></span>${need} te ${need > 1 ? 'necesitan' : 'necesita'}</div>` : ''}`;
}

function focus(id) {
  followId = followId === id ? null : id;
  if (followId === null) {
    flyTo(variant.camera.pos, variant.camera.target, 1.2);
    return;
  }
  const w = walkers.find((x) => x.agent.id === id);
  const p = w.body.root.position;
  flyTo(new THREE.Vector3(p.x + 4, p.y + 11, p.z + 16), p.clone(), 1.2, false);
}

// In-world labels.
let labelEls = [];
function buildLabels() {
  const box = $('#labels');
  box.innerHTML = '';
  labelEls = [];
  for (const L of built.labels) {
    const e = el(
      'div',
      'label place',
      `${L.text}${L.sub ? `<small style="color:${L.accent ?? 'inherit'}">${L.sub}</small>` : ''}<div class="rule"></div>`,
    );
    box.appendChild(e);
    labelEls.push({ e, pos: L.pos });
  }
  for (const w of walkers) {
    const e = el(
      'div',
      'label agent-tag',
      `<span class="face" style="background:${w.agent.color}"></span><span class="nm"></span><span class="act"></span>`,
    );
    box.appendChild(e);
    labelEls.push({ e, walker: w });
  }
}
const v3 = new THREE.Vector3();
function placeLabels() {
  const W = innerWidth;
  const H = innerHeight;
  for (const L of labelEls) {
    if (L.walker) {
      L.walker.head(v3);
      const a = L.walker.agent;
      L.e.classList.toggle('need', a.state === 'need');
      L.e.querySelector('.nm').textContent = a.name;
      L.e.querySelector('.act').textContent = a.state === 'idle' ? 'zzz' : a.activity;
      L.e.querySelector('.face').style.background = a.color;
      L.e.style.borderLeft = a.state === 'need' ? '' : `3px solid ${STATUS[a.state].color}`;
    } else v3.copy(L.pos);
    v3.project(camera);
    const vis = v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1;
    L.e.style.display = vis ? '' : 'none';
    if (vis) {
      L.e.style.left = `${((v3.x + 1) / 2) * W}px`;
      L.e.style.top = `${((1 - v3.y) / 2) * H}px`;
    }
  }
}

// ── Loop ──────────────────────────────────────────────────────────────────
let saved = 0;
try {
  saved = Number(localStorage.getItem('archipelago.variant')) || 0;
} catch {}
load(Math.min(saved, VARIANTS.length - 1), true);
addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= VARIANTS.length) load(n - 1);
});

const clock = new THREE.Clock();
let hudTimer = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  for (const a of stepCrew(crew, dt)) onStateChange(a);
  world.update(t, dt);
  for (const w of walkers) w.update(t, dt);
  if (followId !== null && !flight) {
    const w = walkers.find((x) => x.agent.id === followId);
    controls.target.lerp(w.body.root.position, 0.05);
  }
  updateFlight();
  controls.update();
  composer.render();
  placeLabels();
  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.25;
    renderDock();
    renderNeeds();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(() => {
  $('#loading').style.opacity = '0';
  setTimeout(() => $('#loading').remove(), 700);
  frame();
});
