// The archipelago view's engine: renderer, camera, world, agents, labels.
// The React side hands it `getCrew()` (read every frame) and `onSelect(id)`.
import { thoughtOf } from './activity.js';
import { makeBody, STATUS, Walker } from './agents.js';
import { buildIslands, DAY_PAL } from './islands.js';
import * as THREE from './three.js';
import { World } from './world.js';

const FALLBACK_PROJECT = 'office';
/** Past this camera distance clouds show their emoji only, so the view doesn't clutter. */
const CLOUD_TEXT_MAX_DISTANCE = 70;
const MOVE_KEYS = new Set([
  'w',
  'a',
  's',
  'd',
  'q',
  'e',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export class ArchipelagoScene {
  constructor(container, { getCrew, onSelect, onIslands, themeOf }) {
    this.themeOf = themeOf ?? (() => 'beach');
    this.container = container;
    this.getCrew = getCrew;
    this.onSelect = onSelect;
    this.onIslands = onIslands;
    // The user moved the camera themself: stop pulling it back to the followed agent.
    this.free = false;
    this.keys = new Set();
    this.members = new Map();
    this.projectOrder = [];
    this.signature = '';
    this.followId = null;
    this.flight = null;
    this.disposed = false;

    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.domElement.className = 'archi-canvas';
    container.appendChild(r.domElement);
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.5, 1500);
    const c = new THREE.OrbitControls(this.camera, r.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.06;
    c.minPolarAngle = 0.45;
    c.maxPolarAngle = 1.38;
    c.minDistance = 8;
    c.maxDistance = 220;
    // Like a map: drag moves across the sea, right-drag (two fingers) turns,
    // the wheel (pinch) zooms toward the cursor.
    c.screenSpacePanning = false;
    c.zoomToCursor = true;
    c.panSpeed = 1.2;
    c.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.onControlStart = () => {
      this.flight = null;
      this.free = true;
    };
    c.addEventListener('start', this.onControlStart);
    this.controls = c;
    this.composer = new THREE.EffectComposer(r);
    this.composer.addPass(new THREE.RenderPass(this.scene, this.camera));
    this.composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.4, 0.95));
    this.composer.addPass(new THREE.OutputPass());

    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'archi-labels';
    container.appendChild(this.labelLayer);

    this.resize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      r.setSize(w, h);
      this.composer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    this.ro = new ResizeObserver(this.resize);
    this.ro.observe(container);
    this.resize();

    // A tap (not a drag) on an agent selects it.
    let down = null;
    // The map takes the keyboard when pressed (out of a terminal, say), so its keys work.
    r.domElement.tabIndex = -1;
    this.onDown = (e) => {
      down = { x: e.clientX, y: e.clientY };
      r.domElement.focus({ preventScroll: true });
    };
    this.onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const id = this.pick(e.clientX, e.clientY);
      if (id === null) return;
      this.focusAgent(id);
      this.onSelect(id);
    };
    // A double click on the sea or an island flies there.
    this.onDouble = (e) => {
      const p = this.groundAt(e.clientX, e.clientY);
      if (p) this.focusPoint(p, 0.75);
    };
    r.domElement.addEventListener('pointerdown', this.onDown);
    r.domElement.addEventListener('pointerup', this.onUp);
    r.domElement.addEventListener('dblclick', this.onDouble);
    // Keys: WASD / arrows move, Q E turn, 1–9 an island, 0 everything. Never
    // while typing (a terminal, a field): those keys are theirs.
    const typing = () => {
      const a = document.activeElement;
      return (
        !!a &&
        (a.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) ||
          !!a.closest?.('.xterm'))
      );
    };
    this.onKeyDown = (e) => {
      if (typing() || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (MOVE_KEYS.has(k)) {
        this.keys.add(k);
        this.flight = null;
        this.free = true;
        e.preventDefault();
      } else if (/^[1-9]$/.test(k)) this.goIsland(Number(k) - 1);
      else if (k === '0' || k === 'Home') this.showAll();
    };
    this.onKeyUp = (e) => this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    this.onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.clock = new THREE.Clock();
    this.loop = () => {
      if (this.disposed) return;
      this.frame();
      this.raf = requestAnimationFrame(this.loop);
    };
    this.raf = requestAnimationFrame(this.loop);
    // Dev only: reach the scene from the console.
    if (import.meta.env?.DEV) window.__archipelago = this;
  }

  // ── World ───────────────────────────────────────────────────────────────
  rebuild(projects, keepView = false) {
    for (const m of this.members.values()) m.walker = null;
    if (this.world) this.world.dispose();
    this.world = new World(this.scene, DAY_PAL);
    const crewOf = (p) =>
      [...this.members.values()].filter((m) => m.record.project === p).map((m) => m.record);
    this.built = buildIslands(this.world, projects, crewOf, this.themeOf);
    this.world.finish();
    this.buildIslandLabels();
    this.onIslands?.(this.built.islands.map((i) => i.name));
    if (!this.everFramed || (!this.free && !keepView)) this.frameOverview(!this.everFramed);
    this.everFramed = true;
  }

  // ── Moving around ───────────────────────────────────────────────────────
  /** Everything in view again. */
  showAll() {
    this.free = false;
    this.frameOverview(false);
  }

  /** Fly to the i-th island (the order the switcher lists them in). */
  goIsland(i) {
    const isl = this.built?.islands[i];
    if (!isl) return;
    const d = isl.r * 3.1;
    this.flyKeepingView(isl.center.clone(), d, 1.1);
  }

  /** Fly to an agent, close up. */
  focusAgent(id) {
    const m = this.members.get(id);
    if (!m?.walker) return;
    this.free = false;
    const p = m.walker.body.root.position;
    this.flyTo(new THREE.Vector3(p.x + 4, p.y + 11, p.z + 16), p.clone(), 1.2);
  }

  /** Look at a point from where the camera is turned now, `k` times as far. */
  focusPoint(p, k) {
    const off = this.camera.position.clone().sub(this.controls.target);
    this.flyKeepingView(p, Math.max(this.controls.minDistance, off.length() * k), 0.8);
  }

  /** Fly so the camera looks at `target` from `dist` away, keeping its heading. */
  flyKeepingView(target, dist, dur) {
    this.free = true;
    const off = this.camera.position.clone().sub(this.controls.target);
    if (off.lengthSq() < 1e-6) off.set(0, 0.4, 1);
    this.flyTo(target.clone().add(off.setLength(dist)), target, dur);
  }

  /** Where a screen point meets the sea level (y = 0), if it does. */
  groundAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit) ? hit : null;
  }

  /** Held keys: slide across the map (relative to the heading) or turn. */
  steer(dt) {
    if (this.keys.size === 0) return;
    const c = this.controls;
    const off = this.camera.position.clone().sub(c.target);
    const fwd = new THREE.Vector3(-off.x, 0, -off.z).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3();
    const has = (...k) => k.some((x) => this.keys.has(x));
    if (has('w', 'ArrowUp')) move.add(fwd);
    if (has('s', 'ArrowDown')) move.sub(fwd);
    if (has('d', 'ArrowRight')) move.add(right);
    if (has('a', 'ArrowLeft')) move.sub(right);
    if (move.lengthSq() > 0) {
      // Faster when far out, so crossing the map takes the same time at any zoom.
      move.setLength(dt * Math.max(10, off.length() * 0.9));
      c.target.add(move);
      this.camera.position.add(move);
    }
    const turn = (has('e') ? 1 : 0) - (has('q') ? 1 : 0);
    if (turn) {
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), turn * dt * 1.6);
      this.camera.position.copy(c.target).add(off);
    }
  }

  /** Keep the view over the archipelago: the target can't leave the map. */
  clampToMap() {
    if (!this.built) return;
    const { center, span } = this.built;
    const c = this.controls;
    const limit = span * 1.25 + 24;
    const dx = c.target.x - center.x;
    const dz = c.target.z - center.z;
    const d = Math.hypot(dx, dz);
    if (d <= limit) return;
    const back = new THREE.Vector3(dx, 0, dz).multiplyScalar(1 - limit / d);
    c.target.sub(back);
    this.camera.position.sub(back);
  }

  overview() {
    const { center, span } = this.built;
    const d = Math.max(34, span * 1.55);
    let pos = center.clone().add(new THREE.Vector3(-0.08 * d, 0.36 * d, 0.93 * d));
    let target = center.clone().add(new THREE.Vector3(0, -1, -0.08 * d));
    if (this.camera.aspect < 1) {
      const k = Math.min(3, 1.5 / this.camera.aspect);
      const off = pos.clone().sub(target).multiplyScalar(k);
      off.y *= 1.45;
      pos = target.clone().add(off);
    }
    return { pos, target };
  }

  frameOverview(jump) {
    const { pos, target } = this.overview();
    if (jump) {
      this.camera.position.copy(pos).add(new THREE.Vector3(0, 10, 18));
      this.controls.target.copy(target);
    }
    this.flyTo(pos, target, jump ? 2.2 : 1.2);
  }

  flyTo(pos, target, dur) {
    this.flight = {
      p0: this.camera.position.clone(),
      t0: this.controls.target.clone(),
      p1: pos,
      t1: target,
      s: performance.now(),
      dur,
    };
  }

  // ── Crew ────────────────────────────────────────────────────────────────
  sync() {
    const crew = this.getCrew();
    const projects = [...new Set(crew.map((a) => a.project || FALLBACK_PROJECT))];
    // Keep islands where they were: new projects append, gone ones drop.
    this.projectOrder = this.projectOrder.filter((p) => projects.includes(p));
    for (const p of projects) if (!this.projectOrder.includes(p)) this.projectOrder.push(p);
    const order = this.projectOrder.length ? this.projectOrder : [FALLBACK_PROJECT];
    // A style change rebuilds too, but keeps the camera where it is.
    const sig = order.map((p) => `${p}=${this.themeOf(p)}`).join('\n');
    if (sig !== this.signature) {
      const restyled = order.join('\n') === this.projectsSig;
      if (!restyled) this.free = false;
      this.projectsSig = order.join('\n');
      this.signature = sig;
      this.rebuild(order, restyled);
    }
    // Slots: each agent's index among its island's agents, by id.
    const seen = new Set();
    const byProject = new Map();
    // Main agents first (by id), then Sub-agents (negative ids), so a parent
    // keeps its desk when its helpers arrive.
    const rank = (a) => (a.id < 0 ? 1e9 - a.id : a.id);
    for (const a of [...crew].sort((x, y) => rank(x) - rank(y))) {
      const p = a.project || FALLBACK_PROJECT;
      const slot = byProject.get(p) ?? 0;
      byProject.set(p, slot + 1);
      seen.add(a.id);
      let m = this.members.get(a.id);
      if (!m) {
        m = { record: { ...a, project: p, slot }, walker: null, placed: null };
        this.members.set(a.id, m);
      }
      const prev = m.record;
      m.record = { ...a, project: p, slot };
      if (!m.walker) {
        m.walker = new Walker(m.record, makeBody(a.color), this.world);
        if (a.parentId !== null) m.walker.body.root.scale.multiplyScalar(0.78);
        this.world.root.add(m.walker.body.root);
        const s = this.built.spotFor(p, slot, a.state, a);
        m.walker.place(s.x, s.z, s.face);
        m.walker.goTo([], s.pose, s.face, s.seatY ?? 0, s.orbit);
        m.placed = `${p}|${slot}|${a.state}`;
        m.label ??= this.makeAgentLabel();
        m.cloud ??= this.makeCloud();
      }
      m.walker.agent = m.record;
      const key = `${p}|${slot}|${a.state}`;
      if (key !== m.placed || prev.color !== a.color) {
        m.placed = key;
        const s = this.built.spotFor(p, slot, a.state, a);
        // Into the water from the shore, not across the island's shelf.
        const path = s.via ? [s.via, [s.x, s.z]] : [[s.x, s.z]];
        m.walker.goTo(path, s.pose, s.face, s.seatY ?? 0, s.orbit);
      }
    }
    for (const [id, m] of this.members) {
      if (seen.has(id)) continue;
      if (m.walker) this.world.root.remove(m.walker.body.root);
      m.label?.remove();
      m.cloud?.remove();
      this.members.delete(id);
    }
    // Follow the office's selected agent.
    const follow = crew.find((a) => a.followed)?.id ?? null;
    if (follow !== this.followId) {
      this.followId = follow;
      const m = follow !== null ? this.members.get(follow) : null;
      if (m?.walker) this.focusAgent(follow);
      else if (!this.free) this.frameOverview(false);
    }
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const roots = [...this.members.entries()].filter(([, m]) => m.walker);
    const hits = ray.intersectObjects(
      roots.map(([, m]) => m.walker.body.root),
      true,
    );
    for (const h of hits)
      for (const [id, m] of roots) {
        let o = h.object;
        while (o) {
          if (o === m.walker.body.root) return id;
          o = o.parent;
        }
      }
    return null;
  }

  // ── Labels ──────────────────────────────────────────────────────────────
  buildIslandLabels() {
    for (const e of this.islandLabels ?? []) e.el.remove();
    this.islandLabels = this.built.labels.map((L, i) => {
      const el = document.createElement('div');
      el.className = 'archi-label archi-place';
      el.title = 'Go to this island';
      el.addEventListener('click', () => this.goIsland(i));
      el.textContent = L.text;
      const rule = document.createElement('div');
      rule.className = 'archi-rule';
      el.appendChild(rule);
      this.labelLayer.appendChild(el);
      return { el, pos: L.pos };
    });
  }

  makeAgentLabel() {
    const el = document.createElement('div');
    el.className = 'archi-label archi-tag';
    el.innerHTML =
      '<span class="archi-face"></span><span class="archi-name"></span><span class="archi-act"></span>';
    this.labelLayer.appendChild(el);
    return el;
  }

  /** The thought cloud over an agent's tag: an emoji and what it's doing. */
  makeCloud() {
    const el = document.createElement('div');
    el.className = 'archi-label archi-cloud';
    el.innerHTML =
      '<span class="archi-cloud-body"><span class="archi-cloud-emoji"></span><span class="archi-cloud-text"></span></span><i class="archi-cloud-dot"></i><i class="archi-cloud-dot archi-cloud-dot-sm"></i>';
    this.labelLayer.appendChild(el);
    return el;
  }

  /** Fills a cloud; a new emoji pops in. Far out, only the emoji shows. */
  fillCloud(m, far) {
    const th = thoughtOf(m.record, m.walker?.pose);
    const el = m.cloud;
    const key = `${th.emoji}|${th.text}|${far}`;
    if (el.dataset.key === key) return th;
    const emoji = el.querySelector('.archi-cloud-emoji');
    if (emoji.textContent !== th.emoji) {
      emoji.textContent = th.emoji;
      el.classList.remove('archi-cloud-pop');
      void el.offsetWidth; // restart the pop
      el.classList.add('archi-cloud-pop');
    }
    el.querySelector('.archi-cloud-text').textContent = far ? '' : th.text;
    el.classList.toggle('archi-cloud-need', m.record.state === 'need');
    el.classList.toggle('archi-cloud-rest', !th.text || far);
    el.dataset.key = key;
    return th;
  }

  placeLabel(el, world) {
    const v = world.clone().project(this.camera);
    const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    el.hidden = !vis;
    if (!vis) return;
    el.style.left = `${((v.x + 1) / 2) * this.container.clientWidth}px`;
    el.style.top = `${((1 - v.y) / 2) * this.container.clientHeight}px`;
  }

  // ── Frame ───────────────────────────────────────────────────────────────
  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.sync();
    this.world.update(t, dt);
    for (const m of this.members.values()) m.walker?.update(t, dt);
    if (this.flight) {
      const f = this.flight;
      const k = Math.min(1, (performance.now() - f.s) / (f.dur * 1000));
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(f.p0, f.p1, e);
      this.controls.target.lerpVectors(f.t0, f.t1, e);
      if (k >= 1) this.flight = null;
    } else if (this.followId !== null && !this.free) {
      const m = this.members.get(this.followId);
      if (m?.walker) this.controls.target.lerp(m.walker.body.root.position, 0.05);
    }
    this.steer(dt);
    this.clampToMap();
    this.controls.update();
    // Haze starts past the islands in view and moves with the camera: far
    // out, the archipelago keeps its colours; only the horizon fades.
    const away = this.camera.position.distanceTo(this.controls.target);
    this.world.setFog(away + (this.built?.span ?? 30) * 0.6, away + 300);
    this.fadePalms(dt);
    this.composer.render();
    for (const L of this.islandLabels) this.placeLabel(L.el, L.pos);
    const head = new THREE.Vector3();
    const far = away > CLOUD_TEXT_MAX_DISTANCE;
    for (const m of this.members.values()) {
      if (!m.walker || !m.label) continue;
      const a = m.record;
      const th = m.cloud ? this.fillCloud(m, far) : null;
      m.label.classList.toggle('archi-need', a.state === 'need');
      m.label.classList.toggle('archi-unread', !!a.unread);
      m.label.querySelector('.archi-face').style.background = a.color;
      m.label.querySelector('.archi-name').textContent = a.name;
      // The cloud says what it's doing; the tag keeps only what the cloud doesn't.
      m.label.querySelector('.archi-act').textContent =
        a.state === 'idle' || (th?.text && !far) ? '' : a.activity;
      m.label.style.borderLeftColor = a.state === 'need' ? 'transparent' : STATUS[a.state].color;
      m.walker.head(head);
      this.placeLabel(m.label, head);
      if (m.cloud) this.placeLabel(m.cloud, head);
    }
  }

  /**
   * A palm between the camera and an agent turns see-through, so agents are
   * never hidden; it comes back once it no longer covers anyone.
   */
  fadePalms(dt) {
    const palms = this.world.palms ?? [];
    if (!palms.length) return;
    const cam = this.camera.position;
    // Sight lines from the camera to each agent's middle.
    const lines = [];
    for (const m of this.members.values()) {
      if (!m.walker) continue;
      const feet = m.walker.body.root.position;
      lines.push(feet.clone().lerp(m.walker.head(new THREE.Vector3()), 0.5));
    }
    const seg = new THREE.Line3();
    const near = new THREE.Vector3();
    const probe = new THREE.Vector3();
    for (const palm of palms) {
      const base = palm.group.position;
      let hide = false;
      for (const mid of lines) {
        seg.set(cam, mid);
        // The crown (wide) and two points up the trunk (narrow).
        for (const [h, radius] of [
          [3.9, 2.4],
          [2.4, 0.9],
          [1.0, 0.7],
        ]) {
          probe.set(base.x, base.y + h, base.z);
          seg.closestPointToPoint(probe, true, near);
          // Only in front of the agent, not behind it.
          if (near.distanceTo(probe) < radius && near.distanceTo(mid) > 0.8) {
            hide = true;
            break;
          }
        }
        if (hide) break;
      }
      const target = hide ? 0.25 : 1;
      palm.opacity += (target - palm.opacity) * Math.min(1, dt * 8);
      const transparent = palm.opacity < 0.98;
      for (const mat of palm.mats) {
        if (mat.transparent !== transparent) {
          mat.transparent = transparent;
          mat.needsUpdate = true;
        }
        mat.opacity = palm.opacity;
        mat.depthWrite = !transparent;
      }
    }
  }

  zoomBy(f) {
    const c = this.controls;
    const off = this.camera.position.clone().sub(c.target);
    const d = Math.min(c.maxDistance, Math.max(c.minDistance, off.length() * f));
    this.flight = null;
    this.free = true;
    this.flyTo(c.target.clone().add(off.setLength(d)), c.target.clone(), 0.35);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    this.renderer.domElement.removeEventListener('dblclick', this.onDouble);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.controls.removeEventListener('start', this.onControlStart);
    this.controls.dispose();
    if (this.world) this.world.dispose();
    this.composer.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelLayer.remove();
  }
}
